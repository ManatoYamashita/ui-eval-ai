'use client';

import { useState, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  accept?: string;
  maxSize?: number; // MB
  selectedFile?: File | null;
  previewUrl?: string | null;
}

export default function FileUpload({
  onFileSelect,
  isUploading = false,
  accept = 'image/jpeg,image/png,image/gif',
  maxSize = 10,
  selectedFile,
  previewUrl
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="w-full">
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
        ) : selectedFile && previewUrl ? (
          /* 画像プレビュー表示 */
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="プレビュー"
                className="max-w-full max-h-64 object-contain rounded-lg shadow-sm"
              />
              <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                {selectedFile.name}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null as File | null); // リセット用
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              別の画像を選択
            </button>
          </div>
        ) : (
          /* ファイル選択UI */
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
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
} 