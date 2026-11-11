import * as React from 'react';
import { Card, CardContent } from './Card';
import { Badge, BadgeProps } from './Badge';
import { ProgressBar } from './ProgressBar';
import { Skeleton } from './LoadingState';
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
    colorScheme?: 'auto' | 'violet' | 'cyan' | 'emerald' | 'burgundy' | 'sage';
  };
  badgeText?: string;
  badgeVariant?: BadgeProps['variant'];
  sparkline?: number[];
  isLoading?: boolean;
  emptyText?: string;
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
  isLoading = false,
  emptyText = 'N/A',
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

  if (isLoading) {
    return (
      <Card className={cn('relative overflow-hidden border-wf-border-default bg-wf-surface-card shadow-card', className)}>
        <CardContent className="p-5 sm:p-6 md:p-7 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
          <Skeleton className="h-2 w-full rounded-full mt-2" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayValue = value !== undefined && value !== null && value !== '' ? value : emptyText;
  const isValueEmpty = displayValue === emptyText;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border-wf-border-default bg-wf-surface-card shadow-card transition-colors duration-hover',
        className
      )}
    >
      {/* Top subtle highlight line in Sage/Cream */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-wf-brand-burgundy/40 via-wf-brand-cream/30 to-transparent" />

      <CardContent className="p-5 sm:p-6 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-wf-text-secondary truncate select-none">
              {title}
            </p>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums',
                isValueEmpty ? 'text-wf-text-tertiary font-normal' : 'text-wf-text-primary'
              )}
            >
              {displayValue}
            </div>
          </div>
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-wf-border-default bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream shadow-sm">
              {icon}
            </div>
          )}
        </div>

        {/* Optional Sparkline curve */}
        {sparklineData && (
          <div className="mt-4 -mb-1 w-full h-8 overflow-hidden select-none">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 100 24"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--wf-brand-burgundy)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--wf-brand-burgundy)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d={sparklineData.areaPath}
                fill={`url(#sparkline-grad-${title.replace(/[^a-zA-Z0-9]/g, '')})`}
              />
              <path
                d={sparklineData.linePath}
                fill="none"
                stroke="var(--wf-brand-burgundy)"
                strokeWidth="1.75"
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold tabular-nums',
                isPositive ? 'text-wf-semantic-success' : 'text-wf-semantic-danger'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
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
            <span className="text-xs text-wf-text-secondary leading-normal">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
