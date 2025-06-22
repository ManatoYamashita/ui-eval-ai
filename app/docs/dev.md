<!-- app/docs/dev.md -->

# UI Evaluation AI: 開発リファレンスドキュメント

**🎯 このドキュメントの目的**: AIアシスタントが常に参照し、プロジェクトの方向性を保ちながら実装を進めるためのマスタードキュメント

**📝 更新ルール**: 実装過程で新しい知見や変更が生じた場合、このドキュメントに追記・更新を行う
実装手順の項目を完了したら、該当項目にチェックを入れる。

---

## 📋 プロジェクト概要

### システムの目的

ユーザーがデザイン画像をアップロードし、「このデザインの改善点は？」などの自然言語質問に対して、WCAG・Apple HIG・Refactoring UIなどの権威あるガイドラインに基づいた専門的な改善提案を提供するWebアプリケーション。

### ターゲットユーザー

- **デザイナー**: 客観的なデザイン評価とガイドライン準拠確認
- **フロントエンドエンジニア**: 実装レベルでの改善提案（TailwindCSSコード付き）
- **プロダクトマネージャー**: デザイン品質の定量的評価

### 核心価値

1. **専門性**: 業界標準ガイドラインに基づく信頼性の高い分析
2. **実用性**: 具体的なコード例を含む実装可能な改善提案
3. **アクセシビリティ**: 自然言語での質問に対応、専門知識不要

---

## 🏗️ システムアーキテクチャ

### 全体構成

``` plaintext
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│    Frontend         │    │    Supabase         │    │    AI Services      │
│    (Next.js 15)     │    │   (PostgreSQL +     │    │                     │
│                     │    │    pgvector)        │    │                     │
│  ┌───────────────┐  │    │                     │    │  ┌───────────────┐  │
│  │ File Upload   │  │    │  ┌───────────────┐  │    │  │ Claude 3.5    │  │
│  │ Component     │  │────┤  │ Vector Search │  │    │  │ Haiku         │  │
│  └───────────────┘  │    │  │ (Guidelines)  │  │    │  └───────────────┘  │
│                     │    │  └───────────────┘  │    │                     │
│  ┌───────────────┐  │    │                     │    │  ┌───────────────┐  │
│  │ Analysis      │  │    │  ┌───────────────┐  │    │  │ OpenAI        │  │
│  │ Results UI    │  │────┤  │ Hybrid Search │  │    │  │ Embeddings    │  │
│  └───────────────┘  │    │  │ Function      │  │    │  └───────────────┘  │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

### データフロー

1. **入力**: ユーザーが画像とプロンプトをアップロード
2. **要素識別**: AI APIで画像のUI要素を自動分析
3. **知識検索**: Supabaseでハイブリッド検索実行（ベクトル+全文）
4. **分析実行**: 関連ガイドライン + 画像をAI APIに送信
5. **結果表示**: 構造化された改善提案をUI表示

---

## 💻 技術スタック

### フロントエンド

- **Next.js 15**: App Router使用
- **TypeScript**: 厳密な型安全性
- **TailwindCSS**: ユーティリティファーストCSS
- **React Hook Form**: フォーム状態管理

### バックエンド・データベース

- **Supabase**: PostgreSQL + pgvector + 認証
- **PostgreSQL Functions**: カスタムSQL関数でハイブリッド検索
- **Row Level Security**: データ保護

### AI・機械学習

- **Google Gemini 1.5 Flash**: 画像分析・改善提案生成（コスト最適化）
  - Input: $0.075/1M tokens (vs Claude $15/1M tokens: **200倍削減**)
  - Output: $0.30/1M tokens (vs Claude $75/1M tokens: **250倍削減**)
- **Google Text Embedding 004**: テキストベクトル化（768次元）
  - $0.00001/token (vs OpenAI $0.0001/token: **10倍削減**)
- **pgvector**: ベクトル類似度検索

### インフラ・デプロイメント

- **Vercel**: フロントエンド + API Routes
- **Supabase Cloud**: マネージドPostgreSQL

**💰 コスト削減効果**: 従来比約**95%削減**（月100回分析で約$150→$7.5）

---

## 📊 データベース設計

### メインテーブル: design_guidelines

```sql
CREATE TABLE design_guidelines (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,                    -- ガイドライン本文
  source VARCHAR(100) NOT NULL,             -- WCAG, Apple HIG, Refactoring UI
  category VARCHAR(50) NOT NULL,            -- accessibility, usability, visual_design
  subcategory VARCHAR(100),                 -- color_contrast, touch_targets, typography
  embedding VECTOR(1536),                   -- OpenAI embeddings (1536次元)
  metadata JSONB,                          -- 追加情報（レベル、重要度等）
  keywords TEXT[],                         -- 検索用キーワード配列
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- パフォーマンス最適化インデックス
CREATE INDEX design_guidelines_embedding_idx 
ON design_guidelines 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX design_guidelines_content_gin_idx 
ON design_guidelines 
USING gin(to_tsvector('japanese', content));

CREATE INDEX design_guidelines_category_idx 
ON design_guidelines (source, category);
```

### 重要なPostgreSQL関数

```sql
-- ハイブリッド検索関数（ベクトル検索 + 全文検索）
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id BIGINT,
  content TEXT,
  source VARCHAR(100),
  category VARCHAR(50),
  similarity_score FLOAT,
  text_rank FLOAT,
  combined_score FLOAT,
  metadata JSONB
)
LANGUAGE SQL
AS $$
  WITH vector_search AS (
    SELECT 
      id, content, source, category, metadata,
      1 - (embedding <=> query_embedding) AS similarity_score
    FROM design_guidelines
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ),
  text_search AS (
    SELECT 
      id, content, source, category, metadata,
      ts_rank_cd(
        to_tsvector('japanese', content), 
        plainto_tsquery('japanese', query_text)
      ) AS text_rank
    FROM design_guidelines
    WHERE to_tsvector('japanese', content) @@ plainto_tsquery('japanese', query_text)
  )
  SELECT 
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.content, t.content) AS content,
    COALESCE(v.source, t.source) AS source,
    COALESCE(v.category, t.category) AS category,
    COALESCE(v.similarity_score, 0) AS similarity_score,
    COALESCE(t.text_rank, 0) AS text_rank,
    (COALESCE(v.similarity_score, 0) * 0.7 + COALESCE(t.text_rank, 0) * 0.3) AS combined_score,
    COALESCE(v.metadata, t.metadata) AS metadata
  FROM vector_search v
  FULL OUTER JOIN text_search t ON v.id = t.id
  ORDER BY combined_score DESC
  LIMIT match_count;
