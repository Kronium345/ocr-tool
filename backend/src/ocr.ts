import { createWorker } from "tesseract.js";

// Initialize Tesseract worker (reused across calls for performance)
let worker: any = null;

/**
 * Initialize Tesseract OCR worker
 * This is done once and reused for all images
 */
async function getWorker() {
  if (!worker) {
    console.log("   🔧 Initializing Tesseract OCR engine (first time only)...");
    worker = await createWorker("eng", 1, {
      logger: (m: any) => {
        // Only log progress for first image to avoid spam
        if (m.status === "recognizing text") {
          // Suppress detailed progress logs
        }
      }
    });
    console.log("   ✅ Tesseract OCR engine ready");
  }
  return worker;
}

/**
 * Extract text from image using Tesseract.js OCR
 * This is a local OCR solution that actually extracts text, not just concepts
 */
export async function ocrImage(base64: string): Promise<string> {
  try {
    console.log(`   Using Tesseract.js OCR (local, no API needed)`);
    
    // Get or create worker
    const ocrWorker = await getWorker();
    
    // Convert base64 to buffer
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Perform OCR
    const { data: { text } } = await ocrWorker.recognize(buffer);
    
    if (!text || text.trim().length === 0) {
      console.warn("   ⚠️ No text extracted from image");
      return "";
    }
    
    const textLength = text.trim().length;
    console.log(`   ✅ Extracted ${textLength} characters of text`);
    
    return text.trim();
  } catch (error: any) {
    console.error("OCR Error:", error.message);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Cleanup Tesseract worker (call when done processing all images)
 */
export async function cleanupOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log("   🧹 Tesseract OCR worker terminated");
  }
}

