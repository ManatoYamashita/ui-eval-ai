import { NextRequest, NextResponse } from 'next/server';
import { performHybridSearch, searchByUIElements } from '../../lib/rag-search';
import { z } from 'zod';

// リクエストバリデーションスキーマ
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  categories: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
  limit: z.number().min(1).max(20).optional(),
  threshold: z.number().min(0).max(1).optional(),
  detectedElements: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // リクエストバリデーション
    const validatedData = searchRequestSchema.parse(body);
    
    const {
      query,
      categories,
      sources,
      limit = 5,
      threshold = 0.7,
      detectedElements = []
    } = validatedData;

    // UI要素が検出されている場合は要素ベース検索を実行
    const searchResult = detectedElements.length > 0
      ? await searchByUIElements(detectedElements, query, {
          categories,
          sources,
          limit,
          threshold
        })
      : await performHybridSearch(query, {
          categories,
          sources,
          limit,
          threshold
        });

    return NextResponse.json({
      success: true,
      data: searchResult,
      message: 'Search completed successfully'
    });

  } catch (error) {
    console.error('Search API error:', error);
    
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
        error: 'Internal server error',
        message: 'Failed to perform search'
      },
      { status: 500 }
    );
  }
}

// GET リクエスト（クエリパラメータから検索）
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query parameter "q" is required'
        },
        { status: 400 }
      );
    }

    const categories = searchParams.get('categories')?.split(',') || undefined;
    const sources = searchParams.get('sources')?.split(',') || undefined;
    const limit = parseInt(searchParams.get('limit') || '5');
    const threshold = parseFloat(searchParams.get('threshold') || '0.7');

    const searchResult = await performHybridSearch(query, {
      categories,
      sources,
      limit,
      threshold
    });

    return NextResponse.json({
      success: true,
      data: searchResult
    });

  } catch (error) {
    console.error('Search API GET error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
} 