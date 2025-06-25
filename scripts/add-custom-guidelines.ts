#!/usr/bin/env npx tsx

/**
 * カスタムガイドライン手動追加スクリプト
 * WCAGやHIG以外の任意のデザインガイドラインを追加
 */

import { config } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import * as readline from 'readline';
import { readFileSync } from 'fs';

// 環境設定
config({ path: join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const googleApiKey = process.env.GOOGLE_GENAI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const genai = new GoogleGenAI({ apiKey: googleApiKey });

interface CustomGuideline {
  content: string;
  source: string;
  category: 'accessibility' | 'visual_design' | 'usability' | 'performance' | 'security' | 'other';
  subcategory?: string;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
}

// コンソール入力インターフェース
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: [text.replace(/\n/g, ' ')],
      config: { outputDimensionality: 768 }
    });
    return response.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('⚠️  埋め込み生成エラー:', error);
    return [];
  }
}

async function displayCurrentGuidelines() {
  const { data, error } = await supabase
    .from('design_guidelines')
    .select('source, category');

  if (error) {
    console.error('データベース取得エラー:', error);
    return;
  }

  // 手動でグループ化
  const grouped = data?.reduce((acc: Record<string, number>, item: { source: string; category: string }) => {
    const key = `${item.source}-${item.category}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}) || {};

  console.log('\n📊 現在の知識ベース状況:');
  Object.entries(grouped).forEach(([key, count]) => {
    const [source, category] = key.split('-');
    console.log(`  ${source} (${category}): ${count}件`);
  });
}

async function validateGuideline(guideline: CustomGuideline): Promise<boolean> {
  // 重複チェック
  const { data } = await supabase
    .from('design_guidelines')
    .select('content')
    .ilike('content', `%${guideline.content.substring(0, 50)}%`);

  if (data && data.length > 0) {
    console.log('⚠️  類似のガイドラインが既に存在する可能性があります');
    const proceed = await question('続行しますか？ (y/n): ');
    return proceed.toLowerCase() === 'y';
  }
  return true;
}

async function collectGuidelineInfo(): Promise<CustomGuideline> {
  console.log('\n📝 新しいガイドライン情報を入力してください:\n');

  const content = await question('📄 ガイドライン内容: ');
  const source = await question('📚 ソース名 (例: Material Design, Microsoft Fluent, 独自ガイド): ');
  
  console.log('\n📂 カテゴリを選択してください:');
  console.log('  1. accessibility (アクセシビリティ)');
  console.log('  2. visual_design (ビジュアルデザイン)');
  console.log('  3. usability (ユーザビリティ)');
  console.log('  4. performance (パフォーマンス)');
  console.log('  5. security (セキュリティ)');
  console.log('  6. other (その他)');
  
  const categoryChoice = await question('番号を選択 (1-6): ');
  const categories: Record<string, CustomGuideline['category']> = {
    '1': 'accessibility',
    '2': 'visual_design', 
    '3': 'usability',
    '4': 'performance',
    '5': 'security',
    '6': 'other'
  };
  const category = categories[categoryChoice] || 'other';

  const subcategory = await question('🏷️  サブカテゴリ (任意): ');
  
  console.log('\n🔑 キーワードを入力してください (カンマ区切り):');
  const keywordsInput = await question('例: ボタン, UI, デザイン: ');
  const keywords = keywordsInput.split(',').map(k => k.trim()).filter(k => k);

  console.log('\n⭐ 優先度を選択してください:');
  console.log('  1. high (高)');
  console.log('  2. medium (中)');
  console.log('  3. low (低)');
  
  const priorityChoice = await question('番号を選択 (1-3): ');
  const priorities: Record<string, CustomGuideline['priority']> = {
    '1': 'high',
    '2': 'medium',
    '3': 'low'
  };
  const priority = priorities[priorityChoice] || 'medium';

  return {
    content,
    source,
    category,
    subcategory: subcategory || undefined,
    keywords,
    priority
  };
}

async function confirmAndAdd(guideline: CustomGuideline): Promise<boolean> {
  console.log('\n🔍 入力内容を確認してください:');
  console.log(`📄 内容: ${guideline.content}`);
  console.log(`📚 ソース: ${guideline.source}`);
  console.log(`📂 カテゴリ: ${guideline.category}`);
  console.log(`🏷️  サブカテゴリ: ${guideline.subcategory || 'なし'}`);
  console.log(`🔑 キーワード: ${guideline.keywords.join(', ')}`);
  console.log(`⭐ 優先度: ${guideline.priority}`);

  const confirm = await question('\n💾 この内容でガイドラインを追加しますか？ (y/n): ');
  
  if (confirm.toLowerCase() !== 'y') {
    return false;
  }

  console.log('\n🔤 埋め込み生成中...');
  const embedding = await generateEmbedding(guideline.content);
  
  if (embedding.length === 0) {
    console.log('❌ 埋め込み生成に失敗しました。再試行してください。');
    return false;
  }

  console.log('💾 データベースに保存中...');
  const { data, error } = await supabase
    .from('design_guidelines')
    .insert({
      content: guideline.content,
      source: guideline.source,
      category: guideline.category,
      subcategory: guideline.subcategory || null,
      embedding: embedding,
      metadata: { 
        priority: guideline.priority,
        custom: true,
        added_manually: true,
        topic: guideline.subcategory
      },
      keywords: guideline.keywords
    })
    .select();

  if (error) {
    console.error('❌ データベース保存エラー:', error.message);
    return false;
  }

  console.log('✅ ガイドラインが正常に追加されました！');
  console.log(`📝 ID: ${data?.[0]?.id}`);
  return true;
}

async function batchAddFromFile() {
  console.log('\n📄 ファイルからの一括追加機能');
  console.log('次の形式のJSONファイルを作成してください:');
  console.log(`
{
  "guidelines": [
    {
      "content": "ガイドライン内容",
      "source": "ソース名",
      "category": "accessibility",
      "subcategory": "サブカテゴリ(任意)",
      "keywords": ["キーワード1", "キーワード2"],
      "priority": "medium"
    }
  ]
}
  `);
  
  const filePath = await question('JSONファイルのパス: ');
  
  try {
    const fileContent = readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    console.log(`📚 ${data.guidelines.length}件のガイドラインを処理中...`);
    
    for (let i = 0; i < data.guidelines.length; i++) {
      const guideline = data.guidelines[i];
      console.log(`\n進捗: ${i + 1}/${data.guidelines.length}`);
      console.log(`処理中: ${guideline.content.substring(0, 50)}...`);
      
      const embedding = await generateEmbedding(guideline.content);
      
      const { error } = await supabase
        .from('design_guidelines')
        .insert({
          content: guideline.content,
          source: guideline.source,
          category: guideline.category,
          subcategory: guideline.subcategory || null,
          embedding: embedding,
          metadata: { 
            priority: guideline.priority || 'medium',
            custom: true,
            batch_added: true
          },
          keywords: guideline.keywords || []
        });

      if (error) {
        console.error(`❌ エラー (${i + 1}件目):`, error.message);
      } else {
        console.log(`✅ 追加完了 (${i + 1}件目)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 200)); // レート制限対策
    }
    
    console.log('\n🎉 一括追加が完了しました！');
  } catch (error) {
    console.error('❌ ファイル読み込みエラー:', error);
  }
}

async function main() {
  console.log('🎨 カスタムガイドライン追加ツール');
  console.log('=====================================\n');

  // 現状表示
  await displayCurrentGuidelines();

  while (true) {
    console.log('\n🔧 操作を選択してください:');
    console.log('  1. 新しいガイドラインを1件追加');
    console.log('  2. JSONファイルから一括追加');
    console.log('  3. 現在の知識ベース状況を確認');
    console.log('  4. 終了');

    const choice = await question('\n番号を選択: ');

    switch (choice) {
      case '1':
        try {
          const guideline = await collectGuidelineInfo();
          const isValid = await validateGuideline(guideline);
          if (isValid) {
            await confirmAndAdd(guideline);
          }
        } catch (error) {
          console.error('❌ エラーが発生しました:', error);
        }
        break;

      case '2':
        await batchAddFromFile();
        break;

      case '3':
        await displayCurrentGuidelines();
        break;

      case '4':
        console.log('\n👋 ツールを終了します');
        rl.close();
        return;

      default:
        console.log('❌ 無効な選択です');
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { collectGuidelineInfo, confirmAndAdd }; 