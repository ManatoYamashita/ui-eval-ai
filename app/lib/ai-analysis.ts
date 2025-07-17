import { analyzeImageWithGemini, analyzeMultipleImagesWithGemini } from './ai-clients';
import { processImageForAnalysis } from './image-processing';
import { searchRelevantGuidelines } from './rag-search';
import {
  generateElementDetectionPrompt,
  generateComprehensiveAnalysisPrompt,
  generateQuickAnalysisPrompt,
  optimizePromptForTokenLimit,
  type UIElement,
  type AnalysisContext
} from './prompt-engineering';
import type { AnalysisResult, ImprovementSuggestion, PredictedImpact } from '../types/analysis';
import type { SearchResult } from '../types/guidelines';


export interface AnalysisOptions {
  mode?: 'comprehensive' | 'quick';
  maxTokens?: number;
  categories?: string[];
  includeTechnicalDetails?: boolean;
  isComparative?: boolean;
}

/**
 * メイン分析関数（複数画像対応）
 */
export async function analyzeDesign(
  imageFiles: File[],
  userPrompt: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    const {
      mode = 'comprehensive',
      maxTokens = 8000,
      isComparative = false
    } = options;

    console.log(`🖼️ Processing ${imageFiles.length} image(s)... ${isComparative ? '(Comparative Analysis)' : ''}`);
    
    // 1. 複数画像前処理
    const processedImages = await Promise.all(
      imageFiles.map(file => processImageForAnalysis(file))
    );

    // 2. 複数画像のUI要素識別
    console.log('🔍 Detecting UI elements from all images...');
    const allDetectedElements = await Promise.all(
      processedImages.map(async (img, index) => {
        const elements = await detectUIElements(img.base64Data);
        return elements.map(el => ({ ...el, imageIndex: index }));
      })
    );
    const detectedElements = allDetectedElements.flat();

    // 3. 関連ガイドライン検索（比較分析対応）
    console.log('📚 Searching relevant guidelines...');
    const searchQuery = isComparative 
      ? `${userPrompt} comparison usability accessibility guidelines`
      : userPrompt;
    
    const relevantGuidelines = await searchRelevantGuidelines(
      detectedElements.map(el => el.type),
      searchQuery
    );

    // 4. 複数画像分析実行
    console.log('🧠 Performing analysis...');
    const analysisContext: AnalysisContext = {
      userPrompt,
      detectedElements,
      relevantGuidelines,
      imageMetadata: processedImages.map((img, index) => ({
        width: img.width,
        height: img.height,
        aspectRatio: img.width / img.height,
        fileName: imageFiles[index].name,
        imageIndex: index
      })),
      isComparative
    };

    const analysisText = mode === 'quick'
      ? await performQuickAnalysis(processedImages, userPrompt, relevantGuidelines, isComparative)
      : await performComprehensiveAnalysis(processedImages, analysisContext, maxTokens);

    // 5. 結果パース
    console.log('📊 Parsing results...');
    const parsedAnalysis = parseAnalysisResult(analysisText);

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      analysis: parsedAnalysis,
      guidelines_used: relevantGuidelines.map(g => ({
        source: g.source,
        content: g.content,
        relevance_score: g.combined_score
      })),
      processing_time: processingTime
    };

  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    // エラーメッセージを分類
    let userFriendlyError = 'Analysis failed due to technical issues';
    if (error instanceof Error) {
      if (error.message.includes('Network connection failed')) {
        userFriendlyError = 'Network connection issue - analysis completed with offline guidelines';
      } else if (error.message.includes('API key restriction')) {
        userFriendlyError = 'API configuration issue - using offline analysis mode';
      } else if (error.message.includes('Multiple image analysis failed')) {
        userFriendlyError = 'Multi-image analysis unavailable - using basic comparison';
      }
    }
    
    // フォールバック分析を実行（エラー時はデフォルト値を使用）
    console.log('🔄 Performing fallback analysis...');
    const fallbackDetectedElements = ['button', 'text', 'layout']; // デフォルト要素
    const fallbackGuidelines: SearchResult[] = []; // 空のガイドライン配列
    
    try {
      const fallbackAnalysis = await generateFallbackAnalysis(userPrompt, fallbackDetectedElements, fallbackGuidelines);
      
      return {
        success: true, // フォールバック成功時はtrueに変更
        analysis: fallbackAnalysis,
        guidelines_used: [],
        processing_time: Date.now() - startTime,
        error: userFriendlyError
      };
    } catch (fallbackError) {
      console.error('❌ Fallback analysis also failed:', fallbackError);
      
      return {
        success: false,
        analysis: {
          current_issues: 'Analysis could not be completed due to technical issues.',
          improvements: [],
          predicted_impact: {
            accessibility_score: 0,
            usability_improvement: 'Unable to provide assessment',
            conversion_impact: 'Unable to provide assessment'
          }
        },
        guidelines_used: [],
        processing_time: Date.now() - startTime,
        error: userFriendlyError
      };
    }
  }
}

