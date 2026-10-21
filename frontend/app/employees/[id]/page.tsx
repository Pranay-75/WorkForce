'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
import { useProjects } from '@/lib/hooks/useProjects';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import {
  ArrowLeft,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
  Award,
  Calendar,
  FolderKanban,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params?.id as string;

  const { isAuthenticated, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);
  const isManagerOrAdmin = authRole === 'organizer' || authRole === 'admin' || authRole === 'manager';

  // Live hooks
  const { members: liveMembers, isLoading: isMembersLoading } = useOrganizationMembers();
  const { projects: dbProjects, addProjectMember, refetch: refetchProjects } = useProjects();
  const { tasks: dbTasks, assignTask, refetch: refetchTasks } = useTasks();

  // Mock store fallback
  const { employees: mockEmployees, tasks: mockTasks } = useMockStore();

  // Project Assignment Dialog State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignProjectId, setAssignProjectId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Resolve employee either from live members or mock store
  const liveMember = isLive ? liveMembers.find((m) => m.userId === employeeId || m.id === employeeId) : null;
  const mockEmployee = !isLive ? mockEmployees.find((e) => e.id === employeeId) : null;

  // Loading skeleton for live mode
  if (isLive && isMembersLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-6 w-32 bg-slate-800 rounded" />
        <div className="h-44 bg-navy-900/60 rounded-xl border border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-navy-900/40 rounded-xl border border-slate-800" />
          <div className="h-48 bg-navy-900/40 rounded-xl border border-slate-800" />
        </div>
      </div>
    );
  }

  if (!liveMember && !mockEmployee) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Employee Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested employee identifier does not exist in the active organization directory.
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

  // Unified employee representation
  const targetUid = isLive ? (liveMember?.userId || employeeId) : mockEmployee!.id;
  const fullName = isLive ? liveMember!.fullName : mockEmployee!.fullName;
  const email = isLive ? liveMember!.email : mockEmployee!.email;
  const role = isLive ? liveMember!.role : mockEmployee!.role;
  const department = isLive ? (liveMember!.department || 'Engineering') : mockEmployee!.department;
  const jobTitle = isLive ? (liveMember!.jobTitle || 'Team Member') : mockEmployee!.jobTitle;
  const weeklyCapacityHours = isLive ? (liveMember!.weeklyCapacityHours ?? 40) : mockEmployee!.weeklyCapacityHours;

  // Resolve assigned tasks
  const assignedTasks = isLive
    ? dbTasks.filter((t) => t.assignedTo === targetUid)
    : mockTasks.filter((t) => t.assignedTo === mockEmployee!.id);

  const activeTasks = assignedTasks.filter((t) => t.status !== 'completed');

  const currentLoadHours = isLive
    ? activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    : mockEmployee!.currentLoadHours;

  const utilPct = weeklyCapacityHours > 0 ? Math.round((currentLoadHours / weeklyCapacityHours) * 100) : 0;
  const riskIndex = Math.min(100, Math.round(utilPct * 0.9));

  // Resolve allocated projects
  const allocatedProjects = isLive
    ? dbProjects.filter((p) => p.memberIds.includes(targetUid))
    : [];

  const employee = {
    id: targetUid,
    fullName,
    email,
    role,
    department,
    jobTitle,
    weeklyCapacityHours,
    currentLoadHours,
    burnoutRiskScore: Math.min(Math.round(utilPct) / 100, 1.0),
    skills: mockEmployee?.skills || [],
    avatarUrl: liveMember?.avatarUrl || mockEmployee?.avatarUrl,
  };

  const handleOpenAssignModal = () => {
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    const unallocated = dbProjects.find((p) => !p.memberIds.includes(targetUid));
    setAssignProjectId(unallocated ? unallocated.id : (dbProjects[0]?.id || ''));
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignProjectId || !targetUid) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    const res = await addProjectMember(assignProjectId, targetUid);
    if (res.error) {
      setAssignLoading(false);
      setAssignError(res.error);
      return;
    }

    if (assignTaskIds.length > 0) {
      for (const taskId of assignTaskIds) {
        await assignTask(taskId, targetUid);
      }
      await refetchTasks();
    }

    await refetchProjects();
    setAssignLoading(false);
    setAssignSuccess(`Assigned ${fullName} to project initiative.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  const initials = employee.fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';

  // 8-week capacity history
  const historyData = [
    { week: 'W1', load: Math.max(employee.weeklyCapacityHours - 4, 0), pct: 90 },
    { week: 'W2', load: Math.max(employee.weeklyCapacityHours - 2, 0), pct: 95 },
    { week: 'W3', load: Math.max(employee.weeklyCapacityHours - 8, 0), pct: 80 },
    { week: 'W4', load: employee.weeklyCapacityHours, pct: 100 },
    { week: 'W5', load: Math.max(employee.weeklyCapacityHours - 6, 0), pct: 85 },
    { week: 'W6', load: Math.max(employee.weeklyCapacityHours - 2, 0), pct: 95 },
    { week: 'W7', load: Math.round(employee.weeklyCapacityHours * 1.05), pct: 105 },
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
          {isManagerOrAdmin && isLive && (
            <Button variant="secondary" size="sm" onClick={handleOpenAssignModal}>
              <FolderKanban className="h-3.5 w-3.5 mr-1 text-cyan-400" />
              <span>Assign Project</span>
            </Button>
          )}
          <Badge variant="violet" size="sm">
            Profile ID: {employee.id.slice(0, 8)}...
          </Badge>
          <Badge
            variant={utilPct > 100 ? 'rose' : utilPct >= 80 ? 'amber' : 'emerald'}
            size="sm"
          >
            {utilPct > 100 ? 'Overload Alert' : utilPct >= 80 ? 'Near Limit' : 'Optimal Capacity'}
          </Badge>
        </div>
      </div>

      {/* Hero Profile Header Card */}
      <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-xl font-bold text-white shadow-lg border border-violet-400/40">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">
                  {employee.fullName}
                </h2>
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <Badge variant="cyan" size="sm" className="uppercase text-[10px]">
                  {employee.role}
                </Badge>
              </div>
              <p className="text-sm text-slate-300 font-medium">{jobTitle}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  {email}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {isLive ? 'Active Organization Member' : 'San Francisco, CA'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 min-w-[200px] text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold">
              Weekly Allocation Load
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {currentLoadHours}h / {weeklyCapacityHours}h ({utilPct}%)
            </div>
            <div className="w-full">
              <ProgressBar value={utilPct} />
            </div>
          </div>
        </div>
      </Card>

      {/* Allocated Projects & Capacity Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Allocated Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-cyan-400" />
                <CardTitle>Allocated Projects ({allocatedProjects.length})</CardTitle>
              </div>
              {isManagerOrAdmin && isLive && (
                <Button variant="ghost" size="sm" onClick={handleOpenAssignModal} className="text-xs text-cyan-400">
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  <span>Assign</span>
                </Button>
              )}
            </div>
            <CardDescription>
              Verified technical capabilities used by the deterministic task matching engine
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employee.skills.length > 0 ? (
              employee.skills.map((s) => (
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
              ))
            ) : (
              <div className="p-6 text-center text-slate-400">
                <p className="text-xs text-slate-300">Default profile skills linked via department role ({employee.department}).</p>
                <p className="text-[11px] text-slate-500 mt-1">Additional skill endorsements can be added via organization settings.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Scheduling Risk */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-400" />
              <CardTitle>Operational Capacity Overview</CardTitle>
            </div>
            <CardDescription>
              Sprint utilization benchmarks ({employee.weeklyCapacityHours}h standard baseline)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLive ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Clock className="h-8 w-8 text-slate-500 mb-2" />
                <p className="text-xs font-medium text-slate-200">
                  Historical capacity trends pending
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Sprint-over-sprint workload snapshots will populate as multi-week operational logs accumulate.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-2 h-36 pt-4 border-b border-slate-800/80 pb-2">
                  {historyData.map((item, idx) => {
                    const heightPct = Math.min((item.load / (employee.weeklyCapacityHours * 1.25 || 50)) * 100, 100);
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
              </>
            )}
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
            Active commitments contributing to this member&apos;s current weekly workload
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
                      {t.dueDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="h-3 w-3" /> Due {t.dueDate}
                          </span>
                        </>
                      )}
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
            Operational risk scores ({Math.round(employee.burnoutRiskScore * 100)}% index) reflect
            purely active assigned workload divided by weekly capacity.
            They are operational metrics designed to prevent delivery delays and over-allocation, not clinical or
            psychological predictions.
          </p>
        </div>
      </div>

      {/* Assign to Project Dialog */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign ${fullName} to Project`}
        description="Allocate this team member to an active project portfolio initiative."
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 py-2">
          {assignError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          {assignSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{assignSuccess}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Select Target Project *
            </label>
            {dbProjects.length === 0 ? (
              <p className="text-xs text-amber-400">No active projects found in workspace.</p>
            ) : (
              <select
                value={assignProjectId}
                onChange={(e) => setAssignProjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                required
              >
                <option value="" disabled>-- Select a Project --</option>
                {dbProjects.map((p) => {
                  const isAllocated = p.memberIds.includes(targetUid);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priority.toUpperCase()} Priority) {isAllocated ? '— Already Allocated' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={assignLoading || !assignProjectId}
            >
              {assignLoading ? 'Assigning...' : 'Confirm Project Assignment'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
