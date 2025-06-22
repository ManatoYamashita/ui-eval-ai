// app/types/analysis.ts

export type Priority = 'high' | 'medium' | 'low';

export interface ImprovementSuggestion {
  priority: Priority;
  title: string;
  problem: string;
  solution: string;
  implementation: string;  // TailwindCSS code example
  guideline_reference: string;
}

export interface PredictedImpact {
  accessibility_score: number;
  usability_improvement: string;
  conversion_impact: string;
}

export interface AnalysisResult {
  success: boolean;
  analysis: {
    current_issues: string;
    improvements: ImprovementSuggestion[];
    predicted_impact: PredictedImpact;
  };
  guidelines_used: GuidelineReference[];
  processing_time: number;
  error?: string;
}

export interface GuidelineReference {
  source: string;
  content: string;
  relevance_score: number;
}

export interface AnalysisRequest {
  image: File;
  prompt: string;
} 