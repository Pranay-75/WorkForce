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
    | 'neutral'
    | 'outline'
    | 'burgundy'
    | 'cream'
    | 'sage'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
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
    // WorkForce Brand Semantics
    burgundy:
      'bg-wf-brand-burgundy/15 text-wf-brand-burgundy dark:text-wf-cream border-wf-brand-burgundy/30',
    cream:
      'bg-wf-brand-cream/30 text-wf-text-primary border-wf-brand-cream',
    sage:
      'bg-wf-brand-sage/20 text-wf-text-primary border-wf-brand-sage/40',
    success:
      'bg-wf-semantic-success-bg text-wf-semantic-success border-wf-semantic-success-border',
    warning:
      'bg-wf-semantic-warning-bg text-wf-semantic-warning border-wf-semantic-warning-border',
    danger:
      'bg-wf-semantic-danger-bg text-wf-semantic-danger border-wf-semantic-danger-border',
    info:
      'bg-wf-semantic-info-bg text-wf-semantic-info border-wf-semantic-info-border',

    // Existing Color Name Aliases (mapped to accessible tokens)
    emerald:
      'bg-wf-semantic-success-bg text-wf-semantic-success border-wf-semantic-success-border',
    amber:
      'bg-wf-semantic-warning-bg text-wf-semantic-warning border-wf-semantic-warning-border',
    rose:
      'bg-wf-semantic-danger-bg text-wf-semantic-danger border-wf-semantic-danger-border',
    cyan:
      'bg-wf-semantic-info-bg text-wf-semantic-info border-wf-semantic-info-border',
    blue:
      'bg-wf-semantic-info-bg text-wf-semantic-info border-wf-semantic-info-border',
    violet:
      'bg-wf-brand-burgundy/15 text-wf-brand-burgundy dark:text-wf-cream border-wf-brand-burgundy/30',
    slate:
      'bg-wf-surface-subtle text-wf-text-secondary border-wf-border-default',
    neutral:
      'bg-wf-surface-subtle text-wf-text-secondary border-wf-border-default',
    outline:
      'bg-transparent text-wf-text-secondary border-wf-border-default',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 font-medium leading-tight',
    md: 'text-xs px-2.5 py-1 font-semibold leading-tight',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors duration-micro select-none',
        variants[variant] || variants.slate,
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
