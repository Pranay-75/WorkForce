import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  interactive?: boolean;
}

export function Card({
  className,
  children,
  variant = 'default',
  interactive = false,
  ...props
}: CardProps) {
  const isInteractive = interactive || variant === 'interactive';

  const variants = {
    default: 'bg-wf-surface-card border-wf-border-default shadow-card',
    elevated: 'bg-wf-surface-elevated border-wf-border-default shadow-elevated',
    subtle: 'bg-wf-surface-subtle/60 border-wf-border-subtle shadow-none',
    interactive:
      'bg-wf-surface-card border-wf-border-default shadow-card hover:border-wf-border-strong hover:shadow-elevated cursor-pointer active:scale-[0.99] transition-all duration-hover motion-reduce:transition-none motion-reduce:active:scale-100',
  };

  return (
    <div
      className={cn(
        'rounded-2xl border text-wf-text-primary backdrop-blur-sm',
        variants[variant],
        isInteractive && variants.interactive,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6 sm:p-7 pb-3', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-base sm:text-lg font-semibold leading-snug tracking-tight text-wf-text-primary',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-xs text-wf-text-secondary leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-6 sm:p-7 pt-2', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center p-6 sm:p-7 pt-0 border-t border-wf-border-subtle mt-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}
