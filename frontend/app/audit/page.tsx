'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { useMockStore } from '@/lib/mockStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  History,
  Search,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import { AccessDenied } from '@/components/ui/AccessDenied';

interface DisplayAuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityTitle: string;
  actorName: string;
  details: string;
  timestamp: string;
}

export default function AuditPage() {
  const { isAuthenticated, organization, role: authRole } = useAuth();
  const isLive = Boolean(isAuthenticated && organization?.id);
  const { auditEvents: mockAuditEvents, activeRole: mockRole } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;

  const {
    auditLogs: liveAuditLogs,
    isLoading: isAuditLoading,
    error: auditError,
    refetch,
  } = useAuditLogs();

  const auditEvents = isLive ? liveAuditLogs : mockAuditEvents;
  const isLoading = isLive && isAuditLoading;

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAction, setSelectedAction] = React.useState('all');
  const filteredEvents = React.useMemo(() => {
    return auditEvents.filter((ev) => {
      const matchesSearch =
        ev.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.entityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.details && ev.details.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesAction =
        selectedAction === 'all' || ev.entityType.toLowerCase() === selectedAction.toLowerCase();

      return matchesSearch && matchesAction;
    });
  }, [auditEvents, searchQuery, selectedAction]);

  if (activeRole !== 'organizer' && activeRole !== 'admin') {
    return (
      <AccessDenied
        resourceName="Compliance & System Audit Trail"
        currentRole={activeRole}
        requiredRoles={['organizer', 'admin']}
        description="Immutable compliance audit events and security oversight records are restricted strictly to Workspace Administrators and Organizers."
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Compliance &amp; System Audit Trail
            </h2>
            <Badge variant={isLive ? 'cyan' : 'violet'} size="sm">
              <ShieldCheck className="h-3 w-3 mr-1" />
              {isLive ? 'PostgreSQL Immutable Log' : 'Demo Memory Log'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete chronological record of all administrative actions, task assignments, role changes, and compliance events
          </p>
        </div>

        {isLive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isAuditLoading}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAuditLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        )}
      </div>

      {auditError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{auditError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-slate-800 bg-navy-900/80 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit actions, actors, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Entity Types</option>
          <option value="Recommendation">AI Recommendation Decisions</option>
          <option value="Task">Task Actions</option>
          <option value="Workload">Workload Rebalancing</option>
          <option value="Employee">Employee & Membership Updates</option>
          <option value="Organization">Organization Lifecycle</option>
        </select>
      </div>

      {/* Loading Skeleton */}
      {isLive && isAuditLoading && auditEvents.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-slate-800 bg-navy-900/40 animate-pulse p-4" />
          ))}
        </div>
      )}

      {/* Audit Timeline List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-3">
          <RefreshCw className="h-7 w-7 animate-spin text-violet-400" />
          <p className="text-xs text-slate-400">Loading immutable organization audit events...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((ev) => (
            <Card
              key={ev.id}
              className="border-slate-800/90 hover:border-slate-700 transition-colors"
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        ev.entityType === 'Recommendation'
                          ? 'violet'
                          : ev.entityType === 'Project'
                          ? 'cyan'
                          : ev.entityType === 'Task'
                          ? 'emerald'
                          : 'slate'
                      }
                      size="sm"
                    >
                      {ev.entityType}
                    </Badge>
                    <span className="text-xs font-bold text-white">
                      {ev.action}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-violet-300">
                    {ev.entityTitle}
                  </h4>

                <p className="text-xs text-slate-300 leading-relaxed font-mono break-all">
                  {ev.details}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                  <span>Actor: <strong>{ev.actorName}</strong></span>
                  <span>•</span>
                  <span>Timestamp: <strong className="text-slate-300 font-mono">{new Date(ev.timestamp).toLocaleString()}</strong></span>
                </div>
              </div>

              <Badge variant="slate" size="sm" className="font-mono text-[10px] shrink-0">
                Event ID: {ev.id.slice(0, 12)}...
              </Badge>
            </div>
          </Card>
        ))}

        {!isAuditLoading && filteredEvents.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400">
            <History className="mx-auto h-8 w-8 text-slate-500 mb-2" />
            <p className="text-xs font-medium text-slate-300">
              No audit events found matching filters.
            </p>
          </div>
        )}
      </div>
    )}
  </div>
);
}
