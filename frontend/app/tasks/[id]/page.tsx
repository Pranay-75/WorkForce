'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { PriorityLevel, TaskStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Input';
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
  AlertTriangle,
  Edit3,
  Trash2,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
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
    deleteTask: dbDeleteTask,
  } = useTasks();

  const { projects: dbProjects } = useProjects();
  const { members: orgMembers } = useOrganizationMembers();

  // Mock store fallback
  const {
    tasks: mockTasks,
    projects: mockProjects,
    employees: mockEmployees,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateTaskStatus: mockUpdateTaskStatus,
    updateTaskDetails: mockUpdateTaskDetails,
    deleteTask: mockDeleteTask,
  } = useMockStore();

  const tasks = isLive ? dbTasks : mockTasks;
  const projects = isLive ? dbProjects : mockProjects;
  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;

  const task = tasks.find((t) => t.id === taskId);
  const currentProject = projects.find((p) => p.id === task?.projectId);
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'organizer';
  const isAssignedToMe = task?.assignedTo === currentUserId;
  const canUpdateStatus = isManagerOrAdmin || isAssignedToMe;

  const isOverdue =
    task &&
    task.status !== 'completed' &&
    Boolean(task.dueDate) &&
    new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [isMutating, setIsMutating] = React.useState(false);

  // Edit Task Modal State
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<PriorityLevel>('medium');
  const [editComplexity, setEditComplexity] = React.useState<'Low' | 'Medium' | 'High'>('Medium');
  const [editDueDate, setEditDueDate] = React.useState('');
  const [editHours, setEditHours] = React.useState('');
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete Task Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

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

  const handleOpenEditModal = () => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDesc(task.description || '');
    setEditPriority(task.priority);
    setEditComplexity(task.complexity || 'Medium');
    setEditDueDate(task.dueDate || '');
    setEditHours(String(task.estimatedHours || '8'));
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!editTitle.trim()) {
      setEditError('Task title is required.');
      return;
    }
    const parsedHours = parseFloat(editHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setEditError('Estimated effort must be a positive number.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    if (isLive) {
      const res = await dbUpdateTaskDetails(task.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        priority: editPriority,
        complexity: editComplexity,
        dueDate: editDueDate || undefined,
        estimatedHours: parsedHours,
      });

      setEditLoading(false);
      if (res.error) {
        setEditError(res.error);
        return;
      }
    } else {
      mockUpdateTaskDetails(task.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        priority: editPriority,
        complexity: editComplexity,
        dueDate: editDueDate,
        estimatedHours: parsedHours,
      });
      setEditLoading(false);
    }

    setIsEditModalOpen(false);
    showNotification(`Task "${editTitle}" updated successfully.`);
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setDeleteLoading(true);
    setDeleteError(null);

    if (isLive) {
      const res = await dbDeleteTask(task.id);
      setDeleteLoading(false);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
    } else {
      mockDeleteTask(task.id);
      setDeleteLoading(false);
    }

    setIsDeleteModalOpen(false);
    router.push('/tasks');
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
          {isOverdue && (
            <Badge variant="rose" size="sm" className="flex items-center gap-1 font-bold animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              OVERDUE
            </Badge>
          )}
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

          {isManagerOrAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenEditModal}
              className="text-xs"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1 text-slate-300" />
              <span>Edit Task</span>
            </Button>
          )}

          {isManagerOrAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
              title="Delete Task"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              <span>Delete</span>
            </Button>
          )}
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
                <Calendar className={`h-3.5 w-3.5 ${isOverdue ? 'text-rose-400' : 'text-cyan-400'}`} />
                <span className={isOverdue ? 'text-rose-300 font-bold' : ''}>{task.dueDate || 'Unscheduled'}</span>
                {isOverdue && (
                  <span className="text-[10px] bg-rose-950/60 text-rose-400 border border-rose-500/40 rounded px-1 py-0.2">
                    LATE
                  </span>
                )}
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
                      {employees.map((e) => {
                        const isAllocated = currentProject?.memberIds?.includes(e.id);
                        return (
                          <option key={e.id} value={e.id}>
                            {e.fullName} ({e.department}){isAllocated ? ' [Project Member]' : ''}
                          </option>
                        );
                      })}
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
                      {employees.map((e) => {
                        const isAllocated = currentProject?.memberIds?.includes(e.id);
                        return (
                          <option key={e.id} value={e.id}>
                            {e.fullName} ({e.department}){isAllocated ? ' [Project Member]' : ''}
                          </option>
                        );
                      })}
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
      {/* Edit Task Dialog */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Task: ${task.title}`}
        description="Update task parameters, estimated effort, technical complexity, and target deadline."
      >
        <form onSubmit={handleEditTaskSubmit} className="space-y-3.5 py-2">
          {editError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <Input
            label="Task Title *"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Task Description
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority Level"
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
              options={[
                { label: 'Critical', value: 'critical' },
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
              ]}
            />
            <Select
              label="Technical Complexity"
              value={editComplexity}
              onChange={(e) => setEditComplexity(e.target.value as 'Low' | 'Medium' | 'High')}
              options={[
                { label: 'Low', value: 'Low' },
                { label: 'Medium', value: 'Medium' },
                { label: 'High', value: 'High' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimated Effort (Hours) *"
              type="number"
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
              min="1"
              max="200"
              required
            />
            <Input
              label="Target Deadline"
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={editLoading}
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Task Deletion"
        description="Are you sure you want to permanently remove this deliverable from the backlog?"
      >
        <div className="space-y-4 py-2">
          {deleteError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-rose-200">
                Warning: Permanent Task Deletion
              </p>
              <p className="text-rose-300/80">
                Deleting <strong>{task.title}</strong> will remove it from project <strong>{task.projectName}</strong> and recalculate assignee workload automatically.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteTask}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Task Permanently'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
