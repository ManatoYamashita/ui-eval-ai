'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import FileUpload from './components/ui/FileUpload';

export default function Home() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [showAddImageInput, setShowAddImageInput] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 複数画像プレビューURLの管理
  useEffect(() => {
    if (selectedFiles.length > 0) {
      const urls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(urls);
      
      // クリーンアップ
      return () => {
        urls.forEach(url => URL.revokeObjectURL(url));
      };
    } else {
      setPreviewUrls([]);
    }
  }, [selectedFiles]);

  // 分析開始処理
  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 || !prompt.trim()) {
      setError('画像ファイルと質問の両方を入力してください');
      return;
    }

    setError(null);
    
    // 画像データをsessionStorageに保存
    selectedFiles.forEach((file, index) => {
      const imageData = {
        name: file.name,
        size: file.size,
        type: file.type,
        url: previewUrls[index]
      };
      sessionStorage.setItem(`uploadedImage_${index}`, JSON.stringify(imageData));
    });

    // 分析ページに遷移
    const params = new URLSearchParams({
      imageCount: selectedFiles.length.toString(),
      prompt: prompt.trim()
    });
    
    router.push(`/analyze?${params.toString()}`);
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      if (selectedFiles.length === 0) {
        setSelectedFiles([file]);
      } else {
        setSelectedFiles(prev => [...prev, file]);
      }
      setShowAddImageInput(false);
    }
    setError(null);
  };

  const handleAddImage = () => {
    setShowAddImageInput(true);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };




  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-3">
              🎨 UI Evaluation AI
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              デザイン画像をアップロードして、WCAG・Apple HIG・Refactoring UIに基づく
              専門的な改善提案を受け取りましょう
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 分析入力フォーム */}
        <div className="max-w-4xl mx-auto space-y-6">
          {/* ファイルアップロード */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📸</span>
                デザイン画像をアップロード
              </CardTitle>
              <CardDescription>
                最大5枚まで画像をアップロードできます。複数の画像を比較分析する場合に便利です。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showAddImageInput ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      追加画像を選択してください
                    </p>
                  </div>
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    isUploading={false}
                    selectedFiles={[]}
                    maxFiles={1}
                  />
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={() => setShowAddImageInput(false)}
                      variant="outline"
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <FileUpload
                  onFileSelect={handleFileSelect}
                  isUploading={false}
                  selectedFiles={selectedFiles}
                  onAddImage={handleAddImage}
                  onRemoveImage={handleRemoveImage}
                  maxFiles={5}
                />
              )}
            </CardContent>
          </Card>

          {/* プロンプト入力 */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">💬</span>
                質問・要望を入力
              </CardTitle>
              <CardDescription>
                具体的な質問をするほど、詳細で有用な改善提案が得られます。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例: このランディングページの改善点を教えてください&#10;例: アクセシビリティの問題点はありますか？&#10;例: ボタンのデザインをもっと目立たせるには？"
                className="w-full h-32 p-4 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent resize-none bg-background"
                maxLength={1000}
              />
              <div className="text-sm text-muted-foreground text-right">
                {prompt.length}/1000文字
              </div>

              {/* サンプルプロンプト */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-slate-700">
                  サンプル質問:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    'このデザインのアクセシビリティ改善点は？',
                    'ユーザビリティの観点から問題点を教えて',
                    'コンバージョン率を上げるための改善案は？'
                  ].map((samplePrompt, index) => (
                    <Button
                      key={index}
                      onClick={() => setPrompt(samplePrompt)}
                      variant="ghost"
                      size="sm"
                      className="text-left justify-start h-auto p-3 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    >
                      📝 {samplePrompt}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>


          {/* エラー表示 */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="text-xl">⚠️</span>
                  <span className="font-medium">エラー</span>
                </div>
                <p className="mt-2 text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* 分析ボタン */}
          <div className="flex justify-center">
            <Button
              onClick={handleAnalyze}
              disabled={selectedFiles.length === 0 || !prompt.trim()}
              size="lg"
              className="px-8 py-3 text-lg font-semibold gap-2 shadow-lg"
            >
              🔍 デザインを分析する{selectedFiles.length > 1 ? ` (${selectedFiles.length}枚)` : ''}
            </Button>
          </div>


          {/* 利用上の注意 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <span className="text-blue-500 text-2xl">💡</span>
                <div>
                  <h3 className="font-medium text-blue-900 mb-2">
                    利用のヒント
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 画像は1024x1024px以下に自動リサイズされます</li>
                    <li>• 分析には10-30秒程度かかる場合があります</li>
                    <li>• 具体的な質問ほど詳細な改善提案が得られます</li>
                    <li>• 日本語・英語どちらでも質問可能です</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-slate-500 text-sm">
            <p>© 2024 UI Evaluation AI. Built with Next.js, shadcn/ui, and ❤️</p>
            <p className="mt-2">
              Based on WCAG 2.1, Apple Human Interface Guidelines, and Refactoring UI principles
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
