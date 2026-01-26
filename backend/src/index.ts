import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ocrImage, cleanupOCR } from "./ocr.js";
import { parseQuestion, type ParsedQuestion } from "./parser.js";
import { tagQuestion, type AWSTags } from "./awsTagger.js";
import { generateSummary, generateHeatmapData, type QuestionAnalysis } from "./analyzer.js";

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'none'}...`);
  next();
});

// CORS configuration with detailed logging
app.use(cors({
  origin: (origin, callback) => {
    console.log(`   CORS: Request from origin: ${origin || 'none (same-origin)'}`);
    // Allow all origins for local development
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type']
}));

// Explicit OPTIONS handler for CORS preflight (required for FormData uploads)
app.options('*', (req, res) => {
  console.log('   CORS: Preflight OPTIONS request');
  console.log(`   Requested method: ${req.headers['access-control-request-method']}`);
  console.log(`   Requested headers: ${req.headers['access-control-request-headers']}`);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  res.sendStatus(200);
});

// Explicit OPTIONS handler for upload endpoint
app.options('/api/ocr/upload', (req, res) => {
  console.log('   CORS: Preflight OPTIONS for /api/ocr/upload');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

app.use(express.json({ limit: '100mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // Increase URL-encoded payload limit

// Configure multer with file size limits
const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    fieldSize: 10 * 1024 * 1024  // 10MB max field size
  }
});

const EXTRACT_DIR = path.join(__dirname, "..", "extracted");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const RESULTS_DIR = path.join(__dirname, "..", "results");

// Ensure directories exist
[EXTRACT_DIR, UPLOADS_DIR, RESULTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Health check endpoint with detailed info
 */
app.get("/api/health", (req, res) => {
  console.log('   ✅ Health check successful');
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    clarifaiConfigured: !!process.env.FitnessOnePAT,
    server: {
      port: process.env.PORT || 4000,
      nodeVersion: process.version,
      platform: process.platform
    },
    request: {
      origin: req.headers.origin || 'none',
      userAgent: req.headers['user-agent'] || 'none'
    }
  });
});

/**
 * Main OCR upload endpoint with full intelligence features
 */
app.post("/api/ocr/upload", upload.single("zip"), async (req, res) => {
  try {
    console.log('   📤 Upload request received');
    console.log(`   Content-Type: ${req.headers['content-type']}`);
    console.log(`   Content-Length: ${req.headers['content-length']} bytes`);
    console.log(`   File field: ${req.file ? 'present' : 'missing'}`);
    console.log(`   File name: ${req.file ? req.file.originalname : 'none'}`);
    console.log(`   File size: ${req.file ? req.file.size : 0} bytes`);
    console.log(`   File path: ${req.file ? req.file.path : 'none'}`);
    
    const zipPath = req.file?.path;
    if (!zipPath) {
      console.error('   ❌ No file uploaded');
      console.error('   Request body keys:', Object.keys(req.body));
      console.error('   Multer error:', (req as any).multerError);
      return res.status(400).json({ error: "No zip uploaded" });
    }

    console.log("📦 Processing uploaded ZIP file...");

    // Clean extraction directory
    if (fs.existsSync(EXTRACT_DIR)) {
      fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });

    // Extract ZIP
    console.log("📂 Extracting files...");
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: EXTRACT_DIR }))
      .promise();

    // Get all image files (including nested directories)
    const imageFiles = getAllImageFiles(EXTRACT_DIR);
    console.log(`🖼️  Found ${imageFiles.length} images`);

    if (imageFiles.length === 0) {
      return res.status(400).json({ 
        error: "No image files found in ZIP",
        hint: "Make sure your ZIP contains .png, .jpg, .jpeg, or .webp files"
      });
    }

    const analyses: QuestionAnalysis[] = [];

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const filePath = imageFiles[i];
      const fileName = path.basename(filePath);
      
      console.log(`🔍 OCR processing [${i + 1}/${imageFiles.length}]: ${fileName}`);

      try {
        // Read and encode image
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString("base64");

        // Perform OCR
        const extractedText = await ocrImage(base64);

        // Parse question structure
        const parsed = parseQuestion(extractedText);

        // Tag with AWS services and domains
        const tags = tagQuestion(extractedText);

        // Determine if answer was correct
        const isCorrect = parsed.yourAnswer === parsed.correctAnswer;

        analyses.push({
          file: fileName,
          parsed,
          tags,
          isCorrect
        });

        console.log(`✅ Processed: ${fileName} ${isCorrect ? "✓" : "✗"}`);
      } catch (error: any) {
        console.error(`❌ Failed to process ${fileName}:`, error.message);
        
        // Add failed entry
        analyses.push({
          file: fileName,
          parsed: {
            question: "",
            options: [],
            yourAnswer: "",
            correctAnswer: "",
            explanation: "",
            rawText: `Error: ${error.message}`
          },
          tags: { services: [], domains: [], keywords: [] },
          isCorrect: false
        });
      }
    }

    // Generate comprehensive summary
    console.log("📊 Generating study summary...");
    const summary = generateSummary(analyses);
    const heatmap = generateHeatmapData(summary);

    // Prepare response data
    const responseData = {
      success: true,
      processedCount: analyses.length,
      timestamp: new Date().toISOString(),
      
      // Individual question analyses
      questions: analyses,
      
      // Intelligent summary
      summary,
      
      // Heatmap visualization data
      heatmap,
      
      // Quick stats
      quickStats: {
        accuracy: `${summary.accuracy.toFixed(1)}%`,
        correct: summary.correctCount,
        incorrect: summary.incorrectCount,
        totalServices: Object.keys(summary.serviceBreakdown).length,
        weakAreaCount: summary.weakAreas.length
      }
    };

    // Save results to file for later viewing
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(RESULTS_DIR, `results-${timestamp}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(responseData, null, 2));
    console.log(`💾 Results saved to: ${resultsFile}`);

    // Cleanup OCR worker and uploaded file
    await cleanupOCR();
    fs.unlinkSync(zipPath);

    console.log("✨ Processing complete!");

    res.json(responseData);

  } catch (err: any) {
    console.error("❌ Server error:", err);
    res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/**
 * Get all image files recursively from a directory
 */
function getAllImageFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common non-image directories
        if (!entry.name.startsWith('.') && !entry.name.startsWith('__')) {
          traverse(fullPath);
        }
      } else if (entry.isFile()) {
        // Check if it's an image file
        if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files.sort(); // Sort for consistent ordering
}

