import { createClient } from '@supabase/supabase-js';

// 環境変数取得のヘルパー関数
function getEnvVar(name: string): string | undefined {
  return typeof window === 'undefined' 
    ? (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env?.[name]
    : undefined;
}

// 遅延評価でSupabaseクライアントを初期化
function createSupabaseClients() {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return {
    client: createClient(supabaseUrl, supabaseAnonKey),
    admin: createClient(
      supabaseUrl,
      supabaseServiceKey || supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  };
}

// 遅延評価されるSupabaseクライアント
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const clients = createSupabaseClients();
    return clients.client[prop as keyof typeof clients.client];
  }
});

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const clients = createSupabaseClients();
    return clients.admin[prop as keyof typeof clients.admin];
  }
});

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