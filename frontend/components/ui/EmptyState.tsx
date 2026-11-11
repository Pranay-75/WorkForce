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
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center animate-in fade-in duration-reveal motion-reduce:animate-none select-none',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-wf-border-default bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream shadow-sm mb-4">
        {icon || <FolderKanban className="h-8 w-8" aria-hidden="true" />}
      </div>
      <h4 className="text-base sm:text-lg font-semibold text-wf-text-primary tracking-tight mb-1.5">
        {title}
      </h4>
      {description && (
        <p className="text-xs sm:text-sm text-wf-text-secondary max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
