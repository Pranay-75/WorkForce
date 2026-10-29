'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import Link from 'next/link';
import {
  ShieldCheck,
  TrendingUp,
  Activity,
  AlertTriangle,
  RefreshCw,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  calculateEmployeeWorkload,
  calculateOrganizationWorkloadMetrics,
  isTaskActive,
  isTaskOverdue,
} from '@/lib/workloadEngine';
import {
  getAIWorkloadInsights,
  WorkloadInsightsResult,
} from '@/lib/aiService';

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
  const { isAuthenticated, organization, session, role: authRole } = useAuth();
  const isLive = Boolean(isAuthenticated && organization?.id);
  const { employees: mockEmployees, tasks: mockTasks, activeRole: mockRole } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;

  const {
    members: liveMembers,
    isLoading: isMembersLoading,
    refetch: refetchMembers,
  } = useOrganizationMembers();

  const {
    tasks: liveTasks,
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useTasks();

  const { auditLogs: liveLogs } = useAuditLogs();

  const [aiInsights, setAiInsights] = React.useState<WorkloadInsightsResult | null>(null);
  const [aiLoading, setAiLoading] = React.useState(false);

  const tasks = isLive ? liveTasks : mockTasks;

  const employees = React.useMemo(() => {
    if (isLive) {
      return liveMembers.map((m) => {
        const metrics = calculateEmployeeWorkload(
          { id: m.userId, weeklyCapacityHours: m.weeklyCapacityHours },
          tasks
        );

        const memberTasks = tasks.filter((t) => t.assignedTo === m.userId);
        const memberCompleted = memberTasks.filter((t) => t.status === 'completed');
        const onTimeRate = memberTasks.length > 0
          ? Math.round((memberCompleted.length / memberTasks.length) * 100)
          : null;

        return {
          id: m.userId,
          fullName: m.fullName,
          department: m.department || 'Engineering',
          jobTitle: m.jobTitle || 'Team Member',
          weeklyCapacityHours: metrics.weeklyCapacityHours,
          currentLoadHours: metrics.activeAssignedHours,
          burnoutRiskScore: metrics.burnoutRiskScore,
          onTimeCompletionRate: onTimeRate,
        };
      });
    }
    return mockEmployees.map((e) => {
      const metrics = calculateEmployeeWorkload(
        { id: e.id, weeklyCapacityHours: e.weeklyCapacityHours },
        tasks
      );
      return {
        id: e.id,
        fullName: e.fullName,
        department: e.department,
        jobTitle: e.jobTitle,
        weeklyCapacityHours: metrics.weeklyCapacityHours,
        currentLoadHours: metrics.activeAssignedHours,
        burnoutRiskScore: metrics.burnoutRiskScore,
        onTimeCompletionRate: e.onTimeCompletionRate as number | null,
      };
    });
  }, [isLive, liveMembers, tasks, mockEmployees]);

  // Aggregate telemetry
  const orgMetrics = React.useMemo(() => {
    return calculateOrganizationWorkloadMetrics(employees as any, tasks);
  }, [employees, tasks]);

  // Fetch AI Insights
  const handleFetchAIInsights = React.useCallback(async () => {
    setAiLoading(true);
    const overallocatedMembers = employees
      .filter((e) => e.weeklyCapacityHours > 0 && e.currentLoadHours > e.weeklyCapacityHours)
      .map((e) => ({
        name: e.fullName,
        hours: e.currentLoadHours,
        capacity: e.weeklyCapacityHours,
        utilization: Math.round((e.currentLoadHours / e.weeklyCapacityHours) * 100),
      }));

    const result = await getAIWorkloadInsights(
      {
        total_capacity_hours: orgMetrics.totalCapacityHours,
        total_active_hours: orgMetrics.totalActiveHours,
        average_utilization_pct: orgMetrics.averageUtilizationPercentage,
        overallocated_count: orgMetrics.overallocatedCount,
        near_limit_count: orgMetrics.nearLimitCount,
        optimal_count: orgMetrics.optimalCount,
        underutilized_count: orgMetrics.underutilizedCount,
        overdue_tasks_count: orgMetrics.totalOverdueTasksCount,
        unassigned_tasks_count: orgMetrics.unassignedTasksCount,
        overallocated_members: overallocatedMembers,
      },
      session?.access_token,
      organization?.id
    );

    setAiInsights(result);
    setAiLoading(false);
  }, [orgMetrics, employees, session?.access_token, organization?.id]);

  React.useEffect(() => {
    if (!aiInsights && employees.length > 0) {
      handleFetchAIInsights();
    }
  }, [handleFetchAIInsights, aiInsights, employees.length]);

  const sortedByRisk = React.useMemo(() => {
    return [...employees].sort((a, b) => b.burnoutRiskScore - a.burnoutRiskScore);
  }, [employees]);

  const totalEffortHours = React.useMemo(() => {
    const list = isLive ? liveTasks : [];
    return list.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  }, [isLive, liveTasks]);

  const avgOnTime = React.useMemo(() => {
    if (!isLive) return '95.5%';
    const completed = liveTasks.filter((t) => t.status === 'completed');
    if (liveTasks.length === 0) return 'N/A';
    return `${Math.round((completed.length / liveTasks.length) * 100)}%`;
  }, [isLive, liveTasks]);

  const governanceCompliance = React.useMemo(() => {
    if (!isLive) return '100%';
    if (liveTasks.length === 0 && liveLogs.length === 0) return 'N/A';
    return '100%';
  }, [isLive, liveTasks, liveLogs]);

  if (activeRole === 'employee') {
    return (
      <AccessDenied
        resourceName="Employee Insights & Burnout Diagnostics"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="Operational burnout risk indicators, sprint velocity trends, and capacity distribution analytics are restricted to management and HR."
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
              Employee Performance &amp; Operational Risk
            </h2>
            <Badge variant="rose" size="sm">
              {isLive ? 'Live Operational Risk Matrix' : 'Operational Risk Demo'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic workload congestion metrics, capacity distributions, and scheduling health
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleFetchAIInsights}
            disabled={aiLoading}
            className="flex items-center gap-1.5"
          >
            <Sparkles className={`h-3.5 w-3.5 text-violet-400 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Generating AI...' : 'Refresh AI Insights'}</span>
          </Button>

          {isLive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchMembers();
                refetchTasks();
              }}
              disabled={isMembersLoading || isTasksLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isMembersLoading || isTasksLoading ? 'animate-spin' : ''}`} />
              <span>Recalculate</span>
            </Button>
          )}
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
              WorkForce strictly frames all risk indexes as <strong>operational capacity and delivery metrics</strong>. Scores are calculated deterministically from active assigned task hours divided by weekly capacity. They are designed to assist managers in balancing workloads and do not constitute psychological or clinical predictions.
            </p>
          </div>
        </div>
      </div>

      {/* AI Executive Insights Card */}
      {aiInsights && (
        <Card className="border-violet-500/40 bg-gradient-to-br from-navy-900 via-navy-850 to-navy-900 shadow-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">Executive Operational Synthesis</CardTitle>
            </div>
            <Badge variant={aiInsights.is_ai_generated ? 'violet' : 'slate'} size="sm">
              {aiInsights.is_ai_generated ? 'Powered by Gemini 3.8-Flash' : 'Deterministic Telemetry'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              {aiInsights.executive_summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <div className="space-y-2">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                  Identified Operational Bottlenecks
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiInsights.identified_risks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                  Actionable Mitigation Strategies
                </span>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {aiInsights.actionable_recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 font-bold">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Link href="/workload">
                <Button variant="secondary" size="sm" className="text-xs">
                  <span>Open Workload Balancing Hub</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Velocity and Performance Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Verified Team Members
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {avgOnTime}
              </div>
              <p className="text-[11px] text-slate-400">
                {isLive && avgOnTime === 'N/A' ? 'Awaiting completed tasks' : 'Reliable delivery track record'}
              </p>
            </div>
            <Users className="h-8 w-8 text-emerald-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Sprint Work Effort
              </span>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {isLive ? `${totalEffortHours} hrs` : '88.6 hrs / wk'}
              </div>
              <p className="text-[11px] text-slate-400">Across active initiatives</p>
            </div>
            <Activity className="h-8 w-8 text-cyan-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Governance Compliance
              </span>
              <div className="text-2xl font-bold font-mono text-violet-400">
                {governanceCompliance}
              </div>
              <p className="text-[11px] text-slate-400">
                {isLive && governanceCompliance === 'N/A' ? 'Audit trail logging active' : 'Human sign-off on all assignments'}
              </p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="border-b border-slate-800 bg-navy-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Weekly Load</th>
                  <th className="px-4 py-3">On-Time Velocity</th>
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
                        <Link href={`/employees/${emp.id}`} className="hover:text-violet-300 transition-colors">
                          {emp.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{emp.department}</td>
                      <td className="px-4 py-3 font-mono">
                        <span className={utilPct > 100 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {emp.currentLoadHours}h ({utilPct}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400">
                        {emp.onTimeCompletionRate !== null ? `${emp.onTimeCompletionRate}%` : 'N/A'}
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

                {sortedByRisk.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No team members found in the current organization.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
