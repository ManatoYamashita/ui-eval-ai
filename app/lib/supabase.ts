import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// クライアントサイド用（認証・基本操作）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバーサイド用（管理者権限・サービス操作）
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// データベース型定義
export interface Database {
  public: {
    Tables: {
      design_guidelines: {
        Row: {
          id: number;
          content: string;
          source: string;
          category: string;
          subcategory: string | null;
          embedding: number[] | null;
          metadata: Record<string, unknown> | null;
          keywords: string[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          source: string;
          category: string;
          subcategory?: string | null;
          embedding?: number[] | null;
          metadata?: Record<string, unknown> | null;
          keywords?: string[] | null;
        };
        Update: {
          content?: string;
          source?: string;
          category?: string;
          subcategory?: string | null;
          embedding?: number[] | null;
          metadata?: Record<string, unknown> | null;
          keywords?: string[] | null;
          updated_at?: string;
        };
      };
    };
    Functions: {
      hybrid_search: {
        Args: {
          query_text: string;
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: number;
          content: string;
          source: string;
          category: string;
          similarity_score: number;
          text_rank: number;
          combined_score: number;
          metadata: Record<string, unknown> | null;
        }[];
      };
    };
  };
}

// 型付きクライアント
export const typedSupabase = supabase as ReturnType<typeof createClient<Database>>;
export const typedSupabaseAdmin = supabaseAdmin as ReturnType<typeof createClient<Database>>; 