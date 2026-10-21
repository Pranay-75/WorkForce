'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowRight,
  CheckCheck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface LiveNotification {
  id: string;
  type: 'capacity_alert' | 'recommendation_ready' | 'deadline_warning' | 'task_assigned';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  linkUrl?: string;
}

export default function NotificationsPage() {
  const { isAuthenticated, organization } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  const { tasks, isLoading: isTasksLoading, error: tasksError, refetch: refetchTasks } = useTasks();
  const { members, isLoading: isMembersLoading, error: membersError, refetch: refetchMembers } = useOrganizationMembers();
  const { auditLogs, isLoading: isLogsLoading, error: logsError, refetch: refetchLogs } = useAuditLogs();
  const loadError = isLive ? (tasksError || membersError || logsError) : null;

  const {
    notifications: mockNotifications,
    markNotificationAsRead: mockMarkRead,
    markAllNotificationsAsRead: mockMarkAllRead,
  } = useMockStore();

  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());

  // Derive live alerts from real organization data
  const liveNotifications = React.useMemo<LiveNotification[]>(() => {
    if (!isLive) return [];
    const alerts: LiveNotification[] = [];

    // 1. Capacity Overload Alerts
    members.forEach((m) => {
      const activeTasks = tasks.filter(
        (t) => t.assignedTo === m.userId && t.status !== 'completed'
      );
      const load = activeTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
      const cap = m.weeklyCapacityHours || 40;
      const pct = Math.round((load / cap) * 100);

      if (pct > 100) {
        alerts.push({
          id: `cap-${m.userId}`,
          type: 'capacity_alert',
          title: `Capacity Overload Alert: ${m.fullName}`,
          message: `${m.fullName} is allocated at ${pct}% (${load}h / ${cap}h target capacity). Operational workload rebalancing required.`,
          timestamp: 'Live Heuristic',
          isRead: readIds.has(`cap-${m.userId}`),
          linkUrl: '/workload',
        });
      }
    });

    // 2. Unassigned Tasks
    const unassignedTasks = tasks.filter(
      (t) => (!t.assignedTo || t.assignedTo === '') && t.status !== 'completed'
    );
    unassignedTasks.forEach((t) => {
      alerts.push({
        id: `unassigned-${t.id}`,
        type: 'deadline_warning',
        title: `Unassigned Task: ${t.title}`,
        message: `Task is awaiting member allocation (${t.estimatedHours || 0}h, ${t.priority} priority).`,
        timestamp: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Active',
        isRead: readIds.has(`unassigned-${t.id}`),
        linkUrl: '/matching',
      });
    });

    // 3. Recent Audit Activity
    auditLogs.slice(0, 5).forEach((l) => {
      alerts.push({
        id: `audit-${l.id}`,
        type: 'task_assigned',
        title: `Audit Event: ${l.action.replace('_', ' ').toUpperCase()}`,
        message: `${l.actorName || 'System'} modified ${l.entityType} ${l.entityId ? `#${l.entityId.slice(0, 8)}` : ''}`,
        timestamp: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: readIds.has(`audit-${l.id}`),
        linkUrl: '/audit',
      });
    });

    return alerts;
  }, [isLive, members, tasks, auditLogs, readIds]);

  const notifications = isLive ? liveNotifications : mockNotifications;
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markNotificationAsRead = (id: string) => {
    if (isLive) {
      setReadIds((prev) => new Set(prev).add(id));
    } else {
      mockMarkRead(id);
    }
  };

  const markAllNotificationsAsRead = () => {
    if (isLive) {
      setReadIds(new Set(notifications.map((n) => n.id)));
    } else {
      mockMarkAllRead();
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Notification &amp; Alert Center
            </h2>
            <Badge variant={unreadCount > 0 ? 'amber' : 'emerald'} size="sm">
              {unreadCount} Unread
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time capacity overload warnings, deadline updates, and operational alerts
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDismissAll}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            <span>Mark All as Read</span>
          </Button>
        )}
      </div>

      {/* Actionable Error Banner */}
      {loadError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Failed to load organization alerts</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{loadError}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refetchTasks();
              refetchMembers();
              refetchLogs();
            }}
            className="text-xs shrink-0"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLive && (isTasksLoading || isMembersLoading || isLogsLoading) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-slate-800 bg-navy-900/40 p-4 animate-pulse flex items-center gap-4"
            >
              <div className="h-10 w-10 bg-slate-800 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 bg-slate-800 rounded" />
                <div className="h-3 w-80 bg-slate-800/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!(isLive && (isTasksLoading || isMembersLoading || isLogsLoading)) && !loadError && notifications.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-white">All Systems Operational</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No capacity overloads, pending task bottlenecks, or unassigned deliverables detected for your organization.
          </p>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((n) => {
          return (
            <Card
              key={n.id}
              className={`border-slate-800 transition-all ${
                !n.isRead
                  ? 'border-violet-500/50 bg-navy-900/95 shadow-sm'
                  : 'bg-navy-900/40 opacity-75'
              }`}
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 flex-1">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      n.type === 'capacity_alert'
                        ? 'border-rose-500/40 bg-rose-950/40 text-rose-400'
                        : n.type === 'recommendation_ready'
                        ? 'border-violet-500/40 bg-violet-950/40 text-violet-400'
                        : n.type === 'deadline_warning'
                        ? 'border-amber-500/40 bg-amber-950/40 text-amber-400'
                        : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-400'
                    }`}
                  >
                    {n.type === 'capacity_alert' && <AlertTriangle className="h-5 w-5" />}
                    {n.type === 'recommendation_ready' && <Sparkles className="h-5 w-5" />}
                    {n.type === 'deadline_warning' && <Calendar className="h-5 w-5" />}
                    {n.type === 'task_assigned' && <CheckCircle2 className="h-5 w-5" />}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{n.title}</h4>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono block pt-0.5">
                      {n.timestamp}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleDismiss(n.id)}
                    >
                      Dismiss
                    </Button>
                  )}
                  {n.linkUrl && (
                    <Link href={n.linkUrl}>
                      <Button variant="primary" size="sm" className="text-xs">
                        <span>Review</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {notifications.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
            <h4 className="text-base font-bold text-white">All Clear</h4>
            <p className="text-xs text-slate-400">
              No operational alerts, capacity bottlenecks, or critical deadlines pending.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
