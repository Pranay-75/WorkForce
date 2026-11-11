'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
import { FolderKanban, Calendar, ArrowUpRight } from 'lucide-react';
import { Project } from '@/lib/types';

export interface InteractiveProjectCoverProps {
  project: Project;
  members?: { id: string; name: string; utilizationPct?: number }[];
  completedHours?: number;
  totalHours?: number;
  className?: string;
}

export function InteractiveProjectCover({
  project,
  members = [],
  completedHours = 0,
  totalHours = 0,
  className,
}: InteractiveProjectCoverProps) {
  const calcHours = totalHours > 0 ? totalHours : Number(project.totalHours || 0);
  const doneHours = completedHours > 0 ? completedHours : Number(project.completedHours || 0);
  const progressPct = calcHours > 0
    ? Math.min(100, Math.round((doneHours / calcHours) * 100))
    : (project.status === 'completed' ? 100 : 0);

  const priorityVariant =
    project.priority === 'critical'
      ? 'rose'
      : project.priority === 'high'
      ? 'amber'
      : 'slate';

  const statusVariant =
    project.status === 'in_progress'
      ? 'cyan'
      : project.status === 'completed'
      ? 'emerald'
      : 'slate';

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-wf-border-default bg-wf-surface-card p-5 sm:p-6 shadow-card transition-all duration-hover hover:border-wf-border-strong hover:shadow-elevated select-none motion-reduce:transition-none',
        className
      )}
    >
      {/* Background Ambient Decorative Light Shift */}
      <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-gradient-to-br from-wf-brand-burgundy/10 via-wf-brand-cream/5 to-transparent blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-chart motion-reduce:transform-none" />

      {/* Top Header Row */}
      <div className="relative space-y-3 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-wf-border-default bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream shadow-sm group-hover:scale-105 transition-transform duration-hover motion-reduce:transform-none">
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <Link
                href={`/projects/${project.id}`}
                className="text-sm font-bold text-wf-text-primary tracking-tight truncate block group-hover:text-wf-brand-burgundy dark:group-hover:text-wf-cream transition-colors"
              >
                {project.name}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={statusVariant} size="sm" className="text-[10px]">
                  {project.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant={priorityVariant} size="sm" className="text-[10px]">
                  {project.priority.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-wf-text-secondary hover:bg-wf-surface-subtle hover:text-wf-text-primary transition-colors"
            title="Inspect project portfolio detail"
            aria-label={`Inspect ${project.name}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {project.description && (
          <p className="text-xs text-wf-text-secondary line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      {/* Middle: Milestone Progress */}
      <div className="relative my-4 space-y-1.5 z-10">
        <div className="flex justify-between text-[11px] text-wf-text-secondary font-mono tabular-nums">
          <span>Milestone Progress</span>
          <span className="font-semibold text-wf-text-primary">
            {doneHours}h / {calcHours}h ({progressPct}%)
          </span>
        </div>
        <ProgressBar value={progressPct} max={100} colorScheme={progressPct >= 100 ? 'emerald' : 'burgundy'} />
      </div>

      {/* Footer: Team Allocation & Target Date */}
      <div className="relative flex items-center justify-between gap-3 pt-3 border-t border-wf-border-subtle z-10">
        {/* Allocated Members with Interactive Halos */}
        <div className="flex items-center -space-x-2 overflow-hidden py-1">
          {members.length > 0 ? (
            members.slice(0, 4).map((member, idx) => (
              <InteractiveAvatar
                key={member.id || idx}
                name={member.name}
                size="sm"
                utilizationPct={member.utilizationPct}
                employeeId={member.id}
                showPopover={false}
                className="hover:z-20 transition-transform group-hover:scale-105"
              />
            ))
          ) : (
            <span className="text-[11px] text-wf-text-tertiary">No members assigned</span>
          )}
          {members.length > 4 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-wf-border-default bg-wf-surface-subtle text-[10px] font-bold text-wf-text-secondary">
              +{members.length - 4}
            </div>
          )}
        </div>

        {/* Target Deadline */}
        {project.targetEndDate && (
          <div className="flex items-center gap-1.5 text-[11px] text-wf-text-secondary font-mono shrink-0">
            <Calendar className="h-3.5 w-3.5 text-wf-text-tertiary" />
            <span>{project.targetEndDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

