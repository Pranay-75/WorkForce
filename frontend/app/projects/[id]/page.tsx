'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import {
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  Trash2,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const { isAuthenticated, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live hooks
  const {
    projects: dbProjects,
    isLoading: isProjectsLoading,
    addProjectMember,
    removeProjectMember,
    refetch: refetchProjects,
  } = useProjects();
  const {
    tasks: dbTasks,
    isLoading: isTasksLoading,
    assignTask,
    refetch: refetchTasks,
  } = useTasks();
  const { members: orgMembers, isLoading: isMembersLoading } = useOrganizationMembers();

  // Mock store fallback
  const { projects: mockProjects, employees: mockEmployees, tasks: mockTasks, activeRole: mockRole } = useMockStore();

  const activeRole = isLive ? authRole : mockRole;
  const isManagerOrAdmin = activeRole === 'organizer' || activeRole === 'admin' || activeRole === 'manager';

  const projects = isLive ? dbProjects : mockProjects;
  const tasks = isLive ? dbTasks : mockTasks;

  const project = projects.find((p) => p.id === projectId);
  const [activeTab, setActiveTab] = React.useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

  // Member Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Card Action feedback
  const [actionNotice, setActionNotice] = React.useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Loading skeleton
  if (isLive && isProjectsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-6 w-32 bg-slate-800 rounded" />
        <div className="h-44 bg-navy-900/60 rounded-xl border border-slate-800" />
        <div className="h-32 bg-navy-900/40 rounded-xl border border-slate-800" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested project does not exist in the active organization portfolio.
        </p>
        <Link href="/projects">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const filteredTasks = projectTasks.filter((t) =>
    activeTab === 'all' ? true : t.status === activeTab
  );

  // Resolve members allocated to this project
  const projectMembers = isLive
    ? orgMembers
        .filter((m) => project.memberIds.includes(m.userId))
        .map((m) => {
          const memberActiveTasks = tasks.filter(
            (t) => t.assignedTo === m.userId && t.status !== 'completed'
          );
          const currentLoad = memberActiveTasks.reduce(
            (acc, t) => acc + (t.estimatedHours || 0),
            0
          );
          return {
            id: m.userId,
            fullName: m.fullName,
            jobTitle: m.jobTitle || 'Team Member',
            department: m.department || 'Engineering',
            weeklyCapacityHours: m.weeklyCapacityHours || 40,
            currentLoadHours: currentLoad,
          };
        })
    : mockEmployees.filter((e) => project.memberIds.includes(e.id));

  const progressPct =
    project.totalHours > 0 ? Math.round((project.completedHours / project.totalHours) * 100) : 0;

  // Handlers for Member Allocation
  const handleOpenAssignModal = () => {
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    const unallocated = orgMembers.find((m) => !project.memberIds.includes(m.userId));
    setSelectedMemberId(unallocated ? unallocated.userId : (orgMembers[0]?.userId || ''));
    setIsAssignModalOpen(true);
  };

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    const res = await addProjectMember(project.id, selectedMemberId);
    if (res.error) {
      setAssignLoading(false);
      setAssignError(res.error);
      return;
    }

    if (assignTaskIds.length > 0) {
      for (const taskId of assignTaskIds) {
        await assignTask(taskId, selectedMemberId);
      }
      await refetchTasks();
    }

    await refetchProjects();
    setAssignLoading(false);
    const assignedMember = orgMembers.find((m) => m.userId === selectedMemberId);
    setAssignSuccess(`Assigned ${assignedMember?.fullName || 'member'} to ${project.name}.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from ${project.name}?`)) return;
    const res = await removeProjectMember(project.id, userId);
    if (res.error) {
      setActionNotice({ type: 'error', text: res.error });
    } else {
      setActionNotice({ type: 'success', text: `${memberName} was removed from the project.` });
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Action Notice */}
      {actionNotice && (
        <div
          className={`rounded-xl border p-3 text-xs flex items-center gap-2 animate-in fade-in ${
            actionNotice.type === 'error'
              ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {actionNotice.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>All Projects</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              project.priority === 'critical'
                ? 'rose'
                : project.priority === 'high'
                ? 'amber'
                : 'slate'
            }
            size="sm"
          >
            {project.priority.toUpperCase()} PRIORITY
          </Badge>
          <Badge variant="cyan" size="sm">
            {project.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Project Banner Card */}
      <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <FolderKanban className="h-6 w-6 text-violet-400" />
              <h2 className="text-2xl font-extrabold text-white">
                {project.name}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {project.description || 'No detailed scope description provided.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                Target: {project.targetEndDate || 'Unscheduled'}
              </span>
              <span>•</span>
              <span>Lead: {project.managerName || 'Unassigned'}</span>
              <span>•</span>
              <span className="font-mono">{projectTasks.length} Total Tasks</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 min-w-[200px] text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold">
              Project Delivery
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {project.completedHours}h / {project.totalHours}h ({progressPct}%)
            </div>
            <div className="w-full">
              <ProgressBar value={progressPct} />
            </div>
          </div>
        </div>
      </Card>

      {/* Assigned Team Members Row */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <CardTitle>Allocated Team Members ({projectMembers.length})</CardTitle>
          </div>
          {isManagerOrAdmin && (
            <Button variant="secondary" size="sm" onClick={handleOpenAssignModal}>
              <UserPlus className="h-3.5 w-3.5 mr-1 text-cyan-400" />
              <span>Assign Member</span>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {projectMembers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No team members have been specifically assigned to this project.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {projectMembers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 bg-navy-900/60 p-3 hover:border-violet-500/50 transition-all group flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-xs font-bold text-white shrink-0">
                      {m.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                        {m.fullName}
                      </h4>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {m.jobTitle}
                      </span>
                    </div>
                  </div>
                  {isManagerOrAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(m.id, m.fullName)}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-1 h-7 w-7 shrink-0 ml-2"
                      title="Remove from project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Tasks Summary & Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Project Task Roster
            </h3>
            <p className="text-xs text-slate-400">
              Granular breakdown of requirements, deadlines, and assigned talent
            </p>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-navy-900 p-1 border border-slate-800 text-xs">
            {(['all', 'todo', 'in_progress', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Tasks' : tab.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <Card
              key={t.id}
              className="border-slate-800 hover:border-violet-500/50 transition-all"
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-sm font-bold text-white hover:text-violet-300 transition-colors"
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
                  <p className="text-xs text-slate-300 line-clamp-1">
                    {t.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="font-mono text-cyan-400 font-semibold">
                      {t.estimatedHours} hrs estimate
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3" /> Due {t.dueDate || 'Unscheduled'}
                    </span>
                    <span>•</span>
                    <span>
                      Assignee:{' '}
                      <strong className="text-slate-200">
                        {t.assignedEmployeeName || 'Unassigned'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!t.assignedTo ? (
                    <Link href="/matching">
                      <Button variant="accent" size="sm">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Find AI Match
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/tasks/${t.id}`}>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400">
              <CheckSquare className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-300">
                No tasks matching &quot;{activeTab}&quot; status.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Assign Member Modal */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Member to ${project.name}`}
        description="Select an active organization member to allocate to this project initiative."
      >
        <form onSubmit={handleAssignMember} className="space-y-4 py-2">
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
              Select Active Member *
            </label>
            {orgMembers.length === 0 ? (
              <p className="text-xs text-amber-400">No active members found in organization.</p>
            ) : (
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                required
              >
                <option value="" disabled>-- Select a Team Member --</option>
                {orgMembers.map((m) => {
                  const isAllocated = project.memberIds.includes(m.userId);
                  return (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName} ({m.role.toUpperCase()} • {m.department || 'Engineering'}) {isAllocated ? '— Already Allocated' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Optional Task Assignment Selection */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold text-slate-300">
              Optionally Assign Open Tasks from this Project:
            </label>
            {projectTasks.filter((t) => !t.assignedTo).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                No unassigned tasks found for this project.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-navy-950/60 p-2">
                {projectTasks
                  .filter((t) => !t.assignedTo)
                  .map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignTaskIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignTaskIds((prev) => [...prev, t.id]);
                          } else {
                            setAssignTaskIds((prev) => prev.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded border-slate-700 bg-navy-850 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="truncate">{t.title}</span>
                      <span className="text-[10px] text-cyan-400 font-mono ml-auto shrink-0">
                        {t.estimatedHours}h
                      </span>
                    </label>
                  ))}
              </div>
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
              disabled={assignLoading || !selectedMemberId}
            >
              {assignLoading ? 'Assigning...' : 'Confirm Allocation'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
