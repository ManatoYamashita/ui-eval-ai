'use client';

import { useEffect, useState } from 'react';

interface ProgressBarProps {
  isActive: boolean;
  label?: string;
}

export default function ProgressBar({ isActive, label = '処理中...' }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }

    // リアルなプログレスを取得できない場合は、見た目の演出として進捗を表示
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // 30秒で90%まで進む（徐々に遅くなる）
      const newProgress = Math.min(90, (1 - Math.exp(-elapsed / 10000)) * 90);
      setProgress(newProgress);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}