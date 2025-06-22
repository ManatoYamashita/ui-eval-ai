'use client';

import { useState } from 'react';
import FileUpload from './components/ui/FileUpload';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !prompt.trim()) return;

    setIsAnalyzing(true);
    try {
      // TODO: 実際の分析API呼び出しを実装
      console.log('分析開始:', { file: selectedFile.name, prompt });
      await new Promise(resolve => setTimeout(resolve, 2000)); // 仮の待機
      console.log('分析完了');
    } catch (error) {
      console.error('分析エラー:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          UI評価AI
        </h1>
        <p className="text-lg text-gray-600">
          デザイン画像をアップロードして、専門的な改善提案を受け取りましょう
        </p>
      </div>

      <div className="space-y-6">
        {/* ファイルアップロード */}
        <div>
          <h2 className="text-xl font-semibold mb-3">画像をアップロード</h2>
          <FileUpload onFileSelect={handleFileSelect} isUploading={isAnalyzing} />
          {selectedFile && (
            <p className="mt-2 text-sm text-green-600">
              選択されたファイル: {selectedFile.name}
            </p>
          )}
        </div>

        {/* プロンプト入力 */}
        <div>
          <h2 className="text-xl font-semibold mb-3">質問・要望</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="このデザインの改善点は？ アクセシビリティの問題はある？ など..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            disabled={isAnalyzing}
          />
        </div>

        {/* 分析ボタン */}
        <div className="text-center">
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || !prompt.trim() || isAnalyzing}
            className="
              bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
              text-white font-medium py-3 px-8 rounded-lg
              transition-colors duration-200
              disabled:cursor-not-allowed
            "
          >
            {isAnalyzing ? '分析中...' : 'デザインを分析する'}
          </button>
        </div>

        {/* TODO: 分析結果表示エリア */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-center">
            分析結果がここに表示されます（実装予定）
          </p>
        </div>
      </div>
    </main>
  );
}
