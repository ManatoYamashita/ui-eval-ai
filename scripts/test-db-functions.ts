#!/usr/bin/env tsx

import { typedSupabaseAdmin } from '../app/lib/supabase';

interface FunctionTest {
  name: string;
  test: () => Promise<void>;
}

/**
 * PostgreSQL関数のテスト実行
 */
async function testDatabaseFunctions(): Promise<void> {
  console.log('🔧 PostgreSQL関数のテストを開始します...\n');

  const tests: FunctionTest[] = [
    {
      name: 'データベース接続確認',
      test: testConnection
    },
    {
      name: 'テーブル存在確認',
      test: testTablesExist
    },
    {
      name: '関数存在確認',
      test: testFunctionsExist
    },
    {
      name: 'キーワード検索関数',
      test: testKeywordSearch
    },
    {
      name: 'カテゴリ検索関数',
      test: testCategorySearch
    },
    {
      name: 'ハイブリッド検索関数',
      test: testHybridSearch
    },
    {
      name: 'カテゴリ別ハイブリッド検索関数',
      test: testCategoryHybridSearch
    }
  ];

  let passedTests = 0;
  let failedTests = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 ${test.name}をテスト中...`);
      await test.test();
      console.log(`✅ ${test.name}: 成功\n`);
      passedTests++;
    } catch (error) {
      console.error(`❌ ${test.name}: 失敗`);
      console.error(`   エラー: ${error instanceof Error ? error.message : String(error)}\n`);
      failedTests++;
    }
  }

  console.log('📊 テスト結果:');
  console.log(`✅ 成功: ${passedTests}`);
  console.log(`❌ 失敗: ${failedTests}`);
  console.log(`📈 成功率: ${Math.round((passedTests / tests.length) * 100)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 すべてのテストが成功しました！');
  } else {
    console.log('\n⚠️ 一部のテストが失敗しました。上記のエラーを確認してください。');
  }
}

/**
 * データベース接続テスト
 */
async function testConnection(): Promise<void> {
  const { count, error } = await typedSupabaseAdmin
    .from('design_guidelines')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`データベース接続エラー: ${error.message}`);
  }

  console.log(`   📊 ガイドライン数: ${count || 0}`);
}

/**
 * テーブル存在確認
 */
async function testTablesExist(): Promise<void> {
  const { error } = await typedSupabaseAdmin
    .from('design_guidelines')
    .select('id')
    .limit(1);

  if (error) {
    throw new Error(`テーブルアクセスエラー: ${error.message}`);
  }

  console.log(`   📋 design_guidelinesテーブル: 存在確認`);
}

/**
 * 関数存在確認
 */
async function testFunctionsExist(): Promise<void> {
  const { error } = await typedSupabaseAdmin
    .rpc('refresh_search_statistics');

  if (error) {
    throw new Error(`統計更新関数エラー: ${error.message}`);
  }

  console.log(`   🔧 PostgreSQL関数: 正常にアクセス可能`);
}

/**
 * キーワード検索テスト
 */
async function testKeywordSearch(): Promise<void> {
  const { data, error } = await typedSupabaseAdmin
    .rpc('search_by_keywords', {
      keywords: ['accessibility', 'button'],
      match_count: 3
    });

  if (error) {
    throw new Error(`キーワード検索エラー: ${error.message}`);
  }

  console.log(`   🔍 キーワード検索結果: ${data?.length || 0}件`);
}

/**
 * カテゴリ検索テスト
 */
async function testCategorySearch(): Promise<void> {
  const { data, error } = await typedSupabaseAdmin
    .rpc('search_by_category', {
      target_categories: ['accessibility', 'usability'],
      match_count: 3
    });

  if (error) {
    throw new Error(`カテゴリ検索エラー: ${error.message}`);
  }

  console.log(`   📂 カテゴリ検索結果: ${data?.length || 0}件`);
}

/**
 * ハイブリッド検索テスト
 */
async function testHybridSearch(): Promise<void> {
  // 768次元のダミーベクトルを作成
  const dummyVector = Array(768).fill(0.1);

  const { data, error } = await typedSupabaseAdmin
    .rpc('hybrid_search', {
      query_text: 'accessibility button design',
      query_embedding: dummyVector,
      match_threshold: 0.5,
      match_count: 3
    });

  if (error) {
    throw new Error(`ハイブリッド検索エラー: ${error.message}`);
  }

  console.log(`   🔄 ハイブリッド検索結果: ${data?.length || 0}件`);
}

/**
 * カテゴリ別ハイブリッド検索テスト
 */
async function testCategoryHybridSearch(): Promise<void> {
  // 768次元のダミーベクトルを作成
  const dummyVector = Array(768).fill(0.1);

  const { data, error } = await typedSupabaseAdmin
    .rpc('hybrid_search_by_category', {
      query_text: 'accessibility button design',
      query_embedding: dummyVector,
      target_categories: ['accessibility', 'usability'],
      match_threshold: 0.5,
      match_count: 3
    });

  if (error) {
    throw new Error(`カテゴリ別ハイブリッド検索エラー: ${error.message}`);
  }

  console.log(`   📊 カテゴリ別ハイブリッド検索結果: ${data?.length || 0}件`);
}

// メイン実行
if (require.main === module) {
  testDatabaseFunctions().catch(error => {
    console.error('🔥 テスト実行エラー:', error);
    process.exit(1);
  });
} 