/**
 * 分析フォールバック（AI API失敗時）
 */
async function generateFallbackAnalysis(
  userPrompt: string,
  detectedElements: string[],
  guidelines: SearchResult[]
): Promise<{
  current_issues: string;
  improvements: ImprovementSuggestion[];
  predicted_impact: PredictedImpact;
}> {
  
  console.log('🔄 Generating fallback analysis without AI API...');
  
  try {
    // ユーザープロンプトから改善領域を特定
    const improvementAreas = identifyImprovementAreas(userPrompt, detectedElements);
    
    // ガイドラインから関連する改善提案を抽出
    const improvements = generateGuidelineBasedImprovements(guidelines, improvementAreas);
    
    // 基本的な分析結果を構築
    const fallbackAnalysis = {
      current_issues: generateCurrentIssuesDescription(detectedElements, userPrompt),
      improvements: improvements.slice(0, 5), // 最大5件の改善提案
      predicted_impact: {
        accessibility_score: calculateAccessibilityScore(improvements),
        usability_improvement: 'UIの一貫性と使いやすさが向上します',
        conversion_impact: '改善により、ユーザーエンゲージメントの向上が期待されます'
      }
    };

    console.log('✅ Fallback analysis generated successfully');
    return fallbackAnalysis;

  } catch (error) {
    console.error('❌ Fallback analysis generation failed:', error);
    
    // 最終フォールバック: ハードコードされた基本改善提案
    return getBasicImprovementSuggestions();
  }
}

/**
 * 改善領域の特定
 */
function identifyImprovementAreas(userPrompt: string, elements: string[]): string[] {
  const prompt = userPrompt.toLowerCase();
  const areas: string[] = [];

  // プロンプトから改善領域を推測
  if (prompt.includes('アクセシビリティ') || prompt.includes('accessibility')) {
    areas.push('accessibility');
  }
  if (prompt.includes('使いやす') || prompt.includes('usability') || prompt.includes('ユーザビリティ')) {
    areas.push('usability');
  }
  if (prompt.includes('デザイン') || prompt.includes('visual') || prompt.includes('見た目')) {
    areas.push('visual_design');
  }
  if (prompt.includes('色') || prompt.includes('color') || prompt.includes('コントラスト')) {
    areas.push('color_contrast');
  }
  if (prompt.includes('ボタン') || prompt.includes('button')) {
    areas.push('button_design');
  }

  // 検出された要素から改善領域を推測
  elements.forEach(element => {
    if (element.includes('button') && !areas.includes('button_design')) {
      areas.push('button_design');
    }
    if (element.includes('text') && !areas.includes('typography')) {
      areas.push('typography');
    }
    if (element.includes('color') && !areas.includes('color_contrast')) {
      areas.push('color_contrast');
    }
  });

  return areas.length > 0 ? areas : ['accessibility', 'usability'];
}

/**
 * ガイドラインベースの改善提案生成
 */
