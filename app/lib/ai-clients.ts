import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// 環境変数の検証
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is required');
}

// OpenAI クライアント初期化
export const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Anthropic クライアント初期化
export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// OpenAI Embeddings 生成
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' '),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding error:', error);
    throw new Error('Failed to generate embedding');
  }
}

// バッチ埋め込み生成（複数テキスト対応）
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 2048) {
      throw new Error('Too many texts for batch embedding (max: 2048)');
    }

    const cleanTexts = texts.map(text => text.replace(/\n/g, ' '));
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: cleanTexts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('OpenAI batch embedding error:', error);
    throw new Error('Failed to generate batch embeddings');
  }
}

// Claude 画像分析
export async function analyzeImageWithClaude(
  imageData: string, // base64エンコードされた画像データ
  prompt: string,
  maxTokens: number = 4000
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageData,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('Claude analysis error:', error);
    throw new Error('Failed to analyze image with Claude');
  }
}

// Claude テキスト生成（ガイドラインベース分析）
export async function generateAnalysisWithClaude(
  prompt: string,
  maxTokens: number = 4000
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('Claude text generation error:', error);
    throw new Error('Failed to generate analysis with Claude');
  }
}

// API使用量とコストの監視（デバッグ用）
export interface ApiUsageStats {
  openai_tokens: number;
  anthropic_tokens: number;
  estimated_cost: number;
}

let usageStats: ApiUsageStats = {
  openai_tokens: 0,
  anthropic_tokens: 0,
  estimated_cost: 0,
};

export function getUsageStats(): ApiUsageStats {
  return { ...usageStats };
}

export function resetUsageStats(): void {
  usageStats = {
    openai_tokens: 0,
    anthropic_tokens: 0,
    estimated_cost: 0,
  };
}

// エラーハンドリング用のカスタムエラークラス
export class AIApiError extends Error {
  constructor(
    message: string,
    public provider: 'openai' | 'anthropic',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIApiError';
  }
} 