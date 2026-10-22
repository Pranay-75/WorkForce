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
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-300">
      <Card className="max-w-lg w-full border-rose-500/30 bg-navy-900/90 shadow-2xl p-6 sm:p-8 text-center space-y-5 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-950/50 text-rose-400 shadow-glow">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <Badge variant="rose" size="sm" className="mb-1 uppercase tracking-wider text-[10px] font-bold">
            Access Restricted
          </Badge>
          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {resourceName}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {description ||
              `Your current role (${currentRole.toUpperCase()}) does not possess authorization to view this area. Access requires ${roleLabels} privileges.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400">Current Role:</span>
          <Badge variant="rose" size="sm">
            {currentRole.toUpperCase()}
          </Badge>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] text-slate-400">Required:</span>
          <Badge variant="slate" size="sm">
            {roleLabels}
          </Badge>
        </div>

        <div className="pt-2">
          <Link href={returnHref} className="inline-block w-full">
            <Button variant="secondary" size="md" className="w-full justify-center text-xs text-zinc-200">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span>Return to Dashboard</span>
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