function generateGuidelineBasedImprovements(
  guidelines: SearchResult[],
  areas: string[]
): ImprovementSuggestion[] {
  
  const improvements: ImprovementSuggestion[] = [];
  
  // 関連するガイドラインを優先的に処理（areasを活用）
  const relevantGuidelines = guidelines.filter(guideline => 
    areas.some(area => 
      guideline.category === area || 
      guideline.content.toLowerCase().includes(area.toLowerCase())
    )
  );
  
  // 関連ガイドラインが少ない場合は全ガイドラインを使用
  const processGuidelines = relevantGuidelines.length > 0 ? relevantGuidelines : guidelines;
  
  processGuidelines.forEach((guideline, index) => {
    // ガイドラインの内容から改善提案を生成
    const improvement: ImprovementSuggestion = {
      priority: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
      title: extractTitleFromGuideline(guideline.content),
      problem: extractProblemFromGuideline(guideline.content),
      solution: guideline.content.substring(0, 200) + '...',
      implementation: generateTailwindImplementation(guideline.category),
      guideline_reference: `${guideline.source} - ${guideline.category}`
    };
    
    improvements.push(improvement);
  });

  // ガイドラインが不足している場合、基本的な改善提案を追加
  if (improvements.length < 3) {
    improvements.push(...getDefaultImprovements().slice(0, 3 - improvements.length));
  }

  return improvements;
}

/**
 * 現在の問題の説明生成
 */
function generateCurrentIssuesDescription(elements: string[], userPrompt: string): string {
  const issues: string[] = [];
  
  if (userPrompt.includes('アクセシビリティ')) {
    issues.push('アクセシビリティの観点から改善が必要な要素が検出されています');
  }
  
  if (elements.includes('button')) {
    issues.push('ボタン要素のタッチターゲットサイズや視認性に改善の余地があります');
  }
  
  if (elements.includes('text')) {
    issues.push('テキストの可読性とコントラスト比の確認が必要です');
  }

  return issues.length > 0 
    ? issues.join('。') + '。'
    : '全体的なUI/UXの改善により、ユーザー体験の向上が期待されます。';
}

/**
 * アクセシビリティスコア計算
 */
function calculateAccessibilityScore(improvements: ImprovementSuggestion[]): number {
  const baseScore = 65; // 基本スコア
  const improvementBonus = Math.min(improvements.length * 5, 25); // 改善提案数によるボーナス
  return Math.min(baseScore + improvementBonus, 95);
}

/**
 * TailwindCSS実装例の生成
 */
function generateTailwindImplementation(category: string): string {
  const implementations: Record<string, string> = {
    accessibility: `
/* アクセシビリティ改善 */
.improved-button {
  @apply min-h-[44px] min-w-[44px] 
         focus:ring-2 focus:ring-blue-500 focus:outline-none
         transition-colors duration-200;
}`,
    usability: `
/* ユーザビリティ改善 */
.user-friendly-element {
  @apply hover:bg-gray-50 active:bg-gray-100
         transition-all duration-150 ease-in-out
         cursor-pointer;
}`,
    visual_design: `
/* ビジュアルデザイン改善 */
.visually-improved {
  @apply shadow-sm border border-gray-200
         rounded-lg bg-white
         hover:shadow-md transition-shadow;
}`,
    color_contrast: `
/* コントラスト改善 */
.high-contrast-text {
  @apply text-gray-900 bg-white
         border-2 border-gray-300;
}`
  };

  return implementations[category] || implementations.accessibility;
}

/**
 * ガイドラインからタイトル抽出
 */
function extractTitleFromGuideline(content: string): string {
  // 最初の文または重要なキーワードからタイトルを生成
  const firstSentence = content.split('。')[0];
  
  if (content.includes('タッチターゲット') || content.includes('44px')) {
    return 'タッチターゲットサイズの最適化';
  }
  if (content.includes('コントラスト') || content.includes('4.5:1')) {
    return '色コントラスト比の改善';
  }
  if (content.includes('一貫性') || content.includes('統一')) {
    return 'デザインの一貫性向上';
  }
  
  return firstSentence.length > 30 
    ? firstSentence.substring(0, 30) + '...'
    : firstSentence;
}

/**
 * ガイドラインから問題抽出
 */
function extractProblemFromGuideline(content: string): string {
  if (content.includes('タッチターゲット')) {
    return 'モバイルデバイスでのタッチ操作時に、小さなボタンは誤操作の原因となります';
  }
  if (content.includes('コントラスト')) {
    return '低いコントラスト比により、視覚に障害のあるユーザーがテキストを読みにくくなります';
  }
  if (content.includes('一貫性')) {
    return 'デザインの不一致により、ユーザーの学習コストが増加し、使いにくさにつながります';
  }
  
  return '現在のデザインにおいて、ユーザビリティとアクセシビリティの観点から改善が必要です';
}

/**
 * デフォルト改善提案
 */
