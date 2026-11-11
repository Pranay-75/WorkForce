import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, disabled, readOnly, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'flex h-10 w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary placeholder:text-wf-text-tertiary shadow-sm transition-all duration-micro',
            'focus:border-wf-border-focus focus:bg-wf-surface-card focus:outline-none focus:ring-2 focus:ring-wf-border-focus/20',
            'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-wf-surface-subtle',
            'read-only:bg-wf-surface-subtle read-only:cursor-default',
            error && 'border-wf-semantic-danger focus:border-wf-semantic-danger focus:ring-wf-semantic-danger/20',
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-[11px] text-wf-semantic-danger font-medium leading-tight">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-wf-text-tertiary leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { label: string; value: string | number }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'flex h-10 w-full appearance-none rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 pr-9 text-sm text-wf-text-primary shadow-sm transition-all duration-micro',
              'focus:border-wf-border-focus focus:bg-wf-surface-card focus:outline-none focus:ring-2 focus:ring-wf-border-focus/20',
              'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-wf-surface-subtle',
              error && 'border-wf-semantic-danger focus:border-wf-semantic-danger focus:ring-wf-semantic-danger/20',
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-wf-surface-card text-wf-text-primary py-1">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-wf-text-secondary">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-[11px] text-wf-semantic-danger font-medium leading-tight">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-wf-text-tertiary leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, disabled, readOnly, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'flex min-h-[80px] w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary placeholder:text-wf-text-tertiary shadow-sm transition-all duration-micro',
            'focus:border-wf-border-focus focus:bg-wf-surface-card focus:outline-none focus:ring-2 focus:ring-wf-border-focus/20',
            'disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-wf-surface-subtle',
            'read-only:bg-wf-surface-subtle read-only:cursor-default',
            error && 'border-wf-semantic-danger focus:border-wf-semantic-danger focus:ring-wf-semantic-danger/20',
            className
          )}
          {...props}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-[11px] text-wf-semantic-danger font-medium leading-tight">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-[11px] text-wf-text-tertiary leading-tight">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
