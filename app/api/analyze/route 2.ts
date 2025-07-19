import { NextRequest, NextResponse } from 'next/server';
import { analyzeDesign } from '../../lib/ai-analysis';
import type { AnalysisResult } from '../../types/analysis';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    console.log('📝 Received analysis request');
    
    // リクエストの検証
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    // FormDataの解析
    const formData = await request.formData();
    const mainImage = formData.get('image') as File;
    const userPrompt = formData.get('prompt') as string;
    const mode = formData.get('mode') as string || 'comprehensive';
    
    // 追加画像を取得
    const additionalImages: File[] = [];
    let i = 0;
    while (true) {
      const additionalImage = formData.get(`additional_image_${i}`) as File;
      if (!additionalImage) break;
      additionalImages.push(additionalImage);
      i++;
    }
    
    const allImages = [mainImage, ...additionalImages];
    console.log(`📷 Total images received: ${allImages.length}`);
    
    // 入力検証
    const validationError = validateInput(allImages, userPrompt);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    console.log(`🖼️ Processing ${allImages.length} images:`);
    allImages.forEach((img, idx) => {
      console.log(`  ${idx + 1}. ${img.name} (${img.size} bytes)`);
    });
    console.log(`💬 User prompt: ${userPrompt.substring(0, 100)}...`);

    // 分析実行（複数画像対応）
    const analysisResult: AnalysisResult = await analyzeDesign(
      allImages,
      userPrompt,
      {
        mode: mode as 'comprehensive' | 'quick',
        maxTokens: mode === 'quick' ? 3000 : 8000,
        includeTechnicalDetails: true,
        isComparative: allImages.length > 1
      }
    );

    console.log(`✅ Analysis completed in ${analysisResult.processing_time}ms`);

    // AnalysisResult構造の検証
    const resultValidationError = validateAnalysisResult(analysisResult);
    if (resultValidationError) {
      console.error('❌ Analysis result validation failed:', resultValidationError);
      console.error('❌ Invalid analysis result:', JSON.stringify(analysisResult, null, 2));
      
      // 修正版のレスポンスを返す
      const correctedResult = correctAnalysisResult(analysisResult);
      console.log('🔧 Using corrected analysis result');
      
      return NextResponse.json(correctedResult, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // レスポンス返却前の最終検証
    console.log('📊 Final response validation:', {
      hasSuccess: 'success' in analysisResult,
      hasAnalysis: 'analysis' in analysisResult,
      hasGuidelinesUsed: 'guidelines_used' in analysisResult,
      hasProcessingTime: 'processing_time' in analysisResult,
      successValue: analysisResult.success,
      analysisKeys: analysisResult.analysis ? Object.keys(analysisResult.analysis) : null,
      guidelinesCount: analysisResult.guidelines_used ? analysisResult.guidelines_used.length : null
    });

    // レスポンス返却
    return NextResponse.json(analysisResult, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('❌ Analysis API error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred during analysis';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
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
        processing_time: 0
      } as AnalysisResult,
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Design Analysis API - POST method required',
    usage: {
      method: 'POST',
      content_type: 'multipart/form-data',
      required_fields: {
        image: 'File (JPEG, PNG, GIF, WebP, max 10MB)',
        prompt: 'string (user question about the design)'
      },
      optional_fields: {
        mode: 'string ("comprehensive" | "quick", default: "comprehensive")'
      }
    },
    example: {
      curl: `curl -X POST -F "image=@design.png" -F "prompt=このデザインの改善点は？" ${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/analyze`
    }
  });
}

/**
 * AnalysisResult構造の検証
 */
function validateAnalysisResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return 'Result is not an object';
  }

  // 必須フィールドの確認
  if (!('success' in result)) {
    return 'Missing success field';
  }

  if (!('analysis' in result)) {
    return 'Missing analysis field';
  }

  if (!('guidelines_used' in result)) {
    return 'Missing guidelines_used field';
  }

  if (!('processing_time' in result)) {
    return 'Missing processing_time field';
  }

  // analysis構造の確認
  if (result.analysis && typeof result.analysis === 'object') {
    if (!('current_issues' in result.analysis)) {
      return 'Missing analysis.current_issues field';
    }
    if (!('improvements' in result.analysis)) {
      return 'Missing analysis.improvements field';
    }
    if (!('predicted_impact' in result.analysis)) {
      return 'Missing analysis.predicted_impact field';
    }

    // improvements配列の確認
    if (!Array.isArray(result.analysis.improvements)) {
      return 'analysis.improvements is not an array';
    }

    // predicted_impact構造の確認
    const impact = result.analysis.predicted_impact;
    if (impact && typeof impact === 'object') {
      if (!('accessibility_score' in impact)) {
        return 'Missing analysis.predicted_impact.accessibility_score field';
      }
      if (!('usability_improvement' in impact)) {
        return 'Missing analysis.predicted_impact.usability_improvement field';
      }
      if (!('conversion_impact' in impact)) {
        return 'Missing analysis.predicted_impact.conversion_impact field';
      }
    }
  }

  // guidelines_used配列の確認
  if (!Array.isArray(result.guidelines_used)) {
    return 'guidelines_used is not an array';
  }

  return null; // 検証成功
}

