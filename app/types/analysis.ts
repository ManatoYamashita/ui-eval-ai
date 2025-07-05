// app/types/analysis.ts

export type Priority = 'high' | 'medium' | 'low';

export interface ImprovementSuggestion {
  priority: Priority;
  title: string;
  problem: string; // Supports Markdown formatting
  solution: string; // Supports Markdown formatting
  implementation: string;  // TailwindCSS code example
  guideline_reference: string; // Supports Markdown formatting
}

export interface PredictedImpact {
  accessibility_score: number;
  usability_improvement: string; // Supports Markdown formatting
  conversion_impact: string; // Supports Markdown formatting
}

export interface AnalysisResult {
  success: boolean;
  analysis: {
    current_issues: string; // Supports Markdown formatting
    improvements: ImprovementSuggestion[];
    predicted_impact: PredictedImpact;
  };
  guidelines_used: GuidelineReference[];
  processing_time: number;
  error?: string;
}

export interface GuidelineReference {
  source: string;
  content: string; // Supports Markdown formatting
  relevance_score: number;
}

export interface AnalysisRequest {
  image: File;
  prompt: string;
} 