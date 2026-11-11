import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { UserRole } from '@/lib/types';

export interface AccessDeniedProps {
  resourceName?: string;
  description?: string;
  currentRole: UserRole;
  requiredRoles: UserRole[];
  returnHref?: string;
}

export function AccessDenied({
  resourceName = 'Restricted Resource',
  description,
  currentRole,
  requiredRoles,
  returnHref = '/dashboard',
}: AccessDeniedProps) {
  const roleLabels = requiredRoles
    .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
    .join(', ');

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-reveal motion-reduce:animate-none select-none">
      <Card className="max-w-lg w-full border-wf-semantic-danger-border bg-wf-surface-card shadow-elevated p-6 sm:p-8 text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg text-wf-semantic-danger shadow-sm">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <Badge variant="danger" size="sm" className="mb-1 uppercase tracking-wider text-[10px] font-bold">
            Access Restricted
          </Badge>
          <h3 className="text-lg sm:text-xl font-bold text-wf-text-primary tracking-tight">
            {resourceName}
          </h3>
          <p className="text-xs sm:text-sm text-wf-text-secondary leading-relaxed max-w-sm mx-auto">
            {description ||
              `Your current role (${currentRole.toUpperCase()}) does not possess authorization to view this area. Access requires ${roleLabels} privileges.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-wf-border-subtle">
          <span className="text-[11px] text-wf-text-secondary">Current Role:</span>
          <Badge variant="danger" size="sm">
            {currentRole.toUpperCase()}
          </Badge>
          <span className="text-wf-border-strong">•</span>
          <span className="text-[11px] text-wf-text-secondary">Required:</span>
          <Badge variant="slate" size="sm">
            {roleLabels}
          </Badge>
        </div>

        <div className="pt-2">
          <Link href={returnHref} className="inline-block w-full">
            <Button variant="secondary" size="md" className="w-full justify-center text-xs">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
