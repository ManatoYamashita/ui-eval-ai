import { typedSupabaseAdmin } from './supabase';
import { generateEmbedding } from './ai-clients';
import type { SearchResult } from '../types/guidelines';

export interface RAGSearchOptions {
  categories?: string[];
  sources?: string[];
  threshold?: number;
  limit?: number;
}

export interface RAGSearchResult {
  results: SearchResult[];
  query: string;
  totalResults: number;
  processingTime: number;
}

interface KeywordSearchResult {
  id: number;
  content: string;
  source: string;
  category: string;
  metadata?: Record<string, unknown>;
  matched_keywords?: string[];
}

/**
 * ハイブリッド検索実行（ベクトル + 全文検索）
 */
export async function performHybridSearch(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGSearchResult> {
  const startTime = Date.now();
  
  try {
    // デフォルトオプション設定
    const {
      categories = ['accessibility', 'usability', 'visual_design'],
      threshold = 0.7,
      limit = 5
    } = options;

    // クエリの埋め込み生成
    const queryEmbedding = await generateEmbedding(query);

    // カテゴリ別ハイブリッド検索実行
    const { data: searchResults, error } = await typedSupabaseAdmin
      .rpc('hybrid_search_by_category', {
        query_text: query,
        query_embedding: queryEmbedding,
        target_categories: categories,
        match_threshold: threshold,
        match_count: limit
      });

    if (error) {
      console.error('Hybrid search error:', error);
      throw new Error(`Database search failed: ${error.message}`);
    }

    const processingTime = Date.now() - startTime;

    return {
      results: searchResults || [],
      query,
      totalResults: searchResults?.length || 0,
      processingTime
    };

  } catch (error) {
    console.error('RAG search error:', error);
    throw new Error('Failed to perform hybrid search');
  }
}

/**
 * UI要素に基づく動的検索
 */
export async function searchByUIElements(
  detectedElements: string[],
  userPrompt: string,
  options: RAGSearchOptions = {}
): Promise<RAGSearchResult> {
  
  // UI要素からカテゴリを動的に決定
  const elementToCategoryMap: Record<string, string[]> = {
    'button': ['accessibility', 'usability'],
    'form': ['accessibility', 'usability'],
    'navigation': ['usability', 'visual_design'],
    'text': ['accessibility', 'visual_design'],
    'image': ['accessibility', 'visual_design'],
    'color': ['accessibility', 'visual_design'],
    'layout': ['visual_design', 'usability'],
    'touch_target': ['accessibility', 'usability'],
    'contrast': ['accessibility'],
    'typography': ['accessibility', 'visual_design']
  };

  // 検出された要素に基づいてカテゴリを決定
  const relevantCategories = new Set<string>();
  detectedElements.forEach(element => {
    const categories = elementToCategoryMap[element.toLowerCase()];
    if (categories) {
      categories.forEach(cat => relevantCategories.add(cat));
    }
  });

  // デフォルトカテゴリを使用（要素が検出されない場合）
  const searchCategories = relevantCategories.size > 0 
    ? Array.from(relevantCategories)
    : ['accessibility', 'usability', 'visual_design'];

  // 拡張クエリ作成（UI要素情報を含む）
  const enhancedQuery = `${userPrompt} ${detectedElements.join(' ')}`;

  return performHybridSearch(enhancedQuery, {
    ...options,
    categories: searchCategories
  });
}

/**
 * キーワードベース検索
 */
export async function searchByKeywords(
  keywords: string[],
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const { data: results, error } = await typedSupabaseAdmin
      .rpc('search_by_keywords', {
        keywords,
        match_count: limit
      });

    if (error) {
      console.error('Keyword search error:', error);
      throw new Error(`Keyword search failed: ${error.message}`);
    }

    // キーワード検索結果をSearchResult形式に変換
    return (results || []).map((result: KeywordSearchResult) => ({
      id: result.id,
      content: result.content,
      source: result.source,
      category: result.category,
      similarity_score: 0, // キーワード検索では類似度スコアなし
      text_rank: 0,
      combined_score: result.matched_keywords?.length || 0,
      metadata: result.metadata
    }));

  } catch (error) {
    console.error('Keyword search error:', error);
    throw new Error('Failed to perform keyword search');
  }
}

