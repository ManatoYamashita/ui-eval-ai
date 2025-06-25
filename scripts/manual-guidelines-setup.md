# 📝 カスタムガイドライン手動追加ガイド

UI Evaluation AIプロジェクトにWCAG・Apple HIG以外の独自ガイドラインを追加するための完全ガイドです。

## 🎯 概要

このガイドでは、以下のナレッジを手動で知識ベースに追加できます：
- **Material Design ガイドライン**
- **Microsoft Fluent Design**
- **Ant Design 原則**
- **会社独自のデザインガイド**
- **UX/UIベストプラクティス**
- **パフォーマンス・セキュリティガイドライン**

## 🚀 クイックスタート

### 1. インタラクティブ追加（推奨）

```bash
# 対話形式で1件ずつ追加
npm run add-guidelines
```

**操作の流れ:**
1. ガイドライン内容を入力
2. ソース名を指定（例: Material Design）
3. カテゴリを選択（accessibility, visual_design, usability等）
4. キーワードを設定
5. 優先度を選択
6. 確認後に自動保存

### 2. 一括追加（効率的）

```bash
# JSONファイルから複数件を一括追加
npm run add-guidelines
# → メニューで「2. JSONファイルから一括追加」を選択
```

## 📄 JSONファイル形式

### テンプレートファイル
```bash
# サンプルテンプレートをコピー
cp scripts/custom-guidelines-template.json my-guidelines.json
```

### JSON構造
```json
{
  "guidelines": [
    {
      "content": "ガイドライン内容（日本語OK）",
      "source": "ソース名",
      "category": "カテゴリ名",
      "subcategory": "サブカテゴリ（任意）",
      "keywords": ["キーワード1", "キーワード2"],
      "priority": "high|medium|low"
    }
  ]
}
```

### カテゴリ一覧
- `accessibility` - アクセシビリティ
- `visual_design` - ビジュアルデザイン
- `usability` - ユーザビリティ
- `performance` - パフォーマンス
- `security` - セキュリティ
- `other` - その他

## 📚 具体的な追加例

### Material Design ガイドラインの追加

```json
{
  "guidelines": [
    {
      "content": "Floating Action Button (FAB) は画面上で最も重要なアクションを表し、各画面に1つだけ配置してください。",
      "source": "Material Design",
      "category": "visual_design",
      "subcategory": "buttons",
      "keywords": ["FAB", "フローティングアクションボタン", "重要アクション"],
      "priority": "high"
    },
    {
      "content": "カードコンポーネントは関連情報をグループ化し、8dpの角丸と適切なエレベーション（影）を使用してください。",
      "source": "Material Design",
      "category": "visual_design",
      "subcategory": "cards",
      "keywords": ["カード", "グループ化", "エレベーション", "角丸"],
      "priority": "medium"
    }
  ]
}
```

### 会社独自ガイドラインの追加

```json
{
  "guidelines": [
    {
      "content": "当社ブランドカラーは#0066CCを基調とし、アクセントカラーには#FF6B35を使用してください。",
      "source": "社内デザインガイド",
      "category": "visual_design",
      "subcategory": "brand_colors",
      "keywords": ["ブランドカラー", "カラーパレット", "会社色"],
      "priority": "high"
    },
    {
      "content": "重要な通知には必ず音声読み上げ対応のAria-labelを設定し、視覚障害のあるユーザーにも情報を伝達してください。",
      "source": "社内アクセシビリティガイド",
      "category": "accessibility",
      "subcategory": "notifications",
      "keywords": ["通知", "音声読み上げ", "aria-label", "アクセシビリティ"],
      "priority": "high"
    }
  ]
}
```

## 🔧 高度な使用方法

### 1. キーワード設定のコツ

**効果的なキーワードの例:**
```json
{
  "keywords": [
    "ボタン",           // 基本的な要素名
    "プライマリボタン",   // 具体的な種類
    "CTA",             // 略語・専門用語
    "コンバージョン",    // 関連概念
    "アクション"        // 機能的側面
  ]
}
```

### 2. プライオリティの使い分け

- **high**: 必須ルール、法的要件、ブランドに関わる重要事項
- **medium**: 推奨事項、ベストプラクティス
- **low**: 細かな改善提案、将来的な検討事項

### 3. 重複チェック機能

スクリプトは自動で類似ガイドラインをチェックし、重複を警告します。

## 📊 状況確認コマンド

```bash
# 現在の知識ベース状況を確認
npm run check-db

# または対話的に確認
npm run add-guidelines
# → メニューで「3. 現在の知識ベース状況を確認」を選択
```

**出力例:**
```
📊 現在の知識ベース状況:
  WCAG (accessibility): 5件
  Apple HIG (visual_design): 3件
  Refactoring UI (visual_design): 3件
  Material Design (visual_design): 2件
  社内ガイド (accessibility): 1件
```

## 🔍 追加後の確認方法

### 1. システム動作確認
```bash
# アプリを起動してテスト
npm run dev
# http://localhost:3000 で画像分析を実行
```

### 2. 検索機能テスト
追加したキーワードを含む質問で分析を実行し、新しいガイドラインが引用されることを確認してください。

**テスト例:**
- 「ボタンデザインの改善点は？」
- 「Material Designに準拠させるには？」
- 「アクセシビリティを向上させる方法は？」

## ⚠️ 注意事項

### 1. 環境変数設定
```bash
# .env.local に以下が設定されていることを確認
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-key
GOOGLE_GENAI_API_KEY=your-google-ai-key
```

### 2. データベース接続確認
```bash
# データベース接続をテスト
npm run check-db
```

### 3. レート制限
- Google AI APIには使用制限があります
- 大量追加時は自動的に間隔を空けます
- エラーが発生した場合は時間を置いて再実行してください

## 🎯 ベストプラクティス

### 1. ガイドライン品質
- **具体的**: 曖昧な表現ではなく具体的な指示
- **実装可能**: 実際に適用できる内容
- **測定可能**: 成果を確認できる基準

### 2. カテゴリ分類
- **明確な分類**: 適切なカテゴリを選択
- **一貫性**: 同じソースからのガイドラインは統一性を保つ
- **サブカテゴリ活用**: 詳細な分類で検索精度向上

### 3. キーワード設定
- **多様性**: 同義語・関連語を含める
- **日英両対応**: 英語キーワードも併記
- **専門用語**: UI/UX専門用語を活用

## 🚀 次のステップ

1. **基本ガイドライン追加**: まずは使用頻度の高いMaterial DesignやFluent Designから
2. **社内ガイドライン整備**: 独自のデザインシステムを体系化
3. **継続的更新**: 新しいトレンドやガイドラインを定期的に追加
4. **効果測定**: 分析結果の品質向上を確認

---

**🎨 あなただけのカスタムナレッジベースを構築して、より精度の高いAI分析を実現しましょう！** 