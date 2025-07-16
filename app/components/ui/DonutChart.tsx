'use client';

import { useEffect, useState } from 'react';

interface DonutChartProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  backgroundColor?: string;
  animationDuration?: number;
  label?: string;
}

export default function DonutChart({
  percentage,
  size = 120,
  strokeWidth = 8,
  backgroundColor = '#E5E7EB',
  animationDuration = 1500,
  label = '評価'
}: DonutChartProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  // 色を動的に変更
  const getColor = (percent: number) => {
    if (percent >= 80) return '#10B981'; // green
    if (percent >= 60) return '#F59E0B'; // yellow
    if (percent >= 40) return '#EF4444'; // red
    return '#DC2626'; // dark red
  };

  const currentColor = getColor(percentage);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* 背景の円 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
          />
          
          {/* 進捗の円 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={currentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{
              transitionDuration: `${animationDuration}ms`
            }}
          />
        </svg>
        
        {/* 中央のテキスト */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(animatedPercentage)}%
          </div>
          <div className="text-sm text-gray-600">
            {label}
          </div>
        </div>
      </div>
      
      {/* 評価レベル表示 */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: currentColor }}
          />
          <span className="text-sm font-medium text-gray-700">
            {percentage >= 80 ? '優秀' : 
             percentage >= 60 ? '良好' : 
             percentage >= 40 ? '要改善' : '要大幅改善'}
          </span>
        </div>
      </div>
    </div>
  );
}