$$;
```

---

## 🔧 主要機能の実装仕様

### 1. ファイルアップロード機能

**仕様**:

- 対応形式: JPEG, PNG, GIF, webP
- 最大サイズ: 10MB
- クライアントサイド前処理: リサイズ、画質最適化

**実装場所**: `app/components/FileUpload.tsx`

### 2. AI画像分析機能

**段階的分析プロセス**:

```typescript
// 分析フロー
async function analyzeDesign(image: File, prompt: string): Promise<AnalysisResult> {
  // 1. 画像前処理
  const processedImage = await preprocessImage(image);
  
  // 2. UI要素識別
  const elements = await identifyDesignElements(processedImage);
  
  // 3. 関連ガイドライン検索
  const guidelines = await searchRelevantGuidelines(elements, prompt);
  
  // 4. 構造化プロンプト生成
  const analysisPrompt = generateAnalysisPrompt(elements, guidelines, prompt);
  
  // 5. AI分析実行
  const result = await callClaudeAPI(processedImage, analysisPrompt);
  
  return result;
}
```

**実装場所**: `app/lib/ai-analysis.ts`

### 3. RAG検索システム

**検索戦略**:

- **ベクトル検索**: セマンティックな類似性（重み: 70%）
- **全文検索**: キーワードマッチング（重み: 30%）
- **動的クエリ生成**: 識別されたUI要素に基づく自動検索

**実装場所**: `app/lib/rag-search.ts`

---

## 🛠️ API設計

### メイン分析API

**エンドポイント**: `POST /api/analyze`

**リクエスト**:

```typescript
interface AnalyzeRequest {
  image: File;     // 画像ファイル（FormData）
  prompt: string;  // ユーザーの質問
}
```

**レスポンス**:

```typescript
interface AnalyzeResponse {
  success: boolean;
  analysis: {
    current_issues: string;           // 現状の問題点
    improvements: {
      priority: 'high' | 'medium' | 'low';
      title: string;
      problem: string;
      solution: string;
      implementation: string;        // TailwindCSSコード例
      guideline_reference: string;
    }[];
    predicted_impact: {
      accessibility_score: number;
      usability_improvement: string;
      conversion_impact: string;
    };
  };
  guidelines_used: {
    source: string;
    content: string;
    relevance_score: number;
  }[];
  processing_time: number;
  error?: string;
}
```

### 補助API

**ガイドライン検索**: `POST /api/search`
**テキスト埋め込み**: `POST /api/embed`

---

## 📁 プロジェクト構造

``` bash

