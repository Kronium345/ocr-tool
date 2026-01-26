/**
 * Parses OCR text to extract structured question data
 */
export interface ParsedQuestion {
  question: string;
  options: string[];
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  rawText: string;
}

/**
 * Extracts structured question data from OCR text
 */
export function parseQuestion(text: string): ParsedQuestion {
  const result: ParsedQuestion = {
    question: "",
    options: [],
    yourAnswer: "",
    correctAnswer: "",
    explanation: "",
    rawText: text
  };

  // Normalize line breaks
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extract Question
  const questionMatch = normalized.match(/(?:Question[:\s]*|Q[:\s]*)(.*?)(?=(?:A\)|Options:|Your Answer:|Correct Answer:|$))/is);
  if (questionMatch) {
    result.question = questionMatch[1].trim();
  }

  // Extract Options (A, B, C, D format)
  const optionsRegex = /([A-D])[:\)\.]?\s*([^\n]+)/gi;
  let match;
  while ((match = optionsRegex.exec(normalized)) !== null) {
    result.options.push(`${match[1]}: ${match[2].trim()}`);
  }

  // Extract Your Answer
  const yourAnswerMatch = normalized.match(/Your\s+Answer[:\s]*([A-D])/i);
  if (yourAnswerMatch) {
    result.yourAnswer = yourAnswerMatch[1].toUpperCase();
  }

  // Extract Correct Answer
  const correctAnswerMatch = normalized.match(/Correct\s+Answer[:\s]*([A-D])/i);
  if (correctAnswerMatch) {
    result.correctAnswer = correctAnswerMatch[1].toUpperCase();
  }

  // Extract Explanation
  const explanationMatch = normalized.match(/Explanation[:\s]*(.*?)$/is);
  if (explanationMatch) {
    result.explanation = explanationMatch[1].trim();
  }

  return result;
}

