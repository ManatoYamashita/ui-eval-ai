export interface ProcessedImage {
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * 分析用画像処理（サーバーサイド対応）
 */
export async function processImageForAnalysis(
  file: File
): Promise<ProcessedImage> {
  
  try {
    // ファイル検証
    validateImageFile(file);
    
    console.log(`🖼️ Processing image: ${file.name} (${file.size} bytes)`);
    
    // ファイルが空でないことを確認
    if (file.size === 0) {
      throw new Error('File is empty');
    }
    
    // サーバーサイドでは直接Base64変換を行う
    const base64Data = await convertFileToBase64(file);
    
    // Base64データが正常に取得できたことを確認
    if (!base64Data || base64Data.length === 0) {
      throw new Error('Failed to convert file to base64');
    }
    
    // 基本的な画像情報を取得（実際のwidth/heightは概算）
    const imageInfo = await getBasicImageInfo(file);
    
    const result = {
      base64Data,
      mimeType: file.type,
      width: imageInfo.width,
      height: imageInfo.height,
      originalSize: file.size,
      processedSize: estimateFileSizeFromBase64(base64Data)
    };
    
    console.log(`✅ Image processed: ${imageInfo.width}x${imageInfo.height}, ${file.size} bytes`);
    
    return result;

  } catch (error) {
    console.error('Image processing error:', error);
    throw new ImageProcessingError('Failed to process image', error);
  }
}

/**
 * ファイルをBase64に変換（サーバーサイド対応）
 */
async function convertFileToBase64(file: File): Promise<string> {
  try {
    // Node.js環境でFile.arrayBuffer()を使用
    const arrayBuffer = await file.arrayBuffer();
    
    // Node.js環境でのBuffer使用
    if (typeof Buffer !== 'undefined') {
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } else {
      // ブラウザ環境のフォールバック（実際には使用されない）
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      return btoa(binaryString);
    }
  } catch (error) {
    console.error('Base64 conversion error:', error);
    throw new Error('Failed to convert file to base64');
  }
}

/**
 * 基本的な画像情報を取得（概算）
 */
async function getBasicImageInfo(file: File): Promise<{ width: number; height: number }> {
  // ファイルサイズから概算の解像度を推定
  // これは正確ではないが、サーバーサイドでの簡易実装として使用
  
  const sizeInKB = file.size / 1024;
  
  // ファイル名から解像度のヒントを得る
  const filename = file.name.toLowerCase();
  let estimatedWidth = 1920;
  let estimatedHeight = 1080;
  
  // 一般的な解像度パターンを検出
  if (filename.includes('4k') || filename.includes('2160')) {
    estimatedWidth = 3840;
    estimatedHeight = 2160;
  } else if (filename.includes('fhd') || filename.includes('1080')) {
    estimatedWidth = 1920;
    estimatedHeight = 1080;
  } else if (filename.includes('hd') || filename.includes('720')) {
    estimatedWidth = 1280;
    estimatedHeight = 720;
  } else if (filename.includes('mobile') || filename.includes('phone')) {
    estimatedWidth = 375;
    estimatedHeight = 812;
  } else if (filename.includes('tablet') || filename.includes('ipad')) {
    estimatedWidth = 768;
    estimatedHeight = 1024;
  } else {
    // ファイルサイズから推定
    let estimatedPixels: number;
    
    if (file.type === 'image/jpeg') {
      // JPEGは1ピクセルあたり約0.5-2バイト
      estimatedPixels = Math.sqrt(sizeInKB * 1024 / 1.5);
    } else if (file.type === 'image/png') {
      // PNGは1ピクセルあたり約1-4バイト
      estimatedPixels = Math.sqrt(sizeInKB * 1024 / 2.5);
    } else {
      // その他の形式は中間値を使用
      estimatedPixels = Math.sqrt(sizeInKB * 1024 / 2);
    }
    
    // 一般的なアスペクト比（16:9）を仮定
    estimatedWidth = Math.round(estimatedPixels * 1.33);
    estimatedHeight = Math.round(estimatedPixels * 0.75);
  }
  
  return { width: estimatedWidth, height: estimatedHeight };
}

/**
 * 画像ファイルの検証
 */
function validateImageFile(file: File): void {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
  
  if (!allowedTypes.includes(file.type)) {
    throw new ImageValidationError(
      `Unsupported file type: ${file.type}. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
  
  if (file.size > maxSize) {
    throw new ImageValidationError(
      `File size too large: ${file.size} bytes. Maximum allowed: ${maxSize} bytes`
    );
  }
}

/**
 * Base64データからファイルサイズを概算
 */
export function estimateFileSizeFromBase64(base64Data: string): number {
  // Base64エンコードは元データの約1.33倍のサイズになる
  return Math.ceil(base64Data.length * 0.75);
}

/**
 * 画像の最適な圧縮品質を計算
 */
export function calculateOptimalQuality(
  originalSize: number,
  targetSize: number = 500000 // 500KB
): number {
  if (originalSize <= targetSize) {
    return 0.95; // 高品質
  }
  
  const ratio = targetSize / originalSize;
  
  if (ratio > 0.8) return 0.85;
  if (ratio > 0.6) return 0.75;
  if (ratio > 0.4) return 0.65;
  if (ratio > 0.2) return 0.55;
  return 0.45; // 最低品質
}

/**
 * 複数画像の一括処理
 */
export async function processMultipleImages(
  files: File[]
): Promise<ProcessedImage[]> {
  
  if (files.length > 10) {
    throw new Error('Too many files. Maximum 10 images allowed.');
  }
  
  try {
    const promises = files.map(file => processImageForAnalysis(file));
    return await Promise.all(promises);
  } catch (error) {
    console.error('Batch image processing error:', error);
    throw new Error('Failed to process multiple images');
  }
}

// カスタムエラークラス
export class ImageProcessingError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

// 画像メタデータ抽出
export interface ImageMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  hasTransparency: boolean;
}

export function extractImageMetadata(file: File, processedImage?: ProcessedImage): ImageMetadata {
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    width: processedImage?.width || 0,
    height: processedImage?.height || 0,
    aspectRatio: processedImage ? processedImage.width / processedImage.height : 0,
    hasTransparency: file.type === 'image/png' || file.type === 'image/gif'
  };
} 