'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { Task, TaskStatus, PriorityLevel, Project, OrganizationMember, Employee, UserRole } from '@/lib/types';
import { RoleFilterValue, resolveTaskAssigneeRole } from '@/lib/tasks';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  Search,
  Plus,
  Kanban,
  Table as TableIcon,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Edit3,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  User,
  ShieldCheck,
  Minimize2,
  Maximize2,
  X,
  SlidersHorizontal,
  Check,
  Trash2,
} from 'lucide-react';

const kanbanColumns: { status: TaskStatus; label: string; badgeVariant: 'slate' | 'cyan' | 'amber' | 'emerald' }[] = [
  { status: 'todo', label: 'To do', badgeVariant: 'slate' },
  { status: 'in_progress', label: 'In progress', badgeVariant: 'cyan' },
  { status: 'in_review', label: 'In review', badgeVariant: 'amber' },
  { status: 'completed', label: 'Completed', badgeVariant: 'emerald' },
];

export default function TasksPage() {
  const { isAuthenticated, user, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live Supabase hooks
  const {
    tasks: dbTasks,
    isLoading: isTasksLoading,
    error: tasksError,
    refetch: refetchTasks,
    createTask,
    updateTaskStatus: dbUpdateTaskStatus,
    updateTaskDetails: dbUpdateTaskDetails,
    assignTask: dbAssignTask,
    deleteTask: dbDeleteTask,
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
    updateTaskDetails: mockUpdateTaskDetails,
    addNewTask: mockAddNewTask,
    deleteTask: mockDeleteTask,
  } = useMockStore();

  const tasks = isLive ? dbTasks : mockTasks;
  const projects = isLive ? dbProjects : mockProjects;
  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'organizer';

  const employees = React.useMemo(() => {
    if (isLive) {
      return orgMembers.map((m) => {
        const load = tasks
          .filter((t) => t.assignedTo === m.userId && t.status !== 'completed')
          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        return {
          id: m.userId,
          email: m.email,
          fullName: m.fullName,
          avatarUrl: m.avatarUrl || undefined,
          role: m.role,
          department: (m.department || 'Engineering') as any,
          jobTitle: m.jobTitle || 'Team Member',
          weeklyCapacityHours: m.weeklyCapacityHours || 40,
          currentLoadHours: load,
          burnoutRiskScore: 0,
          skills: [],
          activeTaskCount: 0,
          onTimeCompletionRate: 100,
          location: 'Remote',
        };
      });
    }
    return mockEmployees;
  }, [isLive, orgMembers, mockEmployees, tasks]);

  // Project lookup map
  const projectMap = React.useMemo(() => {
    const map: Record<string, Project> = {};
    projects.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [projects]);

  // View & Filter States
  const [viewMode, setViewMode] = React.useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Default to the first project to provide a focused, low-clutter initial view
  const [selectedProject, setSelectedProject] = React.useState<string>('initial');
  const [selectedRole, setSelectedRole] = React.useState<RoleFilterValue>('all');
  const [selectedPriority, setSelectedPriority] = React.useState<string>('all');

  // Collapsible state
  const [collapsedColumns, setCollapsedColumns] = React.useState<Record<TaskStatus, boolean>>({
    todo: false,
    in_progress: false,
    in_review: false,
    completed: false,
  });
  const [collapsedProjects, setCollapsedProjects] = React.useState<Record<string, boolean>>({});

  // Initialize selectedProject to the first project when projects are available
  React.useEffect(() => {
    if (selectedProject === 'initial') {
      if (projects.length > 0) {
        setSelectedProject(projects[0].id);
      } else {
        setSelectedProject('all');
      }
    }
  }, [projects, selectedProject]);

  // Effective selected project
  const currentSelectedProject = selectedProject === 'initial'
    ? (projects[0]?.id || 'all')
    : selectedProject;

  // Task Creation Modal Form State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Edit Task Modal State
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<PriorityLevel>('medium');
  const [editStatus, setEditStatus] = React.useState<TaskStatus>('todo');
  const [editEstimatedHours, setEditEstimatedHours] = React.useState('8');
  const [editDueDate, setEditDueDate] = React.useState('');
  const [editAssigneeId, setEditAssigneeId] = React.useState('unassigned');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  // Create form fields
  const [newTitle, setNewTitle] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [newProjId, setNewProjId] = React.useState('');
  const [newPriority, setNewPriority] = React.useState<PriorityLevel>('medium');
  const [newHours, setNewHours] = React.useState('8');
  const [newDueDate, setNewDueDate] = React.useState('2026-11-15');
  const [newAssigneeId, setNewAssigneeId] = React.useState('unassigned');

  React.useEffect(() => {
    if (!newProjId && projects.length > 0) {
      setNewProjId(projects[0].id);
    }
  }, [projects, newProjId]);

  // Role Match Evaluation
  const matchesRole = React.useCallback(
    (task: Task) => {
      if (selectedRole === 'all') return true;
      const roleInfo = resolveTaskAssigneeRole(task, orgMembers, employees);

      if (selectedRole === 'unassigned') {
        return roleInfo.status === 'unassigned';
      }
      if (selectedRole === 'unknown') {
        return roleInfo.status === 'unknown';
      }
      return roleInfo.status === 'known' && roleInfo.role === selectedRole;
    },
    [selectedRole, orgMembers, employees]
  );

  // Combined Filtering Logic
  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        Boolean(t.assignedEmployeeName && t.assignedEmployeeName.toLowerCase().includes(q));

      const matchesProj =
        currentSelectedProject === 'all'
          ? true
          : currentSelectedProject === 'unassigned'
            ? !t.projectId || t.projectId === 'unassigned' || !projectMap[t.projectId]
            : t.projectId === currentSelectedProject;

      const matchesPrio = selectedPriority === 'all' || t.priority === selectedPriority;
      const matchesR = matchesRole(t);

      return matchesSearch && matchesProj && matchesPrio && matchesR;
    });
  }, [tasks, searchQuery, currentSelectedProject, projectMap, selectedPriority, matchesRole]);

  // Partition tasks into project groups for "All projects" view
  const projectGroups = React.useMemo(() => {
    const groups: { project: Project | null; isUnassigned: boolean; tasks: Task[] }[] = [];

    // 1. Groups for known projects
    projects.forEach((proj) => {
      const projTasks = filteredTasks.filter((t) => t.projectId === proj.id);
      groups.push({
        project: proj,
        isUnassigned: false,
        tasks: projTasks,
      });
    });

    // 2. Group for unassigned project tasks
    const unassignedTasks = filteredTasks.filter(
      (t) => !t.projectId || t.projectId === 'unassigned' || !projectMap[t.projectId]
    );

    if (unassignedTasks.length > 0 || currentSelectedProject === 'unassigned') {
      groups.push({
        project: null,
        isUnassigned: true,
        tasks: unassignedTasks,
      });
    }

    return groups;
  }, [projects, filteredTasks, projectMap, currentSelectedProject]);

  // Counts for Project Selector
  const projectCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length, unassigned: 0 };
    projects.forEach((p) => {
      counts[p.id] = 0;
    });
    tasks.forEach((t) => {
      if (!t.projectId || t.projectId === 'unassigned' || !projectMap[t.projectId]) {
        counts.unassigned++;
      } else if (counts[t.projectId] !== undefined) {
        counts[t.projectId]++;
      }
    });
    return counts;
  }, [tasks, projects, projectMap]);

  // Counts for Role Filter
  const roleCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    tasks.forEach((t) => {
      const info = resolveTaskAssigneeRole(t, orgMembers, employees);
      if (info.status === 'unassigned') {
        counts.unassigned = (counts.unassigned || 0) + 1;
      } else if (info.status === 'unknown') {
        counts.unknown = (counts.unknown || 0) + 1;
      } else if (info.role) {
        counts[info.role] = (counts[info.role] || 0) + 1;
      }
    });
    return counts;
  }, [tasks, orgMembers, employees]);

  const toggleColumnCollapse = (status: TaskStatus) => {
    setCollapsedColumns((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const toggleProjectCollapse = (projectId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const collapseAllProjects = () => {
    const next: Record<string, boolean> = {};
    projectGroups.forEach((g) => {
      const key = g.project ? g.project.id : 'unassigned';
      next[key] = true;
    });
    setCollapsedProjects(next);
  };

  const expandAllProjects = () => {
    setCollapsedProjects({});
  };

  // Status progression / regression actions
  const advanceTaskStatus = async (t: Task) => {
    setActionError(null);
    let nextStatus: TaskStatus | null = null;
    if (t.status === 'todo') nextStatus = 'in_progress';
    else if (t.status === 'in_progress') nextStatus = 'in_review';
    else if (t.status === 'in_review') nextStatus = 'completed';

    if (nextStatus) {
      if (isLive) {
        const res = await dbUpdateTaskStatus(t.id, nextStatus);
        if (res.error) {
          setActionError(`Failed to advance task: ${res.error}`);
        }
      } else {
        mockUpdateTaskStatus(t.id, nextStatus);
      }
    }
  };

  const regressTaskStatus = async (t: Task) => {
    setActionError(null);
    let prevStatus: TaskStatus | null = null;
    if (t.status === 'completed') prevStatus = 'in_review';
    else if (t.status === 'in_review') prevStatus = 'in_progress';
    else if (t.status === 'in_progress') prevStatus = 'todo';

    if (prevStatus) {
      if (isLive) {
        const res = await dbUpdateTaskStatus(t.id, prevStatus);
        if (res.error) {
          setActionError(`Failed to regress task: ${res.error}`);
        }
      } else {
        mockUpdateTaskStatus(t.id, prevStatus);
      }
    }
  };

  const handleOpenEditModal = (t: Task) => {
    setEditingTask(t);
    setEditTitle(t.title);
    setEditDesc(t.description || '');
    setEditPriority(t.priority);
    setEditStatus(t.status);
    setEditEstimatedHours(String(t.estimatedHours || 8));
    setEditDueDate(t.dueDate || '');
    setEditAssigneeId(t.assignedTo || 'unassigned');
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    if (!confirm(`Are you sure you want to permanently delete task "${editingTask.title}"?`)) return;
    setEditSubmitting(true);
    if (isLive) {
      const res = await dbDeleteTask(editingTask.id);
      if (res.error) {
        setEditError(res.error);
        setEditSubmitting(false);
        return;
      }
      await refetchTasks();
    } else {
      mockDeleteTask(editingTask.id);
    }
    setEditSubmitting(false);
    setIsEditOpen(false);
    setEditingTask(null);
  };

  const handleSaveTaskEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (!editTitle.trim()) {
      setEditError('Task title is required.');
      return;
    }
    const hours = parseFloat(editEstimatedHours);
    if (isNaN(hours) || hours <= 0) {
      setEditError('Estimated hours must be a positive number.');
      return;
    }

    setEditSubmitting(true);
    setEditError(null);

    const targetAssigneeId = editAssigneeId === 'unassigned' ? null : editAssigneeId;
    const targetAssignee = employees.find((emp) => emp.id === targetAssigneeId);

    if (isLive) {
      const detailRes = await dbUpdateTaskDetails(editingTask.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        priority: editPriority,
        estimatedHours: hours,
        dueDate: editDueDate || undefined,
      });

      if (detailRes.error) {
        setEditError(detailRes.error);
        setEditSubmitting(false);
        return;
      }

      if (editStatus !== editingTask.status) {
        const statusRes = await dbUpdateTaskStatus(editingTask.id, editStatus);
        if (statusRes.error) {
          setEditError(statusRes.error);
          setEditSubmitting(false);
          return;
        }
      }

      if (targetAssigneeId !== (editingTask.assignedTo || null)) {
        const assignRes = await dbAssignTask(editingTask.id, targetAssigneeId);
        if (assignRes.error) {
          setEditError(assignRes.error);
          setEditSubmitting(false);
          return;
        }
      }

      await refetchTasks();
    } else {
      mockUpdateTaskDetails(editingTask.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        priority: editPriority,
        estimatedHours: hours,
        dueDate: editDueDate,
        assignedTo: targetAssigneeId || undefined,
        assignedEmployeeName: targetAssignee ? targetAssignee.fullName : undefined,
      });

      if (editStatus !== editingTask.status) {
        mockUpdateTaskStatus(editingTask.id, editStatus);
      }
    }

    setEditSubmitting(false);
    setIsEditOpen(false);
    setEditingTask(null);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }

    const parsedHours = parseFloat(newHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('Estimated hours must be a positive number.');
      return;
    }

    const proj = projects.find((p) => p.id === newProjId) || projects[0];
    if (!proj) {
      setFormError('Please select or create a project first.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setActionError(null);

    if (isLive) {
      const res = await createTask({
        projectId: proj.id,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        status: 'todo',
        priority: newPriority,
        complexity: 'Medium',
        estimatedHours: parsedHours,
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
        estimatedHours: parsedHours,
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

  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (selectedRole !== 'all' ? 1 : 0) +
    (selectedPriority !== 'all' ? 1 : 0) +
    (currentSelectedProject !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedRole('all');
    setSelectedPriority('all');
    setSelectedProject('all');
  };

  // Render a compact task card
  const renderCompactTaskCard = (t: Task) => {
    const isMine = t.assignedTo === currentUserId;
    const canMove = activeRole !== 'employee' || isMine;
    const roleInfo = resolveTaskAssigneeRole(t, orgMembers, employees);

    const isTaskOverdue =
      t.status !== 'completed' &&
      Boolean(t.dueDate) &&
      new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));

    return (
      <Card
        key={t.id}
        className="border-zinc-800/90 bg-zinc-900/95 hover:border-zinc-700 transition-colors shadow-sm group"
      >
        <CardContent className="p-3 space-y-2">
          {/* Top Row: Priority & Due Date */}
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Badge
                variant={
                  t.priority === 'critical'
                    ? 'rose'
                    : t.priority === 'high'
                      ? 'amber'
                      : 'slate'
                }
                size="sm"
                className="capitalize text-[10px] py-0 px-1.5 font-medium"
              >
                {t.priority}
              </Badge>
              <span className="font-mono text-zinc-400 text-[10px]">{t.estimatedHours}h</span>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
              <Calendar className={`h-3 w-3 ${isTaskOverdue ? 'text-rose-400' : 'text-zinc-500'}`} />
              <span className={isTaskOverdue ? 'text-rose-300 font-semibold' : ''}>
                {t.dueDate ? t.dueDate.slice(5) : 'Unscheduled'}
              </span>
              {isTaskOverdue && (
                <Badge variant="rose" size="sm" className="text-[9px] py-0 px-1 font-bold">
                  LATE
                </Badge>
              )}
            </div>
          </div>

          {/* Title */}
          <Link
            href={`/tasks/${t.id}`}
            className="text-xs font-semibold text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-2 block leading-snug"
          >
            {t.title}
          </Link>

          {/* Bottom Row: Assignee, Role & Actions */}
          <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 text-xs">
            {t.assignedTo ? (
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-200 border border-zinc-700 shrink-0">
                  {t.assignedEmployeeAvatar || 'EM'}
                </div>
                <div className="flex items-center gap-1 truncate">
                  <span className="text-[11px] text-zinc-200 truncate font-medium">
                    {t.assignedEmployeeName}
                  </span>
                  {roleInfo.status === 'known' ? (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono shrink-0 border border-zinc-700/50">
                      {roleInfo.label}
                    </span>
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 font-mono shrink-0 border border-amber-800/50">
                      Unknown
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <Link href="/matching">
                <Badge variant="violet" size="sm" className="cursor-pointer text-[10px] py-0">
                  <Sparkles className="h-2.5 w-2.5 mr-1 text-violet-300" />
                  Match AI
                </Badge>
              </Link>
            )}

            {/* Quick Workflow Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {activeRole !== 'employee' && (
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(t)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  title="Edit task"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
              )}

              {canMove ? (
                <>
                  {t.status !== 'todo' && (
                    <button
                      type="button"
                      onClick={() => regressTaskStatus(t)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                      title="Move back"
                    >
                      <ArrowLeft className="h-3 w-3" />
                    </button>
                  )}
                  {t.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => advanceTaskStatus(t)}
                      className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                      title="Move forward"
                    >
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-zinc-500 italic pr-1">Read-only</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render a project's 4-column kanban board
  const renderProjectKanban = (projectTasks: Task[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        {kanbanColumns.map((col) => {
          const columnTasks = projectTasks.filter((t) => t.status === col.status);
          const isCollapsed = collapsedColumns[col.status];

          if (isCollapsed) {
            return (
              <div
                key={col.status}
                className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-2.5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-300">{col.label}</span>
                  <Badge variant={col.badgeVariant} size="sm">
                    {columnTasks.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => toggleColumnCollapse(col.status)}
                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
                  title={`Expand ${col.label}`}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={col.status}
              className="flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-2.5 space-y-2.5 transition-all"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">{col.label}</span>
                  <Badge variant={col.badgeVariant} size="sm">
                    {columnTasks.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => toggleColumnCollapse(col.status)}
                  className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                  title={`Collapse ${col.label}`}
                >
                  <Minimize2 className="h-3 w-3" />
                </button>
              </div>

              {/* Column Cards */}
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-0.5">
                {columnTasks.map((t) => renderCompactTaskCard(t))}

                {columnTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-800/80 py-4 px-2 text-center text-zinc-500 text-xs">
                    No tasks in {col.label.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render a project's table view
  const renderProjectTable = (projectTasks: Task[]) => {
    if (projectTasks.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-400">
          No tasks match the active filters for this project.
        </div>
      );
    }

    return (
      <Card className="border-zinc-800/80 bg-zinc-900/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-200">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-3.5 py-2.5">Task Title</th>
                <th className="px-3.5 py-2.5">Priority</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5">Estimate</th>
                <th className="px-3.5 py-2.5">Due Date</th>
                <th className="px-3.5 py-2.5">Assignee</th>
                <th className="px-3.5 py-2.5">Role</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {projectTasks.map((t) => {
                const isTaskOverdue =
                  t.status !== 'completed' &&
                  Boolean(t.dueDate) &&
                  new Date(t.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
                const roleInfo = resolveTaskAssigneeRole(t, orgMembers, employees);

                return (
                  <tr key={t.id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-white max-w-[220px] truncate">
                      <Link href={`/tasks/${t.id}`} className="hover:text-violet-300">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge
                        variant={
                          t.priority === 'critical'
                            ? 'rose'
                            : t.priority === 'high'
                              ? 'amber'
                              : 'slate'
                        }
                        size="sm"
                        className="capitalize text-[10px]"
                      >
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge variant="cyan" size="sm" className="capitalize text-[10px]">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-zinc-300">{t.estimatedHours}h</td>
                    <td className="px-3.5 py-2.5 font-mono text-zinc-400">
                      <span className={isTaskOverdue ? 'text-rose-300 font-semibold' : ''}>
                        {t.dueDate || 'Unscheduled'}
                      </span>
                      {isTaskOverdue && (
                        <Badge variant="rose" size="sm" className="ml-1.5 text-[9px] py-0 px-1 font-bold">
                          LATE
                        </Badge>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {t.assignedEmployeeName ? (
                        <span className="text-zinc-200 font-medium">{t.assignedEmployeeName}</span>
                      ) : (
                        <span className="text-violet-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {roleInfo.status === 'known' ? (
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700/60">
                          {roleInfo.label}
                        </span>
                      ) : roleInfo.status === 'unknown' ? (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                          Unknown
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {activeRole !== 'employee' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEditModal(t)}
                            className="text-xs h-7 px-2"
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            <span>Edit</span>
                          </Button>
                        )}
                        <Link href={`/tasks/${t.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                            Inspect
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Tasks
            </h2>
            <Badge variant="slate" size="sm">
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            </Badge>
            {activeFiltersCount > 0 && (
              <Badge variant="cyan" size="sm" className="hidden sm:inline-flex">
                {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Track and prioritize work deliverables with project scoping and role-governed execution
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Switcher */}
          <div className="flex items-center rounded-lg bg-zinc-900 p-1 border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'kanban'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === 'table'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
                }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
          </div>

          {activeRole !== 'employee' && (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Banners */}
      {isLive && tasksError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center justify-between">
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

      {actionError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search title, description, assignee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 pl-8 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Project Selector (Focused single project or All projects) */}
          <div className="flex flex-col">
            <select
              value={currentSelectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              aria-label="Filter by project"
            >
              <optgroup label="Overview">
                <option value="all">All Projects ({projectCounts.all || 0})</option>
                {projectCounts.unassigned > 0 && (
                  <option value="unassigned">Unassigned Project ({projectCounts.unassigned})</option>
                )}
              </optgroup>
              <optgroup label="Projects">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({projectCounts[p.id] || 0})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Role Filter (Assignee's organization membership role) */}
          <div className="flex flex-col">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleFilterValue)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              aria-label="Filter by assignee role"
            >
              <option value="all">All Roles ({roleCounts.all || 0})</option>
              <option value="organizer">Organizer ({roleCounts.organizer || 0})</option>
              <option value="admin">Admin ({roleCounts.admin || 0})</option>
              <option value="hr">HR ({roleCounts.hr || 0})</option>
              <option value="manager">Manager ({roleCounts.manager || 0})</option>
              <option value="employee">Staff ({roleCounts.employee || 0})</option>
              <option value="unassigned">Unassigned ({roleCounts.unassigned || 0})</option>
              {Boolean(roleCounts.unknown) && (
                <option value="unknown">Unknown Role ({roleCounts.unknown})</option>
              )}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex flex-col">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Filter State / Quick Reset */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3 w-3 text-zinc-400" />
              <span>
                Showing <strong>{filteredTasks.length}</strong> of {tasks.length} total tasks
              </span>
            </div>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-violet-400 hover:text-violet-300 text-xs font-medium flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              <span>Reset filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLive && isTasksLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 animate-pulse space-y-3"
            >
              <div className="h-4 w-20 bg-zinc-800 rounded" />
              <div className="h-20 bg-zinc-800/60 rounded-lg" />
              <div className="h-20 bg-zinc-800/60 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Main Tasks Board Area */}
      {!isTasksLoading && (
        <>
          {/* VIEW CASE 1: Single Project Focused View */}
          {currentSelectedProject !== 'all' ? (
            <div className="space-y-4">
              {/* Focused Project Header Card */}
              {(() => {
                const currentProj = projectMap[currentSelectedProject];
                const isUnassigned = currentSelectedProject === 'unassigned' || !currentProj;
                const projName = isUnassigned ? 'Unassigned Project' : currentProj.name;
                const projDesc = isUnassigned
                  ? 'Tasks not scoped to an active project'
                  : currentProj.description;

                return (
                  <Card className="border-zinc-800 bg-zinc-900/90 p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <FolderKanban className="h-4 w-4 text-zinc-400" />
                          <h3 className="text-base font-bold text-white">{projName}</h3>
                          {!isUnassigned && currentProj.status && (
                            <Badge variant="cyan" size="sm" className="capitalize text-[10px]">
                              {currentProj.status.replace('_', ' ')}
                            </Badge>
                          )}
                          {!isUnassigned && currentProj.priority && (
                            <Badge
                              variant={
                                currentProj.priority === 'critical'
                                  ? 'rose'
                                  : currentProj.priority === 'high'
                                    ? 'amber'
                                    : 'slate'
                              }
                              size="sm"
                              className="capitalize text-[10px]"
                            >
                              {currentProj.priority}
                            </Badge>
                          )}
                        </div>
                        {projDesc && <p className="text-xs text-zinc-400 line-clamp-1">{projDesc}</p>}
                      </div>

                      {/* Status Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {kanbanColumns.map((col) => {
                          const count = filteredTasks.filter((t) => t.status === col.status).length;
                          return (
                            <span
                              key={col.status}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300"
                            >
                              {col.label}: <strong className="text-white">{count}</strong>
                            </span>
                          );
                        })}
                        {!isUnassigned && currentProj && (
                          <Link href={`/projects/${currentProj.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-zinc-400 hover:text-white">
                              Inspect Project
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })()}

              {/* Board or Table */}
              {viewMode === 'kanban' ? renderProjectKanban(filteredTasks) : renderProjectTable(filteredTasks)}
            </div>
          ) : (
            /* VIEW CASE 2: All Projects Grouped View */
            <div className="space-y-4">
              {/* Toolbar for Grouped View */}
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span>
                  Showing tasks grouped by project ({projectGroups.length} {projectGroups.length === 1 ? 'group' : 'groups'})
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={expandAllProjects}
                    className="hover:text-white transition-colors"
                  >
                    Expand all
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={collapseAllProjects}
                    className="hover:text-white transition-colors"
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              {/* Project Group Accordions */}
              {projectGroups.map((group) => {
                const groupKey = group.project ? group.project.id : 'unassigned';
                const isCollapsed = Boolean(collapsedProjects[groupKey]);
                const groupTitle = group.project ? group.project.name : 'Unassigned Tasks (No Project)';
                const groupTasks = group.tasks;

                return (
                  <Card
                    key={groupKey}
                    className="border-zinc-800 bg-zinc-900/70 overflow-hidden transition-all shadow-sm"
                  >
                    {/* Collapsible Project Group Header */}
                    <div
                      onClick={() => toggleProjectCollapse(groupKey)}
                      className="p-3.5 bg-zinc-950/60 border-b border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer hover:bg-zinc-950 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          className="p-0.5 text-zinc-400 hover:text-white"
                          aria-label={isCollapsed ? 'Expand project group' : 'Collapse project group'}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        <div className="flex items-center gap-2">
                          <FolderKanban className={`h-4 w-4 ${group.isUnassigned ? 'text-amber-400' : 'text-zinc-400'}`} />
                          <span className="text-sm font-bold text-white">{groupTitle}</span>
                          {group.isUnassigned ? (
                            <Badge variant="amber" size="sm" className="text-[10px]">
                              Needs Scoping
                            </Badge>
                          ) : (
                            group.project?.status && (
                              <Badge variant="cyan" size="sm" className="capitalize text-[10px]">
                                {group.project.status.replace('_', ' ')}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>

                      {/* Status Breakdown Pills */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                        {kanbanColumns.map((col) => {
                          const count = groupTasks.filter((t) => t.status === col.status).length;
                          return (
                            <span
                              key={col.status}
                              className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                            >
                              {col.label}: <strong className="text-white">{count}</strong>
                            </span>
                          );
                        })}
                        <Badge variant="slate" size="sm" className="font-mono">
                          {groupTasks.length} {groupTasks.length === 1 ? 'task' : 'tasks'}
                        </Badge>
                      </div>
                    </div>

                    {/* Group Body */}
                    {!isCollapsed && (
                      <div className="p-3.5 space-y-3">
                        {groupTasks.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center text-xs text-zinc-500">
                            No tasks match current search/role filters in this project.
                          </div>
                        ) : viewMode === 'kanban' ? (
                          renderProjectKanban(groupTasks)
                        ) : (
                          renderProjectTable(groupTasks)
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}

              {projectGroups.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-400">
                  No projects or tasks found matching current filters.
                </div>
              )}
            </div>
          )}
        </>
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

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Implement resilient token refresh pipeline"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Project Destination <span className="text-rose-400">*</span>
            </label>
            <select
              value={newProjId}
              onChange={(e) => setNewProjId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Estimated Hours <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Assignee</label>
              <select
                value={newAssigneeId}
                onChange={(e) => setNewAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              >
                <option value="unassigned">Unassigned (Match AI)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.department})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Outline acceptance criteria, technical dependencies, and deliverables..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Create Task
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Sprint Task"
        description="Update task allocation, priority status, or sprint commitments."
      >
        <form onSubmit={handleSaveTaskEdit} className="space-y-3.5 py-2">
          {editError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-2.5 text-xs text-rose-300">
              {editError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="in_review">In review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Priority</label>
              <select
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Estimated Hours <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                required
                value={editEstimatedHours}
                onChange={(e) => setEditEstimatedHours(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Due Date</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Assignee</label>
            <select
              value={editAssigneeId}
              onChange={(e) => setEditAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 focus:border-zinc-400 focus:outline-none"
            >
              <option value="unassigned">Unassigned (Match AI)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-zinc-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
            {isManagerOrAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteTask}
                disabled={editSubmitting}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={editSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={editSubmitting}>
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
