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
    if (pct > 100) return 'bg-rose-500';
    if (pct >= 90) return 'bg-amber-500';
    if (pct >= 50) return 'bg-zinc-100';
    return 'bg-zinc-300';
  };

  const colors = {
    auto: getAutoColor(percentage),
    violet: 'bg-zinc-100',
    cyan: 'bg-zinc-300',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className={cn('w-full space-y-1', className)}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800/80 p-0.5 border border-zinc-700/50">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors[colorScheme])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
          <span>{Math.round(percentage)}% capacity</span>
          <span>{max}h total</span>
        </div>
      )}
    </div>
  );
}
