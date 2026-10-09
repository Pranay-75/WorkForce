'use client';

import * as React from 'react';
import Link from 'next/link';
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
} from 'lucide-react';

export default function NotificationsPage() {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useMockStore();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Notification & Alert Center
            </h2>
            <Badge variant={unreadCount > 0 ? 'amber' : 'emerald'} size="sm">
              {unreadCount} Unread
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time capacity overload warnings, AI recommendation notices, and sprint updates
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={markAllNotificationsAsRead}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            <span>Mark All as Read</span>
          </Button>
        )}
      </div>

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
                      onClick={() => markNotificationAsRead(n.id)}
                    >
                      Mark Read
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
      </div>
    </div>
  );
}
