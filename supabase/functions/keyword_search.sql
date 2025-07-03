-- キーワード検索関数

-- キーワードベース検索関数
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
         OR dg.keywords @> ARRAY[keyword]
    ) AS matched_keywords
  FROM design_guidelines dg
  WHERE 
    EXISTS (
      SELECT 1 
      FROM unnest(keywords) AS keyword 
      WHERE dg.content ILIKE '%' || keyword || '%' 
         OR dg.keywords @> ARRAY[keyword]
    )
  ORDER BY 
    array_length(
      ARRAY(
        SELECT keyword 
        FROM unnest(keywords) AS keyword 
        WHERE dg.content ILIKE '%' || keyword || '%' 
           OR dg.keywords @> ARRAY[keyword]
      ), 1
    ) DESC NULLS LAST,
    dg.id
  LIMIT match_count;
$$;

-- 基本的なカテゴリ検索関数
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