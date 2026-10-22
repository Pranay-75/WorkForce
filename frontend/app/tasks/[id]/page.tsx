'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { TaskStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ArrowLeft,
  CheckSquare,
  Calendar,
  Clock,
  Sparkles,
  FolderKanban,
  ShieldCheck,
  Award,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Plus,
  Minus,
  AlertCircle,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params?.id as string;

  const { isAuthenticated, user, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live hooks
  const {
    tasks: dbTasks,
    isLoading: isTasksLoading,
    error: tasksError,
    updateTaskStatus: dbUpdateTaskStatus,
    updateTaskDetails: dbUpdateTaskDetails,
    assignTask: dbAssignTask,
  } = useTasks();

  const { members: orgMembers } = useOrganizationMembers();

  // Mock store fallback
  const {
    tasks: mockTasks,
    employees: mockEmployees,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateTaskStatus: mockUpdateTaskStatus,
    updateTaskDetails: mockUpdateTaskDetails,
  } = useMockStore();

  const tasks = isLive ? dbTasks : mockTasks;
  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;

  const task = tasks.find((t) => t.id === taskId);
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'organizer';
  const isAssignedToMe = task?.assignedTo === currentUserId;
  const canUpdateStatus = isManagerOrAdmin || isAssignedToMe;

  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const employees = React.useMemo(() => {
    if (isLive) {
      return orgMembers.map((m) => {
        const load = tasks
          .filter((t) => t.assignedTo === m.userId && t.status !== 'completed')
          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        return {
          id: m.userId,
          fullName: m.fullName,
          jobTitle: m.jobTitle || 'Team Member',
          department: m.department || 'Engineering',
          weeklyCapacityHours: m.weeklyCapacityHours || 40,
          currentLoadHours: load,
        };
      });
    }
    return mockEmployees;
  }, [isLive, orgMembers, mockEmployees, tasks]);

  // Loading skeleton
  if (isLive && isTasksLoading) {
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

  if (!task) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Task Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested task identifier does not exist in the active organization backlog.
        </p>
        <Link href="/tasks">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Task List
          </Button>
        </Link>
      </div>
    );
  }

  const assignee = employees.find((e) => e.id === task.assignedTo);
  const assigneeUtilPct = assignee
    ? Math.round((assignee.currentLoadHours / assignee.weeklyCapacityHours) * 100)
    : 0;

  const handleAdjustHours = async (delta: number) => {
    if (!isManagerOrAdmin) {
      showNotification('Permission Denied: Only managers and admins can adjust task estimates.');
      return;
    }

    const newHours = Math.max(1, (task.estimatedHours || 0) + delta);
    setIsMutating(true);

    if (isLive) {
      const res = await dbUpdateTaskDetails(task.id, { estimatedHours: newHours });
      setIsMutating(false);
      if (res.error) {
        showNotification(`Failed to adjust hours: ${res.error}`);
      } else {
        showNotification(`Updated effort to ${newHours}h`);
      }
    } else {
      mockUpdateTaskDetails(task.id, { estimatedHours: newHours });
      setIsMutating(false);
      showNotification(`Updated effort to ${newHours}h`);
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!canUpdateStatus) {
      showNotification('Permission Denied: Employees may only update their own assigned tasks.');
      return;
    }

    setIsMutating(true);
    if (isLive) {
      const res = await dbUpdateTaskStatus(task.id, newStatus);
      setIsMutating(false);
      if (res.error) {
        showNotification(`Failed to update status: ${res.error}`);
      } else {
        showNotification(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      }
    } else {
      mockUpdateTaskStatus(task.id, newStatus);
      setIsMutating(false);
      showNotification(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
    }
  };

  const handleReassign = async (newEmpId: string) => {
    if (!isManagerOrAdmin) {
      showNotification('Permission Denied: Only managers and admins can assign or reassign tasks.');
      return;
    }

    setIsMutating(true);
    if (isLive) {
      const targetId = newEmpId === 'unassigned' ? null : newEmpId;
      const res = await dbAssignTask(task.id, targetId);
      setIsMutating(false);
      if (res.error) {
        showNotification(`Reassignment failed: ${res.error}`);
      } else {
        showNotification('Task successfully reassigned via authorized RPC.');
      }
    } else {
      mockUpdateTaskDetails(task.id, {
        assignedTo: newEmpId === 'unassigned' ? undefined : newEmpId,
        status: newEmpId === 'unassigned' ? 'todo' : task.status,
      });
      setIsMutating(false);
      showNotification('Task successfully reassigned.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Back to All Tasks</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              task.priority === 'critical'
                ? 'rose'
                : task.priority === 'high'
                ? 'amber'
                : 'slate'
            }
            size="sm"
          >
            {task.priority.toUpperCase()} PRIORITY
          </Badge>
          <Badge variant="cyan" size="sm">
            STATUS: {task.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Notification Toast */}
      {feedback && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-2.5 text-xs text-cyan-200 animate-in fade-in">
          {feedback}
        </div>
      )}

      {/* Task Specification Card */}
      <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-violet-400">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>{task.projectName}</span>
              <span>•</span>
              <span className="truncate max-w-[200px]">ID: {task.id}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {task.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {task.description || 'No detailed task specifications provided.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* Estimated Effort (Interactive Adjustment for Manager/Admin) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Estimated Effort (Hours)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-cyan-400">
                  {task.estimatedHours}h
                </span>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdjustHours(-2)}
                      disabled={isMutating}
                      className="rounded p-1 bg-navy-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      title="Decrease 2 hours"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAdjustHours(2)}
                      disabled={isMutating}
                      className="rounded p-1 bg-navy-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                      title="Increase 2 hours"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Target Deadline */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Target Deadline
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-200">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                <span>{task.dueDate || 'Unscheduled'}</span>
              </div>
            </div>

            {/* Complexity Indicator */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Technical Complexity
              </span>
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-200">
                <Award className="h-3.5 w-3.5 text-amber-400" />
                <span>{task.complexity}</span>
              </div>
            </div>

            {/* Status Transition Control */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Workflow Status
              </span>
              <select
                value={task.status}
                disabled={!canUpdateStatus || isMutating}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-700 bg-navy-850 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-50"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Skills & Assignee Impact */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Required Technical Skills */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <CardTitle>Required Technical Skills ({task.requiredSkills.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1">
            {task.requiredSkills.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No prerequisite skills attached to this task.
              </p>
            ) : (
              task.requiredSkills.map((req) => (
                <div
                  key={req.skillId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/60 p-3"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-white">
                      {req.skillName}
                    </span>
                  </div>
                  <Badge variant="cyan" size="sm">
                    MIN: {req.minProficiency.toUpperCase()}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Assignment & Workload Impact Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-violet-400" />
                <CardTitle>Assignee & Workload Impact</CardTitle>
              </div>
              <Badge variant={task.assignedTo ? 'emerald' : 'amber'} size="sm">
                {task.assignedTo ? 'Assigned' : 'Unassigned'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 flex-1">
            {assignee ? (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-navy-900/80 p-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-800 text-sm font-bold text-white shadow-sm">
                    {assignee.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white">
                      {assignee.fullName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {assignee.jobTitle} • {assignee.department}
                    </p>
                  </div>
                </div>

                {/* Manager Reassignment Control */}
                {isManagerOrAdmin && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-400">
                      Reassign via assign_task() RPC:
                    </label>
                    <select
                      value={task.assignedTo || 'unassigned'}
                      disabled={isMutating}
                      onChange={(e) => handleReassign(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="unassigned">Unassigned (Send to AI Matching Hub)</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName} ({e.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-5 space-y-3 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-violet-400 animate-pulse" />
                <h4 className="text-sm font-bold text-white">
                  No Talent Assigned Yet
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Run explainable AI candidate ranking to match available team members based on skills, capacity, and deadlines.
                </p>

                {isManagerOrAdmin && (
                  <div className="pt-2 text-left space-y-1.5 max-w-xs mx-auto">
                    <label className="block text-xs font-medium text-slate-400">
                      Direct Assign (Manager RPC):
                    </label>
                    <select
                      value="unassigned"
                      disabled={isMutating}
                      onChange={(e) => handleReassign(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="unassigned">Select team member...</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName} ({e.department})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-2 flex justify-center gap-2">
                  <Link href="/matching">
                    <Button variant="primary" size="sm">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Open AI Matching Hub
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
