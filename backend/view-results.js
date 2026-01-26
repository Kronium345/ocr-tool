/**
 * View extracted OCR text from processed images
 * Run with: node view-results.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extractedDir = path.join(__dirname, "extracted");
const resultsDir = path.join(__dirname, "results");

console.log("🔍 Checking for processed results...\n");

// First, check if there are saved results files
if (fs.existsSync(resultsDir)) {
  const resultFiles = fs.readdirSync(resultsDir)
    .filter(f => f.startsWith('results-') && f.endsWith('.json'))
    .map(f => ({
      name: f,
      path: path.join(resultsDir, f),
      time: fs.statSync(path.join(resultsDir, f)).mtime
    }))
    .sort((a, b) => b.time.getTime() - a.time.getTime());

  if (resultFiles.length > 0) {
    console.log(`✅ Found ${resultFiles.length} saved result file(s)\n`);
    console.log("📋 Latest Results File:");
    console.log(`   File: ${resultFiles[0].name}`);
    console.log(`   Time: ${resultFiles[0].time.toISOString()}`);
    console.log(`   Path: ${resultFiles[0].path}\n`);
    
    const results = JSON.parse(fs.readFileSync(resultFiles[0].path, 'utf-8'));
    
    console.log("=" .repeat(60));
    console.log("📊 QUICK STATS:");
    console.log("=" .repeat(60));
    console.log(`Total Questions: ${results.processedCount}`);
    console.log(`Accuracy: ${results.quickStats.accuracy}`);
    console.log(`Correct: ${results.quickStats.correct}`);
    console.log(`Incorrect: ${results.quickStats.incorrect}`);
    console.log(`Services Covered: ${results.quickStats.totalServices}`);
    console.log(`Weak Areas: ${results.quickStats.weakAreaCount}\n`);
    
    console.log("=" .repeat(60));
    console.log("📝 SAMPLE QUESTIONS (First 3):");
    console.log("=" .repeat(60));
    
    results.questions.slice(0, 3).forEach((q, idx) => {
      console.log(`\n--- Question ${idx + 1} (${q.isCorrect ? "✓ CORRECT" : "✗ INCORRECT"}) ---`);
      console.log(`File: ${q.file}`);
      if (q.parsed.question) {
        console.log(`Question: ${q.parsed.question.substring(0, 100)}...`);
      }
      if (q.parsed.options.length > 0) {
        console.log(`Options: ${q.parsed.options.length} found`);
        q.parsed.options.slice(0, 2).forEach(opt => console.log(`  - ${opt.substring(0, 80)}...`));
      }
      console.log(`Your Answer: ${q.parsed.yourAnswer || 'N/A'}`);
      console.log(`Correct Answer: ${q.parsed.correctAnswer || 'N/A'}`);
      if (q.tags.services.length > 0) {
        console.log(`AWS Services: ${q.tags.services.join(', ')}`);
      }
      console.log(`Raw Text Length: ${q.parsed.rawText.length} characters`);
    });
    
    console.log(`\n💡 To see all results, open: ${resultFiles[0].path}`);
    console.log(`💡 Or visit: http://localhost:4000/api/results/latest\n`);
    process.exit(0);
  }
}

// If no saved results, check extracted images and show sample OCR
if (fs.existsSync(extractedDir)) {
  const imageFiles = [];
  
  function findImages(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findImages(filePath);
      } else if (file.match(/\.(png|jpg|jpeg|webp)$/i)) {
        imageFiles.push(filePath);
      }
    }
  }
  
  findImages(extractedDir);
  
  if (imageFiles.length > 0) {
    console.log(`📸 Found ${imageFiles.length} extracted images`);
    console.log(`💡 Note: Results weren't saved. Re-upload to save results, or view sample below:\n`);
    
    // Show sample from first image
    console.log("=" .repeat(60));
    console.log("📋 SAMPLE OCR EXTRACTION (First Image):");
    console.log("=" .repeat(60));
    console.log(`File: ${path.basename(imageFiles[0])}\n`);
    
    try {
      const buffer = fs.readFileSync(imageFiles[0]);
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      
      console.log(text.substring(0, 500));
      console.log(`\n... (${text.length} total characters)`);
      console.log(`\n💡 This is what Tesseract extracted from the image`);
      console.log(`💡 Upload again to save full results to: ${resultsDir}\n`);
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
  } else {
    console.log("❌ No images found in extracted directory");
    console.log("   Upload a ZIP file first\n");
  }
} else {
  console.log("❌ No extracted directory found");
  console.log("   Upload a ZIP file first\n");
}

