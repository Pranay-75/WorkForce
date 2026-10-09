import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number; // 0 to 100+
  max?: number;
  className?: string;
  showLabel?: boolean;
  colorScheme?: 'auto' | 'violet' | 'cyan' | 'emerald';
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  colorScheme = 'auto',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const getAutoColor = (pct: number) => {
    if (pct > 100) return 'bg-gradient-to-r from-rose-500 to-red-600';
    if (pct >= 90) return 'bg-gradient-to-r from-amber-500 to-orange-600';
    if (pct >= 50) return 'bg-gradient-to-r from-emerald-500 to-teal-500';
    return 'bg-gradient-to-r from-cyan-500 to-blue-500';
  };

  const colors = {
    auto: getAutoColor(percentage),
    violet: 'bg-gradient-to-r from-violet-500 to-purple-600',
    cyan: 'bg-gradient-to-r from-cyan-500 to-blue-500',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  };

  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80 p-0.5 border border-slate-700/50">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[colorScheme])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
          <span>{Math.round(percentage)}% capacity</span>
          <span>{max}h total</span>
        </div>
      )}
    </div>
  );
}
