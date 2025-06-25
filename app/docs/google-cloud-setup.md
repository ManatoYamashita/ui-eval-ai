# Google Cloud Console API設定ガイド

## 🚨 現在のエラー: API_KEY_HTTP_REFERRER_BLOCKED

このエラーは、Google Cloud ConsoleでAPIキーに制限が設定されているために発生します。

### エラー詳細
```
Error Code: 403 (PERMISSION_DENIED)
Reason: API_KEY_HTTP_REFERRER_BLOCKED
Message: "Requests from referer <empty> are blocked."
```

## 🛠️ 解決手順

### Step 1: Google Cloud Consoleにアクセス

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 正しいプロジェクトが選択されていることを確認

### Step 2: APIキーの設定変更

1. **左側メニュー** → **APIs & Services** → **Credentials** をクリック

2. **API keys** セクションで該当するAPIキーをクリック

3. **Application restrictions** セクションで以下を変更：
   - 現在の設定: `HTTP referrers (web sites)`
   - **変更後**: `None` を選択

4. **API restrictions** セクションの確認：
   - `Generative Language API` が有効になっていることを確認
   - 無効な場合は、`Restrict key` → `Select APIs` → `Generative Language API` にチェック

5. **Save** ボタンをクリック

### Step 3: 設定の反映待ち

- 設定変更は **5-10分程度** で反映されます
- 反映されるまで少し待ってから再試行してください

## 🔧 代替設定方法（セキュリティを保つ場合）

開発環境でセキュリティを保ちたい場合は、以下の設定を行います：

### HTTP referrer制限の設定

**Application restrictions** で `HTTP referrers (web sites)` を選択し、以下を追加：

```
# 開発環境
http://localhost:3000/*
https://localhost:3000/*

# 本番環境（Vercelの場合）
https://your-domain.vercel.app/*
https://*.vercel.app/*

# プレビュー環境
https://*-your-project.vercel.app/*
```

## 🧪 設定確認方法

### 1. API Testerで確認

```bash
# APIキーのテスト
curl -X POST \
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{"text": "Test message"}]
    }]
  }'
```

### 2. アプリケーションでの確認

1. 開発サーバーを再起動
```bash
npm run dev
```

2. ブラウザで `http://localhost:3000` にアクセス

3. 画像をアップロードして分析を実行

4. ブラウザのデベロッパーツール（F12）→ Consoleタブで正常なログを確認

## 🚀 正常動作時のログ例

```
🖼️ Starting Gemini image analysis...
📝 Prompt length: 525
🖼️ Image data size: 240476 characters
✅ Gemini analysis successful
🔍 Generating embedding for text: test button text layout...
✅ Embedding generated successfully
📚 Found 5 relevant guidelines
```

## ❌ トラブルシューティング

### 問題1: 設定変更後もエラーが続く

**解決策:**
- 10-15分待ってから再試行
- ブラウザキャッシュをクリア（Ctrl+Shift+R）
- 開発サーバーを再起動

### 問題2: APIキーが見つからない

**解決策:**
1. Google Cloud Console → APIs & Services → Credentials
2. "CREATE CREDENTIALS" → "API key" で新しいキーを作成
3. `.env.local` ファイルの `GOOGLE_AI_API_KEY` を更新

### 問題3: プロジェクトでAPIが有効化されていない

**解決策:**
1. Google Cloud Console → APIs & Services → Library
2. "Generative Language API" を検索
3. "ENABLE" ボタンをクリック

## 📋 セキュリティベストプラクティス

### 本番環境での推奨設定

1. **HTTP referrer制限を使用**
   - 本番ドメインのみ許可
   - ワイルドカードは最小限に

2. **API制限の設定**
   - 必要なAPIのみ有効化
   - Generative Language APIのみ許可

3. **使用量の監視**
   - Google Cloud Console → APIs & Services → Quotas
   - アラートの設定

### 環境変数の管理

```bash
# 開発環境
GOOGLE_AI_API_KEY=development_key_with_localhost_restrictions

# 本番環境  
GOOGLE_AI_API_KEY=production_key_with_domain_restrictions
```

## 🔗 参考リンク

- [Google AI API Documentation](https://ai.google.dev/docs)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Generative Language API](https://developers.generativeai.google/api) 