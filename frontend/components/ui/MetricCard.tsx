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
  sparkline?: number[];
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
  badgeVariant = 'slate',
  sparkline,
  className,
}: MetricCardProps) {
  const isPositive = trend ? trend.value >= 0 : null;

  // Generate SVG path for sparkline if provided
  const sparklineData = React.useMemo(() => {
    if (!sparkline || sparkline.length < 2) return null;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const width = 100;
    const height = 24;

    const points = sparkline.map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const linePath = `M ${points.join(' L ')}`;
    const areaPath = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

    return { linePath, areaPath };
  }, [sparkline]);

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-zinc-800/80 bg-zinc-900/90 hover:border-zinc-700/80 transition-all hover:shadow-md',
        className
      )}
    >
      {/* Top subtle highlight border */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-zinc-400/30 via-zinc-600/10 to-transparent" />

      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {title}
            </p>
            <div className="text-2xl font-bold tracking-tight text-zinc-100 font-mono">
              {value}
            </div>
          </div>
          {icon && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-zinc-300 shadow-sm">
              {icon}
            </div>
          )}
        </div>

        {/* Optional Sparkline curve matching Option 2 screenshot */}
        {sparklineData && (
          <div className="mt-3 -mb-1 w-full h-7 overflow-hidden">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 100 24"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={`sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FAFAFA" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#FAFAFA" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={sparklineData.areaPath}
                fill={`url(#sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')})`}
              />
              <path
                d={sparklineData.linePath}
                fill="none"
                stroke="#FAFAFA"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

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

        <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <span className="text-xs text-zinc-300 leading-normal">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
