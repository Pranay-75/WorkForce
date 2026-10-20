'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  Flame,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  RefreshCw,
  Users,
} from 'lucide-react';

interface InsightMember {
  id: string;
  fullName: string;
  department: string;
  currentLoadHours: number;
  weeklyCapacityHours: number;
  burnoutRiskScore: number;
  activeTaskCount: number;
  onTimeCompletionRate: number;
}

export default function InsightsPage() {
  const { isAuthenticated, organization } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  const { members: liveMembers, isLoading: isMembersLoading } = useOrganizationMembers();
  const { tasks: liveTasks, isLoading: isTasksLoading } = useTasks();
  const { employees: mockEmployees } = useMockStore();

  const isLoading = isLive && (isMembersLoading || isTasksLoading);

  const employees: InsightMember[] = React.useMemo(() => {
    if (!isLive) {
      return mockEmployees.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        department: e.department,
        currentLoadHours: e.currentLoadHours,
        weeklyCapacityHours: e.weeklyCapacityHours,
        burnoutRiskScore: e.burnoutRiskScore,
        activeTaskCount: e.activeTaskCount,
        onTimeCompletionRate: e.onTimeCompletionRate,
      }));
    }

    return liveMembers.map((m) => {
      const memberTasks = liveTasks.filter(
        (t) => t.assignedTo === m.userId && t.status !== 'completed'
      );
      const load = memberTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
      const cap = m.weeklyCapacityHours || 40;
      const util = cap > 0 ? load / cap : 0;
      return {
        id: m.userId,
        fullName: m.fullName,
        department: m.department || 'General',
        currentLoadHours: load,
        weeklyCapacityHours: cap,
        burnoutRiskScore: Math.min(1.0, util * 0.9),
        activeTaskCount: memberTasks.length,
        onTimeCompletionRate: 100,
      };
    });
  }, [isLive, mockEmployees, liveMembers, liveTasks]);

  const sortedByRisk = React.useMemo(() => {
    return [...employees].sort((a, b) => b.burnoutRiskScore - a.burnoutRiskScore);
  }, [employees]);

  const highRiskCount = employees.filter(
    (e) => e.weeklyCapacityHours > 0 && e.currentLoadHours / e.weeklyCapacityHours > 1.0
  ).length;

  const totalOpenEffort = isLive
    ? liveTasks.filter((t) => t.status !== 'completed').reduce((s, t) => s + (t.estimatedHours || 0), 0)
    : 88.6;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm text-slate-400">Loading live operational risk matrix &amp; member workloads...</p>
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
              Employee Performance &amp; Operational Risk
            </h2>
            <Badge variant={isLive ? 'cyan' : 'rose'} size="sm">
              {isLive ? 'Live Risk Telemetry' : 'Demo Risk Matrix'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic workload congestion metrics, capacity distributions, and scheduling health
          </p>
        </div>
      </div>

      {/* Ethical Framework Disclaimer Alert */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card">
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-white text-sm block">
              Ethical Risk &amp; Operational Metric Guidelines
            </span>
            <p className="text-slate-300 leading-relaxed">
              WorkForce strictly frames all risk indexes as <strong>operational capacity and delivery metrics</strong>. Scores are calculated deterministically from scheduled task hours, capacity thresholds, and task density. They are designed to assist managers and organizers in balancing workloads and do not constitute psychological or clinical predictions.
            </p>
          </div>
        </div>
      </div>

      {/* Velocity and Performance Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Verified Team Members
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {employees.length}
              </div>
              <p className="text-[11px] text-slate-400">Active roster headcount</p>
            </div>
            <Users className="h-8 w-8 text-emerald-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Active Sprint Workload
              </span>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {totalOpenEffort} hrs
              </div>
              <p className="text-[11px] text-slate-400">Across allocated tasks</p>
            </div>
            <Activity className="h-8 w-8 text-cyan-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Over-Capacity Alerts
              </span>
              <div className="text-2xl font-bold font-mono text-rose-400">
                {highRiskCount}
              </div>
              <p className="text-[11px] text-slate-400">Members above 100% load</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-rose-400 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Operational Scheduling Congestion Table */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Scheduling Risk Index</CardTitle>
          <CardDescription>
            Deterministic indicators based on active task density and capacity allocation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedByRisk.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
              <Users className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs">No team members registered yet in this organization.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200">
                <thead className="border-b border-slate-800 bg-navy-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Team Member</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Weekly Load</th>
                    <th className="px-4 py-3">Active Tasks</th>
                    <th className="px-4 py-3">Operational Risk Index</th>
                    <th className="px-4 py-3">Status Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedByRisk.map((emp) => {
                    const riskPct = Math.round(emp.burnoutRiskScore * 100);
                    const utilPct = emp.weeklyCapacityHours > 0
                      ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100)
                      : 0;

                    return (
                      <tr key={emp.id} className="hover:bg-navy-800/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">
                          {emp.fullName}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{emp.department}</td>
                        <td className="px-4 py-3 font-mono">
                          <span className={utilPct > 100 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                            {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({utilPct}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-cyan-400">
                          {emp.activeTaskCount} task{emp.activeTaskCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between font-mono text-[10px]">
                              <span>Score:</span>
                              <span className={riskPct > 60 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                                {riskPct}%
                              </span>
                            </div>
                            <ProgressBar value={riskPct} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {riskPct > 70 ? (
                            <Badge variant="rose" size="sm">
                              High Scheduling Risk
                            </Badge>
                          ) : riskPct > 40 ? (
                            <Badge variant="amber" size="sm">
                              Moderate Load
                            </Badge>
                          ) : (
                            <Badge variant="emerald" size="sm">
                              Healthy Capacity
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
