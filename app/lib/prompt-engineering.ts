import type { SearchResult } from '../types/guidelines';

export interface UIElement {
  type: string;
  confidence: number;
  description?: string;
}

export interface AnalysisContext {
  userPrompt: string;
  detectedElements: UIElement[];
  relevantGuidelines: SearchResult[];
  imageMetadata?: {
    width: number;
    height: number;
    aspectRatio: number;
    fileName: string;
  };
}

/**
 * UI要素識別用プロンプト生成（Gemini最適化版）
 */
export function generateElementDetectionPrompt(): string {
  return `
Analyze the UI/UX design image and identify elements in the following JSON format:

{
  "elements": [
    {"type": "button", "confidence": 0.95, "description": "Primary button"},
    {"type": "text", "confidence": 0.90, "description": "Heading text"}
  ],
  "layout_type": "landing_page",
  "potential_issues": ["small_targets", "low_contrast"],
  "priorities": ["accessibility", "usability"]
}

Element types: button, form, input, nav, text, image, icon, card, modal
Issues: small_targets, low_contrast, crowded_layout, poor_hierarchy
Priorities: accessibility, usability, visual_design

Return only valid JSON without any additional text or explanation.
`.trim();
}

/**
 * 包括的デザイン分析用プロンプト生成
 */
export function generateComprehensiveAnalysisPrompt(context: AnalysisContext): string {
  const {
    userPrompt,
    detectedElements,
    relevantGuidelines,
    imageMetadata
  } = context;

  const elementsText = detectedElements
    .map(el => `- ${el.type} (信頼度: ${el.confidence})`)
    .join('\n');

  const guidelinesText = formatGuidelinesForPrompt(relevantGuidelines);
  
  const imageInfo = imageMetadata 
    ? `
【画像情報】
- サイズ: ${imageMetadata.width}x${imageMetadata.height}px
- アスペクト比: ${imageMetadata.aspectRatio.toFixed(2)}
- ファイル名: ${imageMetadata.fileName}
`
    : '';

  return `
あなたはUI/UXデザインの専門家です。アップロードされた画像を総合的に分析し、具体的な改善提案を行ってください。

【ユーザーの質問・要望】
${userPrompt}

【検出されたUI要素】
${elementsText}

${imageInfo}

【参考ガイドライン】
${guidelinesText}

【出力形式】
以下のMarkdown形式で回答してください：

## 🔍 現状分析
[デザインの現状と主要な問題点を3-5点で簡潔に記述]

## 💡 改善提案（優先度順）

### 🔴 高優先度
**1. [改善項目名]**
- **問題**: [具体的な問題点]
- **根拠**: [該当するガイドライン名・原則]
- **改善案**: [具体的な解決策]
- **実装**: \`[TailwindCSSクラス例]\`

### 🟡 中優先度
**1. [改善項目名]**
- **問題**: [具体的な問題点]
- **根拠**: [該当するガイドライン名・原則]
- **改善案**: [具体的な解決策]
- **実装**: \`[TailwindCSSクラス例]\`

### 🟢 低優先度
**1. [改善項目名]**
- **問題**: [具体的な問題点]
- **根拠**: [該当するガイドライン名・原則]
- **改善案**: [具体的な解決策]
- **実装**: \`[TailwindCSSクラス例]\`

## 💻 実装例

\`\`\`html
<!-- 改善後のHTMLコード例 -->
<button class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]">
  アクション
</button>
\`\`\`

## 📊 改善効果予測
- **アクセシビリティスコア**: [現在] → [改善後] (予測)
- **ユーザビリティ向上**: [期待される効果]
- **コンバージョン影響**: [予想される影響]

【回答の指針】
1. 各改善提案は具体的で実装可能な内容にする
2. ガイドライン名を明記し根拠を明確にする
3. TailwindCSSクラスは実際に使用可能なものを記載する
4. 優先度は影響度とアクセシビリティの観点から判断する
5. 日本語で分かりやすく説明する
`.trim();
}

/**
 * ガイドライン情報をプロンプト用にフォーマット
 */
function formatGuidelinesForPrompt(guidelines: SearchResult[]): string {
  if (guidelines.length === 0) {
    return '関連するガイドラインが見つかりませんでした。一般的なベストプラクティスに基づいて分析してください。';
  }

  return guidelines.map((guideline, index) => {
    return `
${index + 1}. **${guideline.source}** (${guideline.category})
   ${guideline.content}
   [関連度: ${(guideline.combined_score * 100).toFixed(1)}%]
`;
  }).join('\n');
}

/**
 * カテゴリ別分析プロンプト生成
 */
export function generateCategorySpecificPrompt(
  category: 'accessibility' | 'usability' | 'visual_design',
  context: AnalysisContext
): string {
  const basePrompt = generateComprehensiveAnalysisPrompt(context);
  
  const categoryFocus = {
    accessibility: `
【アクセシビリティ重点分析】
特に以下の観点を重視して分析してください：
- カラーコントラスト（WCAG 2.1 準拠）
- キーボードナビゲーション
- スクリーンリーダー対応
- タッチターゲットサイズ（最小44px×44px）
- フォーカスインジケーター
- 代替テキスト
`,
    usability: `
【ユーザビリティ重点分析】
特に以下の観点を重視して分析してください：
- 情報アーキテクチャの明確性
- ナビゲーションの一貫性
- ユーザーフローの最適化
- エラー防止・処理
- レスポンシブデザイン
- パフォーマンス影響
`,
    visual_design: `
【視覚デザイン重点分析】
特に以下の観点を重視して分析してください：
- 視覚的階層の明確性
- タイポグラフィの統一性
- 色彩設計の効果性
- 空白とレイアウトの最適化
- ブランドアイデンティティの一貫性
- 美的印象とトーン
`
  };

  return basePrompt + '\n' + categoryFocus[category];
}

