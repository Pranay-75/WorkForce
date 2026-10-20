'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

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
  const { isAuthenticated, organization } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  const { members: liveMembers } = useOrganizationMembers();
  const { auditEvents: mockAuditEvents } = useMockStore();

  const [liveEvents, setLiveEvents] = React.useState<DisplayAuditEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAction, setSelectedAction] = React.useState('all');

  const fetchLiveAuditLogs = React.useCallback(async () => {
    if (!isLive || !organization?.id) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('organization_audit_logs')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMsg(error.message);
        setLiveEvents([]);
      } else if (data) {
        const memberMap = new Map<string, string>();
        liveMembers.forEach((m) => {
          memberMap.set(m.userId, m.fullName || m.email);
        });

        const mapped: DisplayAuditEvent[] = data.map((row: any) => {
          const actorName = memberMap.get(row.actor_user_id) || (row.actor_user_id ? `User (${row.actor_user_id.slice(0, 8)})` : 'System');
          let entityType = 'Governance';
          if (row.action.includes('task')) entityType = 'Task';
          else if (row.action.includes('member') || row.action.includes('invite')) entityType = 'Member';
          else if (row.action.includes('workspace') || row.action.includes('org')) entityType = 'Organization';
          else if (row.action.includes('recommendation')) entityType = 'Recommendation';

          let detailsStr = '';
          if (row.details && typeof row.details === 'object') {
            detailsStr = Object.entries(row.details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ');
          }

          return {
            id: row.id,
            action: row.action.replace(/_/g, ' ').toUpperCase(),
            entityType,
            entityTitle: `Organization Event [${row.action}]`,
            actorName,
            details: detailsStr || 'Audit action logged by system.',
            timestamp: new Date(row.created_at).toLocaleString(),
          };
        });
        setLiveEvents(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch audit logs.');
    } finally {
      setIsLoading(false);
    }
  }, [isLive, organization?.id, liveMembers]);

  React.useEffect(() => {
    if (isLive) {
      fetchLiveAuditLogs();
    }
  }, [isLive, fetchLiveAuditLogs]);

  const auditEvents: DisplayAuditEvent[] = isLive
    ? liveEvents
    : mockAuditEvents.map((m) => ({
        id: m.id,
        action: m.action,
        entityType: m.entityType,
        entityTitle: m.entityTitle,
        actorName: m.actorName,
        details: m.details,
        timestamp: m.timestamp,
      }));

  const filteredEvents = auditEvents.filter((ev) => {
    const matchesSearch =
      ev.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.entityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.details.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction =
      selectedAction === 'all' || ev.entityType.toLowerCase() === selectedAction.toLowerCase();

    return matchesSearch && matchesAction;
  });

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
              {isLive ? 'Live Immutable Log' : 'Demo Mode Log'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete chronological record of assignments, role governance, and organizational actions
          </p>
        </div>

        {isLive && (
          <Button variant="secondary" size="sm" onClick={fetchLiveAuditLogs} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Logs</span>
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Error retrieving live audit logs: {errorMsg}. (Verified Admin or Organizer permissions required).</span>
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
          <option value="all">All Entity Types (All)</option>
          <option value="Member">Member &amp; Role Governance</option>
          <option value="Task">Task Actions</option>
          <option value="Organization">Organization &amp; Workspace</option>
          <option value="Recommendation">AI Recommendation Decisions</option>
        </select>
      </div>

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
                          : ev.entityType === 'Organization'
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

                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    {ev.details}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <span>Actor: <strong>{ev.actorName}</strong></span>
                    <span>•</span>
                    <span>Timestamp: <strong className="text-slate-300 font-mono">{ev.timestamp}</strong></span>
                  </div>
                </div>

                <Badge variant="slate" size="sm" className="font-mono text-[10px] shrink-0">
                  Event ID: {ev.id.slice(0, 12)}...
                </Badge>
              </div>
            </Card>
          ))}

          {filteredEvents.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400">
              <History className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-300">
                {isLive ? 'No audit events recorded yet for this organization.' : 'No audit events found matching filters.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
