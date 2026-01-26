

export interface ParsedQuestion {
  question: string;
  options: string[];
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  rawText: string;
}

export interface AWSTags {
  services: string[];
  domains: string[];
  keywords: string[];
}

export interface QuestionAnalysis {
  file: string;
  parsed: ParsedQuestion;
  tags: AWSTags;
  isCorrect: boolean;
  difficulty?: "easy" | "medium" | "hard";
}

export interface ServiceBreakdown {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export interface DomainBreakdown {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export interface WeakArea {
  service: string;
  accuracy: number;
  questionsReviewed: number;
}

export interface StrongArea {
  service: string;
  accuracy: number;
  questionsReviewed: number;
}

export interface KeywordFrequency {
  keyword: string;
  count: number;
}

export interface StudySummary {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  
  serviceBreakdown: {
    [service: string]: ServiceBreakdown;
  };
  
  domainBreakdown: {
    [domain: string]: DomainBreakdown;
  };
  
  weakAreas: WeakArea[];
  strongAreas: StrongArea[];
  topKeywords: KeywordFrequency[];
  recommendations: string[];
}

export interface HeatmapItem {
  service: string;
  accuracy: number;
  total: number;
  color: string;
  status: string;
}

export interface OCRResponse {
  success: boolean;
  processedCount: number;
  timestamp: string;
  questions: QuestionAnalysis[];
  summary: StudySummary;
  heatmap: HeatmapItem[];
  quickStats: {
    accuracy: string;
    correct: number;
    incorrect: number;
    totalServices: number;
    weakAreaCount: number;
  };
}

export interface ExportResponse {
  success: boolean;
  formattedText: string;
  hint: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  clarifaiConfigured: boolean;
}

