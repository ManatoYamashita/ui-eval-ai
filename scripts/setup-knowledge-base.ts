#!/usr/bin/env npx tsx
// scripts/setup-knowledge-base.ts
// 知識ベース構築スクリプト

import { typedSupabaseAdmin } from '../app/lib/supabase';
import { generateEmbeddings } from '../app/lib/ai-clients';

// 知識ベースデータの型定義
interface GuidelineData {
  content: string;
  source: 'WCAG' | 'Apple HIG' | 'Refactoring UI';
  category: 'accessibility' | 'usability' | 'visual_design';
  subcategory?: string;
  metadata?: Record<string, unknown>;
  keywords?: string[];
}

// WCAGガイドライン（サンプル）
const wcagGuidelines: GuidelineData[] = [
  {
    content: 'テキストと背景色のコントラスト比は4.5:1以上を保つ必要があります。大きなテキスト（18pt以上）の場合は3:1以上で十分です。',
    source: 'WCAG',
    category: 'accessibility',
    subcategory: 'color_contrast',
    metadata: { level: 'AA', priority: 'high' },
    keywords: ['コントラスト', '色', 'テキスト', 'アクセシビリティ', 'WCAG']
  },
  {
    content: 'すべてのインタラクティブ要素には適切なフォーカスインジケーターを提供する必要があります。',
    source: 'WCAG',
    category: 'accessibility',
    subcategory: 'keyboard_navigation',
    metadata: { level: 'AA', priority: 'high' },
    keywords: ['フォーカス', 'キーボード', 'ナビゲーション', 'アクセシビリティ']
  },
  {
    content: '画像には適切な代替テキスト（alt属性）を提供する必要があります。装飾的な画像の場合は空のalt属性を使用します。',
    source: 'WCAG',
    category: 'accessibility',
    subcategory: 'images',
    metadata: { level: 'A', priority: 'high' },
    keywords: ['画像', 'alt', '代替テキスト', 'アクセシビリティ']
  },
  {
    content: 'タッチターゲットのサイズは最小44px×44pxを確保する必要があります。',
    source: 'WCAG',
    category: 'accessibility',
    subcategory: 'touch_targets',
    metadata: { level: 'AA', priority: 'medium' },
    keywords: ['タッチ', 'ボタン', 'サイズ', 'モバイル', 'アクセシビリティ']
  }
];

// Apple HIG ガイドライン（サンプル）
const appleHIGGuidelines: GuidelineData[] = [
  {
    content: 'システムフォントのSan Franciscoを使用し、動的な文字サイズ設定に対応する必要があります。',
    source: 'Apple HIG',
    category: 'visual_design',
    subcategory: 'typography',
    metadata: { platform: 'iOS', priority: 'medium' },
    keywords: ['フォント', 'タイポグラフィ', 'San Francisco', 'iOS']
  },
  {
    content: 'ナビゲーションは一貫性を保ち、ユーザーが現在の位置を常に把握できるようにする必要があります。',
    source: 'Apple HIG',
    category: 'usability',
    subcategory: 'navigation',
    metadata: { platform: 'iOS', priority: 'high' },
    keywords: ['ナビゲーション', 'ユーザビリティ', '一貫性', 'iOS']
  },
  {
    content: 'Color（色）だけに依存しない情報伝達を行い、形状や位置でも情報を伝える必要があります。',
    source: 'Apple HIG',
    category: 'accessibility',
    subcategory: 'color_usage',
    metadata: { platform: 'iOS', priority: 'high' },
    keywords: ['色', 'アクセシビリティ', '情報伝達', 'iOS']
  }
];

