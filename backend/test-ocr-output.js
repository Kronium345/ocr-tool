/**
 * Quick test script to see what the OCR is actually extracting
 * Run with: node test-ocr-output.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find first image in extracted directory
const extractedDir = path.join(__dirname, "extracted");
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

if (fs.existsSync(extractedDir)) {
  findImages(extractedDir);
} else {
  console.error("❌ No extracted directory found. Upload a ZIP file first.");
  process.exit(1);
}

if (imageFiles.length === 0) {
  console.error("❌ No images found in extracted directory");
  process.exit(1);
}

console.log(`\n📸 Found ${imageFiles.length} images`);
console.log(`🔍 Testing OCR on: ${path.basename(imageFiles[0])}\n`);

// Read and process first image
const imagePath = imageFiles[0];
const buffer = fs.readFileSync(imagePath);

// Use Tesseract.js OCR
try {
  console.log("📡 Initializing Tesseract.js OCR...");
  const worker = await createWorker("eng");
  
  console.log("🔍 Processing image with Tesseract OCR...");
  const { data: { text } } = await worker.recognize(buffer);
  
  await worker.terminate();
  
  console.log("\n✅ OCR Complete\n");
  console.log("=" .repeat(60));
  console.log("📋 EXTRACTED TEXT:");
  console.log("=" .repeat(60));
  
  if (text && text.trim().length > 0) {
    console.log(text);
    console.log("\n" + "=" .repeat(60));
    console.log(`\n✅ Successfully extracted ${text.trim().length} characters of text`);
    console.log("💡 This is actual text content that can be parsed!");
  } else {
    console.log("⚠️  No text extracted from image");
    console.log("   This might be because:");
    console.log("   - Image quality is too low");
    console.log("   - Image doesn't contain readable text");
    console.log("   - Text is too small or unclear");
  }
  
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
}