function getDefaultImprovements(): ImprovementSuggestion[] {
  return [
    {
      priority: 'high',
      title: 'タッチターゲットサイズの確保',
      problem: 'ボタンやリンクのサイズが小さく、モバイルデバイスでの操作性に問題があります',
      solution: 'すべてのインタラクティブ要素を最小44px×44pxのサイズに設定してください',
      implementation: `
.touch-target {
  @apply min-h-[44px] min-w-[44px] 
         flex items-center justify-center
         touch-manipulation;
}`,
      guideline_reference: 'WCAG 2.1 - Target Size (Level AAA)'
    },
    {
      priority: 'high',
      title: 'カラーコントラストの改善',
      problem: 'テキストと背景色のコントラスト比が不十分で、可読性に問題があります',
      solution: '通常テキストは4.5:1以上、大きなテキストは3:1以上のコントラスト比を確保してください',
      implementation: `
.high-contrast {
  @apply text-gray-900 bg-white;
  /* または */
  @apply text-white bg-gray-900;
}`,
      guideline_reference: 'WCAG 2.1 - Contrast (Level AA)'
    },
    {
      priority: 'medium',
      title: 'フォーカス状態の明示',
      problem: 'キーボード操作時のフォーカス状態が不明確で、アクセシビリティに問題があります',
      solution: 'すべてのインタラクティブ要素に明確なフォーカス表示を追加してください',
      implementation: `
.focusable {
  @apply focus:ring-2 focus:ring-blue-500 
         focus:outline-none focus:ring-opacity-50;
}`,
      guideline_reference: 'WCAG 2.1 - Focus Visible (Level AA)'
    }
  ];
}

/**
 * 基本改善提案（最終フォールバック）
 */
function getBasicImprovementSuggestions(): {
  current_issues: string;
  improvements: ImprovementSuggestion[];
  predicted_impact: PredictedImpact;
} {
  console.log('🆘 Using basic improvement suggestions as final fallback');
  
  return {
    current_issues: 'システム分析中にエラーが発生しましたが、一般的な改善提案を提供します。',
    improvements: getDefaultImprovements(),
    predicted_impact: {
      accessibility_score: 75,
      usability_improvement: '基本的なアクセシビリティ改善により、より多くのユーザーが利用しやすくなります',
      conversion_impact: 'ユーザビリティの向上により、離脱率の減少が期待されます'
    }
  };
}

/**
 * UI要素検出
 */
async function detectUIElements(base64Image: string): Promise<UIElement[]> {
  try {
    const detectionPrompt = generateElementDetectionPrompt();
    const result = await analyzeImageWithGemini(base64Image, detectionPrompt, 2000);
    
    // JSON応答をクリーンアップ
    let cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();
    
    // 日本語レスポンスをチェックして適切にハンドリング
    if (cleanedResult.includes('はい') || cleanedResult.includes('です') || cleanedResult.includes('ます')) {
      console.log('🔄 Non-JSON response detected, using fallback elements');
      throw new Error('Non-JSON response received');
    }
    
    // JSON の開始位置を探す
    const jsonStart = cleanedResult.indexOf('{');
    const jsonEnd = cleanedResult.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleanedResult = cleanedResult.substring(jsonStart, jsonEnd + 1);
    }
    
    const detected = JSON.parse(cleanedResult);
    
    return detected.elements || [];
    
  } catch (error) {
    console.error('Element detection error:', error);
    // フォールバック: 一般的な要素を返す
    return [
      { type: 'button', confidence: 0.5, description: 'General interactive elements' },
      { type: 'text', confidence: 0.8, description: 'Text content' },
      { type: 'layout', confidence: 0.7, description: 'Overall layout structure' }
    ];
  }
}

/**
 * 包括的分析実行（複数画像対応）
 */
async function performComprehensiveAnalysis(
  processedImages: Array<{base64Data: string; width: number; height: number}>,
  context: AnalysisContext,
  maxTokens: number
): Promise<string> {
  
  const prompt = generateComprehensiveAnalysisPrompt(context);
  const optimizedPrompt = optimizePromptForTokenLimit(prompt, Math.floor(maxTokens * 0.7));
  
  // 複数画像をAIに送信
  return await analyzeMultipleImagesWithGemini(processedImages, optimizedPrompt, maxTokens);
}

