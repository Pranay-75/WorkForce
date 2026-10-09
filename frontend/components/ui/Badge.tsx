import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'violet'
    | 'cyan'
    | 'emerald'
    | 'amber'
    | 'rose'
    | 'slate'
    | 'outline';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'violet',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    violet:
      'bg-violet-950/60 text-violet-300 border-violet-700/50 shadow-[0_0_10px_-3px_rgba(139,92,246,0.3)]',
    cyan:
      'bg-cyan-950/60 text-cyan-300 border-cyan-700/50 shadow-[0_0_10px_-3px_rgba(6,182,212,0.3)]',
    emerald:
      'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    amber:
      'bg-amber-950/60 text-amber-300 border-amber-700/50',
    rose:
      'bg-rose-950/60 text-rose-300 border-rose-700/50',
    slate:
      'bg-slate-800/80 text-slate-300 border-slate-700',
    outline:
      'bg-transparent text-slate-300 border-slate-700',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
