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
    const imageFile = formData.get('image') as File;
    const userPrompt = formData.get('prompt') as string;
    const mode = formData.get('mode') as string || 'comprehensive';
    
    // 入力検証
    const validationError = validateInput(imageFile, userPrompt);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    console.log(`🖼️ Processing image: ${imageFile.name} (${imageFile.size} bytes)`);
    console.log(`💬 User prompt: ${userPrompt.substring(0, 100)}...`);

    // 分析実行
    const analysisResult: AnalysisResult = await analyzeDesign(
      imageFile,
      userPrompt,
      {
        mode: mode as 'comprehensive' | 'quick',
        maxTokens: mode === 'quick' ? 3000 : 8000,
        includeTechnicalDetails: true
      }
    );

    console.log(`✅ Analysis completed in ${analysisResult.processing_time}ms`);

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
 * 入力の検証
 */
function validateInput(imageFile: File, userPrompt: string): string | null {
  
  // 画像ファイルの検証
  if (!imageFile) {
    return 'Image file is required';
  }
  
  if (!ALLOWED_TYPES.includes(imageFile.type)) {
    return `Unsupported file type: ${imageFile.type}. Allowed types: ${ALLOWED_TYPES.join(', ')}`;
  }
  
  if (imageFile.size > MAX_FILE_SIZE) {
    return `File size too large: ${Math.round(imageFile.size / 1024 / 1024)}MB. Maximum allowed: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`;
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