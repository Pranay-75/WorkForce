import * as React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'accent';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmDialogProps) {
  const iconConfig = {
    danger: {
      icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
      style: 'border-wf-semantic-danger-border bg-wf-semantic-danger-bg text-wf-semantic-danger',
    },
    accent: {
      icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" />,
      style: 'border-wf-semantic-warning-border bg-wf-semantic-warning-bg text-wf-semantic-warning',
    },
    primary: {
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
      style: 'border-wf-border-default bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream',
    },
  };

  const { icon, style } = iconConfig[variant] || iconConfig.primary;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex items-start gap-4 p-1">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm',
            style
          )}
        >
          {icon}
        </div>
        <div className="space-y-1.5 min-w-0">
          <h4 className="text-base font-semibold text-wf-text-primary tracking-tight">{title}</h4>
          <p className="text-xs text-wf-text-secondary leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-2.5">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : variant === 'accent' ? 'accent' : 'primary'}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  );
}