/**
 * マルチモーダル検索（複数の検索手法を組み合わせ）
 */
export async function performMultiModalSearch(
  textQuery: string,
  detectedElements: string[],
  keywords: string[] = [],
  options: RAGSearchOptions = {}
): Promise<RAGSearchResult> {
  
  try {
    const startTime = Date.now();
    
    // 並列検索実行
    const [hybridResults, keywordResults] = await Promise.all([
      searchByUIElements(detectedElements, textQuery, { ...options, limit: 3 }),
      searchByKeywords(keywords, 3)
    ]);

    // 結果をマージして重複除去
    const allResults = [...hybridResults.results, ...keywordResults];
    const uniqueResults = allResults.reduce((acc, current) => {
      const existing = acc.find(item => item.id === current.id);
      if (!existing) {
        acc.push(current);
      } else {
        // 既存結果のスコアを更新（最高スコアを維持）
        existing.combined_score = Math.max(existing.combined_score, current.combined_score);
      }
      return acc;
    }, [] as SearchResult[]);

    // スコア順でソート
    uniqueResults.sort((a, b) => b.combined_score - a.combined_score);

    const processingTime = Date.now() - startTime;

    return {
      results: uniqueResults.slice(0, options.limit || 5),
      query: textQuery,
      totalResults: uniqueResults.length,
      processingTime
    };

  } catch (error) {
    console.error('Multi-modal search error:', error);
    throw new Error('Failed to perform multi-modal search');
  }
}

/**
 * 関連ガイドライン検索（分析用）
 */
export async function searchRelevantGuidelines(
  detectedElements: string[],
  userPrompt: string
): Promise<SearchResult[]> {
  
  try {
    // キーワード抽出
    const extractedKeywords = extractKeywords(userPrompt, detectedElements);
    
    // マルチモーダル検索実行
    const searchResult = await performMultiModalSearch(
      userPrompt,
      detectedElements,
      extractedKeywords,
      { limit: 8, threshold: 0.65 }
    );

    return searchResult.results;

  } catch (error) {
    console.error('Guidelines search error:', error);
    throw new Error('Failed to search relevant guidelines');
  }
}

/**
 * キーワード抽出ヘルパー関数
 */
function extractKeywords(prompt: string, elements: string[]): string[] {
  const commonKeywords = [
    'アクセシビリティ', 'ユーザビリティ', 'デザイン', 'レイアウト',
    '色', 'コントラスト', 'フォント', 'ボタン', 'ナビゲーション',
    'accessibility', 'usability', 'design', 'layout', 'color', 'contrast'
  ];

  const promptWords = prompt.toLowerCase().split(/\s+/);
  const keywords = [...elements];

  // プロンプト内のキーワードを抽出
  commonKeywords.forEach(keyword => {
    if (promptWords.some(word => word.includes(keyword.toLowerCase()))) {
      keywords.push(keyword);
    }
  });

  return [...new Set(keywords)]; // 重複除去
}

/**
 * 検索結果フォーマッター（分析プロンプト用）
 */
export function formatGuidelinesForPrompt(guidelines: SearchResult[]): string {
  if (guidelines.length === 0) {
    return '関連するガイドラインが見つかりませんでした。';
  }

  return guidelines.map((guideline, index) => {
    return `
【ガイドライン ${index + 1}】
出典: ${guideline.source}
カテゴリ: ${guideline.category}
内容: ${guideline.content}
関連度: ${(guideline.combined_score * 100).toFixed(1)}%
`;
  }).join('\n');
} 