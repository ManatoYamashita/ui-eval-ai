# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**UI Evaluation AI**は、AIを活用してデザイン画像を分析し、権威あるガイドライン（WCAG、Apple HIG、Refactoring UI）に基づいた専門的な改善提案を提供するWebアプリケーションです。

## 開発コマンド

### 基本コマンド
```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# リント実行
npm run lint

# TypeScript型チェック（リント内で実行）
npm run lint
```

### データベース関連
```bash
# データベース初期設定とガイドラインインポート
npm run setup-db

# ガイドラインのインポートのみ
npm run import-guidelines

# エンベディング生成
npm run generate-embeddings
```

### API動作確認
```bash
# すべてのAPIエンドポイントをテスト
npm run test-apis
```

## アーキテクチャ概要

### ディレクトリ構造
- `app/`: Next.js App Routerのメインディレクトリ
  - `api/`: APIエンドポイント（analyze、embed、search）
  - `components/ui/`: 再利用可能なUIコンポーネント
  - `lib/`: ビジネスロジックとユーティリティ
  - `types/`: TypeScript型定義
  - `desgin-knowledgebase/`: デザインガイドラインのJSONデータ

### 主要な処理フロー
1. **画像アップロード**: FileUploadコンポーネントでユーザーが画像をアップロード
2. **画像分析**: Google Gemini 1.5 Flashを使用してUI要素を識別
3. **ガイドライン検索**: ハイブリッド検索（ベクトル＋全文検索）で関連ガイドラインを取得
4. **改善提案生成**: 分析結果とガイドラインを統合して具体的な提案を生成

### 多層フォールバック戦略
APIエラーや検索失敗時でも動作を継続するための6層のフォールバック：
1. ハイブリッド検索（ベクトル＋全文検索）
2. テキスト専用検索
3. キーワード検索
4. 手動キーワード検索
5. 基本カテゴリ検索
6. ハードコード改善提案

### AI統合
- **画像分析**: Google Gemini 1.5 Flash（コスト最適化）
- **テキスト埋め込み**: Google Text Embedding 004（768次元）
- **プロンプト戦略**: lib/prompt-engineering.tsで管理

### データベース構造
Supabase（PostgreSQL）を使用：
- `guidelines`: ガイドライン情報とエンベディング
- pgvector拡張機能でベクトル検索
- 全文検索用のインデックス設定

### 開発時の注意点
1. **環境変数**: `.env.local`に必須の環境変数を設定
2. **型安全性**: TypeScript strictモードが有効（any型は使用禁止）
3. **エラーハンドリング**: 各層でtry-catchを実装し、フォールバック処理を確保
4. **ログ出力**: 開発時はconsole.logで詳細なデバッグ情報を出力

### Cursorルール
`.cursor/rules/`配下のルールファイルを参照：
- `general.mdc`: プロジェクト固有のルール
- `dev.mdc`: 開発標準
- `implement.mdc`: PDCAサイクルによる実装プロセス
- `github.mdc`: Issue管理