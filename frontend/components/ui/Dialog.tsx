import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
}: DialogProps) {
  const titleId = React.useId();
  const descId = React.useId();
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  // Handle Focus Management, Tab Trapping, Escape key and body scroll locking
  React.useEffect(() => {
    if (!isOpen) return;

    // 1. Capture previously focused element to restore upon close
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // 2. Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 3. Move initial focus into modal
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    // 4. Handle Tab focus trap and Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          modalRef.current.focus();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // 5. Restore focus to opening element if still available in DOM
      const prevEl = previousActiveElementRef.current;
      if (prevEl && typeof prevEl.focus === 'function' && document.contains(prevEl)) {
        prevEl.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop with Apple-inspired blur */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md transition-opacity duration-modal animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-wf-border-default bg-wf-surface-elevated text-wf-text-primary shadow-modal transition-all animate-in fade-in zoom-in-95 duration-modal motion-reduce:animate-none z-10 focus:outline-none',
          widthClasses[maxWidth]
        )}
      >
        {/* Top subtle highlight in WorkForce Brand Burgundy to Cream */}
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-wf-brand-burgundy via-wf-brand-burgundy/80 to-wf-brand-cream" />

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-5 sm:p-6 pb-3 border-b border-wf-border-subtle shrink-0">
            <div className="space-y-1 pr-6 min-w-0">
              {title && (
                <h3
                  id={titleId}
                  className="text-base sm:text-lg font-semibold leading-tight tracking-tight text-wf-text-primary truncate"
                >
                  {title}
                </h3>
              )}
              {description && (
                <p id={descId} className="text-xs text-wf-text-secondary leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-wf-text-secondary hover:bg-wf-surface-subtle hover:text-wf-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus"
              aria-label="Close modal dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-6 pt-4 flex-1 text-sm text-wf-text-primary">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-wf-border-subtle bg-wf-surface-subtle/50 p-4 sm:px-6 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
