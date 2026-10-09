'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ArrowLeft,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
  TrendingUp,
  Award,
  Sparkles,
  Calendar,
} from 'lucide-react';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { employees, tasks } = useMockStore();

  const employeeId = params?.id as string;
  const employee = employees.find((e) => e.id === employeeId);

  if (!employee) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Employee Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested employee identifier does not exist in the current workspace.
        </p>
        <Link href="/employees">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Directory
          </Button>
        </Link>
      </div>
    );
  }

  const assignedTasks = tasks.filter((t) => t.assignedTo === employee.id);
  const utilPct = Math.round(
    (employee.currentLoadHours / employee.weeklyCapacityHours) * 100
  );
  const initials = employee.fullName
    .split(' ')
    .map((n) => n[0])
    .join('');

  // 8-week synthetic historical capacity trend
  const historyData = [
    { week: 'W1', load: 36, pct: 90 },
    { week: 'W2', load: 38, pct: 95 },
    { week: 'W3', load: 32, pct: 80 },
    { week: 'W4', load: 40, pct: 100 },
    { week: 'W5', load: 34, pct: 85 },
    { week: 'W6', load: 38, pct: 95 },
    { week: 'W7', load: 42, pct: 105 },
    { week: 'W8 (Now)', load: employee.currentLoadHours, pct: utilPct },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link href="/employees">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Back to Talent Directory</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="violet" size="sm">
            Profile ID: {employee.id}
          </Badge>
          <Badge
            variant={
              utilPct > 100 ? 'rose' : utilPct >= 80 ? 'amber' : 'emerald'
            }
            size="sm"
          >
            {utilPct > 100
              ? 'Overload Alert'
              : utilPct >= 80
              ? 'Near Limit'
              : 'Optimal Capacity'}
          </Badge>
        </div>
      </div>

      {/* Hero Profile Header Card */}
      <Card className="relative overflow-hidden border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-xl font-bold text-white shadow-glow border border-violet-400/40">
              {initials}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">
                  {employee.fullName}
                </h2>
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-violet-300">
                {employee.jobTitle} • {employee.department}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  {employee.email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {employee.location}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-row sm:flex-col items-end gap-2 text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Current Weekly Load
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              <span
                className={
                  utilPct > 100
                    ? 'text-rose-400'
                    : utilPct >= 80
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {employee.currentLoadHours}h
              </span>
              <span className="text-slate-400 text-sm">
                {' '}
                / {employee.weeklyCapacityHours}h ({utilPct}%)
              </span>
            </div>
            <div className="w-44">
              <ProgressBar value={utilPct} />
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Skills Matrix + Workload History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Verified Skills Matrix */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" />
              <CardTitle>Skill Matrix & Proficiencies</CardTitle>
            </div>
            <CardDescription>
              Verified technical capabilities used by the deterministic AI matching engine
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employee.skills.map((s) => (
              <div
                key={s.skillId}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/60 p-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {s.skillName}
                    </span>
                    <Badge variant="cyan" size="sm">
                      {s.category}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Status: {s.verified ? 'Verified by Lead' : 'Self-Reported'}
                  </span>
                </div>

                <Badge
                  variant={
                    s.proficiency === 'expert'
                      ? 'violet'
                      : s.proficiency === 'advanced'
                      ? 'cyan'
                      : 'slate'
                  }
                  size="sm"
                >
                  {s.proficiency.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 8-Week Historical Workload Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-400" />
              <CardTitle>8-Week Capacity History</CardTitle>
            </div>
            <CardDescription>
              Sprint utilization benchmarks (40h standard baseline)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-2 h-36 pt-4 border-b border-slate-800/80 pb-2">
              {historyData.map((item, idx) => {
                const heightPct = Math.min((item.load / 50) * 100, 100);
                const isOver = item.pct > 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.load}h
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isOver
                          ? 'bg-gradient-to-t from-rose-600 to-red-500 shadow-sm'
                          : 'bg-gradient-to-t from-violet-600 to-cyan-500'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] font-semibold text-slate-400">
                      {item.week}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
                <span>Standard Load</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-rose-500" />
                <span>Capacity Overload</span>
              </div>
              <span className="font-mono text-emerald-400">
                Avg: {Math.round(historyData.reduce((s, i) => s + i.pct, 0) / historyData.length)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Tasks Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-violet-400" />
              <CardTitle>Currently Assigned Tasks ({assignedTasks.length})</CardTitle>
            </div>
            <Link href="/tasks">
              <Button variant="ghost" size="sm" className="text-xs">
                Manage All Tasks
              </Button>
            </Link>
          </div>
          <CardDescription>
            Active commitments contributing to this member's current weekly workload
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedTasks.length > 0 ? (
            <div className="divide-y divide-slate-800/80">
              {assignedTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="text-xs font-bold text-white hover:text-violet-300 transition-colors"
                      >
                        {t.title}
                      </Link>
                      <Badge
                        variant={
                          t.priority === 'critical'
                            ? 'rose'
                            : t.priority === 'high'
                            ? 'amber'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {t.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{t.projectName}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" /> Due {t.dueDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {t.estimatedHours} hrs
                    </span>
                    <Badge variant="violet" size="sm">
                      {t.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Link href={`/tasks/${t.id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              <CheckSquare className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-300">
                No active tasks assigned
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                This employee has full open availability for new project allocations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational Risk Assessment Callout */}
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-4 text-xs text-slate-400 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-200 block">
            Transparent Heuristic Risk Model:
          </span>
          <p className="leading-relaxed">
            Operational risk scores ({employee.burnoutRiskScore * 100}% index) reflect
            purely scheduling allocation, deadline density, and multi-week load history.
            They are operational metrics designed to prevent delivery delays, not clinical or
            psychological predictions.
          </p>
        </div>
      </div>
    </div>
  );
}
