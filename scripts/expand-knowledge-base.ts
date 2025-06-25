#!/usr/bin/env npx tsx

/**
 * 知識ベース拡充スクリプト
 * WCAG、Apple HIG、Refactoring UI等のガイドラインを大幅拡充
 */

import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// 環境設定
config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_GENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const genai = new GoogleGenAI({ apiKey: googleApiKey });

// 拡張ガイドラインデータ
const EXPANDED_GUIDELINES = [
  // WCAG 2.1 - アクセシビリティ
  {
    content: 'フォームには明確なラベルと指示を提供し、エラーメッセージは具体的で理解しやすい内容にする必要があります。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'forms',
    keywords: ['フォーム', 'ラベル', 'エラー', '入力', 'バリデーション']
  },
  {
    content: 'リンクやボタンのテキストは、その要素の目的を明確に示す必要があります。「こちら」や「詳細」のような曖昧な表現は避けてください。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'link_purpose',
    keywords: ['リンク', 'ボタン', 'テキスト', '目的', 'わかりやすさ']
  },
  {
    content: 'オーディオやビデオコンテンツには、キャプション（字幕）や音声解説を提供する必要があります。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'media',
    keywords: ['ビデオ', 'オーディオ', 'キャプション', '字幕', 'メディア']
  },
  {
    content: 'ページの見出し構造（h1-h6）は論理的な階層を保ち、コンテンツの構造を適切に表現する必要があります。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'headings',
    keywords: ['見出し', 'h1', 'h2', '階層', '構造']
  },
  {
    content: 'セッションタイムアウトがある場合、ユーザーに事前に警告し、延長する機会を提供する必要があります。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'session_timeout',
    keywords: ['セッション', 'タイムアウト', '警告', '延長']
  },

  // Apple HIG - ユーザビリティ
  {
    content: 'アプリの主要機能は直感的に理解でき、最小限のタップ数でアクセスできるように設計する必要があります。',
    source: 'Apple HIG' as const,
    category: 'usability' as const,
    subcategory: 'navigation_efficiency',
    keywords: ['ナビゲーション', '直感的', 'タップ', '効率性', 'iOS']
  },
  {
    content: 'アイコンは文化的に普遍的で、その意味が明確に理解できるものを使用してください。独自アイコンにはラベルを併用することを推奨します。',
    source: 'Apple HIG' as const,
    category: 'visual_design' as const,
    subcategory: 'iconography',
    keywords: ['アイコン', 'ラベル', '理解しやすさ', 'iOS', 'デザイン']
  },
  {
    content: '画面の向きの変更（縦・横）に適応し、コンテンツが適切に表示されるようにデザインする必要があります。',
    source: 'Apple HIG' as const,
    category: 'usability' as const,
    subcategory: 'orientation',
    keywords: ['画面向き', '縦横', 'レスポンシブ', 'iOS', 'レイアウト']
  },
  {
    content: 'ダークモードとライトモードの両方をサポートし、各モードで適切なコントラストと読みやすさを確保してください。',
    source: 'Apple HIG' as const,
    category: 'visual_design' as const,
    subcategory: 'dark_mode',
    keywords: ['ダークモード', 'ライトモード', 'テーマ', 'コントラスト']
  },

  // Refactoring UI - ビジュアルデザイン
  {
    content: 'カードやコンポーネント間の間隔は一貫性を保ち、8pxまたは16pxの倍数を基準にスペーシングを設計してください。',
    source: 'Refactoring UI' as const,
    category: 'visual_design' as const,
    subcategory: 'spacing_system',
    keywords: ['スペーシング', '間隔', '一貫性', '8px', '16px', 'グリッド']
  },
  {
    content: 'テキストの行間（line-height）は1.4-1.6を基準とし、読みやすさを優先してください。長文では1.6以上を推奨します。',
    source: 'Refactoring UI' as const,
    category: 'visual_design' as const,
    subcategory: 'typography_spacing',
    keywords: ['行間', 'line-height', '読みやすさ', 'タイポグラフィ']
  },
  {
    content: 'シャドウ（影）は控えめに使用し、深度を表現する際は複数のシャドウレイヤーを組み合わせて自然な効果を作り出してください。',
    source: 'Refactoring UI' as const,
    category: 'visual_design' as const,
    subcategory: 'shadows',
    keywords: ['シャドウ', '影', '深度', 'レイヤー', '立体感']
  },
  {
    content: 'カラーパレットは3-5色程度に制限し、プライマリ、セカンダリ、アクセントカラーの役割を明確に分けてください。',
    source: 'Refactoring UI' as const,
    category: 'visual_design' as const,
    subcategory: 'color_system',
    keywords: ['カラーパレット', 'プライマリ', 'セカンダリ', 'アクセント', '色彩']
  },

  // モバイル・レスポンシブ対応
  {
    content: 'モバイルファーストでデザインし、768px、1024px、1440pxでのブレークポイントを設定してレスポンシブ対応を行ってください。',
    source: 'Refactoring UI' as const,
    category: 'usability' as const,
    subcategory: 'responsive_design',
    keywords: ['モバイルファースト', 'レスポンシブ', 'ブレークポイント', '768px']
  },
  {
    content: 'フォントサイズは16px以上を基準とし、モバイルでは18px以上を推奨します。小さすぎるテキストは読みにくさの原因となります。',
    source: 'WCAG' as const,
    category: 'accessibility' as const,
    subcategory: 'font_size',
    keywords: ['フォントサイズ', '16px', '18px', '読みやすさ', 'モバイル']
  },

  // パフォーマンス・UX
  {
    content: 'ローディング状態では、進捗を視覚的に示し、推定時間がある場合は表示してユーザーの不安を軽減してください。',
    source: 'Apple HIG' as const,
    category: 'usability' as const,
    subcategory: 'loading_states',
    keywords: ['ローディング', '進捗', '待機時間', 'UX', 'フィードバック']
  },
  {
    content: 'エラー状態では、問題の説明と具体的な解決方法を提示し、ユーザーが次に取るべき行動を明確にしてください。',
    source: 'Apple HIG' as const,
    category: 'usability' as const,
    subcategory: 'error_handling',
    keywords: ['エラー', '解決方法', '行動', 'ガイダンス', 'UX']
  }
];

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: 'text-embedding-004',
    contents: [text.replace(/\n/g, ' ')],
    config: { outputDimensionality: 768 }
  });
  return response.embeddings?.[0]?.values || [];
}

