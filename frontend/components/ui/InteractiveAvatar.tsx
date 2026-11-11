'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

export interface InteractiveAvatarProps {
  name: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  utilizationPct?: number; // E.g. 75, 95, 115
  skills?: string[];
  weeklyCapacityHours?: number;
  activeAssignedHours?: number;
  employeeId?: string;
  showPopover?: boolean;
  className?: string;
}

export function InteractiveAvatar({
  name,
  jobTitle,
  department,
  avatarUrl,
  size = 'md',
  utilizationPct,
  skills = [],
  weeklyCapacityHours,
  activeAssignedHours,
  employeeId,
  showPopover = true,
  className,
}: InteractiveAvatarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const initials = React.useMemo(() => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  // Capacity halo color mapping strictly grounded in actual workload percentage
  const haloClass = React.useMemo(() => {
    if (utilizationPct === undefined || utilizationPct === null) {
      return 'ring-1 ring-wf-border-default';
    }
    if (utilizationPct > 100) {
      return 'ring-2 ring-wf-semantic-danger ring-offset-2 ring-offset-wf-canvas';
    }
    if (utilizationPct >= 80) {
      return 'ring-2 ring-wf-semantic-warning ring-offset-1 ring-offset-wf-canvas';
    }
    if (utilizationPct > 0) {
      return 'ring-2 ring-wf-semantic-success ring-offset-1 ring-offset-wf-canvas';
    }
    return 'ring-1 ring-wf-border-default';
  }, [utilizationPct]);

  const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  // Click outside and Escape-key listener for popover dismissal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const avatarElement = (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      onMouseEnter={() => showPopover && setIsOpen(true)}
      onMouseLeave={() => showPopover && setIsOpen(false)}
      onClick={(e) => {
        if (showPopover) {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }
      }}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full font-bold select-none transition-transform duration-hover motion-reduce:transition-none cursor-pointer',
          'bg-wf-brand-burgundy/15 text-wf-brand-burgundy dark:bg-wf-brand-burgundy/30 dark:text-wf-cream border border-wf-brand-burgundy/30',
          sizeClasses[size],
          haloClass,
          isOpen && 'scale-105'
        )}
        title={name}
        role="button"
        tabIndex={0}
        aria-label={`Inspect ${name}`}
        onKeyDown={(e) => {
          if (showPopover && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Capacity Indicator Dot on bottom right */}
      {utilizationPct !== undefined && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-wf-canvas',
            utilizationPct > 100
              ? 'bg-wf-semantic-danger'
              : utilizationPct >= 80
              ? 'bg-wf-semantic-warning'
              : 'bg-wf-semantic-success'
          )}
          aria-hidden="true"
        />
      )}

      {/* Interactive Inspection Popover on Hover / Tap */}
      {showPopover && isOpen && (
        <div
          role="tooltip"
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-2xl border border-wf-border-default bg-wf-surface-elevated p-3.5 shadow-modal text-left z-40',
            'animate-in fade-in zoom-in-95 duration-hover motion-reduce:animate-none pointer-events-auto'
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-wf-border-subtle pb-2 mb-2">
            <div className="min-w-0">
              <h5 className="text-xs font-bold text-wf-text-primary tracking-tight truncate">{name}</h5>
              {jobTitle && (
                <p className="text-[11px] text-wf-text-secondary truncate">{jobTitle}</p>
              )}
            </div>
            {department && (
              <Badge variant="slate" size="sm" className="text-[9px] shrink-0">
                {department}
              </Badge>
            )}
          </div>

          {/* Workload Telemetry */}
          {utilizationPct !== undefined && (
            <div className="space-y-1 mb-2.5">
              <div className="flex justify-between text-[10px] text-wf-text-secondary font-mono tabular-nums">
                <span>Weekly Allocation</span>
                <span
                  className={cn(
                    'font-semibold',
                    utilizationPct > 100
                      ? 'text-wf-semantic-danger'
                      : utilizationPct >= 80
                      ? 'text-wf-semantic-warning'
                      : 'text-wf-semantic-success'
                  )}
                >
                  {activeAssignedHours !== undefined && weeklyCapacityHours !== undefined
                    ? `${activeAssignedHours}h / ${weeklyCapacityHours}h (${utilizationPct}%)`
                    : `${utilizationPct}%`}
                </span>
              </div>
              <ProgressBar
                value={utilizationPct}
                max={100}
                colorScheme={utilizationPct > 100 ? 'auto' : 'violet'}
              />
            </div>
          )}

          {/* Verified Skills Preview */}
          {skills.length > 0 && (
            <div className="mb-2.5">
              <span className="text-[10px] font-semibold text-wf-text-tertiary block mb-1">
                Verified Skills
              </span>
              <div className="flex flex-wrap gap-1">
                {skills.slice(0, 3).map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-block rounded px-1.5 py-0.5 text-[9px] bg-wf-surface-subtle text-wf-text-secondary font-medium"
                  >
                    {skill}
                  </span>
                ))}
                {skills.length > 3 && (
                  <span className="text-[9px] text-wf-text-tertiary">+{skills.length - 3}</span>
                )}
              </div>
            </div>
          )}

          {/* Profile Navigation Link */}
          {employeeId && (
            <Link
              href={`/employees/${employeeId}`}
              className="text-[11px] font-semibold text-wf-brand-burgundy dark:text-wf-cream hover:underline flex items-center justify-end gap-1 pt-1 border-t border-wf-border-subtle"
            >
              <span>View Profile & Matrix →</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );

  return avatarElement;
}

