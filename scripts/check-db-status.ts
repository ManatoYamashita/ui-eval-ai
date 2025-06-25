#!/usr/bin/env npx tsx

/**
 * データベース状況確認スクリプト
 */

import { config } from 'dotenv';
import { join } from 'path';

// .env.localを明示的に読み込み
config({ path: join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

async function checkDatabaseStatus() {
  console.log('🔍 データベース状況確認中...\n');

  // 環境変数の確認
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('📋 環境変数確認:');
  console.log('  NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.log('  GOOGLE_GENAI_API_KEY:', !!process.env.GOOGLE_GENAI_API_KEY);
  console.log('');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 必要な環境変数が設定されていません');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. design_guidelines テーブルの確認
    console.log('📊 design_guidelines テーブル確認...');
    const { count: totalCount, error: countError } = await supabase
      .from('design_guidelines')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ テーブル確認エラー:', countError.message);
    } else {
      console.log('✅ テーブル行数:', totalCount, '件');
    }

    // 2. カテゴリ別の件数確認
    if (totalCount && totalCount > 0) {
      console.log('\n📈 カテゴリ別データ確認...');
      const { data: categories, error: catError } = await supabase
        .from('design_guidelines')
        .select('category')
        .limit(1000);

      if (!catError && categories) {
        const categoryCount: Record<string, number> = {};
        categories.forEach(row => {
          categoryCount[row.category] = (categoryCount[row.category] || 0) + 1;
        });
        
        Object.entries(categoryCount).forEach(([category, count]) => {
          console.log(`  ${category}: ${count}件`);
        });
      }
    }

    // 3. 関数の確認
    console.log('\n🔧 PostgreSQL関数確認...');
    const functions = [
      'hybrid_search',
      'hybrid_search_by_category', 
      'search_by_keywords',
      'search_by_category'
    ];

    for (const funcName of functions) {
      try {
        const { error } = await supabase.rpc(funcName, {});
        if (error && !error.message.includes('required')) {
          console.log(`❌ ${funcName}: 存在しない`);
        } else {
          console.log(`✅ ${funcName}: 存在する`);
        }
      } catch (e) {
        console.log(`❌ ${funcName}: 存在しない`);
      }
    }

    // 4. 簡単な検索テスト
    if (totalCount && totalCount > 0) {
      console.log('\n🧪 基本検索テスト...');
      const { data: testData, error: testError } = await supabase
        .from('design_guidelines')
        .select('id, content, source, category')
        .limit(3);

      if (testError) {
        console.error('❌ 検索テストエラー:', testError.message);
      } else {
        console.log('✅ 検索テスト成功:', testData?.length, '件取得');
        testData?.forEach(item => {
          console.log(`  - ${item.source}: ${item.content.substring(0, 50)}...`);
        });
      }
    }

  } catch (error) {
    console.error('❌ データベース接続エラー:', error);
  }

  console.log('\n📋 確認完了');
}

if (require.main === module) {
  checkDatabaseStatus().catch(console.error);
} 