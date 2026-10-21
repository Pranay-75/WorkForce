import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'blue'
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
  variant = 'slate',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    blue:
      'bg-blue-950/60 text-blue-300 border-blue-800/50',
    violet:
      'bg-blue-950/50 text-blue-300 border-blue-800/40',
    cyan:
      'bg-slate-800/90 text-slate-300 border-slate-700',
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
