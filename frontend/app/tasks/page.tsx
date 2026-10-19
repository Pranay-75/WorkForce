'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { Task, TaskStatus, PriorityLevel } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import {
  CheckSquare,
  Search,
  Plus,
  Kanban,
  Table as TableIcon,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const kanbanColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'Todo / Backlog', color: 'border-slate-700' },
  { status: 'in_progress', label: 'In Progress', color: 'border-cyan-500/50' },
  { status: 'in_review', label: 'In Review', color: 'border-amber-500/50' },
  { status: 'completed', label: 'Completed', color: 'border-emerald-500/50' },
];

export default function TasksPage() {
  const { isAuthenticated, user, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live Supabase Phase 2.2B hooks
  const {
    tasks: dbTasks,
    isLoading: isTasksLoading,
    error: tasksError,
    refetch: refetchTasks,
    createTask,
    updateTaskStatus: dbUpdateTaskStatus,
  } = useTasks();

  const { projects: dbProjects } = useProjects();
  const { members: orgMembers } = useOrganizationMembers();

  // Mock store fallback for unauthenticated showcase
  const {
    tasks: mockTasks,
    projects: mockProjects,
    employees: mockEmployees,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateTaskStatus: mockUpdateTaskStatus,
    addNewTask: mockAddNewTask,
  } = useMockStore();

  const tasks = isLive ? dbTasks : mockTasks;
  const projects = isLive ? dbProjects : mockProjects;
  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;

  const employees = React.useMemo(() => {
    if (isLive) {
      return orgMembers.map((m) => {
        const load = tasks
          .filter((t) => t.assignedTo === m.userId && t.status !== 'completed')
          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        return {
          id: m.userId,
          fullName: m.fullName,
          department: m.department || 'Engineering',
          weeklyCapacityHours: m.weeklyCapacityHours || 40,
          currentLoadHours: load,
        };
      });
    }
    return mockEmployees;
  }, [isLive, orgMembers, mockEmployees, tasks]);

  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedProject, setSelectedProject] = React.useState<string>('all');
  const [selectedPriority, setSelectedPriority] = React.useState<string>('all');

  // Task Creation Modal Form State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [newTitle, setNewTitle] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newProjId, setNewProjId] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<PriorityLevel>('medium');
  const [newHours, setNewHours] = React.useState('8');
  const [newDueDate, setNewDueDate] = React.useState('2026-10-25');
  const [newAssigneeId, setNewAssigneeId] = React.useState('unassigned');

  // Default project selection
  React.useEffect(() => {
    if (!newProjId && projects.length > 0) {
      setNewProjId(projects[0].id);
    }
  }, [projects, newProjId]);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assignedEmployeeName && t.assignedEmployeeName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProj = selectedProject === 'all' || t.projectId === selectedProject;
    const matchesPrio = selectedPriority === 'all' || t.priority === selectedPriority;

    return matchesSearch && matchesProj && matchesPrio;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const proj = projects.find((p) => p.id === newProjId) || projects[0];
    if (!proj) {
      setFormError('Please select or create a project first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    if (isLive) {
      const res = await createTask({
        projectId: proj.id,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        status: 'todo',
        priority: newPriority,
        complexity: 'Medium',
        estimatedHours: parseFloat(newHours) || 8,
        dueDate: newDueDate || undefined,
        assignedTo: newAssigneeId === 'unassigned' ? null : newAssigneeId,
        requiredSkills: [
          { skillId: 's1', skillName: 'React', minProficiency: 'intermediate' },
          { skillId: 's2', skillName: 'TypeScript', minProficiency: 'intermediate' },
        ],
      });

      setSubmitting(false);

      if (res.error) {
        setFormError(res.error);
        return;
      }
    } else {
      const assignedEmp = employees.find((emp) => emp.id === newAssigneeId);
      mockAddNewTask({
        projectId: proj.id,
        projectName: proj.name,
        title: newTitle,
        description: newDesc,
        status: 'todo',
        priority: newPriority,
        complexity: 'Medium',
        estimatedHours: parseFloat(newHours) || 8,
        dueDate: newDueDate,
        assignedTo: assignedEmp ? assignedEmp.id : undefined,
        assignedEmployeeName: assignedEmp ? assignedEmp.fullName : undefined,
        assignedEmployeeAvatar: assignedEmp
          ? assignedEmp.fullName
              .split(' ')
              .map((n) => n[0])
              .join('')
          : undefined,
        requiredSkills: [
          { skillId: 's1', skillName: 'React', minProficiency: 'intermediate' },
          { skillId: 's2', skillName: 'TypeScript', minProficiency: 'intermediate' },
        ],
      });
      setSubmitting(false);
    }

    setIsCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewAssigneeId('unassigned');
  };

  const advanceTaskStatus = async (t: Task) => {
    const sequence: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'completed'];
    const currIdx = sequence.indexOf(t.status);
    if (currIdx < sequence.length - 1) {
      const nextStatus = sequence[currIdx + 1];
      if (isLive) {
        await dbUpdateTaskStatus(t.id, nextStatus);
      } else {
        mockUpdateTaskStatus(t.id, nextStatus);
      }
    }
  };

  const regressTaskStatus = async (t: Task) => {
    const sequence: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'completed'];
    const currIdx = sequence.indexOf(t.status);
    if (currIdx > 0) {
      const prevStatus = sequence[currIdx - 1];
      if (isLive) {
        await dbUpdateTaskStatus(t.id, prevStatus);
      } else {
        mockUpdateTaskStatus(t.id, prevStatus);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Task Management & Kanban Board
            </h2>
            <Badge variant="cyan" size="sm">
              {tasks.length} Total Tasks
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Prioritize deliverables, allocate required technical skills, and manage sprint workflows
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Switcher */}
          <div className="flex items-center rounded-xl bg-navy-900 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'table'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          {activeRole !== 'employee' && (
            <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {isLive && tasksError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{tasksError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetchTasks()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-slate-800 bg-navy-900/80 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Loading Skeleton */}
      {isLive && isTasksLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-96 rounded-2xl border border-slate-800 bg-navy-950/60 p-4 animate-pulse space-y-3"
            >
              <div className="h-4 w-24 bg-slate-800 rounded" />
              <div className="h-28 bg-navy-900/40 rounded-xl border border-slate-800/80" />
              <div className="h-28 bg-navy-900/40 rounded-xl border border-slate-800/80" />
            </div>
          ))}
        </div>
      )}

      {/* Kanban Board Mode */}
      {!isTasksLoading && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 items-start">
          {kanbanColumns.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="flex flex-col rounded-2xl border border-slate-800 bg-navy-950/60 p-3.5 space-y-3 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">
                      {col.label}
                    </span>
                  </div>
                  <Badge variant="slate" size="sm">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Column Tasks */}
                <div className="space-y-3 flex-1">
                  {columnTasks.map((t) => (
                    <Card
                      key={t.id}
                      className="border-slate-800/90 hover:border-violet-500/60 transition-all shadow-sm group"
                    >
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
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
                          <span className="font-mono text-[11px] text-cyan-400 font-bold">
                            {t.estimatedHours}h
                          </span>
                        </div>

                        <Link
                          href={`/tasks/${t.id}`}
                          className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2 block leading-snug"
                        >
                          {t.title}
                        </Link>

                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 truncate">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          Due {t.dueDate || 'Unscheduled'}
                        </div>

                        {/* Assignee & Actions */}
                        <div className="flex items-center justify-between border-t border-slate-800/60 pt-2.5 text-xs">
                          {t.assignedTo ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-[9px] font-bold text-white shrink-0">
                                {t.assignedEmployeeAvatar || 'EM'}
                              </div>
                              <span className="text-[11px] text-slate-300 truncate">
                                {t.assignedEmployeeName}
                              </span>
                            </div>
                          ) : (
                            <Link href="/matching">
                              <Badge variant="violet" size="sm" className="cursor-pointer">
                                <Sparkles className="h-2.5 w-2.5 mr-1" />
                                Match AI
                              </Badge>
                            </Link>
                          )}

                          {/* Quick Workflow Move Controls (Only for Assignee or Manager/Admin) */}
                          {(() => {
                            const isMine = t.assignedTo === currentUserId;
                            const canMove = activeRole !== 'employee' || isMine;

                            if (!canMove) {
                              return (
                                <span className="text-[10px] text-slate-500 italic">
                                  Read-only
                                </span>
                              );
                            }

                            return (
                              <div className="flex items-center gap-1">
                                {col.status !== 'todo' && (
                                  <button
                                    onClick={() => regressTaskStatus(t)}
                                    className="rounded p-1 text-slate-400 hover:bg-navy-800 hover:text-white"
                                    title="Move back"
                                  >
                                    <ArrowLeft className="h-3 w-3" />
                                  </button>
                                )}
                                {col.status !== 'completed' && (
                                  <button
                                    onClick={() => advanceTaskStatus(t)}
                                    className="rounded p-1 text-slate-400 hover:bg-navy-800 hover:text-white"
                                    title="Move forward"
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-800/80 p-6 text-center text-slate-400 text-xs">
                      No tasks in {col.label.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Data Table Mode */}
      {!isTasksLoading && viewMode === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="border-b border-slate-800 bg-navy-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Task Title</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Estimate</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-navy-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <Link href={`/tasks/${t.id}`} className="hover:text-violet-300">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{t.projectName}</td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="cyan" size="sm">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-cyan-400">
                      {t.estimatedHours}h
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{t.dueDate || 'Unscheduled'}</td>
                    <td className="px-4 py-3">
                      {t.assignedEmployeeName ? (
                        <span className="text-slate-200 font-medium">
                          {t.assignedEmployeeName}
                        </span>
                      ) : (
                        <span className="text-violet-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/tasks/${t.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Task Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Sprint Task"
        description="Author an authorized task with effort estimation and project scoping."
      >
        <form onSubmit={handleCreateTask} className="space-y-3.5 py-2">
          {formError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-2.5 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <Input
            label="Task Title *"
            placeholder="e.g. Implement Webhook Deduplication"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <Input
            label="Description"
            placeholder="Brief requirements, edge cases, and acceptance criteria..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Associated Project *"
              value={newProjId}
              onChange={(e) => setNewProjId(e.target.value)}
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
            />
            <Select
              label="Priority Level"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
              options={[
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
                { label: 'Low', value: 'low' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Estimated Hours *"
              type="number"
              value={newHours}
              onChange={(e) => setNewHours(e.target.value)}
              min="1"
              max="200"
              required
            />
            <Input
              label="Target Deadline"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>

          <Select
            label="Initial Assignee (Optional)"
            value={newAssigneeId}
            onChange={(e) => setNewAssigneeId(e.target.value)}
            options={[
              { label: 'Unassigned (Route to AI Matching Hub)', value: 'unassigned' },
              ...employees.map((emp) => ({
                label: `${emp.fullName} (${emp.department})`,
                value: emp.id,
              })),
            ]}
          />

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Task</span>
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
