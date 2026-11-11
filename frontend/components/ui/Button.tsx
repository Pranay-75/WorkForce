import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-hover ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-wf-canvas disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed select-none cursor-pointer touch-manipulation motion-reduce:transition-none motion-reduce:active:scale-100';

    const variants = {
      primary:
        'bg-wf-brand-burgundy hover:bg-wf-brand-burgundy-hover active:bg-wf-brand-burgundy-active text-white font-medium shadow-sm active:scale-[0.98] border border-transparent',
      secondary:
        'bg-wf-surface-subtle hover:bg-wf-surface-card text-wf-text-primary border border-wf-border-default hover:border-wf-border-strong active:scale-[0.98]',
      tertiary:
        'bg-transparent hover:bg-wf-surface-subtle text-wf-text-secondary hover:text-wf-text-primary border border-transparent active:scale-[0.98]',
      accent:
        'bg-wf-surface-card hover:bg-wf-surface-subtle text-wf-text-primary shadow-sm active:scale-[0.98] border border-wf-border-default hover:border-wf-border-strong',
      outline:
        'border border-wf-border-default hover:border-wf-border-strong bg-wf-surface-card/60 hover:bg-wf-surface-subtle text-wf-text-primary active:scale-[0.98]',
      ghost:
        'bg-transparent hover:bg-wf-surface-subtle text-wf-text-secondary hover:text-wf-text-primary active:scale-[0.98]',
      danger:
        'bg-wf-semantic-danger hover:opacity-90 active:opacity-95 text-white border border-transparent shadow-sm active:scale-[0.98]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg min-w-[32px]',
      md: 'h-10 px-4 text-sm gap-2 rounded-xl min-h-[40px]',
      lg: 'h-11 px-5 text-sm sm:text-base gap-2.5 rounded-xl min-h-[44px]',
      icon: 'h-10 w-10 p-0 rounded-xl min-h-[40px] min-w-[40px]',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-current shrink-0" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