/**
 * Get latest results endpoint
 */
app.get("/api/results/latest", (req, res) => {
  try {
    // Find the most recent results file
    if (!fs.existsSync(RESULTS_DIR)) {
      return res.status(404).json({ error: "No results found. Upload a ZIP file first." });
    }

    const files = fs.readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith('results-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(RESULTS_DIR, f),
        time: fs.statSync(path.join(RESULTS_DIR, f)).mtime
      }))
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    if (files.length === 0) {
      return res.status(404).json({ error: "No results found. Upload a ZIP file first." });
    }

    const latestFile = files[0];
    const results = JSON.parse(fs.readFileSync(latestFile.path, 'utf-8'));

    res.json({
      success: true,
      file: latestFile.name,
      timestamp: latestFile.time.toISOString(),
      ...results
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List all results files
 */
app.get("/api/results/list", (req, res) => {
  try {
    if (!fs.existsSync(RESULTS_DIR)) {
      return res.json({ success: true, files: [] });
    }

    const files = fs.readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith('results-') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(RESULTS_DIR, f);
        const stats = fs.statSync(filePath);
        return {
          name: f,
          timestamp: stats.mtime.toISOString(),
          size: stats.size
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({
      success: true,
      count: files.length,
      files
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Export endpoint - for ChatGPT paste
 */
app.post("/api/export/chatgpt", express.json(), (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid questions data" });
    }

    // Format for ChatGPT analysis
    let output = "# AWS DVA-C02 Exam Review\n\n";
    output += `Total Questions: ${questions.length}\n\n`;
    output += "---\n\n";

    questions.forEach((q: QuestionAnalysis, idx: number) => {
      output += `## Question ${idx + 1} (${q.isCorrect ? "✓ CORRECT" : "✗ INCORRECT"})\n\n`;
      output += `**File**: ${q.file}\n\n`;
      
      if (q.parsed.question) {
        output += `**Question**: ${q.parsed.question}\n\n`;
      }
      
      if (q.parsed.options.length > 0) {
        output += "**Options**:\n";
        q.parsed.options.forEach(opt => {
          output += `- ${opt}\n`;
        });
        output += "\n";
      }
      
      output += `**Your Answer**: ${q.parsed.yourAnswer || "N/A"}\n`;
      output += `**Correct Answer**: ${q.parsed.correctAnswer || "N/A"}\n\n`;
      
      if (q.parsed.explanation) {
        output += `**Explanation**: ${q.parsed.explanation}\n\n`;
      }
      
      if (q.tags.services.length > 0) {
        output += `**AWS Services**: ${q.tags.services.join(", ")}\n`;
      }
      
      if (q.tags.domains.length > 0) {
        output += `**Domains**: ${q.tags.domains.join(", ")}\n`;
      }
      
      output += "\n---\n\n";
    });

    res.json({
      success: true,
      formattedText: output,
      hint: "Copy the 'formattedText' field and paste into ChatGPT for concept analysis"
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 AWS Exam OCR Intelligence System`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔍 Using Tesseract.js OCR (local, no API keys needed)`);
  console.log(`   First image will take longer to initialize OCR engine\n`);
});