/**
 * 簡易分析実行（複数画像対応）
 */
async function performQuickAnalysis(
  processedImages: Array<{base64Data: string; width: number; height: number}>,
  userPrompt: string,
  guidelines: SearchResult[],
  isComparative: boolean = false
): Promise<string> {
  
  const prompt = generateQuickAnalysisPrompt(userPrompt, guidelines);
  
  // 複数画像の場合は比較用プロンプトを使用
  if (isComparative && processedImages.length > 1) {
    const compPrompt = `
${prompt}

**重要**: 提供された${processedImages.length}枚の画像を比較分析してください。
どちらの画像がユーザビリティとアクセシビリティの観点で優れているかを明確に判定し、その理由を具体的に説明してください。
    `;
    return await analyzeMultipleImagesWithGemini(processedImages, compPrompt, 4000);
  }
  
  return await analyzeImageWithGemini(processedImages[0].base64Data, prompt, 3000);
}

/**
 * 分析結果のパース
 */
function parseAnalysisResult(
  analysisText: string
): {
  current_issues: string;
  improvements: ImprovementSuggestion[];
  predicted_impact: PredictedImpact;
} {
  
  try {
    // セクション抽出
    const sections = extractSections(analysisText);
    
    // 改善提案の抽出
    const improvements = extractImprovements(sections);
    
    // 予測効果の抽出
    const predicted_impact = extractPredictedImpact(sections);
    
    return {
      current_issues: sections.currentAnalysis || '分析結果を取得できませんでした。',
      improvements,
      predicted_impact
    };
    
  } catch (error) {
    console.error('Analysis parsing error:', error);
    
    return {
      current_issues: analysisText.substring(0, 500) + '...',
      improvements: [{
        priority: 'medium' as const,
        title: '分析結果の処理エラー',
        problem: 'AIからの応答を正しく解析できませんでした。',
        solution: '画像を再度アップロードして分析を試してください。',
        implementation: 'エラーが発生しました',
        guideline_reference: 'システムエラー'
      }],
      predicted_impact: {
        accessibility_score: 0,
        usability_improvement: '分析できませんでした',
        conversion_impact: '分析できませんでした'
      }
    };
  }
}

/**
 * セクション抽出
 */
