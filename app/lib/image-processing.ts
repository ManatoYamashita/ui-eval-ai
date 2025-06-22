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
 * 画像ファイルを前処理してClaude APIに適した形式に変換
 */
export async function processImageForAnalysis(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.85,
    format = 'jpeg'
  } = options;

  try {
    // ファイル形式の検証
    validateImageFile(file);

    // 画像をCanvasに読み込み
    const { canvas, ctx, originalWidth, originalHeight } = await loadImageToCanvas(file);
    
    // リサイズ計算
    const { width, height } = calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight);
    
    // キャンバスサイズ調整
    canvas.width = width;
    canvas.height = height;
    
    // 高品質リサイズ
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 元画像を再描画
    const img = await createImageFromFile(file);
    ctx.drawImage(img, 0, 0, width, height);
    
    // Base64エンコード
    const mimeType = `image/${format}`;
    const base64DataUrl = canvas.toDataURL(mimeType, quality);
    const base64Data = base64DataUrl.split(',')[1]; // data:image/jpeg;base64, を除去
    
    // サイズ計算
    const processedSize = Math.ceil(base64Data.length * 0.75); // Base64デコード後のサイズ概算
    
    return {
      base64Data,
      mimeType,
      width,
      height,
      originalSize: file.size,
      processedSize
    };

  } catch (error) {
    console.error('Image processing error:', error);
    throw new ImageProcessingError('Failed to process image', error);
  }
}

/**
 * ファイルからImageオブジェクト作成
 */
function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * 画像をCanvasに読み込み
 */
async function loadImageToCanvas(file: File): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  originalWidth: number;
  originalHeight: number;
}> {
  const img = await createImageFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  return {
    canvas,
    ctx,
    originalWidth: img.naturalWidth,
    originalHeight: img.naturalHeight
  };
}

/**
 * アスペクト比を保持したリサイズ計算
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  
  // 既に制限内の場合はそのまま
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }
  
  const aspectRatio = originalWidth / originalHeight;
  
  let width = maxWidth;
  let height = Math.round(width / aspectRatio);
  
  // 高さが制限を超える場合は高さ基準で再計算
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }
  
  return { width, height };
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
  files: File[],
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage[]> {
  
  if (files.length > 10) {
    throw new Error('Too many files. Maximum 10 images allowed.');
  }
  
  try {
    const promises = files.map(file => processImageForAnalysis(file, options));
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

// 画像メタデータ抽出（EXIF情報など）
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