ui-eval-ai/
├── app/
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts              # メイン分析API
│   │   ├── search/
│   │   │   └── route.ts              # ガイドライン検索API
│   │   └── embed/
│   │       └── route.ts              # テキスト埋め込みAPI
│   ├── components/
│   │   ├── ui/
│   │   │   ├── FileUpload.tsx        # ファイルアップロードUI
│   │   │   ├── AnalysisResult.tsx    # 分析結果表示UI
│   │   │   ├── LoadingSpinner.tsx    # ローディング表示
│   │   │   └── ErrorMessage.tsx      # エラー表示UI
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   ├── lib/
│   │   ├── supabase.ts              # Supabase設定・クライアント
│   │   ├── ai-clients.ts            # AI API クライアント
│   │   ├── ai-analysis.ts           # 画像分析ロジック
│   │   ├── rag-search.ts            # RAG検索ロジック
│   │   ├── image-processing.ts      # 画像前処理
│   │   ├── prompt-engineering.ts    # プロンプト生成
│   │   └── utils.ts                 # ユーティリティ関数
│   ├── types/
│   │   ├── analysis.ts              # 分析関連の型定義
│   │   ├── guidelines.ts            # ガイドライン関連の型定義
│   │   └── api.ts                   # API関連の型定義
│   ├── page.tsx                     # メインページ
│   ├── layout.tsx                   # ルートレイアウト
│   └── globals.css                  # グローバルスタイル
├── scripts/
│   ├── setup-knowledge-base.ts      # 知識ベース構築スクリプト
│   └── migrate-data.ts              # データマイグレーション
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # 初期スキーマ
│   │   └── 002_add_indexes.sql      # インデックス追加
│   └── functions/
│       └── hybrid_search.sql        # ハイブリッド検索関数
├── public/
│   └── examples/                    # サンプル画像
├── docs/
│   ├── setup.md                     # セットアップ手順
│   └── api.md                       # API仕様書
├── .env.local.example               # 環境変数テンプレート
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

---

## 🚀 実装手順

### Phase 1: プロジェクト基盤構築 ✅

- [x] **Next.jsプロジェクト初期化**
  - [x] プロジェクト作成・依存関係インストール
  - [x] TypeScript設定・型定義作成
  - [x] 基本ディレクトリ構造作成

- [x] **基本コンポーネント作成**
  - [x] `LoadingSpinner.tsx`: ローディングUI
  - [x] `FileUpload.tsx`: ファイルアップロード（ドラッグ&ドロップ対応）
  - [x] `page.tsx`: メインページレイアウト

- [ ] **環境変数設定**
  - [ ] Supabase接続情報
  - [ ] AI API キー設定

### Phase 2: データベース・RAGシステム構築 ✅

- [x] **Supabaseセットアップ**
  - [x] プロジェクト作成（要手動設定）
  - [x] pgvector拡張有効化
  - [x] テーブル作成・インデックス設定
  - [x] Supabaseクライアント実装

- [x] **知識ベース構築**
  - [x] `setup-knowledge-base.ts`作成
  - [x] WCAG、Apple HIG、Refactoring UIガイドライン投入
  - [x] 埋め込み生成・保存

- [x] **RAG検索実装**
  - [x] ハイブリッド検索関数作成
  - [x] `rag-search.ts`実装
  - [x] 検索API実装(`/api/search`)
  - [x] 埋め込みAPI実装(`/api/embed`)

- [x] **AI APIクライアント**
  - [x] OpenAI埋め込み生成
  - [x] Claude画像分析クライアント
  - [x] バッチ処理対応

### Phase 3: AI分析システム実装 ✅

- [x] **画像前処理システム**
  - [x] `image-processing.ts`実装
  - [x] 画像リサイズ・最適化
  - [x] Base64エンコーディング
  - [x] ファイル形式変換

- [x] **UI要素識別システム**
  - [x] 要素識別プロンプト実装
  - [x] Gemini API画像分析
  - [x] 構造化データ抽出

