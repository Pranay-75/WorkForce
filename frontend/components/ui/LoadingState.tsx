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
        'animate-pulse rounded-md bg-slate-800/80 border border-slate-700/30',
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-navy-850 p-5 space-y-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2 w-full rounded-full mt-3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx} className="px-4 py-3.5">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export function FullPageLoading({ message = 'Loading workspace...' }: { message?: string }) {
  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
        <Loader2 className="absolute inset-0 m-auto h-5 w-5 text-violet-400 animate-pulse" />
      </div>
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}
