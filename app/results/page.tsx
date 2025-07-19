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
    console.log('📊 Results page: Starting to load analysis result from sessionStorage');
    
    try {
      const resultData = sessionStorage.getItem('analysisResult');
      console.log('📊 SessionStorage data exists:', !!resultData);
      console.log('📊 SessionStorage data length:', resultData?.length || 0);
      
      if (!resultData) {
        console.error('❌ No analysis result found in sessionStorage');
        setAnalysisResult(null);
        setLoading(false);
        return;
      }

      // JSON パースの試行
      let parsedResult;
      try {
        parsedResult = JSON.parse(resultData);
        console.log('✅ JSON Parse successful');
        console.log('📊 Parsed result structure:', {
          hasSuccess: 'success' in parsedResult,
          hasAnalysis: 'analysis' in parsedResult,
          hasGuidelinesUsed: 'guidelines_used' in parsedResult,
          hasProcessingTime: 'processing_time' in parsedResult,
          hasError: 'error' in parsedResult,
          successValue: parsedResult.success,
          analysisKeys: parsedResult.analysis ? Object.keys(parsedResult.analysis) : null,
          guidelinesCount: parsedResult.guidelines_used ? parsedResult.guidelines_used.length : null
        });
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('❌ Failed to parse data:', resultData.substring(0, 500), '...');
        setAnalysisResult(null);
        setLoading(false);
        return;
      }

      // データ構造の検証
      const validationError = validateAnalysisResult(parsedResult);
      if (validationError) {
        console.error('❌ Analysis result validation failed:', validationError);
        console.error('❌ Invalid result structure:', parsedResult);
        
        // 修正を試行
        const correctedResult = correctAnalysisResult(parsedResult);
        console.log('🔧 Using corrected analysis result');
        setAnalysisResult(correctedResult);
      } else {
        console.log('✅ Analysis result validation passed');
        setAnalysisResult(parsedResult);
      }

    } catch (error) {
      console.error('❌ SessionStorage operation failed:', error);
      setAnalysisResult(null);
    }

    // 画像データを取得
    const imageDataList: { name: string; dataUrl: string; size: number; type: string }[] = [];
    let i = 0;
    while (true) {
      const imageData = sessionStorage.getItem(`uploadedImage_${i}`);
      if (!imageData) break;
      imageDataList.push(JSON.parse(imageData));
      i++;
    }

    // Base64データからFile形式に変換
    const convertImages = async () => {
      const convertedImages = [];
      
      // Base64からBlobに変換するヘルパー関数
      const dataURLtoBlob = (dataURL: string): Blob => {
        if (!dataURL || typeof dataURL !== 'string') {
          console.error('Invalid dataURL:', dataURL);
          throw new Error(`Invalid dataURL: ${dataURL}`);
        }
        
        if (!dataURL.includes(',')) {
          console.error('Invalid dataURL format:', dataURL.substring(0, 100));
          throw new Error(`Invalid dataURL format`);
        }
        
        const arr = dataURL.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
          console.error('Cannot extract MIME type from:', arr[0]);
          throw new Error(`Cannot extract MIME type`);
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
      
      for (const imageData of imageDataList) {
        try {
          console.log('Converting image data:', imageData);
          if (!imageData.dataUrl) {
            console.error('Missing dataUrl in image data:', imageData);
            continue;
          }
          
          const blob = dataURLtoBlob(imageData.dataUrl);
          const file = new File([blob], imageData.name, { type: imageData.type });
          const url = URL.createObjectURL(blob);
          convertedImages.push({
            file,
            url
          });
        } catch (error) {
          console.error('Error converting image:', error, imageData);
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">分析結果エラー</CardTitle>
            <CardDescription className="text-center">
              分析結果が見つからないか、データが破損しています
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              <p className="font-medium mb-2">考えられる原因:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>sessionStorageからのデータ読み込みエラー</li>
                <li>分析処理中にページが更新された</li>
                <li>ブラウザのプライベートモードによる制限</li>
                <li>APIレスポンスの構造異常</li>
              </ul>
            </div>
            
            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <p className="font-medium mb-2">解決方法:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>画像を再度アップロードして分析</li>
                <li>ブラウザのリフレッシュ</li>
                <li>プライベートモードの無効化</li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleNewAnalysis} className="w-full">
                🔄 新しい分析を開始
              </Button>
              <Button 
                onClick={() => {
                  console.log('🔍 SessionStorage debug info:');
                  console.log('analysisResult:', sessionStorage.getItem('analysisResult'));
                  const allKeys = Object.keys(sessionStorage);
                  console.log('All sessionStorage keys:', allKeys);
                  allKeys.forEach(key => {
                    if (key.startsWith('uploadedImage_')) {
                      console.log(`${key}:`, sessionStorage.getItem(key)?.substring(0, 100), '...');
                    }
                  });
                  alert('デバッグ情報をコンソールに出力しました。開発者ツールをご確認ください。');
                }}
                variant="outline"
                className="w-full"
              >
                🔍 デバッグ情報を表示
              </Button>
              <Button 
                onClick={() => {
                  // sessionStorageをクリアして再試行
                  console.log('🧹 Clearing sessionStorage and retrying...');
                  sessionStorage.clear();
                  window.location.href = '/';
                }}
                variant="ghost"
                className="w-full"
              >
                🧹 データをクリアして最初から開始
              </Button>
            </div>
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
          <Button 
            onClick={() => {
              console.log('🔍 Analysis result debug info:');
              console.log('Analysis result:', analysisResult);
              console.log('Analyzed images:', analyzedImages);
              console.log('SessionStorage analysisResult:', sessionStorage.getItem('analysisResult'));
              const allKeys = Object.keys(sessionStorage);
              console.log('All sessionStorage keys:', allKeys);
              alert('分析結果のデバッグ情報をコンソールに出力しました。');
            }}
            variant="ghost"
            size="sm"
            className="gap-2 text-gray-500"
          >
            🔍 デバッグ情報
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

/**
 * AnalysisResult構造の検証（フロントエンド版）
 */
function validateAnalysisResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return 'Result is not an object';
  }

  // 必須フィールドの確認
  if (!('success' in result)) {
    return 'Missing success field';
  }

  if (!('analysis' in result)) {
    return 'Missing analysis field';
  }

  if (!('guidelines_used' in result)) {
    return 'Missing guidelines_used field';
  }

  if (!('processing_time' in result)) {
    return 'Missing processing_time field';
  }

  // analysis構造の確認
  if (result.analysis && typeof result.analysis === 'object') {
    if (!('current_issues' in result.analysis)) {
      return 'Missing analysis.current_issues field';
    }
    if (!('improvements' in result.analysis)) {
      return 'Missing analysis.improvements field';
    }
    if (!('predicted_impact' in result.analysis)) {
      return 'Missing analysis.predicted_impact field';
    }

    // improvements配列の確認
    if (!Array.isArray(result.analysis.improvements)) {
      return 'analysis.improvements is not an array';
    }

    // predicted_impact構造の確認
    const impact = result.analysis.predicted_impact;
    if (impact && typeof impact === 'object') {
      if (!('accessibility_score' in impact)) {
        return 'Missing analysis.predicted_impact.accessibility_score field';
      }
      if (!('usability_improvement' in impact)) {
        return 'Missing analysis.predicted_impact.usability_improvement field';
      }
      if (!('conversion_impact' in impact)) {
        return 'Missing analysis.predicted_impact.conversion_impact field';
      }
    }
  }

  // guidelines_used配列の確認
  if (!Array.isArray(result.guidelines_used)) {
    return 'guidelines_used is not an array';
  }

  return null; // 検証成功
}

/**
 * AnalysisResult構造の修正（フロントエンド版）
 */
function correctAnalysisResult(result: unknown): AnalysisResultType {
  // 型ガードでresultがオブジェクトかチェック
  const resultObj = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  
  // 基本構造を保証
  const corrected: AnalysisResultType = {
    success: typeof resultObj.success === 'boolean' ? resultObj.success : true,
    analysis: {
      current_issues: '',
      improvements: [],
      predicted_impact: {
        accessibility_score: 0,
        usability_improvement: '',
        conversion_impact: ''
      }
    },
    guidelines_used: [],
    processing_time: typeof resultObj.processing_time === 'number' ? resultObj.processing_time : 0,
    error: typeof resultObj.error === 'string' ? resultObj.error : undefined
  };

  // analysis フィールドの修正
  if (resultObj.analysis && typeof resultObj.analysis === 'object') {
    const analysisObj = resultObj.analysis as Record<string, unknown>;
    corrected.analysis.current_issues = typeof analysisObj.current_issues === 'string' ? analysisObj.current_issues : 'sessionStorageから読み込んだ分析結果に問題があります。';
    
    // improvements配列の修正
    if (Array.isArray(analysisObj.improvements)) {
      corrected.analysis.improvements = analysisObj.improvements;
    } else {
      corrected.analysis.improvements = [{
        priority: 'medium' as const,
        title: 'データ復旧エラー',
        problem: '改善提案のデータが破損しています。',
        solution: '画像を再度アップロードして分析を試してください。',
        implementation: 'データエラーが発生しました',
        guideline_reference: 'システムエラー'
      }];
    }

    // predicted_impact の修正
    if (analysisObj.predicted_impact && typeof analysisObj.predicted_impact === 'object') {
      const impact = analysisObj.predicted_impact as Record<string, unknown>;
      corrected.analysis.predicted_impact = {
        accessibility_score: typeof impact.accessibility_score === 'number' ? impact.accessibility_score : 0,
        usability_improvement: typeof impact.usability_improvement === 'string' ? impact.usability_improvement : 'データを復旧できませんでした',
        conversion_impact: typeof impact.conversion_impact === 'string' ? impact.conversion_impact : 'データを復旧できませんでした'
      };
    }
  } else {
    corrected.analysis.current_issues = 'sessionStorageから読み込んだデータの構造に問題があります。';
    corrected.analysis.improvements = [{
      priority: 'medium' as const,
      title: 'データ構造復旧エラー',
      problem: 'sessionStorageのデータ構造が無効です。',
      solution: '再度分析を実行してください。',
      implementation: 'データエラーが発生しました',
      guideline_reference: 'システムエラー'
    }];
  }

  // guidelines_used配列の修正
  if (Array.isArray(resultObj.guidelines_used)) {
    corrected.guidelines_used = resultObj.guidelines_used;
  } else {
    corrected.guidelines_used = [];
  }

  return corrected;
}