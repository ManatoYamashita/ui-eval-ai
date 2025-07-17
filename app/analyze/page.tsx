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
    
    // プロンプトの検証
    if (!prompt || prompt.trim().length === 0) {
      setError('質問内容が見つかりません。最初からやり直してください。');
      setIsAnalyzing(false);
      return;
    }
    
    // 実際の処理ステップに基づいたプログレス更新
    updateProgress(5, '処理を開始しています...');

    try {
      // sessionStorageから画像データを取得
      const imageDataList = [];
      for (let i = 0; i < imageCount; i++) {
        const imageData = sessionStorage.getItem(`uploadedImage_${i}`);
        if (imageData) {
          try {
            const parsedData = JSON.parse(imageData);
            console.log(`Image ${i} data:`, parsedData); // デバッグ用
            
            // データの有効性をチェック
            if (parsedData && typeof parsedData === 'object' && parsedData.dataUrl) {
              imageDataList.push(parsedData);
            } else {
              console.error(`Invalid image data format for index ${i}:`, parsedData);
              throw new Error(`画像データ${i}の形式が無効です`);
            }
          } catch (parseError) {
            console.error(`Failed to parse image data for index ${i}:`, parseError);
            throw new Error(`画像データ${i}の解析に失敗しました`);
          }
        }
      }

      if (imageDataList.length === 0) {
        throw new Error('画像データが見つかりません');
      }

      // データの構造をチェック
      console.log('First image data structure:', imageDataList[0]);
      if (!imageDataList[0].dataUrl) {
        throw new Error('画像データの形式が正しくありません。dataUrlプロパティが見つかりません。');
      }

      updateProgress(10, '画像を準備中...');
      
      const formData = new FormData();
      
      // Base64からBlobに変換するヘルパー関数
      const dataURLtoBlob = (dataURL: string): Blob => {
        if (!dataURL || typeof dataURL !== 'string') {
          throw new Error(`Invalid dataURL: ${dataURL}`);
        }
        
        if (!dataURL.includes(',')) {
          throw new Error(`Invalid dataURL format: ${dataURL.substring(0, 100)}...`);
        }
        
        const arr = dataURL.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
          throw new Error(`Cannot extract MIME type from: ${arr[0]}`);
        }
        
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      };
      
      // 最初の画像をメイン分析対象として使用
      const firstImageBlob = dataURLtoBlob(imageDataList[0].dataUrl);
      const firstImageFile = new File([firstImageBlob], imageDataList[0].name, { type: imageDataList[0].type });
      formData.append('image', firstImageFile);
      formData.append('prompt', prompt);
      formData.append('mode', 'comprehensive');
      
      // 追加画像があれば参考情報として送信
      if (imageDataList.length > 1) {
        for (let i = 1; i < imageDataList.length; i++) {
          const additionalImageBlob = dataURLtoBlob(imageDataList[i].dataUrl);
          const additionalImageFile = new File([additionalImageBlob], imageDataList[i].name, { type: imageDataList[i].type });
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