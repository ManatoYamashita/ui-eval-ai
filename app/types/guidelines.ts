// app/types/guidelines.ts

export interface DesignGuideline {
  id: number;
  content: string;
  source: 'WCAG' | 'Apple HIG' | 'Refactoring UI';
  category: 'accessibility' | 'usability' | 'visual_design';
  subcategory?: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  keywords?: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: number;
  content: string;
  source: string;
  category: string;
  similarity_score: number;
  text_rank: number;
  combined_score: number;
  metadata?: Record<string, unknown>;
}

export interface HybridSearchParams {
  query_text: string;
  query_embedding: number[];
  match_threshold?: number;
  match_count?: number;
} 