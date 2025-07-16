'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import AnalysisResult from '../components/ui/AnalysisResult';
import type { AnalysisResult as AnalysisResultType } from '../types/analysis';

export default function ResultsPage() {
  const router = useRouter();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultType | null>(null);
  const [analyzedImages, setAnalyzedImages] = useState<{ file: File; url: string }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // sessionStorageから結果を取得
    const resultData = sessionStorage.getItem('analysisResult');
    if (resultData) {
      setAnalysisResult(JSON.parse(resultData));
    }

    // 画像データを取得
    const imageDataList: { name: string; url: string; size: number; type: string }[] = [];
    let i = 0;
    while (true) {
      const imageData = sessionStorage.getItem(`uploadedImage_${i}`);
      if (!imageData) break;
      imageDataList.push(JSON.parse(imageData));
      i++;
    }

    // 画像データをFile形式に変換
    const convertImages = async () => {
      const convertedImages = [];
      for (const imageData of imageDataList) {
        try {
          const response = await fetch(imageData.url);
          const blob = await response.blob();
          const file = new File([blob], imageData.name, { type: blob.type });
          convertedImages.push({
            file,
            url: imageData.url
          });
        } catch (error) {
          console.error('Error converting image:', error);
        }
      }
      setAnalyzedImages(convertedImages);
      setLoading(false);
    };

    convertImages();
  }, []);

  const handleNewAnalysis = () => {
    // sessionStorageをクリア
    sessionStorage.clear();
    router.push('/');
  };

  const handleRetry = () => {
    router.push('/analyze');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>結果を読み込み中...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-center text-red-600">エラー</CardTitle>
            <CardDescription className="text-center">
              分析結果が見つかりません
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={handleNewAnalysis}>
              新しい分析を開始
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            📊 分析結果
          </h1>
          <p className="text-slate-600">
            AIによるデザイン分析が完了しました
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex justify-center gap-4 mb-8">
          <Button 
            onClick={handleNewAnalysis}
            variant="outline"
            className="gap-2"
          >
            🔄 新しい分析を開始
          </Button>
          <Button 
            onClick={handleRetry}
            variant="ghost"
            className="gap-2"
          >
            🔁 再分析
          </Button>
        </div>

        {/* 分析結果 */}
        <div className="max-w-7xl mx-auto">
          <AnalysisResult 
            result={analysisResult} 
            onRetry={handleRetry}
            analyzedImages={analyzedImages}
          />
        </div>
      </div>
    </div>
  );
}