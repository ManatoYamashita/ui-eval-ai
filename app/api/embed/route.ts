import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateEmbeddings } from '../../lib/ai-clients';
import { z } from 'zod';

// 単一テキスト埋め込みスキーマ
const embedRequestSchema = z.object({
  text: z.string().min(1, 'Text is required').max(8000, 'Text too long')
});

// バッチ埋め込みスキーマ
const batchEmbedRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100, 'Too many texts')
});

// 単一テキスト埋め込み
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // バッチリクエストかどうかチェック
    if (body.texts && Array.isArray(body.texts)) {
      return await handleBatchEmbed(body);
    }
    
    // 単一テキスト埋め込み
    const validatedData = embedRequestSchema.parse(body);
    const { text } = validatedData;

    const startTime = Date.now();
    const embedding = await generateEmbedding(text);
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        embedding,
        dimensions: embedding.length,
        token_count: Math.ceil(text.length / 4), // 概算
        processing_time: processingTime
      }
    });

  } catch (error) {
    console.error('Embed API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate embedding'
      },
      { status: 500 }
    );
  }
}

// バッチ埋め込み処理
async function handleBatchEmbed(body: unknown) {
  try {
    const validatedData = batchEmbedRequestSchema.parse(body);
    const { texts } = validatedData;

    const startTime = Date.now();
    const embeddings = await generateEmbeddings(texts);
    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        embeddings,
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        total_tokens: texts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        processing_time: processingTime
      }
    });

  } catch (error) {
    console.error('Batch embed error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid batch request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate batch embeddings'
      },
      { status: 500 }
    );
  }
}

// GET リクエスト - API情報表示
export async function GET() {
  return NextResponse.json({
    service: 'UI Evaluation AI - Embedding API',
    version: '1.0.0',
    endpoints: {
      'POST /api/embed': {
        description: 'Generate text embedding',
        body: {
          text: 'string (required, max 8000 chars)'
        }
      },
      'POST /api/embed (batch)': {
        description: 'Generate multiple text embeddings',
        body: {
          texts: 'string[] (required, max 100 items, each max 8000 chars)'
        }
      }
    },
    limits: {
      single_text_max_length: 8000,
      batch_max_count: 100,
      batch_item_max_length: 8000
    },
    model: 'text-embedding-ada-002',
    dimensions: 1536
  });
} 