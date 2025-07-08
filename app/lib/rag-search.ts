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
  console.log('🔍 Starting hybrid search for:', query);

  try {
    const { 
      categories = ['accessibility', 'usability', 'visual_design'],
      threshold = 0.7,
      limit = 5
    } = options;

    // クエリの埋め込み生成
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(query);
    } catch (embeddingError) {
      console.error('❌ Embedding generation failed:', embeddingError);
      console.log('🔄 Falling back to text-only search due to embedding failure...');
      return performTextOnlySearch(query, options);
    }

    // まず基本的なハイブリッド検索を試行
    console.log('🔍 Trying basic hybrid search first...');
    let basicSearchResults = null;
    let basicError = null;
    
    try {
      const { data, error } = await typedSupabaseAdmin
        .rpc('hybrid_search', {
          query_text: query,
          query_embedding: queryEmbedding,
          match_threshold: threshold,
          match_count: limit
        });
      basicSearchResults = data;
      basicError = error;
    } catch (rpcError) {
      console.error('❌ RPC call failed for hybrid_search:', rpcError);
      basicError = rpcError;
    }

    if (!basicError && basicSearchResults && basicSearchResults.length > 0) {
      const processingTime = Date.now() - startTime;
      console.log('✅ Basic hybrid search completed, found', basicSearchResults.length, 'results');
      
      return {
        results: basicSearchResults || [],
        query,
        totalResults: basicSearchResults?.length || 0,
        processingTime
      };
    }

    // 基本検索が失敗した場合、カテゴリ別検索を試行
    console.log('🔍 Trying category-based hybrid search...');
    let categorySearchResults = null;
    let categoryError = null;
    
    try {
      const { data, error } = await typedSupabaseAdmin
        .rpc('hybrid_search_by_category', {
          query_text: query,
          query_embedding: queryEmbedding,
          target_categories: categories,
          match_threshold: threshold,
          match_count: limit
        });
      categorySearchResults = data;
      categoryError = error;
    } catch (rpcError) {
      console.error('❌ RPC call failed for hybrid_search_by_category:', rpcError);
      categoryError = rpcError;
    }

    if (!categoryError && categorySearchResults) {
      const processingTime = Date.now() - startTime;
      console.log('✅ Category hybrid search completed, found', categorySearchResults.length, 'results');
      
      return {
        results: categorySearchResults || [],
        query,
        totalResults: categorySearchResults?.length || 0,
        processingTime
      };
    }

    // 両方の検索が失敗した場合、エラーをログに出力してフォールバックへ
    if (basicError) {
      console.error('Basic hybrid search error:', basicError);
    }
    if (categoryError) {
      console.error('Category hybrid search error:', categoryError);
    }

    // データベース関数が存在しない場合のエラーメッセージをチェック
    const isDBFunctionError = (error: unknown) => {
      return error && typeof error === 'object' && error !== null && (
        (error as { message?: string }).message?.includes('Could not find the function') ||
        (error as { message?: string }).message?.includes('function') && (error as { message?: string }).message?.includes('does not exist') ||
        (error as { code?: string }).code === 'PGRST202'
      );
    };

    if (isDBFunctionError(basicError) || isDBFunctionError(categoryError)) {
      console.log('🔄 Database functions not found, falling back to text-only search...');
      return performTextOnlySearch(query, options);
    }

    throw new Error('Both hybrid search methods failed');

  } catch (error) {
    console.error('❌ RAG search error:', error);
    
    // Gemini APIエラーの場合はフォールバック検索を実行
    if (error instanceof Error && error.message.includes('Failed to generate embedding')) {
      console.log('🔄 Falling back to text-only search...');
      return performTextOnlySearch(query, options);
    }
    
    // データベース関数エラーの場合もフォールバック
    if (error instanceof Error && (
      error.message.includes('Could not find the function') ||
      error.message.includes('Both hybrid search methods failed')
    )) {
      console.log('🔄 Database function not found, falling back to text-only search...');
      return performTextOnlySearch(query, options);
    }
    
    // 最終的なフォールバック
    console.log('🔄 Unexpected error, falling back to text-only search...');
    return performTextOnlySearch(query, options);
  }
}

/**
 * フォールバック用テキスト検索（埋め込み不要）
 */
