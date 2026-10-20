'use client';

import * as React from 'react';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
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
  FolderKanban,
  Users,
} from 'lucide-react';

export default function ReportsPage() {
  const { isAuthenticated, organization } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  const { members: liveMembers, isLoading: isMembersLoading } = useOrganizationMembers();
  const { projects: liveProjects, isLoading: isProjectsLoading } = useProjects();
  const { tasks: liveTasks, isLoading: isTasksLoading } = useTasks();

  const [liveAuditCount, setLiveAuditCount] = React.useState<number | null>(null);

  const {
    employees: mockEmployees,
    projects: mockProjects,
    tasks: mockTasks,
    recommendations: mockRecommendations,
    auditEvents: mockAuditEvents,
  } = useMockStore();

  // Load audit log count for real organization
  React.useEffect(() => {
    if (!isLive || !organization?.id) return;
    const fetchAuditCount = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { count, error } = await supabase
          .from('organization_audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id);
        if (!error && count !== null) {
          setLiveAuditCount(count);
        }
      } catch {
        setLiveAuditCount(0);
      }
    };
    fetchAuditCount();
  }, [isLive, organization?.id]);

  const isLoading = isLive && (isMembersLoading || isProjectsLoading || isTasksLoading);

  const totalEffort = isLive
    ? liveTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)
    : mockProjects.reduce((s, p) => s + p.totalHours, 0);

  const activeInitiativesCount = isLive ? liveProjects.length : mockProjects.length;

  const handleDownloadCSV = () => {
    const headers = [
      'Member ID',
      'Full Name',
      'Email',
      'Role',
      'Department',
      'Capacity Hours',
      'Allocated Hours',
      'Utilization Pct',
    ];

    let rows: (string | number)[][];

    if (isLive) {
      rows = liveMembers.map((m) => {
        const memberTasks = liveTasks.filter(
          (t) => t.assignedTo === m.userId && t.status !== 'completed'
        );
        const load = memberTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
        const cap = m.weeklyCapacityHours || 40;
        const util = cap > 0 ? Math.round((load / cap) * 100) : 0;
        return [
          m.userId,
          `"${m.fullName}"`,
          m.email,
          m.role,
          m.department || 'General',
          cap,
          load,
          `${util}%`,
        ];
      });
    } else {
      rows = mockEmployees.map((e) => [
        e.id,
        `"${e.fullName}"`,
        e.email,
        e.role,
        e.department,
        e.weeklyCapacityHours,
        e.currentLoadHours,
        `${Math.round((e.currentLoadHours / e.weeklyCapacityHours) * 100)}%`,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `workforce_capacity_report_${organization?.slug || 'export'}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group departments dynamically
  const departmentStats = React.useMemo(() => {
    if (!isLive) {
      const depts = ['Engineering', 'Design', 'DevOps', 'QA', 'Product'];
      return depts.map((dept) => {
        const deptEmps = mockEmployees.filter((e) => e.department === dept);
        const count = deptEmps.length;
        const capacity = deptEmps.reduce((s, e) => s + e.weeklyCapacityHours, 0);
        const load = deptEmps.reduce((s, e) => s + e.currentLoadHours, 0);
        const util = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
        return { dept, count, capacity, load, util };
      });
    }

    // Dynamic departments from live members
    const deptMap = new Map<string, { count: number; capacity: number; load: number }>();
    liveMembers.forEach((m) => {
      const dept = m.department || 'General';
      const current = deptMap.get(dept) || { count: 0, capacity: 0, load: 0 };
      const memberTasks = liveTasks.filter(
        (t) => t.assignedTo === m.userId && t.status !== 'completed'
      );
      const memberLoad = memberTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
      const cap = m.weeklyCapacityHours || 40;

      deptMap.set(dept, {
        count: current.count + 1,
        capacity: current.capacity + cap,
        load: current.load + memberLoad,
      });
    });

    return Array.from(deptMap.entries()).map(([dept, data]) => ({
      dept,
      count: data.count,
      capacity: data.capacity,
      load: data.load,
      util: data.capacity > 0 ? Math.round((data.load / data.capacity) * 100) : 0,
    }));
  }, [isLive, mockEmployees, liveMembers, liveTasks]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm text-slate-400">Loading live operational analytics &amp; capacity records...</p>
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
              Reports &amp; Operational Analytics
            </h2>
            <Badge variant={isLive ? 'cyan' : 'violet'} size="sm">
              {isLive ? 'Live Organization Data' : 'Demo Mode Suite'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Executive workforce capacity summaries, project workload totals, and compliance logs
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleDownloadCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          <span>Export CSV Report</span>
        </Button>
      </div>

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
              {totalEffort} Hours
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Across {activeInitiativesCount} active initiative{activeInitiativesCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              AI Recommendation Telemetry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {isLive ? 'Advisory Ready' : '87.5%'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isLive
                ? 'Deterministic pre-filters active; FastAPI AI matching router ready'
                : '7 of 8 suggestions approved by managers'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              Audit Compliance Events
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
          {departmentStats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-400">
              <Users className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs">No department capacity data recorded yet for this organization.</p>
            </div>
          ) : (
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
                  {departmentStats.map(({ dept, count, capacity, load, util }) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
