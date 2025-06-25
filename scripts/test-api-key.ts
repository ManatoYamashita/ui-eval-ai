#!/usr/bin/env npx tsx

/**
 * データベース関数作成・テストスクリプト
 * 用途: Supabaseデータベースに必要な関数を作成し、動作確認を行う
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// 環境変数の確認
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 必要な環境変数が設定されていません:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabaseFunctions() {
  console.log('🔧 データベース関数の作成を開始します...');

  try {
    // ハイブリッド検索関数の作成
    console.log('📝 ハイブリッド検索関数を作成中...');
    const hybridSearchSQL = readFileSync(
      join(process.cwd(), 'supabase/functions/hybrid_search.sql'),
      'utf8'
    );

    const { error: hybridError } = await supabase.rpc('query', {
      query: hybridSearchSQL
    });

    if (hybridError) {
      console.error('❌ ハイブリッド検索関数の作成に失敗:', hybridError);
    } else {
      console.log('✅ ハイブリッド検索関数を作成しました');
    }

    // キーワード検索関数の作成
    console.log('📝 キーワード検索関数を作成中...');
    const keywordSearchSQL = readFileSync(
      join(process.cwd(), 'supabase/functions/keyword_search.sql'),
      'utf8'
    );

    const { error: keywordError } = await supabase.rpc('query', {
      query: keywordSearchSQL
    });

    if (keywordError) {
      console.error('❌ キーワード検索関数の作成に失敗:', keywordError);
    } else {
      console.log('✅ キーワード検索関数を作成しました');
    }

  } catch (error) {
    console.error('❌ 関数作成中にエラーが発生:', error);
  }
}

async function testDatabaseFunctions() {
  console.log('\n🧪 データベース関数のテストを開始します...');

  try {
    // ハイブリッド検索のテスト
    console.log('🔍 ハイブリッド検索関数をテスト中...');
    const { data: hybridData, error: hybridError } = await supabase
      .rpc('hybrid_search', {
        query_text: 'accessibility button',
        query_embedding: new Array(768).fill(0), // ダミーの埋め込みベクトル
        match_threshold: 0.5,
        match_count: 3
      });

    if (hybridError) {
      console.error('❌ ハイブリッド検索テスト失敗:', hybridError);
    } else {
      console.log('✅ ハイブリッド検索テスト成功:', hybridData?.length || 0, '件の結果');
    }

    // キーワード検索のテスト
    console.log('🔍 キーワード検索関数をテスト中...');
    const { data: keywordData, error: keywordError } = await supabase
      .rpc('search_by_keywords', {
        keywords: ['accessibility', 'button'],
        match_count: 3
      });

    if (keywordError) {
      console.error('❌ キーワード検索テスト失敗:', keywordError);
    } else {
      console.log('✅ キーワード検索テスト成功:', keywordData?.length || 0, '件の結果');
    }

    // 基本的なカテゴリ検索のテスト
    console.log('🔍 カテゴリ検索関数をテスト中...');
    const { data: categoryData, error: categoryError } = await supabase
      .rpc('search_by_category', {
        target_categories: ['accessibility', 'usability'],
        match_count: 3
      });

    if (categoryError) {
      console.error('❌ カテゴリ検索テスト失敗:', categoryError);
    } else {
      console.log('✅ カテゴリ検索テスト成功:', categoryData?.length || 0, '件の結果');
    }

  } catch (error) {
    console.error('❌ 関数テスト中にエラーが発生:', error);
  }
}

async function checkTableStatus() {
  console.log('\n📊 テーブル状況の確認...');

  try {
    // design_guidelines テーブルの行数確認
    const { count, error } = await supabase
      .from('design_guidelines')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ テーブル確認に失敗:', error);
    } else {
      console.log('📈 design_guidelines テーブル:', count, '件のレコード');
    }

    // インデックスの確認
    const { data: indexes, error: indexError } = await supabase
      .rpc('query', {
        query: `
          SELECT indexname, indexdef 
          FROM pg_indexes 
          WHERE tablename = 'design_guidelines';
        `
      });

    if (indexError) {
      console.error('❌ インデックス確認に失敗:', indexError);
    } else {
      console.log('🗂️  利用可能なインデックス:', indexes?.length || 0, '個');
      indexes?.forEach((idx: { indexname: string; indexdef: string }) => {
        console.log(`  - ${idx.indexname}`);
      });
    }

  } catch (error) {
    console.error('❌ テーブル状況確認中にエラー:', error);
  }
}

async function main() {
  console.log('🚀 Supabase データベース設定スクリプト開始\n');

  await checkTableStatus();
  await setupDatabaseFunctions();
  await testDatabaseFunctions();

  console.log('\n✅ データベース設定スクリプト完了');
  console.log('\n📋 次のステップ:');
  console.log('  1. エラーがある場合は、Supabaseダッシュボードで手動作成');
  console.log('  2. アプリケーションでテスト実行');
  console.log('  3. パフォーマンスの監視');
}

// スクリプト実行
if (require.main === module) {
  main().catch(console.error);
} 