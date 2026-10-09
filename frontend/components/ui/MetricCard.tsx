import * as React from 'react';
import { Card, CardContent } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositiveGood?: boolean;
    label?: string;
  };
  progress?: {
    value: number;
    max?: number;
    colorScheme?: 'auto' | 'violet' | 'cyan' | 'emerald';
  };
  badgeText?: string;
  badgeVariant?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  progress,
  badgeText,
  badgeVariant = 'violet',
  className,
}: MetricCardProps) {
  const isPositive = trend ? trend.value >= 0 : null;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-slate-800/80 hover:border-slate-700/80 transition-all hover:shadow-glow/20',
        className
      )}
    >
      {/* Top subtle highlight border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500/40 via-cyan-500/40 to-transparent" />

      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {title}
            </p>
            <div className="text-2xl font-bold tracking-tight text-white font-mono">
              {value}
            </div>
          </div>
          {icon && (
            <div className="rounded-xl border border-slate-700/60 bg-navy-800/80 p-2.5 text-violet-400 shadow-sm">
              {icon}
            </div>
          )}
        </div>

        {progress && (
          <div className="mt-4">
            <ProgressBar
              value={progress.value}
              max={progress.max}
              colorScheme={progress.colorScheme || 'auto'}
              showLabel
            />
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold',
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
          {badgeText && (
            <Badge variant={badgeVariant} size="sm">
              {badgeText}
            </Badge>
          )}
          {subtitle && (
            <span className="text-xs text-slate-400 truncate">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
