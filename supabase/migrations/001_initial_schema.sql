-- supabase/migrations/001_initial_schema.sql
-- UI Evaluation AI - Initial Database Schema

-- pgvector拡張を有効化
CREATE EXTENSION IF NOT EXISTS vector;

-- design_guidelinesテーブル作成
CREATE TABLE IF NOT EXISTS design_guidelines (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,                    -- ガイドライン本文
  source VARCHAR(100) NOT NULL,             -- WCAG, Apple HIG, Refactoring UI
  category VARCHAR(50) NOT NULL,            -- accessibility, usability, visual_design
  subcategory VARCHAR(100),                 -- color_contrast, touch_targets, typography
  embedding VECTOR(1536),                   -- OpenAI embeddings (1536次元)
  metadata JSONB,                          -- 追加情報（レベル、重要度等）
  keywords TEXT[],                         -- 検索用キーワード配列
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- パフォーマンス最適化のためのインデックス作成
-- ベクトル検索用インデックス（IVFFlat）
CREATE INDEX IF NOT EXISTS design_guidelines_embedding_idx 
ON design_guidelines 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 全文検索用インデックス（日本語対応）
CREATE INDEX IF NOT EXISTS design_guidelines_content_gin_idx 
ON design_guidelines 
USING gin(to_tsvector('japanese', content));

-- カテゴリ別検索用インデックス
CREATE INDEX IF NOT EXISTS design_guidelines_category_idx 
ON design_guidelines (source, category);

-- サブカテゴリ検索用インデックス
CREATE INDEX IF NOT EXISTS design_guidelines_subcategory_idx 
ON design_guidelines (category, subcategory) 
WHERE subcategory IS NOT NULL;

-- キーワード検索用インデックス（GIN）
CREATE INDEX IF NOT EXISTS design_guidelines_keywords_gin_idx 
ON design_guidelines 
USING gin(keywords);

-- メタデータ検索用インデックス（GIN）
CREATE INDEX IF NOT EXISTS design_guidelines_metadata_gin_idx 
ON design_guidelines 
USING gin(metadata);

-- 更新日時トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 更新日時自動更新トリガー
DROP TRIGGER IF EXISTS update_design_guidelines_updated_at ON design_guidelines;
CREATE TRIGGER update_design_guidelines_updated_at
  BEFORE UPDATE ON design_guidelines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 設定
ALTER TABLE design_guidelines ENABLE ROW LEVEL SECURITY;

-- 読み取り権限ポリシー（全員が読み取り可能）
DROP POLICY IF EXISTS "Everyone can read design_guidelines" ON design_guidelines;
CREATE POLICY "Everyone can read design_guidelines" 
ON design_guidelines 
FOR SELECT 
USING (true);

-- 挿入・更新・削除権限ポリシー（サービスロールのみ）
DROP POLICY IF EXISTS "Service role can manage design_guidelines" ON design_guidelines;
CREATE POLICY "Service role can manage design_guidelines" 
ON design_guidelines 
FOR ALL 
USING (auth.role() = 'service_role'); 