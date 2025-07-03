-- ハイブリッド検索関数（英語設定版）

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
  ),
  combined_results AS (
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
  )
  SELECT 
    cr.id,
    cr.content,
    cr.source,
    cr.category,
    cr.similarity_score,
    cr.text_rank,
    cr.combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE cr.combined_score > 0
  ORDER BY cr.combined_score DESC
  LIMIT match_count;
$$;

-- カテゴリ別ハイブリッド検索関数（英語設定版）
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
  ),
  combined_results AS (
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
  )
  SELECT 
    cr.id,
    cr.content,
    cr.source,
    cr.category,
    cr.similarity_score,
    cr.text_rank,
    cr.combined_score,
    cr.metadata
  FROM combined_results cr
  WHERE cr.combined_score > 0
  ORDER BY cr.combined_score DESC
  LIMIT match_count;
$$;

-- 統計情報更新関数
CREATE OR REPLACE FUNCTION refresh_search_statistics()
RETURNS VOID
LANGUAGE SQL
AS $$
  ANALYZE design_guidelines;
$$; 