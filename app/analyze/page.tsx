'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import type { AnalysisResult as AnalysisResultType } from '../types/analysis';

function AnalyzePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URLパラメータから画像データを取得
  const imageCount = parseInt(searchParams.get('imageCount') || '1');
  const prompt = searchParams.get('prompt') || '';

  useEffect(() => {
    // 分析開始
    handleAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateProgress = (progress: number, message: string) => {
    setProgress(progress);
    setProgressMessage(message);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    
    // 実際の処理ステップに基づいたプログレス更新
    updateProgress(5, '処理を開始しています...');

    try {
      // sessionStorageから画像データを取得
      const imageDataList = [];
      for (let i = 0; i < imageCount; i++) {
        const imageData = sessionStorage.getItem(`uploadedImage_${i}`);
        if (imageData) {
          imageDataList.push(JSON.parse(imageData));
        }
      }

      if (imageDataList.length === 0) {
        throw new Error('画像データが見つかりません');
      }

      updateProgress(10, '画像を準備中...');
      
      const formData = new FormData();
      
      // 最初の画像をメイン分析対象として使用
      const firstImageBlob = await fetch(imageDataList[0].url).then(r => r.blob());
      const firstImageFile = new File([firstImageBlob], imageDataList[0].name, { type: firstImageBlob.type });
      formData.append('image', firstImageFile);
      formData.append('prompt', prompt);
      formData.append('mode', 'comprehensive');
      
      // 追加画像があれば参考情報として送信
      if (imageDataList.length > 1) {
        for (let i = 1; i < imageDataList.length; i++) {
          const additionalImageBlob = await fetch(imageDataList[i].url).then(r => r.blob());
          const additionalImageFile = new File([additionalImageBlob], imageDataList[i].name, { type: additionalImageBlob.type });
          formData.append(`additional_image_${i - 1}`, additionalImageFile);
        }
      }

      updateProgress(20, 'AI分析を開始...');
      
      // プログレスのポーリング用の関数
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev < 80) {
            return prev + 5;
          }
          return prev;
        });
      }, 2000);
      
      updateProgress(30, 'デザインガイドラインを参照中...');
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(progressInterval);
      updateProgress(85, '結果を処理中...');

      const result: AnalysisResultType = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // 完了時のプログレス
      updateProgress(100, '分析完了！');
      
      setTimeout(() => {
        // 結果をsessionStorageに保存
        sessionStorage.setItem('analysisResult', JSON.stringify(result));
        
        // 結果ページに遷移
        router.push('/results');
      }, 1000);

    } catch (error) {
      console.error('Analysis error:', error);
      updateProgress(0, 'エラーが発生しました');
      setError(error instanceof Error ? error.message : '分析中にエラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              🎨 AI分析中
            </h1>
            <p className="text-slate-600">
              デザインを詳細に分析しています...
            </p>
          </div>

          {/* プログレス表示 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                分析進捗
              </CardTitle>
              <CardDescription>
                {imageCount}枚の画像を分析中: {prompt}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">{progressMessage}</span>
                <span className="text-sm text-slate-500">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              
              {progress === 100 && (
                <div className="text-center text-green-600 font-medium">
                  ✅ 分析完了！結果ページに移動します...
                </div>
              )}
            </CardContent>
          </Card>

          {/* エラー表示 */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="text-xl">⚠️</span>
                  <span className="font-medium">エラーが発生しました</span>
                </div>
                <p className="mt-2 text-red-600">{error}</p>
                <div className="mt-4 flex gap-2">
                  <Button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    variant="outline"
                    size="sm"
                  >
                    再試行
                  </Button>
                  <Button 
                    onClick={handleBack}
                    variant="ghost"
                    size="sm"
                  >
                    戻る
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 分析のヒント */}
          {!error && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 text-xl">💡</span>
                  <div>
                    <h3 className="font-medium text-blue-900 mb-1">
                      分析中について
                    </h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• デザインガイドライン（WCAG、Apple HIG、Refactoring UI）を参照</li>
                      <li>• 通常10-30秒程度で完了します</li>
                      <li>• 複数画像の場合は最初の画像をメインに分析</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p>ページを読み込み中...</p>
      </div>
    </div>}>
      <AnalyzePageContent />
    </Suspense>
  );
}