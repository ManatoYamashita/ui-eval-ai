'use client';

import { useState, useCallback, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  selectedFiles?: File[];
  isUploading?: boolean;
  accept?: string;
  maxSize?: number; // MB
  onAddImage?: () => void;
  onRemoveImage?: (index: number) => void;
  maxFiles?: number;
}

export default function FileUpload({
  onFileSelect,
  selectedFiles = [],
  isUploading = false,
  accept = 'image/jpeg,image/png,image/gif',
  maxSize = 10,
  onAddImage,
  onRemoveImage,
  maxFiles = 5
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviews([]);
      return;
    }

    // 複数ファイルのプレビューを生成
    const generatePreviews = async () => {
      const newPreviews: string[] = [];
      for (const file of selectedFiles) {
        const reader = new FileReader();
        const previewUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPreviews.push(previewUrl);
      }
      setPreviews(newPreviews);
    };

    generatePreviews();
  }, [selectedFiles]);

  const validateFile = useCallback((file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSizeBytes = maxSize * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setError('サポートされていないファイル形式です。JPEG、PNG、GIFのみ対応しています。');
      return false;
    }

    if (file.size > maxSizeBytes) {
      setError(`ファイルサイズが大きすぎます。${maxSize}MB以下のファイルを選択してください。`);
      return false;
    }

    setError(null);
    return true;
  }, [maxSize]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect, validateFile]);

  const handleRemove = useCallback((index: number) => {
    setError(null);
    if (onRemoveImage) {
      onRemoveImage(index);
    }
  }, [onRemoveImage]);

  return (
    <div className="w-full space-y-4">
      {selectedFiles.length > 0 ? (
        // 複数画像プレビュー表示
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previews.map((preview, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="relative">
                  <img
                    src={preview}
                    alt={`プレビュー ${index + 1}`}
                    className="w-full h-auto max-h-64 object-contain rounded-lg shadow-md"
                  />
                  {!isUploading && (
                    <button
                      onClick={() => handleRemove(index)}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                      aria-label={`画像${index + 1}を削除`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-600 text-center">
                  {selectedFiles[index]?.name} ({Math.round(selectedFiles[index]?.size / 1024)}KB)
                </div>
              </div>
            ))}
          </div>
          
          {/* 追加画像ボタン */}
          {selectedFiles.length < maxFiles && !isUploading && (
            <div className="flex justify-center">
              <button
                onClick={onAddImage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                画像を追加 ({selectedFiles.length}/{maxFiles})
              </button>
            </div>
          )}
        </div>
      ) : (
        // アップロードエリア
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            disabled={isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="画像ファイルを選択"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2">
              <LoadingSpinner size="lg" />
              <p className="text-gray-600">アップロード中...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <svg 
                className="w-12 h-12 text-gray-400"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
              <p className="text-lg font-medium text-gray-700">
                画像をドラッグ&ドロップまたはクリックして選択
              </p>
              <p className="text-sm text-gray-500">
                JPEG、PNG、GIF（最大{maxSize}MB）
              </p>
              <p className="text-xs text-gray-400 mt-1">
                最大{maxFiles}枚まで追加可能
              </p>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
} 