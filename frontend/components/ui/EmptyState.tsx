import * as React from 'react';
import { cn } from '@/lib/utils';
import { FolderKanban } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700/60 bg-navy-800/80 text-violet-400 shadow-glow mb-4">
        {icon || <FolderKanban className="h-7 w-7" />}
      </div>
      <h4 className="text-base font-semibold text-slate-100 mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
