'use client';

import { useState } from 'react';
import FileUpload from './components/ui/FileUpload';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ProgressBar from './components/ui/ProgressBar';
import AnalysisResult from './components/ui/AnalysisResult';
import type { AnalysisResult as AnalysisResultType } from './types/analysis';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    setAnalysisResult(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !prompt.trim()) {
      setError('画像ファイルと質問の両方を入力してください');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt.trim());
      formData.append('mode', 'comprehensive');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const result: AnalysisResultType = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : '分析中にエラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetry = () => {
    setAnalysisResult(null);
    setError(null);
    handleAnalyze();
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPrompt('');
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🎨 UI Evaluation AI
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              デザイン画像をアップロードして、WCAG・Apple HIG・Refactoring UIに基づく
              専門的な改善提案を受け取りましょう
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!analysisResult ? (
          /* 分析入力フォーム */
          <div className="max-w-2xl mx-auto space-y-8">
            {/* ファイルアップロード */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                1. デザイン画像をアップロード
              </h2>
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                isUploading={isAnalyzing}
              />
            </div>

            {/* プロンプト入力 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                2. 質問・要望を入力
              </h2>
              <div className="space-y-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例: このランディングページの改善点を教えてください&#10;例: アクセシビリティの問題点はありますか？&#10;例: ボタンのデザインをもっと目立たせるには？"
                  className="w-full h-32 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={isAnalyzing}
                />
                <div className="text-sm text-gray-500">
                  {prompt.length}/1000文字
                </div>
              </div>

              {/* サンプルプロンプト */}
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  サンプル質問:
                </h3>
                <div className="space-y-2">
                  {[
                    'このデザインのアクセシビリティ改善点は？',
                    'ユーザビリティの観点から問題点を教えて',
                    'コンバージョン率を上げるための改善案は？'
                  ].map((samplePrompt, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(samplePrompt)}
                      className="block text-sm text-blue-600 hover:text-blue-800 transition-colors"
                      disabled={isAnalyzing}
                    >
                      📝 {samplePrompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="text-red-500 mr-2">⚠️</div>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* 分析ボタン */}
            <div className="flex justify-center">
              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || !prompt.trim() || isAnalyzing}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg 
                          hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                          disabled:bg-gray-300 disabled:cursor-not-allowed 
                          transition-colors min-w-[200px]"
              >
                {isAnalyzing ? '🔍 分析中...' : '🔍 デザインを分析する'}
              </button>
            </div>

            {/* プログレスバー */}
            {isAnalyzing && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <ProgressBar
                  isActive={isAnalyzing}
                  label="AIがデザインを分析しています..."
                />
              </div>
            )}

            {/* 利用上の注意 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                💡 利用のヒント
              </h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 画像は1024x1024px以下に自動リサイズされます</li>
                <li>• 分析には10-30秒程度かかる場合があります</li>
                <li>• 具体的な質問ほど詳細な改善提案が得られます</li>
                <li>• 日本語・英語どちらでも質問可能です</li>
              </ul>
            </div>
          </div>
        ) : (
          /* 分析結果表示 */
          <div className="space-y-6">
            {/* アクションボタン */}
            <div className="flex justify-center gap-4">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                🔄 新しい分析を開始
              </button>
              <button
                onClick={handleRetry}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔁 再分析
              </button>
            </div>

            {/* 分析結果 */}
            <AnalysisResult 
              result={analysisResult} 
              selectedFile={selectedFile}
              onRetry={handleRetry} 
            />
          </div>
        )}
      </div>

      {/* フッター */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2024 UI Evaluation AI. Built with Next.js, Claude AI, and ❤️</p>
            <p className="mt-2">
              Based on WCAG 2.1, Apple Human Interface Guidelines, and Refactoring UI principles
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
