'use client';

import React, { useState } from 'react';
import type { AnalysisResult, ImprovementSuggestion } from '../../types/analysis';

interface AnalysisResultProps {
  result: AnalysisResult;
  onRetry?: () => void;
}

export default function AnalysisResult({ result, onRetry }: AnalysisResultProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['current']));
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const filteredImprovements = result.analysis.improvements.filter(improvement => 
    selectedPriority === 'all' || improvement.priority === selectedPriority
  );

  const priorityColors = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-yellow-200 bg-yellow-50', 
    low: 'border-green-200 bg-green-50'
  };

  const priorityIcons = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };

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
      {/* ヘッダー情報 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">🔍 デザイン分析結果</h2>
          <div className="text-sm text-gray-500">
            処理時間: {Math.round(result.processing_time / 1000)}秒
          </div>
        </div>
        
        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {result.analysis.improvements.length}
            </div>
            <div className="text-sm text-blue-800">改善提案</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {result.analysis.predicted_impact.accessibility_score || 'N/A'}
            </div>
            <div className="text-sm text-green-800">予測スコア</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {result.guidelines_used.length}
            </div>
            <div className="text-sm text-purple-800">参照ガイドライン</div>
          </div>
        </div>
      </div>

      {/* 現状分析 */}
      <AnalysisSection
        title="🔍 現状分析"
        isExpanded={expandedSections.has('current')}
        onToggle={() => toggleSection('current')}
      >
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-700 leading-relaxed">
            {result.analysis.current_issues}
          </p>
        </div>
      </AnalysisSection>

      {/* 改善提案 */}
      <AnalysisSection
        title="💡 改善提案"
        isExpanded={expandedSections.has('improvements')}
        onToggle={() => toggleSection('improvements')}
      >
        {/* 優先度フィルター */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {(['all', 'high', 'medium', 'low'] as const).map((priority) => (
              <button
                key={priority}
                onClick={() => setSelectedPriority(priority)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedPriority === priority
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {priority === 'all' ? 'すべて' : `${priorityIcons[priority]} ${priority === 'high' ? '高' : priority === 'medium' ? '中' : '低'}優先度`}
              </button>
            ))}
          </div>
        </div>

        {/* 改善提案リスト */}
        <div className="space-y-4">
          {filteredImprovements.map((improvement, index) => (
            <ImprovementCard
              key={index}
              improvement={improvement}
              className={priorityColors[improvement.priority]}
            />
          ))}
          
          {filteredImprovements.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              選択した優先度の改善提案はありません
            </div>
          )}
        </div>
      </AnalysisSection>

      {/* 改善効果予測 */}
      <AnalysisSection
        title="📊 改善効果予測"
        isExpanded={expandedSections.has('impact')}
        onToggle={() => toggleSection('impact')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">ユーザビリティ向上</h4>
            <p className="text-gray-700">{result.analysis.predicted_impact.usability_improvement}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">コンバージョン影響</h4>
            <p className="text-gray-700">{result.analysis.predicted_impact.conversion_impact}</p>
          </div>
        </div>
      </AnalysisSection>

      {/* 参照ガイドライン */}
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
              <p className="text-gray-700 text-sm">{guideline.content}</p>
            </div>
          ))}
        </div>
      </AnalysisSection>
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

interface ImprovementCardProps {
  improvement: ImprovementSuggestion;
  className?: string;
}

function ImprovementCard({ improvement, className }: ImprovementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-opacity-75 transition-all"
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">{priorityIcons[improvement.priority]}</span>
          <h4 className="font-semibold text-gray-900">{improvement.title}</h4>
        </div>
        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ⌄
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div>
            <h5 className="font-medium text-gray-800 mb-1">問題点</h5>
            <p className="text-gray-700 text-sm">{improvement.problem}</p>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-1">解決策</h5>
            <p className="text-gray-700 text-sm">{improvement.solution}</p>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-1">実装例</h5>
            <div className="bg-gray-900 text-gray-100 p-3 rounded text-sm font-mono overflow-x-auto">
              {improvement.implementation}
            </div>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-1">根拠</h5>
            <p className="text-gray-600 text-sm">{improvement.guideline_reference}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const priorityIcons = {
  high: '🔴',
  medium: '🟡',
  low: '🟢'
} as const; 