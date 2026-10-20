'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
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
  TrendingUp,
  Award,
  Sparkles,
  Calendar,
  FolderKanban,
  UserPlus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
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
  const weeklyCapacityHours = isLive ? (liveMember!.weeklyCapacityHours || 40) : mockEmployee!.weeklyCapacityHours;

  // Resolve assigned tasks
  const assignedTasks = isLive
    ? dbTasks.filter((t) => t.assignedTo === targetUid)
    : mockTasks.filter((t) => t.assignedTo === mockEmployee!.id);

  const currentLoadHours = isLive
    ? assignedTasks.filter((t) => t.status !== 'completed').reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    : mockEmployee!.currentLoadHours;

  const utilPct = weeklyCapacityHours > 0 ? Math.round((currentLoadHours / weeklyCapacityHours) * 100) : 0;
  const riskIndex = Math.min(100, Math.round(utilPct * 0.9));

  // Resolve allocated projects
  const allocatedProjects = isLive
    ? dbProjects.filter((p) => p.memberIds.includes(targetUid))
    : [];

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

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
            {role.toUpperCase()}
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
                <h2 className="text-2xl font-extrabold text-white">{fullName}</h2>
                <Badge variant="cyan" size="sm">
                  {department}
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
              Active portfolio initiatives this team member is currently allocated to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocatedProjects.length > 0 ? (
              <div className="space-y-2">
                {allocatedProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/60 p-3 hover:border-violet-500/40 transition-all"
                  >
                    <div>
                      <Link href={`/projects/${p.id}`} className="text-xs font-bold text-white hover:text-violet-300">
                        {p.name}
                      </Link>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{p.description}</p>
                    </div>
                    <Badge variant={p.status === 'in_progress' ? 'cyan' : 'slate'} size="sm">
                      {p.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400">
                <FolderKanban className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                <p className="text-xs text-slate-400">Not currently assigned to any active projects.</p>
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
              Sprint utilization benchmarks based on verified commitments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Tasks</span>
                <p className="text-2xl font-bold font-mono text-cyan-400 mt-1">{assignedTasks.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Risk Index</span>
                <p className={`text-2xl font-bold font-mono mt-1 ${riskIndex > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {riskIndex}%
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-navy-950/40 p-3 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-white block">Availability Summary:</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {weeklyCapacityHours - currentLoadHours > 0
                  ? `${weeklyCapacityHours - currentLoadHours} hours of available weekly headroom for new task assignments.`
                  : 'Currently at or over capacity limit. Rebalancing recommended.'}
              </p>
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
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" /> Due {t.dueDate || 'Unscheduled'}
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
            Operational risk scores ({riskIndex}% index) reflect purely scheduling allocation,
            deadline density, and multi-week load history. They are operational metrics designed to
            prevent delivery delays, not clinical or psychological predictions.
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
