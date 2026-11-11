import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  value: number; // 0 to 100+
  max?: number;
  className?: string;
  showLabel?: boolean;
  colorScheme?: 'auto' | 'violet' | 'cyan' | 'emerald' | 'burgundy' | 'sage';
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
    if (pct >= 100) return 'bg-wf-semantic-danger';
    if (pct >= 85) return 'bg-wf-semantic-warning';
    if (pct >= 50) return 'bg-wf-semantic-success';
    return 'bg-wf-brand-burgundy dark:bg-wf-cream';
  };

  const colors: Record<string, string> = {
    auto: getAutoColor(percentage),
    emerald: 'bg-wf-semantic-success',
    cyan: 'bg-wf-semantic-info',
    violet: 'bg-wf-brand-burgundy dark:bg-wf-cream',
    burgundy: 'bg-wf-brand-burgundy',
    sage: 'bg-wf-brand-sage',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('w-full space-y-1.5', className)}
    >
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-wf-surface-subtle p-0.5 border border-wf-border-default">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-chart ease-out motion-reduce:transition-none',
            colors[colorScheme] || colors.auto
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-[11px] text-wf-text-secondary font-mono tabular-nums select-none">
          <span>{Math.round(percentage)}% capacity</span>
          <span>{max}h total</span>
        </div>
      )}
    </div>
  );
}
