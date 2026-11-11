'use client';

import * as React from 'react';
import { useTheme, ThemePreference } from '@/lib/themeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'segmented' | 'compact';
}

export function ThemeToggle({ className, variant = 'segmented' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-xl border border-wf-border-default bg-wf-surface-card text-wf-text-secondary transition-all duration-hover hover:border-wf-border-strong hover:text-wf-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus active:scale-[0.96] shadow-sm',
          className
        )}
        title={`Current: ${theme} theme (${resolvedTheme}). Click to switch theme.`}
        aria-label="Toggle display theme"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4 transition-transform duration-hover" />
        ) : (
          <Sun className="h-4 w-4 transition-transform duration-hover" />
        )}
      </button>
    );
  }

  const options: { value: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Auto', icon: Monitor },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Display theme preference"
      className={cn(
        'inline-flex items-center rounded-xl border border-wf-border-default bg-wf-surface-subtle p-0.5 shadow-sm transition-colors duration-hover select-none',
        className
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isSelected = theme === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus',
              isSelected
                ? 'bg-wf-surface-card text-wf-text-primary shadow-sm font-semibold'
                : 'text-wf-text-secondary hover:text-wf-text-primary'
            )}
            title={`Set theme to ${opt.label}`}
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 transition-colors duration-micro',
                isSelected ? 'text-wf-brand-burgundy dark:text-wf-cream' : 'text-wf-text-secondary group-hover:text-wf-text-primary'
              )}
            />
            <span className="hidden md:inline text-[11px]">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