function extractSections(text: string): {
  currentAnalysis?: string;
  improvements?: string;
  implementation?: string;
  impact?: string;
} {
  const sections: Record<string, string> = {};
  
  // 現状分析
  const currentMatch = text.match(/## 🔍 現状分析\s*([\s\S]*?)(?=##|$)/);
  if (currentMatch) {
    sections.currentAnalysis = currentMatch[1].trim();
  }
  
  // 改善提案
  const improvementsMatch = text.match(/## 💡 改善提案[\s\S]*?(###[\s\S]*?)(?=## 💻|## 📊|$)/);
  if (improvementsMatch) {
    sections.improvements = improvementsMatch[1].trim();
  }
  
  // 実装例
  const implementationMatch = text.match(/## 💻 実装例\s*([\s\S]*?)(?=##|$)/);
  if (implementationMatch) {
    sections.implementation = implementationMatch[1].trim();
  }
  
  // 改善効果予測
  const impactMatch = text.match(/## 📊 改善効果予測\s*([\s\S]*?)(?=##|$)/);
  if (impactMatch) {
    sections.impact = impactMatch[1].trim();
  }
  
  return sections;
}

/**
 * 改善提案の抽出
 */
function extractImprovements(sections: Record<string, string>): ImprovementSuggestion[] {
  if (!sections.improvements) return [];
  
  const improvements: ImprovementSuggestion[] = [];
  const text = sections.improvements;
  
  // 優先度別にセクションを分割
  const prioritySections = {
    high: text.match(/### 🔴 高優先度\s*([\s\S]*?)(?=### 🟡|### 🟢|$)/)?.[1] || '',
    medium: text.match(/### 🟡 中優先度\s*([\s\S]*?)(?=### 🔴|### 🟢|$)/)?.[1] || '',
    low: text.match(/### 🟢 低優先度\s*([\s\S]*?)(?=### 🔴|### 🟡|$)/)?.[1] || ''
  };
  
  // 各優先度から項目を抽出
  Object.entries(prioritySections).forEach(([priority, content]) => {
    if (!content.trim()) return;
    
    const items = extractPriorityItems(content, priority as 'high' | 'medium' | 'low');
    improvements.push(...items);
  });
  
  return improvements;
}

/**
 * 優先度別項目抽出
 */
function extractPriorityItems(content: string, priority: 'high' | 'medium' | 'low'): ImprovementSuggestion[] {
  const items: ImprovementSuggestion[] = [];
  
  // **で始まる項目を検索
  const itemMatches = content.match(/\*\*[^*]+\*\*([\s\S]*?)(?=\*\*[^*]+\*\*|$)/g);
  
  if (itemMatches) {
    itemMatches.forEach(itemText => {
      const item = parseImprovementItem(itemText, priority);
      if (item) {
        items.push(item);
      }
    });
  }
  
  return items;
}

/**
 * 個別改善項目のパース
 */
function parseImprovementItem(itemText: string, priority: 'high' | 'medium' | 'low'): ImprovementSuggestion | null {
  try {
    const titleMatch = itemText.match(/\*\*([^*]+)\*\*/);
    const problemMatch = itemText.match(/[・-]\s*\*\*問題\*\*[：:]\s*([^•\n]+)/);
    const solutionMatch = itemText.match(/[・-]\s*\*\*改善案\*\*[：:]\s*([^•\n]+)/);
    const implementationMatch = itemText.match(/[・-]\s*\*\*実装\*\*[：:]\s*`([^`]+)`/);
    const guidelineMatch = itemText.match(/[・-]\s*\*\*根拠\*\*[：:]\s*([^•\n]+)/);
    
    if (!titleMatch) return null;
    
    return {
      priority,
      title: titleMatch[1].trim(),
      problem: problemMatch?.[1]?.trim() || '問題の詳細が取得できませんでした',
      solution: solutionMatch?.[1]?.trim() || '解決策が取得できませんでした',
      implementation: implementationMatch?.[1]?.trim() || '実装例が取得できませんでした',
      guideline_reference: guidelineMatch?.[1]?.trim() || '関連ガイドラインが取得できませんでした'
    };
    
  } catch (error) {
    console.error('Item parsing error:', error);
    return null;
  }
}

/**
 * 予測効果の抽出
 */
function extractPredictedImpact(sections: Record<string, string>): PredictedImpact {
  const defaultImpact: PredictedImpact = {
    accessibility_score: 0,
    usability_improvement: '分析できませんでした',
    conversion_impact: '分析できませんでした'
  };
  
  if (!sections.impact) return defaultImpact;
  
  const text = sections.impact;
  
  // アクセシビリティスコア抽出
  const scoreMatch = text.match(/アクセシビリティスコア[：:]?\s*([^→\n]*?)(?:→|->)\s*([^\n\(]+)/);
  const accessibilityScore = scoreMatch ? parseInt(scoreMatch[2].trim()) : 0;
  
  // ユーザビリティ向上
  const usabilityMatch = text.match(/ユーザビリティ向上[：:]?\s*([^\n]+)/);
  const usabilityImprovement = usabilityMatch?.[1]?.trim() || '分析できませんでした';
  
  // コンバージョン影響
  const conversionMatch = text.match(/コンバージョン影響[：:]?\s*([^\n]+)/);
  const conversionImpact = conversionMatch?.[1]?.trim() || '分析できませんでした';
  
  return {
    accessibility_score: accessibilityScore,
    usability_improvement: usabilityImprovement,
    conversion_impact: conversionImpact
  };
}

/**
 * バッチ分析（複数画像対応）
 */
export async function analyzeMultipleDesigns(
  images: File[],
  userPrompts: string[],
  options: AnalysisOptions = {}
): Promise<AnalysisResult[]> {
  
  if (images.length !== userPrompts.length) {
    throw new Error('Images and prompts arrays must have the same length');
  }
  
  if (images.length > 5) {
    throw new Error('Maximum 5 images allowed for batch analysis');
  }
  
  try {
    const promises = images.map((image, index) => 
      analyzeDesign([image], userPrompts[index], { ...options, mode: 'quick' })
    );
    
    return await Promise.all(promises);
    
  } catch (error) {
    console.error('Batch analysis error:', error);
    throw new Error('Failed to analyze multiple designs');
  }
} 