/**
 * 簡易分析プロンプト生成（高速分析用）
 */
export function generateQuickAnalysisPrompt(
  userPrompt: string,
  guidelines: SearchResult[]
): string {
  const guidelinesText = formatGuidelinesForPrompt(guidelines.slice(0, 3)); // 上位3件のみ

  return `
アップロードされた画像を簡易分析し、主要な改善点を3つ以内で提案してください。

【質問】: ${userPrompt}

【参考ガイドライン】
${guidelinesText}

【出力形式】
## 主要改善点

1. **[問題点]**: [具体的な改善策]
2. **[問題点]**: [具体的な改善策]  
3. **[問題点]**: [具体的な改善策]

各改善点は1-2行で簡潔に記述してください。
`.trim();
}

/**
 * 比較分析プロンプト生成（Before/After用）
 */
export function generateComparisonPrompt(
  beforeAnalysis: string,
  afterPrompt: string
): string {
  return `
前回の分析結果と改善提案に基づいて、新しい画像の改善状況を評価してください。

【前回の分析結果】
${beforeAnalysis}

【新しい評価要求】
${afterPrompt}

【出力形式】
## 🔄 改善状況評価

### ✅ 改善された点
- [具体的な改善点1]
- [具体的な改善点2]

### ⚠️ 残存する課題
- [残っている問題点1]
- [残っている問題点2]

### 🎯 次のステップ
- [追加の改善提案1]
- [追加の改善提案2]

## 📈 総合評価
改善度: [0-100%]
推奨次回アクション: [具体的な提案]
`.trim();
}

/**
 * プロンプト最適化（トークン数制限対応）
 */
export function optimizePromptForTokenLimit(
  prompt: string,
  maxTokens: number = 3000
): string {
  // 簡易トークン数計算（1トークン≈4文字として概算）
  const estimatedTokens = Math.ceil(prompt.length / 4);
  
  if (estimatedTokens <= maxTokens) {
    return prompt;
  }
  
  // トークン制限を超える場合の最適化
  const targetLength = maxTokens * 4 * 0.9; // 90%のマージンを設ける
  
  // セクション別に重要度を設定して削減
  const sections = prompt.split('\n\n');
  const prioritySections = sections.filter(section => 
    section.includes('【ユーザーの質問・要望】') ||
    section.includes('【検出されたUI要素】') ||
    section.includes('【出力形式】')
  );
  
  let optimizedPrompt = prioritySections.join('\n\n');
  
  // まだ長い場合はガイドライン部分を短縮
  if (optimizedPrompt.length > targetLength) {
    optimizedPrompt = optimizedPrompt.replace(
      /【参考ガイドライン】[\s\S]*?(?=【|$)/,
      '【参考ガイドライン】\n関連するベストプラクティスを参考に分析してください。\n'
    );
  }
  
  return optimizedPrompt;
}

/**
 * 多言語対応プロンプト生成
 */
export function generateLocalizedPrompt(
  context: AnalysisContext,
  locale: 'ja' | 'en' = 'ja'
): string {
  if (locale === 'en') {
    return generateEnglishAnalysisPrompt(context);
  }
  
  return generateComprehensiveAnalysisPrompt(context);
}

function generateEnglishAnalysisPrompt(context: AnalysisContext): string {
  const {
    userPrompt,
    detectedElements,
    relevantGuidelines
  } = context;

  const elementsText = detectedElements
    .map(el => `- ${el.type} (confidence: ${el.confidence})`)
    .join('\n');

  const guidelinesText = relevantGuidelines.map((guideline, index) => {
    return `${index + 1}. **${guideline.source}** (${guideline.category})\n   ${guideline.content}`;
  }).join('\n');

  return `
You are a UI/UX design expert. Analyze the uploaded image and provide specific improvement recommendations.

**User Request**: ${userPrompt}

**Detected UI Elements**:
${elementsText}

**Relevant Guidelines**:
${guidelinesText}

**Output Format**:
## 🔍 Current Analysis
[Describe current state and main issues in 3-5 points]

## 💡 Improvement Recommendations (by Priority)

### 🔴 High Priority
**1. [Improvement Item]**
- **Issue**: [Specific problem]
- **Guideline**: [Applicable guideline/principle]
- **Solution**: [Specific fix]
- **Implementation**: \`[TailwindCSS classes]\`

### 🟡 Medium Priority
[Similar format]

### 🟢 Low Priority
[Similar format]

## 💻 Implementation Example
\`\`\`html
<!-- Improved HTML code example -->
\`\`\`

## 📊 Expected Impact
- **Accessibility Score**: [Current] → [After] (predicted)
- **Usability Improvement**: [Expected effect]
- **Conversion Impact**: [Predicted impact]
`.trim();
} 