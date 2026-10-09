'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
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
} from 'lucide-react';

export default function ReportsPage() {
  const { employees, projects, tasks, recommendations, auditEvents } = useMockStore();

  const handleDownloadCSV = () => {
    // Generate real client-side CSV string
    const headers = ['Employee ID', 'Full Name', 'Department', 'Job Title', 'Capacity Hours', 'Allocated Hours', 'Utilization Pct'];
    const rows = employees.map((e) => [
      e.id,
      `"${e.fullName}"`,
      e.department,
      `"${e.jobTitle}"`,
      e.weeklyCapacityHours,
      e.currentLoadHours,
      `${Math.round((e.currentLoadHours / e.weeklyCapacityHours) * 100)}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workforce_capacity_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Reports & Operational Analytics
            </h2>
            <Badge variant="violet" size="sm">
              Analytics Suite
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Executive workforce capacity summaries, AI matching effectiveness, and compliance logs
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
              {projects.reduce((s, p) => s + p.totalHours, 0)} Hours
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Across {projects.length} active initiatives
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase text-slate-400">
              AI Recommendation Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              87.5%
            </div>
            <p className="text-xs text-slate-400 mt-1">
              7 of 8 suggestions approved by managers
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
              {auditEvents.length} Recorded
            </div>
            <p className="text-xs text-slate-400 mt-1">
              100% immutable action logs preserved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Department Workload Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Capacity & Utilization Summary</CardTitle>
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
                {['Engineering', 'Design', 'DevOps', 'QA', 'Product'].map((dept) => {
                  const deptEmps = employees.filter((e) => e.department === dept);
                  const count = deptEmps.length;
                  const capacity = deptEmps.reduce((s, e) => s + e.weeklyCapacityHours, 0);
                  const load = deptEmps.reduce((s, e) => s + e.currentLoadHours, 0);
                  const util = capacity > 0 ? Math.round((load / capacity) * 100) : 0;

                  return (
                    <tr key={dept} className="hover:bg-navy-800/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{dept}</td>
                      <td className="px-4 py-3 font-mono">{count} members</td>
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
