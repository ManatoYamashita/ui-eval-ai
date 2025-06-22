// app/types/api.ts

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AnalyzeApiRequest {
  image: File;
  prompt: string;
}

export interface SearchApiRequest {
  query: string;
  categories?: string[];
  sources?: string[];
  limit?: number;
}

export interface EmbedApiRequest {
  text: string;
}

export interface EmbedApiResponse {
  embedding: number[];
  token_count: number;
} 