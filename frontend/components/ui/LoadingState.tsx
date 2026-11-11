import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-wf-surface-subtle border border-wf-border-subtle motion-reduce:animate-none',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-6 sm:p-7 space-y-4 shadow-card">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-2.5 w-full rounded-full mt-3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-28" />
      </div>
    </div>
  );
}

export function SkeletonMetricCard() {
  return (
    <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-5 sm:p-6 md:p-7 space-y-3.5 shadow-card">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-2 w-full rounded-full mt-2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="min-h-[56px] md:h-[60px]">
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="px-6 py-4 align-middle">
          <Skeleton className="h-4 w-full max-w-[140px]" />
        </td>
      ))}
    </tr>
  );
}

export function FullPageLoading({ message = 'Loading workspace...' }: { message?: string }) {
  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3.5 select-none animate-in fade-in duration-reveal">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-2 border-wf-brand-burgundy/20 border-t-wf-brand-burgundy animate-spin motion-reduce:animate-none" />
        <Loader2 className="absolute inset-0 m-auto h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream animate-pulse motion-reduce:animate-none" />
      </div>
      <p className="text-sm font-medium text-wf-text-secondary tracking-tight">{message}</p>
    </div>
  );
}
