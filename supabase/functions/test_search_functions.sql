-- 検索関数のテスト用クエリ

-- 1. 基本的なカテゴリ検索のテスト
SELECT 'Category Search Test' as test_name;
SELECT COUNT(*) as total_guidelines FROM design_guidelines;

-- 2. キーワード検索関数のテスト
SELECT 'Keyword Search Test' as test_name;
SELECT * FROM search_by_keywords(ARRAY['accessibility', 'button'], 3);

-- 3. カテゴリ検索関数のテスト
SELECT 'Category Function Test' as test_name;
SELECT * FROM search_by_category(ARRAY['accessibility', 'usability'], 3);

-- 4. ハイブリッド検索のテスト（テスト用ダミーベクトル）
SELECT 'Hybrid Search Test' as test_name;
-- 768次元のゼロベクトルでテスト（実際の埋め込みが生成されるまでの暫定テスト）
WITH test_vector AS (
  SELECT array_fill(0.1::float, ARRAY[768])::vector(768) as dummy_vector
)
SELECT * FROM hybrid_search(
  'accessibility button design', 
  (SELECT dummy_vector FROM test_vector),
  0.5, -- 低い閾値でテスト
  3
);

-- 5. カテゴリ別ハイブリッド検索のテスト
SELECT 'Category Hybrid Search Test' as test_name;
WITH test_vector AS (
  SELECT array_fill(0.1::float, ARRAY[768])::vector(768) as dummy_vector
)
SELECT * FROM hybrid_search_by_category(
  'accessibility button design', 
  (SELECT dummy_vector FROM test_vector),
  ARRAY['accessibility', 'usability'],
  0.5, -- 低い閾値でテスト
  3
);

-- 6. 全関数の存在確認
SELECT 'Function Existence Check' as test_name;
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname IN ('hybrid_search', 'hybrid_search_by_category', 'search_by_keywords', 'search_by_category')
ORDER BY proname;
 