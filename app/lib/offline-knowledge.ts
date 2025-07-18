/**
 * オフライン時のローカルナレッジベース機能
 * データベース接続失敗時のフォールバック機能強化
 */

import wcag22 from '../desgin-knowledgebase/wcag22.json';
import appleHig from '../desgin-knowledgebase/apple-hig.json';
import refactoringUi from '../desgin-knowledgebase/refactoring-ui.json';
import type { SearchResult } from '../types/guidelines';

interface LocalKnowledgeItem {
  id?: string;
  content: string;
  source: string;
  category: string;
  subcategory?: string;
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * ローカルナレッジベースの統合データ
 */
const LOCAL_KNOWLEDGE_BASE: LocalKnowledgeItem[] = [
  // WCAG 2.2ガイドライン
  ...((wcag22 as any)?.guidelines || []).map((item: any, index: number) => ({
    id: `wcag-${index}`,
    content: item.content || item.guideline || item.description || '',
    source: 'WCAG 2.2',
    category: item.category || 'accessibility',
    subcategory: item.subcategory || item.type || '',
    keywords: item.keywords || [],
    metadata: { level: item.level, criterion: item.criterion, priority: item.priority }
  })),
  
  // Apple Human Interface Guidelines
  ...((appleHig as any)?.guidelines || []).map((item: any, index: number) => ({
    id: `hig-${index}`,
    content: item.content || item.guideline || item.description || '',
    source: 'Apple HIG',
    category: item.category || 'usability',
    subcategory: item.subcategory || item.component || '',
    keywords: item.keywords || [],
    metadata: { platform: item.platform, component: item.component, priority: item.priority }
  })),
  
  // Refactoring UI
  ...((refactoringUi as any)?.guidelines || []).map((item: any, index: number) => ({
    id: `rui-${index}`,
    content: item.content || item.guideline || item.description || '',
    source: 'Refactoring UI',
    category: item.category || 'visual_design',
    subcategory: item.subcategory || item.topic || '',
    keywords: item.keywords || [],
    metadata: { principle: item.principle, technique: item.technique, priority: item.priority }
  }))
];

/**
 * ローカルナレッジベースでのキーワード検索
 */
export function searchLocalKnowledge(
  query: string,
  elements: string[] = [],
  categories: string[] = ['accessibility', 'usability', 'visual_design'],
  limit: number = 5
): SearchResult[] {
  console.log('🔍 Performing local knowledge search...');
  console.log('📝 Query:', query);
  console.log('🏷️ Elements:', elements);
  console.log('📂 Categories:', categories);

  const startTime = Date.now();
  
  // キーワードの準備
  const queryKeywords = query.toLowerCase().split(/\s+/);
  const elementKeywords = elements.map(el => el.toLowerCase());
  const allKeywords = [...queryKeywords, ...elementKeywords];

  // スコアリング関数
  function calculateScore(item: LocalKnowledgeItem): number {
    let score = 0;
    const contentLower = item.content.toLowerCase();
    const sourceLower = item.source.toLowerCase();
    const categoryLower = item.category.toLowerCase();
    
    // カテゴリマッチング（重要度高）
    if (categories.includes(categoryLower)) {
      score += 10;
    }
    
    // キーワードマッチング
    allKeywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        score += 5;
      }
      if (item.keywords?.some(k => k.toLowerCase().includes(keyword))) {
        score += 3;
      }
    });
    
    // 要素特有のキーワードマッチング
    elementKeywords.forEach(element => {
      if (contentLower.includes(element)) {
        score += 8;
      }
    });
    
    // 日本語キーワードの特別処理
    if (query.includes('アクセシビリティ') && item.source === 'WCAG 2.2') {
      score += 15;
    }
    if (query.includes('ユーザビリティ') && item.source === 'Apple HIG') {
      score += 15;
    }
    if (query.includes('デザイン') && item.source === 'Refactoring UI') {
      score += 15;
    }
    
    return score;
  }

  // 検索とスコアリング
  const scoredResults = LOCAL_KNOWLEDGE_BASE
    .map(item => ({
      item,
      score: calculateScore(item)
    }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // SearchResult形式に変換
  const results: SearchResult[] = scoredResults.map((result, index) => ({
    id: result.item.id || `local-${index}`,
    content: result.item.content,
    source: result.item.source,
    category: result.item.category,
    subcategory: result.item.subcategory || '',
    relevance_score: result.score / 20, // 0-1の範囲に正規化
    metadata: result.item.metadata || {}
  }));

  const processingTime = Date.now() - startTime;
  console.log(`✅ Local knowledge search completed in ${processingTime} ms, found ${results.length} results`);

  return results;
}

/**
 * カテゴリ別のローカル検索
 */
export function searchLocalKnowledgeByCategory(
  category: string,
  limit: number = 10
): SearchResult[] {
  console.log(`🔍 Searching local knowledge by category: ${category}`);

  const results = LOCAL_KNOWLEDGE_BASE
    .filter(item => item.category.toLowerCase() === category.toLowerCase())
    .slice(0, limit)
    .map((item, index) => ({
      id: item.id || `${category}-${index}`,
      content: item.content,
      source: item.source,
      category: item.category,
      subcategory: item.subcategory || '',
      relevance_score: 0.8,
      metadata: item.metadata || {}
    }));

  console.log(`✅ Found ${results.length} results for category: ${category}`);
  return results;
}

/**
 * ローカルナレッジベースの統計情報
 */
export function getLocalKnowledgeStats() {
  const totalItems = LOCAL_KNOWLEDGE_BASE.length;
  const sourceCount = LOCAL_KNOWLEDGE_BASE.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const categoryCount = LOCAL_KNOWLEDGE_BASE.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalItems,
    sourceCount,
    categoryCount,
    isAvailable: totalItems > 0
  };
}

/**
 * 緊急時のハードコードされた改善提案
 */
export const EMERGENCY_SUGGESTIONS = {
  accessibility: [
    {
      title: "コントラスト比の改善",
      description: "テキストと背景のコントラスト比を4.5:1以上にして、視覚的なアクセシビリティを向上させましょう。",
      code: "bg-gray-900 text-white // 高コントラスト"
    },
    {
      title: "タッチターゲットサイズ",
      description: "ボタンやリンクは最小44px×44pxのサイズにして、タッチ操作を改善しましょう。",
      code: "min-h-[44px] min-w-[44px] // 適切なタッチサイズ"
    }
  ],
  usability: [
    {
      title: "視覚的階層の強化",
      description: "見出しサイズとフォントウェイトを調整して、情報の階層を明確にしましょう。",
      code: "text-2xl font-bold // 主見出し\ntext-lg font-semibold // 副見出し"
    },
    {
      title: "余白の最適化",
      description: "適切な余白を設けることで、コンテンツの読みやすさを向上させましょう。",
      code: "p-6 space-y-4 // 適切な余白とスペース"
    }
  ],
  visual_design: [
    {
      title: "カラーパレットの統一",
      description: "一貫したカラーパレットを使用して、デザインの統一感を向上させましょう。",
      code: "bg-blue-500 text-blue-50 // 統一されたブルー系"
    },
    {
      title: "タイポグラフィの改善",
      description: "読みやすいフォントサイズと行間を設定しましょう。",
      code: "text-base leading-relaxed // 読みやすい設定"
    }
  ]
};