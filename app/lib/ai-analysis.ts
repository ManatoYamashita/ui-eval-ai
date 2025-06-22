import { analyzeImageWithGemini } from './ai-clients';
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
}

/**
 * メイン分析関数
 */
export async function analyzeDesign(
  imageFile: File,
  userPrompt: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const startTime = Date.now();
  
  try {
    const {
      mode = 'comprehensive',
      maxTokens = 8000,
    } = options;

    // 1. 画像前処理
    console.log('🖼️ Processing image...');
    const processedImage = await processImageForAnalysis(imageFile, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.85
    });

    // 2. UI要素識別
    console.log('🔍 Detecting UI elements...');
    const detectedElements = await detectUIElements(processedImage.base64Data);

    // 3. 関連ガイドライン検索
    console.log('📚 Searching relevant guidelines...');
    const relevantGuidelines = await searchRelevantGuidelines(
      detectedElements.map(el => el.type),
      userPrompt
    );

    // 4. 分析実行
    console.log('🧠 Performing analysis...');
    const analysisContext: AnalysisContext = {
      userPrompt,
      detectedElements,
      relevantGuidelines,
      imageMetadata: {
        width: processedImage.width,
        height: processedImage.height,
        aspectRatio: processedImage.width / processedImage.height,
        fileName: imageFile.name
      }
    };

    const analysisText = mode === 'quick'
      ? await performQuickAnalysis(processedImage.base64Data, userPrompt, relevantGuidelines)
      : await performComprehensiveAnalysis(processedImage.base64Data, analysisContext, maxTokens);

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
    console.error('Analysis error:', error);
    
    return {
      success: false,
      analysis: {
        current_issues: '',
        improvements: [],
        predicted_impact: {
          accessibility_score: 0,
          usability_improvement: '',
          conversion_impact: ''
        }
      },
      guidelines_used: [],
      processing_time: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown analysis error'
    };
  }
}

/**
 * UI要素検出
 */
async function detectUIElements(base64Image: string): Promise<UIElement[]> {
  try {
    const detectionPrompt = generateElementDetectionPrompt();
    const result = await analyzeImageWithGemini(base64Image, detectionPrompt, 2000);
    
    // JSON応答をパース
    const cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();
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
 * 包括的分析実行
 */
async function performComprehensiveAnalysis(
  base64Image: string,
  context: AnalysisContext,
  maxTokens: number
): Promise<string> {
  
  const prompt = generateComprehensiveAnalysisPrompt(context);
  const optimizedPrompt = optimizePromptForTokenLimit(prompt, Math.floor(maxTokens * 0.7));
  
  return await analyzeImageWithGemini(base64Image, optimizedPrompt, maxTokens);
}

/**
 * 簡易分析実行
 */
async function performQuickAnalysis(
  base64Image: string,
  userPrompt: string,
  guidelines: SearchResult[]
): Promise<string> {
  
  const prompt = generateQuickAnalysisPrompt(userPrompt, guidelines);
  
  return await analyzeImageWithGemini(base64Image, prompt, 3000);
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
      analyzeDesign(image, userPrompts[index], { ...options, mode: 'quick' })
    );
    
    return await Promise.all(promises);
    
  } catch (error) {
    console.error('Batch analysis error:', error);
    throw new Error('Failed to analyze multiple designs');
  }
} 