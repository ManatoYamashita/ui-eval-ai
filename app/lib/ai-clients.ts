import { GoogleGenAI } from '@google/genai';

// 環境変数の検証
const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;

if (!GOOGLE_GENAI_API_KEY) {
  throw new Error('GOOGLE_GENAI_API_KEY environment variable is required');
}

// Google GenAI クライアント初期化
export const genai = new GoogleGenAI({
  apiKey: GOOGLE_GENAI_API_KEY,
});

// テキスト埋め込み生成（Gemini Embedding）
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await genai.models.embedContent({
      model: 'text-embedding-004',
      contents: [text.replace(/\n/g, ' ')],
      config: {
        outputDimensionality: 768
      }
    });

    return response.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error('Gemini embedding error:', error);
    throw new Error('Failed to generate embedding');
  }
}

// バッチ埋め込み生成（複数テキスト対応）
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length > 100) {
      throw new Error('Too many texts for batch embedding (max: 100)');
    }

    // Geminiは現在バッチ埋め込みをサポートしていないため、並列処理
    const promises = texts.map(text => generateEmbedding(text));
    return await Promise.all(promises);
  } catch (error) {
    console.error('Gemini batch embedding error:', error);
    throw new Error('Failed to generate batch embeddings');
  }
}

// Gemini Vision画像分析
export async function analyzeImageWithGemini(
  imageData: string, // base64エンコードされた画像データ
  prompt: string,
  maxTokens: number = 4000
): Promise<string> {
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData
            }
          },
          {
            text: prompt
          }
        ]
      }],
      config: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    });

    return response.text || '';
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw new Error('Failed to analyze image with Gemini');
  }
}

// Gemini テキスト生成（ガイドラインベース分析）
export async function generateAnalysisWithGemini(
  prompt: string,
  maxTokens: number = 4000
): Promise<string> {
  try {
    const response = await genai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ text: prompt }],
      config: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    });

    return response.text || '';
  } catch (error) {
    console.error('Gemini text generation error:', error);
    throw new Error('Failed to generate analysis with Gemini');
  }
}

// API使用量とコストの監視（デバッグ用）
export interface ApiUsageStats {
  gemini_input_tokens: number;
  gemini_output_tokens: number;
  embedding_requests: number;
  estimated_cost: number;
}

let usageStats: ApiUsageStats = {
  gemini_input_tokens: 0,
  gemini_output_tokens: 0,
  embedding_requests: 0,
  estimated_cost: 0,
};

export function getUsageStats(): ApiUsageStats {
  return { ...usageStats };
}

export function resetUsageStats(): void {
  usageStats = {
    gemini_input_tokens: 0,
    gemini_output_tokens: 0,
    embedding_requests: 0,
    estimated_cost: 0,
  };
}

// 使用量追跡関数
export function trackUsage(
  inputTokens: number,
  outputTokens: number,
  isEmbedding: boolean = false
): void {
  usageStats.gemini_input_tokens += inputTokens;
  usageStats.gemini_output_tokens += outputTokens;
  
  if (isEmbedding) {
    usageStats.embedding_requests += 1;
  }
  
  // コスト計算（Gemini 1.5 Flash料金）
  // Input: $0.075/1M tokens, Output: $0.30/1M tokens
  // Embedding: $0.00001/token
  const inputCost = (inputTokens / 1000000) * 0.075;
  const outputCost = (outputTokens / 1000000) * 0.30;
  const embeddingCost = isEmbedding ? 0.00001 : 0;
  
  usageStats.estimated_cost += inputCost + outputCost + embeddingCost;
}



// 最適なモデル選択
export function selectOptimalModel(useCase: 'vision' | 'text' | 'embedding'): string {
  switch (useCase) {
    case 'vision':
      return 'gemini-1.5-flash'; // 画像分析に最適
    case 'text':
      return 'gemini-1.5-flash'; // テキスト生成に最適
    case 'embedding':
      return 'text-embedding-004'; // 埋め込み生成に最適
    default:
      return 'gemini-1.5-flash';
  }
}

// エラーハンドリング用のカスタムエラークラス
export class GeminiApiError extends Error {
  constructor(
    message: string,
    public modelName: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

// 後方互換性のための旧関数名エイリアス
export const analyzeImageWithClaude = analyzeImageWithGemini;
export const generateAnalysisWithClaude = generateAnalysisWithGemini; 