async function addExpandedGuidelines() {
  console.log('🚀 知識ベース拡充を開始します...');
  console.log(`📚 ${EXPANDED_GUIDELINES.length}件の新しいガイドラインを追加中...`);

  // 埋め込み生成
  console.log('🔤 埋め込み生成中...');
  const embeddings: number[][] = [];
  for (let i = 0; i < EXPANDED_GUIDELINES.length; i++) {
    console.log(`  進捗: ${i + 1}/${EXPANDED_GUIDELINES.length}`);
    const embedding = await generateEmbedding(EXPANDED_GUIDELINES[i].content);
    embeddings.push(embedding);
    await new Promise(resolve => setTimeout(resolve, 100)); // レート制限対策
  }

  // データベース挿入
  console.log('💾 データベースに挿入中...');
  const insertData = EXPANDED_GUIDELINES.map((guideline, index) => ({
    content: guideline.content,
    source: guideline.source,
    category: guideline.category,
    subcategory: guideline.subcategory || null,
    embedding: embeddings[index],
    metadata: { priority: 'medium', topic: guideline.subcategory },
    keywords: guideline.keywords
  }));

  const { data, error } = await supabase
    .from('design_guidelines')
    .insert(insertData)
    .select();

  if (error) {
    throw new Error(`データベース挿入エラー: ${error.message}`);
  }

  console.log(`✅ ${data?.length || 0}件の新しいガイドラインを追加しました`);

  // 最終確認
  const { count } = await supabase
    .from('design_guidelines')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 合計ガイドライン数: ${count}件`);
  console.log('🎉 知識ベース拡充が完了しました！');
}

if (require.main === module) {
  addExpandedGuidelines().catch(console.error);
} 