// Refactoring UI ガイドライン（サンプル）
const refactoringUIGuidelines: GuidelineData[] = [
  {
    content: '視覚的階層を作るために、フォントサイズ、色、余白を組み合わせて使用します。',
    source: 'Refactoring UI',
    category: 'visual_design',
    subcategory: 'visual_hierarchy',
    metadata: { topic: 'design_systems', priority: 'high' },
    keywords: ['視覚的階層', 'フォント', '色', '余白', 'デザイン']
  },
  {
    content: 'ボタンは明確な階層を持つべきです。プライマリ、セカンダリ、ターシャリーの区別を明確にします。',
    source: 'Refactoring UI',
    category: 'usability',
    subcategory: 'buttons',
    metadata: { topic: 'interactive_elements', priority: 'medium' },
    keywords: ['ボタン', '階層', 'プライマリ', 'セカンダリ', 'UI']
  },
  {
    content: '空白（ホワイトスペース）を効果的に使用してコンテンツをグループ化し、読みやすさを向上させます。',
    source: 'Refactoring UI',
    category: 'visual_design',
    subcategory: 'spacing',
    metadata: { topic: 'layout', priority: 'medium' },
    keywords: ['空白', 'ホワイトスペース', 'レイアウト', '読みやすさ']
  }
];

// 全ガイドラインのマージ
const allGuidelines: GuidelineData[] = [
  ...wcagGuidelines,
  ...appleHIGGuidelines,
  ...refactoringUIGuidelines
];

// メイン実行関数
async function setupKnowledgeBase(): Promise<void> {
  console.log('🚀 知識ベース構築を開始します...');
  
  try {
    // 1. 既存データの確認
    console.log('📊 既存データを確認中...');
    const { count: existingCount } = await typedSupabaseAdmin
      .from('design_guidelines')
      .select('*', { count: 'exact', head: true });
    
    console.log(`既存のガイドライン数: ${existingCount || 0}`);
    
    // 2. 埋め込み生成
    console.log('🔤 テキスト埋め込みを生成中...');
    const texts = allGuidelines.map(g => g.content);
    const embeddings = await generateEmbeddings(texts);
    
    if (embeddings.length !== allGuidelines.length) {
      throw new Error('埋め込み生成に失敗しました');
    }
    
    // 3. データベースに挿入
    console.log('💾 データベースに挿入中...');
    const insertData = allGuidelines.map((guideline, index) => ({
      content: guideline.content,
      source: guideline.source,
      category: guideline.category,
      subcategory: guideline.subcategory || null,
      embedding: embeddings[index],
      metadata: guideline.metadata || null,
      keywords: guideline.keywords || null
    }));
    
    const { data, error } = await typedSupabaseAdmin
      .from('design_guidelines')
      .insert(insertData)
      .select();
    
    if (error) {
      throw new Error(`データベース挿入エラー: ${error.message}`);
    }
    
    console.log(`✅ ${data?.length || 0}件のガイドラインを挿入しました`);
    
    // 4. 統計情報の更新
    console.log('📈 統計情報を更新中...');
    await typedSupabaseAdmin.rpc('refresh_search_statistics');
    
    // 5. 検索テスト
    console.log('🔍 検索機能をテスト中...');
    const testQuery = 'ボタンのデザイン';
    const testEmbedding = await generateEmbeddings([testQuery]);
    
    const { data: searchResults } = await typedSupabaseAdmin
      .rpc('hybrid_search', {
        query_text: testQuery,
        query_embedding: testEmbedding[0],
        match_count: 3
      });
    
    console.log(`検索テスト結果: ${searchResults?.length || 0}件`);
    
    console.log('🎉 知識ベース構築が完了しました！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// データベースリセット関数（危険！）
async function resetKnowledgeBase(): Promise<void> {
  console.log('⚠️  知識ベースをリセットします...');
  
  const { error } = await typedSupabaseAdmin
    .from('design_guidelines')
    .delete()
    .neq('id', 0); // 全削除
  
  if (error) {
    throw new Error(`リセットエラー: ${error.message}`);
  }
  
  console.log('🗑️  既存データを削除しました');
}

// コマンドライン引数の処理
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--reset')) {
    await resetKnowledgeBase();
  }
  
  await setupKnowledgeBase();
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
} 