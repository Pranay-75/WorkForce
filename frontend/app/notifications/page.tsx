'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useMockStore } from '@/lib/mockStore';
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
  Info,
  RefreshCw,
} from 'lucide-react';

interface DisplayNotification {
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

  const { members: liveMembers, isLoading: isMembersLoading } = useOrganizationMembers();
  const { tasks: liveTasks, isLoading: isTasksLoading } = useTasks();
  const { projects: liveProjects, isLoading: isProjectsLoading } = useProjects();

  const { notifications: mockNotifications, markNotificationAsRead, markAllNotificationsAsRead } = useMockStore();

  const [dismissedLiveIds, setDismissedLiveIds] = React.useState<Set<string>>(new Set());

  // Derive live alerts from actual task and workload status
  const liveNotifications: DisplayNotification[] = React.useMemo(() => {
    if (!isLive) return [];
    const alerts: DisplayNotification[] = [];

    // 1. Capacity overload alerts
    liveMembers.forEach((m) => {
      const memberTasks = liveTasks.filter(
        (t) => t.assignedTo === m.userId && t.status !== 'completed'
      );
      const load = memberTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
      const cap = m.weeklyCapacityHours || 40;
      if (cap > 0 && load > cap) {
        alerts.push({
          id: `live-overload-${m.userId}`,
          type: 'capacity_alert',
          title: `Capacity Congestion: ${m.fullName}`,
          message: `${m.fullName} is allocated ${load}h against ${cap}h weekly capacity (${Math.round((load / cap) * 100)}%). Rebalance tasks in Workload sandbox.`,
          timestamp: 'Live Monitor',
          isRead: dismissedLiveIds.has(`live-overload-${m.userId}`),
          linkUrl: '/workload',
        });
      }
    });

    // 2. Urgent / critical tasks
    liveTasks
      .filter((t) => t.status !== 'completed')
      .forEach((t) => {
        if (t.priority === 'critical') {
          alerts.push({
            id: `live-critical-${t.id}`,
            type: 'deadline_warning',
            title: `Critical Priority Task: ${t.title}`,
            message: `Task "${t.title}" requires immediate attention. Due: ${t.dueDate || 'Sprint End'}.`,
            timestamp: 'Live Monitor',
            isRead: dismissedLiveIds.has(`live-critical-${t.id}`),
            linkUrl: `/tasks/${t.id}`,
          });
        }
      });

    // 3. Unassigned tasks in active projects
    const unassignedTasks = liveTasks.filter((t) => !t.assignedTo && t.status !== 'completed');
    if (unassignedTasks.length > 0) {
      alerts.push({
        id: 'live-unassigned-pool',
        type: 'recommendation_ready',
        title: `${unassignedTasks.length} Unassigned Sprint Task${unassignedTasks.length !== 1 ? 's' : ''}`,
        message: `There are ${unassignedTasks.length} pending task(s) in the organization without an assigned team member.`,
        timestamp: 'Live Monitor',
        isRead: dismissedLiveIds.has('live-unassigned-pool'),
        linkUrl: '/tasks',
      });
    }

    return alerts;
  }, [isLive, liveMembers, liveTasks, dismissedLiveIds]);

  const notifications: DisplayNotification[] = isLive
    ? liveNotifications
    : mockNotifications.map((m) => ({
        id: m.id,
        type: m.type as any,
        title: m.title,
        message: m.message,
        timestamp: m.timestamp,
        isRead: m.isRead,
        linkUrl: m.linkUrl,
      }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleDismiss = (id: string) => {
    if (isLive) {
      setDismissedLiveIds((prev) => new Set(prev).add(id));
    } else {
      markNotificationAsRead(id);
    }
  };

  const handleDismissAll = () => {
    if (isLive) {
      const allIds = new Set(liveNotifications.map((n) => n.id));
      setDismissedLiveIds(allIds);
    } else {
      markAllNotificationsAsRead();
    }
  };

  const isLoading = isLive && (isMembersLoading || isTasksLoading || isProjectsLoading);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm text-slate-400">Loading live operational alerts...</p>
      </div>
    );
  }

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

      {isLive && (
        <div className="rounded-xl border border-violet-500/30 bg-navy-900/60 p-4 text-xs text-slate-300 flex items-start gap-3">
          <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white">Live Telemetry Alert Inbox</span>
            <p className="text-slate-400 leading-relaxed">
              Operational notifications are derived dynamically from verified organization task due dates and capacity bottlenecks. Persistent notification storage with push delivery requires a future database migration.
            </p>
          </div>
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
