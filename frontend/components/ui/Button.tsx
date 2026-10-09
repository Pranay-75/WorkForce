import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'danger';
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
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-base disabled:pointer-events-none disabled:opacity-50 select-none';

    const variants = {
      primary:
        'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-glow active:scale-[0.98] border border-violet-500/30',
      accent:
        'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white shadow-glow-cyan active:scale-[0.98] border border-cyan-500/30',
      secondary:
        'bg-navy-800 hover:bg-navy-700 text-slate-200 border border-slate-700/60 hover:border-slate-600 active:scale-[0.98]',
      outline:
        'border border-slate-700 hover:border-violet-500/50 bg-transparent hover:bg-violet-950/20 text-slate-200 hover:text-white',
      ghost:
        'bg-transparent hover:bg-navy-800 text-slate-300 hover:text-slate-100',
      danger:
        'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/30 shadow-sm active:scale-[0.98]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-6 text-base gap-2.5',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