async function performTextOnlySearch(
  query: string,
  options: RAGSearchOptions = {}
): Promise<RAGSearchResult> {
  
  const startTime = Date.now();
  
  try {
    const { 
      categories = ['accessibility', 'usability', 'visual_design'],
      limit = 5
    } = options;

    console.log('📝 Performing optimized text-only search as fallback...');

    // 複数の検索戦略を並行実行
    const searchPromises = [
      // 全文検索（主要検索）
      typedSupabaseAdmin
        .from('design_guidelines')
        .select('id, content, source, category, subcategory, metadata')
        .textSearch('content', query, { type: 'websearch', config: 'english' })
        .in('category', categories)
        .limit(limit),
      
      // キーワードベースの部分一致検索（補完）
      typedSupabaseAdmin
        .from('design_guidelines')
        .select('id, content, source, category, subcategory, metadata')
        .ilike('content', `%${query}%`)
        .in('category', categories)
        .limit(Math.ceil(limit / 2))
    ];

    const [fullTextResult, keywordResult] = await Promise.all(searchPromises);

    // 結果をマージして重複排除
    const allResults = [
      ...(fullTextResult.data || []),
      ...(keywordResult.data || [])
    ];

    // 重複除去（IDベース）
    const uniqueResults = allResults.reduce((acc, current) => {
      if (!acc.find(item => item.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, [] as typeof allResults);

    // SearchResult形式に変換（検索順序でスコア付与）
    const formattedResults: SearchResult[] = uniqueResults
      .slice(0, limit)
      .map((result, index) => ({
        id: result.id,
        content: result.content,
        source: result.source,
        category: result.category,
        similarity_score: 0, // テキスト検索では類似度スコアなし
        text_rank: 1 - (index * 0.1), // 順位ベースのスコア
        combined_score: 1 - (index * 0.1),
        metadata: result.metadata
      }));

    const processingTime = Date.now() - startTime;
    console.log('✅ Optimized text search completed in', processingTime, 'ms, found', formattedResults.length, 'results');

    return {
      results: formattedResults,
      query,
      totalResults: formattedResults.length,
      processingTime
    };

  } catch (error) {
    console.error('❌ Text-only search error:', error);
    
    // 最後のフォールバック: 基本的なカテゴリ検索
    console.log('🔄 Falling back to basic category search...');
    return performBasicCategorySearch(options.categories || ['accessibility', 'usability', 'visual_design'], startTime);
  }
}

/**
 * 最終フォールバック: 基本的なカテゴリ検索
 */
async function performBasicCategorySearch(
  categories: string[], 
  startTime: number
): Promise<RAGSearchResult> {
  try {
    console.log('🔄 Performing basic category search as final fallback...');

    const { data: searchResults, error } = await typedSupabaseAdmin
      .from('design_guidelines')
      .select('id, content, source, category, subcategory, metadata')
      .in('category', categories)
      .limit(5);

    if (error) {
      throw new Error(`Basic search failed: ${error.message}`);
    }

    const formattedResults: SearchResult[] = (searchResults || []).map((result, index) => ({
      id: result.id,
      content: result.content,
      source: result.source,
      category: result.category,
      similarity_score: 0,
      text_rank: 0.5,
      combined_score: 0.5 - (index * 0.1),
      metadata: result.metadata
    }));

    const processingTime = Date.now() - startTime;
    console.log('✅ Basic category search completed, found', formattedResults.length, 'results');

    return {
      results: formattedResults,
      query: 'fallback search',
      totalResults: formattedResults.length,
      processingTime
    };

  } catch (error) {
    console.error('❌ Basic category search failed:', error);
    
    // 完全なフォールバック: 空の結果を返す
    return {
      results: [],
      query: 'failed search',
      totalResults: 0,
      processingTime: Date.now() - startTime
    };
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
    console.log('🔍 Attempting keyword search with:', keywords);
    
    // まずPostgreSQL関数を試行
    const { data: results, error } = await typedSupabaseAdmin
      .rpc('search_by_keywords', {
        keywords,
        match_count: limit
      });

    if (error) {
      console.error('Keyword search function error:', error);
      
      // 関数が存在しない場合、手動でキーワード検索を実行
      if (error.message.includes('Could not find the function')) {
        console.log('🔄 Function not found, trying manual keyword search...');
        return performManualKeywordSearch(keywords, limit);
      }
      
      throw new Error(`Keyword search failed: ${error.message}`);
    }

    // キーワード検索結果をSearchResult形式に変換
    const formattedResults = (results || []).map((result: KeywordSearchResult) => ({
      id: result.id,
      content: result.content,
      source: result.source,
      category: result.category,
      similarity_score: 0, // キーワード検索では類似度スコアなし
      text_rank: 0,
      combined_score: result.matched_keywords?.length || 0,
      metadata: result.metadata
    }));

    console.log('✅ Keyword search completed, found', formattedResults.length, 'results');
    return formattedResults;

  } catch (error) {
    console.error('Keyword search error:', error);
    
    // フォールバック: 手動キーワード検索
    try {
      console.log('🔄 Attempting manual keyword search fallback...');
      return await performManualKeywordSearch(keywords, limit);
    } catch (fallbackError) {
      console.error('Manual keyword search also failed:', fallbackError);
      throw new Error('Failed to perform keyword search');
    }
  }
}

/**
 * 手動キーワード検索（PostgreSQL関数が利用できない場合）
 */
async function performManualKeywordSearch(
  keywords: string[],
  limit: number
): Promise<SearchResult[]> {
  
  console.log('🔍 Performing manual keyword search...');
  
  // すべてのガイドラインを取得して、JavaScriptでキーワード検索
  const { data: allGuidelines, error } = await typedSupabaseAdmin
    .from('design_guidelines')
    .select('id, content, source, category, subcategory, metadata, keywords')
    .limit(100); // 最大100件に制限

  if (error) {
    throw new Error(`Manual keyword search failed: ${error.message}`);
  }

  // JavaScriptでキーワードマッチング
  const matchedResults = (allGuidelines || [])
    .map(guideline => {
      const matchedKeywords: string[] = [];
      let matchScore = 0;

      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        
        // コンテンツ内の検索
        if (guideline.content.toLowerCase().includes(keywordLower)) {
          matchedKeywords.push(keyword);
          matchScore += 2; // コンテンツマッチは高得点
        }
        
        // キーワード配列内の検索
        if (guideline.keywords && guideline.keywords.some((gkw: string) => 
          gkw.toLowerCase().includes(keywordLower)
        )) {
          matchedKeywords.push(keyword);
          matchScore += 1;
        }
      });

      return {
        ...guideline,
        matchedKeywords,
        matchScore
      };
    })
    .filter(result => result.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  // SearchResult形式に変換
  const formattedResults: SearchResult[] = matchedResults.map(result => ({
    id: result.id,
    content: result.content,
    source: result.source,
    category: result.category,
    similarity_score: 0,
    text_rank: 0,
    combined_score: result.matchScore,
    metadata: result.metadata
  }));

  console.log('✅ Manual keyword search completed, found', formattedResults.length, 'results');
  return formattedResults;
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
    
    // 各検索を個別に試行し、失敗したものはスキップ
    let hybridResults: RAGSearchResult | null = null;
    let keywordResults: SearchResult[] = [];

    // ハイブリッド検索を試行
    try {
      hybridResults = await searchByUIElements(detectedElements, textQuery, { ...options, limit: 3 });
    } catch (error) {
      console.warn('Hybrid search failed, continuing with other methods:', error);
    }

    // キーワード検索を試行（関数が存在する場合のみ）
    try {
      keywordResults = await searchByKeywords(keywords, 3);
    } catch (error) {
      console.warn('Keyword search failed, skipping:', error);
    }

    // 結果をマージ
    const allResults = [
      ...(hybridResults?.results || []),
      ...keywordResults
    ];

    if (allResults.length === 0) {
      // すべての検索が失敗した場合、基本的なカテゴリ検索を実行
      console.log('🔄 All searches failed, trying basic category search...');
      const fallbackResult = await performBasicCategorySearch(
        options.categories || ['accessibility', 'usability', 'visual_design'],
        startTime
      );
      return fallbackResult;
    }

    // 重複除去とスコア統合
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
    
    // 最終フォールバック: 基本カテゴリ検索
    console.log('🔄 Multi-modal search failed, using basic category search...');
    return await performBasicCategorySearch(
      options.categories || ['accessibility', 'usability', 'visual_design'],
      Date.now()
    );
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
    
    // 最終フォールバック: 基本的な検索結果を返す
    console.log('🔄 Using final fallback: basic category search...');
    return await performFinalFallbackSearch(detectedElements, userPrompt);
  }
}

/**
 * 最終フォールバック検索（すべてのAPI失敗時）
 */
async function performFinalFallbackSearch(
  detectedElements: string[],
  userPrompt: string
): Promise<SearchResult[]> {
  
  try {
    console.log('📚 Performing final fallback search without external APIs...');
    
    // カテゴリを推測（UI要素から）
    const categories = inferCategoriesFromElements(detectedElements);
    
    // 基本的なカテゴリ検索（Supabaseクライアント直接使用）
    const { data: results, error } = await typedSupabaseAdmin
      .from('design_guidelines')
      .select('id, content, source, category, subcategory, metadata')
      .in('category', categories)
      .limit(5);

    if (error) {
      console.error('Final fallback search error:', error);
      return getHardcodedFallbackResults(userPrompt);
    }

    const formattedResults: SearchResult[] = (results || []).map((result, index) => ({
      id: result.id,
      content: result.content,
      source: result.source,
      category: result.category,
      similarity_score: 0,
      text_rank: 0,
      combined_score: 0.5 - (index * 0.1),
      metadata: result.metadata
    }));

    console.log('✅ Final fallback search found', formattedResults.length, 'results');
    return formattedResults;

  } catch (error) {
    console.error('❌ Final fallback search failed:', error);
    return getHardcodedFallbackResults(userPrompt);
  }
}

/**
 * UI要素からカテゴリを推測
 */
function inferCategoriesFromElements(elements: string[]): string[] {
  const elementCategoryMap: Record<string, string[]> = {
    'button': ['accessibility', 'usability'],
    'text': ['accessibility', 'visual_design'],
    'form': ['accessibility', 'usability'],
    'navigation': ['usability', 'visual_design'],
    'color': ['accessibility', 'visual_design'],
    'layout': ['visual_design', 'usability']
  };

  const categories = new Set<string>();
  
  elements.forEach(element => {
    const cats = elementCategoryMap[element.toLowerCase()];
    if (cats) {
      cats.forEach(cat => categories.add(cat));
    }
  });

  return categories.size > 0 
    ? Array.from(categories)
    : ['accessibility', 'usability', 'visual_design'];
}

/**
 * ハードコードされたフォールバック結果（最後の手段）
 */
function getHardcodedFallbackResults(userPrompt: string): SearchResult[] {
  console.log('📝 Using hardcoded fallback results...');
  
  const fallbackGuidelines: SearchResult[] = [
    {
      id: -1,
      content: 'アクセシビリティを確保するため、すべてのインタラクティブ要素は最小44px×44pxのタッチターゲットサイズを持つ必要があります。これにより、モバイルデバイスでの操作性が向上します。',
      source: 'WCAG 2.1',
      category: 'accessibility',
      similarity_score: 0.8,
      text_rank: 0.7,
      combined_score: 0.75,
      metadata: { level: 'AA', priority: 'high' }
    },
    {
      id: -2,
      content: '色のコントラスト比は、通常テキストで4.5:1以上、大きなテキスト（18pt以上）で3:1以上を確保する必要があります。これにより視覚的なアクセシビリティが向上します。',
      source: 'WCAG 2.1',
      category: 'accessibility',
      similarity_score: 0.7,
      text_rank: 0.8,
      combined_score: 0.73,
      metadata: { level: 'AA', priority: 'high' }
    },
    {
      id: -3,
      content: 'ユーザーインターフェースの一貫性を保つため、同じ機能を持つ要素は統一されたデザインパターンを使用してください。ナビゲーション、ボタン、フォーム要素などで一貫性を保ちます。',
      source: 'Apple HIG',
      category: 'usability',
      similarity_score: 0.6,
      text_rank: 0.7,
      combined_score: 0.63,
      metadata: { platform: 'universal', priority: 'medium' }
    },
    {
      id: -4,
      content: 'レイアウトでは視覚的階層を明確にし、重要な情報から順番に配置してください。大きなサイズ、高いコントラスト、上部配置により重要度を表現します。',
      source: 'Refactoring UI',
      category: 'visual_design',
      similarity_score: 0.5,
      text_rank: 0.6,
      combined_score: 0.53,
      metadata: { topic: 'layout', priority: 'medium' }
    }
  ];

  // ユーザープロンプトに関連する結果をフィルタリング
  const relevantResults = fallbackGuidelines.filter(guideline => {
    const prompt = userPrompt.toLowerCase();
    const content = guideline.content.toLowerCase();
    const category = guideline.category.toLowerCase();
    
    return prompt.includes(category) || 
           content.includes('アクセシビリティ') && prompt.includes('アクセシ') ||
           content.includes('ユーザビリティ') && prompt.includes('使いやす') ||
           content.includes('デザイン') && prompt.includes('デザイン') ||
           prompt.includes('改善') || prompt.includes('問題');
  });

  return relevantResults.length > 0 ? relevantResults : fallbackGuidelines.slice(0, 3);
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