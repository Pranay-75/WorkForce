'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import { useMockStore } from '@/lib/mockStore';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  FileSpreadsheet,
  Download,
  Sparkles,
  TrendingUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  calculateEmployeeWorkload,
  calculateOrganizationWorkloadMetrics,
  isTaskActive,
  isTaskOverdue,
} from '@/lib/workloadEngine';
import {
  getAIExecutiveReport,
  ExecutiveReportResult,
} from '@/lib/aiService';

export default function ReportsPage() {
  const { isAuthenticated, organization, session, role: authRole } = useAuth();
  const isLive = Boolean(isAuthenticated && organization?.id);
  const [aiReport, setAiReport] = React.useState<ExecutiveReportResult | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);

  // Live hooks
  const {
    members: liveMembers,
    departments: liveDepartments,
    isLoading: isMembersLoading,
    refetch: refetchMembers,
  } = useOrganizationMembers();

  const {
    projects: liveProjects,
    isLoading: isProjectsLoading,
    refetch: refetchProjects,
  } = useProjects();

  const {
    tasks: liveTasks,
    isLoading: isTasksLoading,
    refetch: refetchTasks,
  } = useTasks();

  const {
    auditLogs: liveAuditLogs,
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useAuditLogs();

  // Mock store fallback
  const {
    employees: mockEmployees,
    projects: mockProjects,
    tasks: mockTasks,
    recommendations: mockRecommendations,
    auditEvents: mockAuditEvents,
    activeRole: mockRole,
  } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;

  const projects = isLive ? liveProjects : mockProjects;
  const tasks = isLive ? liveTasks : mockTasks;
  const auditEvents = isLive ? liveAuditLogs : mockAuditEvents;
  const liveAuditCount = liveAuditLogs.length;

  // Reconcile employee list with live assigned tasks using shared workload engine
  const employees = React.useMemo(() => {
    if (isLive) {
      return liveMembers.map((m) => {
        const metrics = calculateEmployeeWorkload(
          { id: m.userId, weeklyCapacityHours: m.weeklyCapacityHours },
          tasks
        );
        return {
          id: m.userId,
          fullName: m.fullName,
          department: m.department || 'Engineering',
          jobTitle: m.jobTitle || 'Team Member',
          weeklyCapacityHours: metrics.weeklyCapacityHours,
          currentLoadHours: metrics.activeAssignedHours,
          remainingCapacityHours: metrics.remainingCapacityHours,
          utilizationPercentage: metrics.utilizationPercentage,
          capacityBand: metrics.capacityBand,
          activeTaskCount: metrics.activeTaskCount,
          overdueTaskCount: metrics.overdueTaskCount,
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
        remainingCapacityHours: metrics.remainingCapacityHours,
        utilizationPercentage: metrics.utilizationPercentage,
        capacityBand: metrics.capacityBand,
        activeTaskCount: metrics.activeTaskCount,
        overdueTaskCount: metrics.overdueTaskCount,
      };
    });
  }, [isLive, liveMembers, tasks, mockEmployees]);

  const orgMetrics = React.useMemo(() => {
    return calculateOrganizationWorkloadMetrics(employees as any, tasks);
  }, [employees, tasks]);

  // Distinct departments
  const departmentList = React.useMemo(() => {
    if (isLive && liveDepartments.length > 0) {
      return liveDepartments.map((d) => d.department);
    }
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return set.size > 0 ? Array.from(set) : ['Engineering', 'Product', 'Design'];
  }, [isLive, liveDepartments, employees]);

  const handleGenerateAIReport = React.useCallback(async () => {
    setReportLoading(true);
    const departmentMetrics = departmentList.map((dept) => {
      const deptEmps = employees.filter((e) => e.department === dept);
      const activeHrs = deptEmps.reduce((sum, e) => sum + e.currentLoadHours, 0);
      const capHrs = deptEmps.reduce((sum, e) => sum + e.weeklyCapacityHours, 0);
      return { department: dept, active_hours: activeHrs, capacity: capHrs };
    });

    const completedCount = tasks.filter((t) => t.status === 'completed').length;
    const completionPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 100;

    const result = await getAIExecutiveReport(
      {
        project_count: projects.length,
        active_tasks_count: tasks.filter(isTaskActive).length,
        completed_tasks_count: completedCount,
        completion_rate_pct: completionPct,
        department_metrics: departmentMetrics,
        recent_audit_count: auditEvents.length,
      },
      session?.access_token,
      organization?.id
    );

    setAiReport(result);
    setReportLoading(false);
  }, [departmentList, employees, tasks, projects, auditEvents, session?.access_token, organization?.id]);

  React.useEffect(() => {
    if (!aiReport && employees.length > 0) {
      handleGenerateAIReport();
    }
  }, [handleGenerateAIReport, aiReport, employees.length]);

  const handleDownloadCSV = () => {
    const headers = [
      'Employee ID',
      'Full Name',
      'Department',
      'Job Title',
      'Weekly Capacity (h)',
      'Active Assigned (h)',
      'Remaining Capacity (h)',
      'Utilization (%)',
      'Capacity Status',
      'Active Tasks',
      'Overdue Tasks',
    ];
    const rows = employees.map((e) => [
      e.id,
      `"${e.fullName}"`,
      `"${e.department}"`,
      `"${e.jobTitle}"`,
      e.weeklyCapacityHours,
      e.currentLoadHours,
      e.remainingCapacityHours,
      `${e.utilizationPercentage}%`,
      e.capacityBand.toUpperCase(),
      e.activeTaskCount,
      e.overdueTaskCount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workforce_capacity_report_${organization?.slug || 'workspace'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalEffortHours = React.useMemo(() => {
    return tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  }, [tasks]);

  if (activeRole === 'employee') {
    return (
      <AccessDenied
        resourceName="Reports & Executive Analytics"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="Organization capacity metrics, AI recommendation accuracy benchmarks, and historical velocity reports are restricted to management and administrative personnel."
      />
    );
  }

  const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 100;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Reports &amp; Operational Analytics
            </h2>
            <Badge variant="violet" size="sm">
              {isLive ? 'PostgreSQL Live Analytics' : 'Demo Analytics Suite'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Executive workforce capacity summaries, project velocity, and immutable compliance audit logs
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateAIReport}
            disabled={reportLoading}
            className="flex items-center gap-1.5 text-xs"
          >
            <Sparkles className={`h-3.5 w-3.5 text-violet-400 ${reportLoading ? 'animate-spin' : ''}`} />
            <span>{reportLoading ? 'Generating Briefing...' : 'Refresh AI Briefing'}</span>
          </Button>

          {isLive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchMembers();
                refetchProjects();
                refetchTasks();
                refetchAudit();
              }}
              disabled={isMembersLoading || isProjectsLoading || isTasksLoading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isMembersLoading || isTasksLoading ? 'animate-spin' : ''}`} />
              <span>Recalculate</span>
            </Button>
          )}

          <Button variant="primary" size="md" onClick={handleDownloadCSV} disabled={employees.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            <span>Export Verified CSV</span>
          </Button>
        </div>
      </div>

      {/* AI Executive Report Briefing */}
      {aiReport && (
        <Card className="border-violet-500/40 bg-gradient-to-br from-navy-900 via-navy-850 to-navy-900 shadow-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <CardTitle className="text-base">Executive Intelligence Briefing</CardTitle>
            </div>
            <Badge variant={aiReport.is_ai_generated ? 'violet' : 'slate'} size="sm">
              {aiReport.is_ai_generated ? 'Powered by Gemini 3.8-Flash' : 'Deterministic Telemetry'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              {aiReport.executive_briefing}
            </p>

            <div className="rounded-xl border border-slate-800 bg-navy-950/60 p-3.5 space-y-1">
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                Sprint Velocity &amp; Cadence Evaluation:
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {aiReport.velocity_analysis}
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-slate-300 block">
                Recommended Strategic Planning Priorities:
              </span>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {aiReport.strategic_priorities.map((item, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-slate-800/80 bg-navy-900/60 p-2.5 text-xs text-slate-300 flex items-start gap-2"
                  >
                    <span className="text-violet-400 font-bold">#{idx + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              Total Recorded Work Effort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">
              {totalEffortHours} Hours
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Across {projects.length} project initiative{projects.length !== 1 ? 's' : ''} ({tasks.length} total tasks)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              Task Velocity & Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {taskCompletionRate}%
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {completedTasksCount} of {tasks.length} tasks marked completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              Compliance Audit Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-cyan-400">
              {isLive
                ? (liveAuditCount !== null ? `${liveAuditCount} Logged` : 'Active')
                : `${mockAuditEvents.length} Recorded`}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Immutable organization governance trail preserved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Workload Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Capacity &amp; Utilization Summary</CardTitle>
          <CardDescription>
            Aggregated metrics for quarterly resource planning and hiring forecasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="border-b border-slate-800 bg-navy-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Headcount</th>
                  <th className="px-4 py-3">Total Capacity</th>
                  <th className="px-4 py-3">Allocated Load</th>
                  <th className="px-4 py-3">Utilization Rate</th>
                  <th className="px-4 py-3">Health Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {departmentList.map((dept) => {
                  const deptEmps = employees.filter((e) => e.department === dept);
                  const count = deptEmps.length;
                  const capacity = deptEmps.reduce((s, e) => s + e.weeklyCapacityHours, 0);
                  const load = deptEmps.reduce((s, e) => s + e.currentLoadHours, 0);
                  const util = capacity > 0 ? Math.round((load / capacity) * 100) : 0;

                  return (
                    <tr key={dept} className="hover:bg-navy-800/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{dept}</td>
                      <td className="px-4 py-3 font-mono">{count} member{count !== 1 ? 's' : ''}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{capacity}h</td>
                      <td className="px-4 py-3 font-mono text-cyan-400">{load}h</td>
                      <td className="px-4 py-3">
                        <div className="w-32 space-y-1">
                          <span className="font-mono font-bold text-xs">{util}%</span>
                          <ProgressBar value={util} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            util > 100
                              ? 'rose'
                              : util >= 80
                              ? 'amber'
                              : 'emerald'
                          }
                          size="sm"
                        >
                          {util > 100
                            ? 'Over Capacity'
                            : util >= 80
                            ? 'Near Limit'
                            : 'Optimal'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}

                {departmentList.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No departments registered in this workspace yet.
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
