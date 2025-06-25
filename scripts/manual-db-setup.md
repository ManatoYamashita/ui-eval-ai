# 手動データベースセットアップ手順

## 🎯 目的
PostgreSQL関数が自動作成できない場合の手動セットアップ手順

## 📋 手順

### 1. Supabaseダッシュボードにアクセス
1. https://supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 2. 基本関数の作成

以下のSQLを順番に実行してください：

#### A. ハイブリッド検索関数
```sql
-- 基本ハイブリッド検索関数
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  similarity_score FLOAT,
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE SQL
STABLE
AS $$
  WITH vector_search AS (
    SELECT 
      dg.id,
      dg.content,
      dg.source,
      dg.category,
      dg.metadata,
      1 - (dg.embedding <=> query_embedding) AS similarity_score
    FROM design_guidelines dg
    WHERE dg.embedding IS NOT NULL
      AND 1 - (dg.embedding <=> query_embedding) > match_threshold
  ),
  text_search AS (
    SELECT 
      dg.id,
      dg.content,
      dg.source,
      dg.category,
      dg.metadata,
      ts_rank_cd(
        to_tsvector('english', dg.content), 
        plainto_tsquery('english', query_text)
      ) AS text_rank
    FROM design_guidelines dg
    WHERE to_tsvector('english', dg.content) @@ plainto_tsquery('english', query_text)
  )
  SELECT 
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.content, t.content) AS content,
    COALESCE(v.source, t.source) AS source,
    COALESCE(v.category, t.category) AS category,
    COALESCE(v.similarity_score, 0.0) AS similarity_score,
    COALESCE(t.text_rank, 0.0) AS text_rank,
    (COALESCE(v.similarity_score, 0.0) * 0.7 + COALESCE(t.text_rank, 0.0) * 0.3) AS combined_score,
    COALESCE(v.metadata, t.metadata) AS metadata
  FROM vector_search v
  FULL OUTER JOIN text_search t ON v.id = t.id
  WHERE (COALESCE(v.similarity_score, 0.0) * 0.7 + COALESCE(t.text_rank, 0.0) * 0.3) > 0
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;
```

#### B. カテゴリ別ハイブリッド検索関数
```sql
-- カテゴリ別ハイブリッド検索関数
CREATE OR REPLACE FUNCTION hybrid_search_by_category(
  query_text TEXT,
  query_embedding VECTOR(768),
  target_categories TEXT[] DEFAULT ARRAY['accessibility', 'usability', 'visual_design'],
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  similarity_score FLOAT,
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE SQL
STABLE
AS $$
  WITH vector_search AS (
    SELECT 
      dg.id,
      dg.content,
      dg.source,
      dg.category,
      dg.metadata,
      1 - (dg.embedding <=> query_embedding) AS similarity_score
    FROM design_guidelines dg
    WHERE dg.embedding IS NOT NULL
      AND dg.category = ANY(target_categories)
      AND 1 - (dg.embedding <=> query_embedding) > match_threshold
  ),
  text_search AS (
    SELECT 
      dg.id,
      dg.content,
      dg.source,
      dg.category,
      dg.metadata,
      ts_rank_cd(
        to_tsvector('english', dg.content), 
        plainto_tsquery('english', query_text)
      ) AS text_rank
    FROM design_guidelines dg
    WHERE dg.category = ANY(target_categories)
      AND to_tsvector('english', dg.content) @@ plainto_tsquery('english', query_text)
  )
  SELECT 
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.content, t.content) AS content,
    COALESCE(v.source, t.source) AS source,
    COALESCE(v.category, t.category) AS category,
    COALESCE(v.similarity_score, 0.0) AS similarity_score,
    COALESCE(t.text_rank, 0.0) AS text_rank,
    (COALESCE(v.similarity_score, 0.0) * 0.7 + COALESCE(t.text_rank, 0.0) * 0.3) AS combined_score,
    COALESCE(v.metadata, t.metadata) AS metadata
  FROM vector_search v
  FULL OUTER JOIN text_search t ON v.id = t.id
  WHERE (COALESCE(v.similarity_score, 0.0) * 0.7 + COALESCE(t.text_rank, 0.0) * 0.3) > 0
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;
```

#### C. キーワード検索関数
```sql
-- キーワード検索関数
CREATE OR REPLACE FUNCTION search_by_keywords(
  keywords TEXT[],
  match_count INT DEFAULT 10
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  subcategory VARCHAR(100),
  metadata JSONB,
  matched_keywords TEXT[]
)
LANGUAGE SQL
AS $$
  SELECT 
    dg.id,
    dg.content,
    dg.source,
    dg.category,
    dg.subcategory,
    dg.metadata,
    ARRAY(
      SELECT keyword 
      FROM unnest(keywords) AS keyword 
      WHERE dg.content ILIKE '%' || keyword || '%' 
         OR (dg.keywords IS NOT NULL AND dg.keywords @> ARRAY[keyword])
    ) AS matched_keywords
  FROM design_guidelines dg
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(keywords) AS keyword 
      WHERE dg.content ILIKE '%' || keyword || '%' 
         OR (dg.keywords IS NOT NULL AND dg.keywords @> ARRAY[keyword])
    )
  ORDER BY 
    array_length(
      ARRAY(
        SELECT keyword 
        FROM unnest(keywords) AS keyword 
        WHERE dg.content ILIKE '%' || keyword || '%' 
           OR (dg.keywords IS NOT NULL AND dg.keywords @> ARRAY[keyword])
      ), 1
    ) DESC NULLS LAST,
    dg.id
  LIMIT match_count;
$$;
```

#### D. カテゴリ検索関数
```sql
-- カテゴリ検索関数
CREATE OR REPLACE FUNCTION search_by_category(
  target_categories TEXT[],
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  subcategory VARCHAR(100),
  metadata JSONB
)
LANGUAGE SQL
AS $$
  SELECT 
    id,
    content,
    source,
    category,
    subcategory,
    metadata
  FROM design_guidelines
  WHERE category = ANY(target_categories)
  ORDER BY 
    CASE 
      WHEN category = 'accessibility' THEN 1
      WHEN category = 'usability' THEN 2
      WHEN category = 'visual_design' THEN 3
      ELSE 4
    END,
    id
  LIMIT match_count;
$$;
```

### 3. 関数作成確認
各SQLを実行後、以下のコマンドで確認：
```bash
npx tsx scripts/check-db-status.ts
```

すべての関数で「✅ 存在する」が表示されればOK！

### 4. 知識ベースの構築
関数作成後、以下のコマンドで知識ベースを構築：
```bash
npx tsx scripts/setup-knowledge-base.ts
```

## 🚧 注意事項
- SQL実行時にエラーが出た場合は、エラーメッセージを確認
- pgvector拡張が有効になっていることを確認
- design_guidelinesテーブルが存在することを確認 