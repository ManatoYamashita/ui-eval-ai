'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { AnalysisResult } from '../../types/analysis';

interface AnalysisResultProps {
  result: AnalysisResult;
  selectedFile?: File | null;
  onRetry?: () => void;
  analyzedImage?: {
    file: File;
    url: string;
  } | null;
}

export default function AnalysisResult({ result, onRetry, analyzedImage }: AnalysisResultProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['current']));
  // 参照ガイドライン表示用の状態（内部的に保持）
  const [showGuidelinesInternal] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!analyzedImage?.file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(analyzedImage.file);
  }, [analyzedImage]);
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // 評価スコアの計算（100% - 改善提案数）
  const designScore = Math.max(0, 100 - result.analysis.improvements.length);

  if (!result.success) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="text-red-500 text-xl mr-2">❌</div>
          <h3 className="text-lg font-semibold text-red-800">分析エラーが発生しました</h3>
        </div>
        <p className="text-red-700 mb-4">{result.error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            再試行
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 分析対象画像表示 */}
      {analyzedImage && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📸 分析対象画像</h3>
          <div className="flex flex-col items-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={analyzedImage.url}
              alt="分析対象画像"
              className="max-w-full max-h-96 object-contain rounded-lg shadow-sm border"
            />
            <div className="text-sm text-gray-600">
              {analyzedImage.file.name} ({Math.round(analyzedImage.file.size / 1024)}KB)
            </div>
          </div>
        </div>
      )}

      {/* ヘッダー情報 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">🔍 デザイン分析結果</h2>
          <div className="text-sm text-gray-500">
            処理時間: {Math.round(result.processing_time / 1000)}秒
          </div>
        </div>
        
        {/* 分析した画像のプレビュー */}
        {imagePreview && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">分析した画像</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <img
                src={imagePreview}
                alt="分析した画像"
                className="w-full h-auto max-h-96 object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        )}
        
        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {result.analysis.improvements.length}
            </div>
            <div className="text-sm text-blue-800">改善点</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {designScore}%
            </div>
            <div className="text-sm text-green-800">評価</div>
          </div>
        </div>
      </div>

      {/* 現状分析 */}
      <AnalysisSection
        title="🔍 現状分析"
        isExpanded={expandedSections.has('current')}
        onToggle={() => toggleSection('current')}
      >
        <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {result.analysis.current_issues}
          </ReactMarkdown>
        </div>
      </AnalysisSection>

      {/* 参照ガイドライン（内部的に表示可能） */}
      {showGuidelinesInternal && (
        <AnalysisSection
          title="📚 参照ガイドライン"
          isExpanded={expandedSections.has('guidelines')}
          onToggle={() => toggleSection('guidelines')}
        >
          <div className="space-y-3">
            {result.guidelines_used.map((guideline, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{guideline.source}</h4>
                  <span className="text-sm text-gray-500">
                    関連度: {Math.round(guideline.relevance_score * 100)}%
                  </span>
                </div>
                <div className="prose prose-sm max-w-none text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {guideline.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </AnalysisSection>
      )}
    </div>
  );
}

interface AnalysisSectionProps {
  title: string;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

function AnalysisSection({ title, children, isExpanded, onToggle }: AnalysisSectionProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ⌄
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
} 