- [x] **プロンプトエンジニアリング**
  - [x] `prompt-engineering.ts`実装
  - [x] 動的プロンプト生成
  - [x] ガイドライン統合
  - [x] 出力形式最適化

- [x] **メイン分析API**
  - [x] `/api/analyze`エンドポイント実装
  - [x] 分析パイプライン統合
  - [x] エラーハンドリング
  - [x] レスポンス最適化

- [x] **分析結果表示UI**
  - [x] `AnalysisResult.tsx`実装
  - [x] 結果の構造化表示
  - [x] TailwindCSSコード表示
  - [x] 改善提案UI

### Phase 4: UI/UX改善・最適化

1. **ユーザーインターフェース改善**
   - 分析結果の見やすい表示
   - ローディング状態の改善
   - レスポンシブ対応

2. **パフォーマンス最適化**
   - 画像圧縮
   - APIレスポンス時間改善
   - キャッシュ戦略

---

## 🎯 品質基準・成功指標

### 技術品質基準

- **TypeScript**: 厳密な型チェック、any型の使用禁止
- **レスポンス時間**: 分析完了まで10秒以内
- **エラーハンドリング**: 全APIで適切なエラーレスポンス
- **セキュリティ**: ファイルアップロードの厳格なバリデーション

### 分析品質基準
- **専門性**: 引用ガイドライン名を明記
- **実用性**: TailwindCSSコード例を含む
- **優先度**: 改善提案を重要度順で整理
- **根拠**: 各提案に対する明確な理由付け

### ユーザー体験基準

- **直感性**: 技術知識なしで利用可能
- **信頼性**: 分析結果の一貫性
- **有用性**: 実際に実装できる改善提案

---

## 🔍 プロンプトエンジニアリング指針

### 要素識別プロンプト

``` markdown
画像のUI要素を分析し、以下のJSON形式で返してください：
{
  "elements": ["button", "text", "image", "form", "navigation"],
  "layout_type": "landing_page" | "app_interface" | "website" | "mobile_app",
  "color_scheme": ["primary_color", "secondary_color", "accent_color"],
  "potential_issues": ["low_contrast", "small_buttons", "crowded_layout"],
  "analysis_priorities": ["accessibility", "usability", "visual_design"]
}
簡潔に要点のみ回答してください。
```

### 包括分析プロンプト

``` markdown

あなたはUI/UXデザインの専門家です。アップロードされた画像を分析し、具体的な改善提案を行ってください。

【ユーザーの質問】
{user_prompt}

【検出された要素】
{detected_elements}

【参考ガイドライン】
{relevant_guidelines}

【出力形式】
## 🔍 現状分析
[問題点の詳細]

## 💡 改善提案（優先度順）
### 🔴 高優先度
1. **[改善項目]**
   - 問題: [具体的な問題]
   - 根拠: [ガイドライン名]
   - 改善案: [具体的な解決策]

## 💻 実装例
```css
/* TailwindCSSクラス例 */
.improved-element {
  @apply [具体的なクラス];
}
```

## 📊 改善効果予測

[予想される効果]
```

---

## 🐛 トラブルシューティング

### よくある問題と解決策

1. **画像アップロードエラー**
   - ファイルサイズチェック（10MB以下）
   - MIME typeバリデーション
   - base64エンコーディング確認

2. **AI API レスポンスエラー**
   - API キーの有効性確認
   - レート制限チェック
   - プロンプトの長さ確認

3. **ベクトル検索の精度低下**
   - embedding品質確認
   - 検索閾値調整（0.7推奨）
   - インデックス再構築

4. **日本語全文検索の問題**
   - PostgreSQL日本語辞書設定確認
   - to_tsvector関数の言語設定

---

## 📝 開発ログ・更新履歴

### [更新日] - [更新者] - [変更内容]
<!-- 実装過程での変更や学んだ知見をここに追記 -->

**例:**
- 2024-01-15 - AI Assistant - 初期ドキュメント作成
- 2024-01-16 - AI Assistant - プロンプトエンジニアリング最適化
- 2024-01-17 - AI Assistant - エラーハンドリング強化

---

## 🔗 参考リソース

### 技術ドキュメント
- [Next.js 15 App Router](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)

### デザインガイドライン
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Refactoring UI](https://refactoringui.com/)

---

**🎯 開発時の注意点**:
このドキュメントを常に参照し、実装が仕様から逸脱しないよう注意してください。新しい知見や変更点は必ずこのドキュメントに反映し、次の開発セッションで共有できるようにしてください。