/**
 * AnalysisResult構造の修正
 */
function correctAnalysisResult(result: unknown): AnalysisResult {
  // 型ガードでresultがオブジェクトかチェック
  const resultObj = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  
  // 基本構造を保証
  const corrected: AnalysisResult = {
    success: typeof resultObj.success === 'boolean' ? resultObj.success : true,
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
    processing_time: typeof resultObj.processing_time === 'number' ? resultObj.processing_time : 0,
    error: typeof resultObj.error === 'string' ? resultObj.error : undefined
  };

  // analysis フィールドの修正
  if (resultObj.analysis && typeof resultObj.analysis === 'object') {
    const analysisObj = resultObj.analysis as Record<string, unknown>;
    corrected.analysis.current_issues = typeof analysisObj.current_issues === 'string' ? analysisObj.current_issues : '分析結果を取得できませんでした。';
    
    // improvements配列の修正
    if (Array.isArray(analysisObj.improvements)) {
      corrected.analysis.improvements = analysisObj.improvements;
    } else {
      corrected.analysis.improvements = [{
        priority: 'medium' as const,
        title: '分析結果の処理エラー',
        problem: '改善提案を正しく解析できませんでした。',
        solution: '画像を再度アップロードして分析を試してください。',
        implementation: 'エラーが発生しました',
        guideline_reference: 'システムエラー'
      }];
    }

    // predicted_impact の修正
    if (analysisObj.predicted_impact && typeof analysisObj.predicted_impact === 'object') {
      const impact = analysisObj.predicted_impact as Record<string, unknown>;
      corrected.analysis.predicted_impact = {
        accessibility_score: typeof impact.accessibility_score === 'number' ? impact.accessibility_score : 0,
        usability_improvement: typeof impact.usability_improvement === 'string' ? impact.usability_improvement : '分析できませんでした',
        conversion_impact: typeof impact.conversion_impact === 'string' ? impact.conversion_impact : '分析できませんでした'
      };
    }
  } else {
    corrected.analysis.current_issues = '分析データの構造に問題があります。';
    corrected.analysis.improvements = [{
      priority: 'medium' as const,
      title: 'データ構造エラー',
      problem: '分析結果の構造が無効です。',
      solution: '再度分析を実行してください。',
      implementation: 'エラーが発生しました',
      guideline_reference: 'システムエラー'
    }];
  }

  // guidelines_used配列の修正
  if (Array.isArray(resultObj.guidelines_used)) {
    corrected.guidelines_used = resultObj.guidelines_used;
  } else {
    corrected.guidelines_used = [];
  }

  return corrected;
}

/**
 * 入力の検証（複数画像対応）
 */
function validateInput(imageFiles: File[], userPrompt: string): string | null {
  
  // 画像ファイルの検証
  if (!imageFiles || imageFiles.length === 0) {
    return 'At least one image file is required';
  }
  
  if (imageFiles.length > 5) {
    return 'Maximum 5 images allowed';
  }
  
  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    
    if (!imageFile) {
      return `Image file ${i + 1} is missing`;
    }
    
    if (!ALLOWED_TYPES.includes(imageFile.type)) {
      return `Image ${i + 1}: Unsupported file type: ${imageFile.type}. Allowed types: ${ALLOWED_TYPES.join(', ')}`;
    }
    
    if (imageFile.size > MAX_FILE_SIZE) {
      return `Image ${i + 1}: File size too large: ${Math.round(imageFile.size / 1024 / 1024)}MB. Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;
    }
  }
  
  // プロンプトの検証
  if (!userPrompt || typeof userPrompt !== 'string') {
    return 'Prompt is required and must be a string';
  }
  
  if (userPrompt.trim().length < 3) {
    return 'Prompt must be at least 3 characters long';
  }
  
  if (userPrompt.length > 1000) {
    return 'Prompt must be less than 1000 characters';
  }
  
  return null;
}

// TODO: 将来実装予定
// - レート制限チェック
// - リクエストメトリクス記録 