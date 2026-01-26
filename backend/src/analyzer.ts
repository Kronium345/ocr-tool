import { ParsedQuestion } from "./parser.js";
import { AWSTags } from "./awsTagger.js";

export interface QuestionAnalysis {
  file: string;
  parsed: ParsedQuestion;
  tags: AWSTags;
  isCorrect: boolean;
  difficulty?: "easy" | "medium" | "hard";
}

export interface StudySummary {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  
  // Service breakdown
  serviceBreakdown: {
    [service: string]: {
      total: number;
      correct: number;
      incorrect: number;
      accuracy: number;
    };
  };
  
  // Domain breakdown
  domainBreakdown: {
    [domain: string]: {
      total: number;
      correct: number;
      incorrect: number;
      accuracy: number;
    };
  };
  
  // Weak areas (services with < 70% accuracy)
  weakAreas: {
    service: string;
    accuracy: number;
    questionsReviewed: number;
  }[];
  
  // Strong areas (services with >= 85% accuracy)
  strongAreas: {
    service: string;
    accuracy: number;
    questionsReviewed: number;
  }[];
  
  // Keyword frequency
  topKeywords: {
    keyword: string;
    count: number;
  }[];
  
  // Recommendations
  recommendations: string[];
}

/**
 * Generates comprehensive study summary from analyzed questions
 */
export function generateSummary(analyses: QuestionAnalysis[]): StudySummary {
  const summary: StudySummary = {
    totalQuestions: analyses.length,
    correctCount: 0,
    incorrectCount: 0,
    accuracy: 0,
    serviceBreakdown: {},
    domainBreakdown: {},
    weakAreas: [],
    strongAreas: [],
    topKeywords: [],
    recommendations: []
  };

  // Calculate basic stats
  analyses.forEach(analysis => {
    if (analysis.isCorrect) {
      summary.correctCount++;
    } else {
      summary.incorrectCount++;
    }
  });

  summary.accuracy = summary.totalQuestions > 0 
    ? (summary.correctCount / summary.totalQuestions) * 100 
    : 0;

  // Build service breakdown
  analyses.forEach(analysis => {
    analysis.tags.services.forEach(service => {
      if (!summary.serviceBreakdown[service]) {
        summary.serviceBreakdown[service] = {
          total: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0
        };
      }
      summary.serviceBreakdown[service].total++;
      if (analysis.isCorrect) {
        summary.serviceBreakdown[service].correct++;
      } else {
        summary.serviceBreakdown[service].incorrect++;
      }
    });
  });

  // Calculate service accuracies
  Object.keys(summary.serviceBreakdown).forEach(service => {
    const breakdown = summary.serviceBreakdown[service];
    breakdown.accuracy = (breakdown.correct / breakdown.total) * 100;
  });

  // Build domain breakdown
  analyses.forEach(analysis => {
    analysis.tags.domains.forEach(domain => {
      if (!summary.domainBreakdown[domain]) {
        summary.domainBreakdown[domain] = {
          total: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0
        };
      }
      summary.domainBreakdown[domain].total++;
      if (analysis.isCorrect) {
        summary.domainBreakdown[domain].correct++;
      } else {
        summary.domainBreakdown[domain].incorrect++;
      }
    });
  });

  // Calculate domain accuracies
  Object.keys(summary.domainBreakdown).forEach(domain => {
    const breakdown = summary.domainBreakdown[domain];
    breakdown.accuracy = (breakdown.correct / breakdown.total) * 100;
  });

  // Identify weak and strong areas
  Object.entries(summary.serviceBreakdown).forEach(([service, data]) => {
    if (data.total >= 2) { // Only consider if 2+ questions
      if (data.accuracy < 70) {
        summary.weakAreas.push({
          service,
          accuracy: data.accuracy,
          questionsReviewed: data.total
        });
      } else if (data.accuracy >= 85) {
        summary.strongAreas.push({
          service,
          accuracy: data.accuracy,
          questionsReviewed: data.total
        });
      }
    }
  });

  // Sort weak and strong areas
  summary.weakAreas.sort((a, b) => a.accuracy - b.accuracy);
  summary.strongAreas.sort((a, b) => b.accuracy - a.accuracy);

  // Calculate keyword frequency
  const keywordMap = new Map<string, number>();
  analyses.forEach(analysis => {
    analysis.tags.keywords.forEach(keyword => {
      keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
    });
  });

  summary.topKeywords = Array.from(keywordMap.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Generate recommendations
  summary.recommendations = generateRecommendations(summary, analyses);

  return summary;
}

function generateRecommendations(summary: StudySummary, analyses: QuestionAnalysis[]): string[] {
  const recommendations: string[] = [];

  // Overall performance
  if (summary.accuracy < 60) {
    recommendations.push("📚 Overall score below 60% - recommend reviewing AWS fundamentals and service overviews");
  } else if (summary.accuracy < 75) {
    recommendations.push("📈 You're on track! Focus on weak areas to boost your score above 75%");
  } else if (summary.accuracy >= 85) {
    recommendations.push("🎯 Excellent performance! You're exam-ready. Focus on scenario-based practice");
  }

  // Weak area recommendations
  if (summary.weakAreas.length > 0) {
    const topWeak = summary.weakAreas.slice(0, 3).map(w => w.service).join(", ");
    recommendations.push(`⚠️ Priority review needed: ${topWeak}`);
  }

  // Domain-specific recommendations
  Object.entries(summary.domainBreakdown).forEach(([domain, data]) => {
    if (data.accuracy < 65) {
      recommendations.push(`🔍 ${domain}: ${data.accuracy.toFixed(1)}% - Deep dive recommended`);
    }
  });

  // Pattern detection
  const incorrectAnalyses = analyses.filter(a => !a.isCorrect);
  const securityMistakes = incorrectAnalyses.filter(a => 
    a.tags.services.some(s => ["IAM", "KMS", "Cognito", "Secrets Manager"].includes(s))
  );
  
  if (securityMistakes.length >= 3) {
    recommendations.push("🔐 Security pattern detected - review IAM policies, KMS encryption, and Cognito authentication");
  }

  const serverlessMistakes = incorrectAnalyses.filter(a =>
    a.tags.keywords.some(k => k.toLowerCase().includes("serverless") || k.toLowerCase().includes("lambda"))
  );

  if (serverlessMistakes.length >= 3) {
    recommendations.push("⚡ Serverless concepts need attention - review Lambda triggers, async patterns, and cold starts");
  }

  // Study strategy
  if (summary.totalQuestions < 20) {
    recommendations.push("📊 Process more questions (20+) for accurate weak-area detection");
  }

  return recommendations;
}

/**
 * Generates a heatmap visualization data for weak areas
 */
export function generateHeatmapData(summary: StudySummary) {
  const allServices = [
    ...Object.keys(summary.serviceBreakdown)
  ];

  return allServices.map(service => {
    const data = summary.serviceBreakdown[service];
    return {
      service,
      accuracy: data.accuracy,
      total: data.total,
      color: getHeatColor(data.accuracy),
      status: getStatus(data.accuracy)
    };
  }).sort((a, b) => a.accuracy - b.accuracy);
}

function getHeatColor(accuracy: number): string {
  if (accuracy >= 85) return "#22c55e"; // Green
  if (accuracy >= 70) return "#eab308"; // Yellow
  if (accuracy >= 50) return "#f97316"; // Orange
  return "#ef4444"; // Red
}

function getStatus(accuracy: number): string {
  if (accuracy >= 85) return "Strong";
  if (accuracy >= 70) return "Good";
  if (accuracy >= 50) return "Review";
  return "Weak";
}

