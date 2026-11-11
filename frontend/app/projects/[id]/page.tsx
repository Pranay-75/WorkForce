'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { PriorityLevel, ProjectStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Input';
import { MetricCard } from '@/components/ui/MetricCard';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
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
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Trash2,
  Edit3,
  Layers,
  Briefcase,
  ShieldAlert,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const { user, isAuthenticated, organization, role: authRole } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live hooks
  const {
    projects: dbProjects,
    isLoading: isProjectsLoading,
    addProjectMember,
    removeProjectMember,
    updateProject: dbUpdateProject,
    deleteProject: dbDeleteProject,
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
  const {
    projects: mockProjects,
    employees: mockEmployees,
    tasks: mockTasks,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateProject: mockUpdateProject,
    deleteProject: mockDeleteProject,
  } = useMockStore();

  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? user?.id : mockUserId;
  const isManagerOrAdmin =
    activeRole === 'organizer' || activeRole === 'admin' || activeRole === 'manager';
  const isAdminOrOrganizer = activeRole === 'organizer' || activeRole === 'admin';

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

  // Member Removal Confirmation State (Strictly using ConfirmDialog, no browser prompt)
  const [memberToRemove, setMemberToRemove] = React.useState<{ id: string; name: string } | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);

  // Edit Project Modal State
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editPriority, setEditPriority] = React.useState<PriorityLevel>('medium');
  const [editStatus, setEditStatus] = React.useState<ProjectStatus>('in_progress');
  const [editTargetEndDate, setEditTargetEndDate] = React.useState('');
  const [editTotalHours, setEditTotalHours] = React.useState('');
  const [editManagerId, setEditManagerId] = React.useState('');
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Eligible Managers filter: strictly 'manager' and 'admin' roles only
  const eligibleManagers = React.useMemo(() => {
    if (isLive) {
      return orgMembers.filter((m) => m.role === 'manager' || m.role === 'admin');
    }
    return mockEmployees.filter((e) => e.role === 'manager' || e.role === 'admin');
  }, [isLive, orgMembers, mockEmployees]);

  // Delete Project Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Card Action feedback
  const [actionNotice, setActionNotice] = React.useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Loading skeleton
  if (isLive && isProjectsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-6 w-32 bg-wf-surface-subtle rounded-xl" />
        <div className="h-44 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-12 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wf-brand-burgundy/10 text-wf-brand-burgundy dark:text-wf-cream">
          <FolderKanban className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-wf-text-primary tracking-tight">Project Not Found</h3>
        <p className="text-sm text-wf-text-secondary max-w-md mx-auto">
          The requested project does not exist in the active organization portfolio.
        </p>
        <Link href="/projects" className="inline-block pt-2">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Projects Portfolio
          </Button>
        </Link>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const filteredTasks = projectTasks.filter((t) =>
    activeTab === 'all' ? true : t.status === activeTab
  );

  // Task breakdown counts
  const totalTasks = projectTasks.length;
  const todoTasks = projectTasks.filter((t) => t.status === 'todo').length;
  const inProgressTasks = projectTasks.filter((t) => t.status === 'in_progress').length;
  const completedTasks = projectTasks.filter((t) => t.status === 'completed').length;

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

  const totalTeamCapacity = projectMembers.reduce(
    (sum: number, m: any) => sum + (Number(m.weeklyCapacityHours) || 40),
    0
  );

  const completedTasksHours = projectTasks
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  const completedHours = isLive ? completedTasksHours : (project.completedHours || completedTasksHours);
  const totalTaskHours = projectTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  const totalEffortHours = Math.max(project.totalHours || 0, totalTaskHours);
  const progressPct =
    totalEffortHours > 0 ? Math.min(100, Math.round((completedHours / totalEffortHours) * 100)) : 0;

  const handleOpenEditModal = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || '');
    setEditPriority(project.priority);
    setEditStatus(project.status);
    setEditTargetEndDate(project.targetEndDate || '');
    setEditTotalHours(project.totalHours ? String(project.totalHours) : '160');
    setEditManagerId(project.managerId || '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleEditProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    if (!editName.trim()) {
      setEditError('Project name is required.');
      return;
    }
    const parsedHours = parseFloat(editTotalHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setEditError('Total allocated effort must be a positive number.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    const chosenManagerId = editManagerId.trim() || undefined;
    const chosenManager = eligibleManagers.find(
      (m: any) => (m.userId || m.id) === (chosenManagerId || '')
    );

    if (isLive) {
      const res = await dbUpdateProject(project.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        priority: editPriority,
        status: editStatus,
        targetEndDate: editTargetEndDate || undefined,
        totalHours: parsedHours,
        managerId: chosenManagerId,
      });

      setEditLoading(false);
      if (res.error) {
        setEditError(res.error);
        return;
      }
      await refetchProjects();
    } else {
      mockUpdateProject(project.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        priority: editPriority,
        status: editStatus,
        targetEndDate: editTargetEndDate,
        totalHours: parsedHours,
        managerId: chosenManagerId,
        managerName: chosenManager ? chosenManager.fullName : (chosenManagerId ? 'Assigned Manager' : 'Unassigned'),
      });
      setEditLoading(false);
    }

    setIsEditModalOpen(false);
    setActionNotice({ type: 'success', text: `Project "${editName}" updated successfully.` });
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleteLoading(true);
    setDeleteError(null);

    if (isLive) {
      const res = await dbDeleteProject(project.id);
      setDeleteLoading(false);
      if (res.error) {
        setDeleteError(res.error);
        return;
      }
    } else {
      mockDeleteProject(project.id);
      setDeleteLoading(false);
    }

    setIsDeleteModalOpen(false);
    router.push('/projects');
  };

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

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || !project) return;
    setRemoveLoading(true);
    const res = await removeProjectMember(project.id, memberToRemove.id);
    setRemoveLoading(false);
    const removedName = memberToRemove.name;
    setMemberToRemove(null);

    if (res.error) {
      setActionNotice({ type: 'error', text: res.error });
    } else {
      setActionNotice({ type: 'success', text: `${removedName} was removed from the project.` });
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Action Notice */}
      {actionNotice && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-xs sm:text-sm font-medium flex items-center gap-3 animate-in fade-in ${
            actionNotice.type === 'error'
              ? 'border-wf-semantic-danger-border bg-wf-semantic-danger-bg text-wf-semantic-danger'
              : 'border-wf-semantic-success-border bg-wf-semantic-success-bg text-wf-semantic-success'
          }`}
        >
          {actionNotice.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Top Breadcrumb Navigation & Role Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/projects"
          className="inline-flex items-center text-xs sm:text-sm font-semibold text-wf-text-secondary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors duration-hover"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          <span>Back to Projects Portfolio</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              project.priority === 'critical'
                ? 'danger'
                : project.priority === 'high'
                ? 'warning'
                : 'slate'
            }
            size="sm"
          >
            {project.priority.toUpperCase()} PRIORITY
          </Badge>
          <Badge
            variant={
              project.status === 'completed'
                ? 'success'
                : project.status === 'in_progress'
                ? 'burgundy'
                : project.status === 'on_hold'
                ? 'warning'
                : 'sage'
            }
            size="sm"
          >
            {project.status.replace('_', ' ').toUpperCase()}
          </Badge>

          {isManagerOrAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenEditModal}
              className="text-xs"
            >
              <Edit3 className="h-3.5 w-3.5 mr-1 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Edit Project</span>
            </Button>
          )}

          {isAdminOrOrganizer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="text-xs text-wf-semantic-danger hover:bg-wf-semantic-danger-bg hover:text-wf-semantic-danger"
              title="Delete Project (Admin Only)"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              <span>Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Project Identity Hero Banner */}
      <Card className="border-wf-border-default bg-wf-surface-card p-6 sm:p-8 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-wf-brand-burgundy/10 text-wf-brand-burgundy dark:text-wf-cream shrink-0">
                <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-wf-text-primary tracking-tight">
                {project.name}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-wf-text-secondary leading-relaxed">
              {project.description || 'No detailed scope description provided.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-wf-text-tertiary pt-1">
              <span className="flex items-center gap-1.5 font-mono text-wf-text-secondary">
                <Calendar className="h-3.5 w-3.5 text-wf-brand-burgundy dark:text-wf-cream" />
                Target: {project.targetEndDate || 'Unscheduled'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <Briefcase className="h-3.5 w-3.5 text-wf-brand-sage" />
                Lead: <strong className="text-wf-text-primary font-semibold">{project.managerName || 'Unassigned'}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <Users className="h-3.5 w-3.5 text-wf-brand-sage" />
                {projectMembers.length} {projectMembers.length === 1 ? 'member' : 'members'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary font-mono">
                <CheckSquare className="h-3.5 w-3.5 text-wf-brand-sage" />
                {totalTasks} total tasks
              </span>
            </div>
          </div>

          {/* Delivery Metric Summary Widget */}
          <div className="rounded-2xl border border-wf-border-subtle bg-wf-surface-subtle/50 p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-[220px] lg:min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-semibold text-wf-text-secondary">
              <span>Overall Delivery</span>
              <span className="font-mono text-wf-brand-burgundy dark:text-wf-cream font-bold">
                {progressPct}%
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-wf-text-primary tabular-nums">
              {completedHours}h <span className="text-xs sm:text-sm font-normal text-wf-text-tertiary">/ {totalEffortHours}h</span>
            </div>
            <div className="w-full">
              <ProgressBar value={progressPct} max={100} colorScheme="auto" />
            </div>
            <p className="text-[11px] text-wf-text-tertiary">
              {completedTasks} of {totalTasks} tasks delivered
            </p>
          </div>
        </div>
      </Card>

      {/* Project Execution Overview (MetricCard Primitives) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Overall Delivery Progress"
          value={`${progressPct}%`}
          subtitle={`${completedHours}h of ${totalEffortHours}h effort logged`}
          icon={<FolderKanban className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
          progress={{ value: progressPct, max: 100, colorScheme: 'auto' }}
        />
        <MetricCard
          title="Effort Budget Allocation"
          value={`${totalEffortHours}h`}
          subtitle={`${completedHours}h completed • ${Math.max(0, totalEffortHours - completedHours)}h remaining`}
          icon={<Clock className="h-5 w-5 text-wf-brand-sage dark:text-wf-sage" />}
        />
        <MetricCard
          title="Active Execution Tasks"
          value={inProgressTasks}
          subtitle={`${completedTasks} delivered • ${todoTasks} pending`}
          icon={<CheckSquare className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
        />
        <MetricCard
          title="Team Roster Bandwidth"
          value={projectMembers.length}
          subtitle={`${totalTeamCapacity}h/wk total weekly capacity`}
          icon={<Users className="h-5 w-5 text-wf-brand-sage dark:text-wf-sage" />}
        />
      </div>

      {/* Allocated Team Members Section */}
      <Card className="border-wf-border-default bg-wf-surface-card shadow-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />
              <CardTitle className="text-base sm:text-lg">
                Allocated Team Members ({projectMembers.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Contributors actively assigned to project deliverables and initiative workflows
            </CardDescription>
          </div>
          {isManagerOrAdmin && (
            <Button variant="secondary" size="sm" onClick={handleOpenAssignModal} className="text-xs shrink-0">
              <UserPlus className="h-3.5 w-3.5 mr-1 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Assign Member</span>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {projectMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-wf-border-default bg-wf-surface-subtle/40 p-8 text-center space-y-2">
              <Users className="mx-auto h-8 w-8 text-wf-text-tertiary" />
              <p className="text-xs font-semibold text-wf-text-primary">No members allocated yet</p>
              <p className="text-xs text-wf-text-secondary max-w-sm mx-auto">
                Assign team members to allocate bandwidth and distribute tasks across your organization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {projectMembers.map((m: any) => {
                // Strict authorization guard: Employees CANNOT browse other employee profiles
                const canNavigateToProfile = activeRole !== 'employee' || m.id === currentUserId;
                const memberUtilPct = m.weeklyCapacityHours > 0
                  ? Math.round(((m.currentLoadHours || 0) / m.weeklyCapacityHours) * 100)
                  : 0;

                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-wf-border-default bg-wf-surface-subtle/50 p-3.5 hover:border-wf-border-strong hover:bg-wf-surface-card transition-all duration-hover flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <InteractiveAvatar
                        name={m.fullName}
                        jobTitle={m.jobTitle}
                        department={m.department}
                        size="sm"
                        weeklyCapacityHours={m.weeklyCapacityHours}
                        activeAssignedHours={m.currentLoadHours}
                        utilizationPct={memberUtilPct}
                        employeeId={canNavigateToProfile ? m.id : undefined}
                      />
                      <div className="min-w-0 flex-1">
                        {canNavigateToProfile ? (
                          <Link
                            href={`/employees/${m.id}`}
                            className="text-xs font-semibold text-wf-text-primary group-hover:text-wf-brand-burgundy dark:group-hover:text-wf-cream transition-colors truncate block"
                          >
                            {m.fullName}
                          </Link>
                        ) : (
                          <span
                            className="text-xs font-semibold text-wf-text-primary truncate block"
                            title="Employee profile navigation restricted"
                          >
                            {m.fullName}
                          </span>
                        )}
                        <span className="text-[11px] text-wf-text-secondary truncate block">
                          {m.jobTitle}
                        </span>
                        <span className="text-[10px] font-mono text-wf-text-tertiary block pt-0.5">
                          {m.currentLoadHours || 0}h / {m.weeklyCapacityHours || 40}h ({memberUtilPct}%)
                        </span>
                      </div>
                    </div>
                    {isManagerOrAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMemberToRemove({ id: m.id, name: m.fullName })}
                        className="text-wf-semantic-danger hover:bg-wf-semantic-danger-bg p-1 h-7 w-7 shrink-0"
                        title={`Remove ${m.fullName} from project`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Execution Workspace & Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-wf-text-primary tracking-tight">
              Project Task Execution Roster
            </h2>
            <p className="text-xs text-wf-text-secondary">
              Granular breakdown of requirements, deadlines, and assigned talent
            </p>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-2xl bg-wf-surface-subtle p-1 border border-wf-border-subtle text-xs">
            {(
              [
                { id: 'all', label: 'All Tasks', count: totalTasks },
                { id: 'todo', label: 'To Do', count: todoTasks },
                { id: 'in_progress', label: 'In Progress', count: inProgressTasks },
                { id: 'completed', label: 'Completed', count: completedTasks },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-xl px-3 py-1.5 font-medium transition-all duration-hover text-xs flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-wf-surface-card text-wf-brand-burgundy dark:text-wf-cream shadow-xs font-semibold border border-wf-border-subtle'
                    : 'text-wf-text-secondary hover:text-wf-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.2 font-mono ${
                    activeTab === tab.id
                      ? 'bg-wf-brand-burgundy/10 text-wf-brand-burgundy dark:text-wf-cream'
                      : 'bg-wf-surface-card text-wf-text-tertiary'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <Card
              key={t.id}
              className="border-wf-border-default hover:border-wf-border-strong hover:shadow-elevated transition-all duration-hover"
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-sm font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors duration-hover"
                    >
                      {t.title}
                    </Link>
                    <Badge
                      variant={
                        t.priority === 'critical'
                          ? 'danger'
                          : t.priority === 'high'
                          ? 'warning'
                          : 'slate'
                      }
                      size="sm"
                    >
                      {t.priority}
                    </Badge>
                    <Badge
                      variant={
                        t.status === 'completed'
                          ? 'success'
                          : t.status === 'in_progress'
                          ? 'burgundy'
                          : 'sage'
                      }
                      size="sm"
                    >
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-wf-text-secondary line-clamp-2">
                    {t.description || 'No additional task specifications provided.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-wf-text-tertiary pt-1">
                    <span className="font-mono text-wf-brand-burgundy dark:text-wf-cream font-semibold">
                      {t.estimatedHours} hrs estimate
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-wf-text-secondary">
                      <Calendar className="h-3 w-3" /> Due {t.dueDate || 'Unscheduled'}
                    </span>
                    <span>•</span>
                    <div className="flex items-center gap-1.5 text-wf-text-secondary">
                      <span>Assignee:</span>
                      {t.assignedEmployeeName ? (
                        <span className="font-semibold text-wf-text-primary">
                          {t.assignedEmployeeName}
                        </span>
                      ) : (
                        <span className="text-wf-semantic-warning font-medium">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
                        <span>View Task</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-wf-border-default bg-wf-surface-card p-10 text-center space-y-2">
              <CheckSquare className="mx-auto h-8 w-8 text-wf-text-tertiary" />
              <p className="text-xs font-semibold text-wf-text-primary">
                No tasks matching &quot;{activeTab}&quot; status
              </p>
              <p className="text-xs text-wf-text-secondary">
                Switch filters above to inspect tasks across other delivery phases.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Member Removal Confirmation Dialog (Strict ConfirmDialog) */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleConfirmRemoveMember}
        title="Remove Member from Project"
        description={`Are you sure you want to remove ${memberToRemove?.name} from ${project.name}? Their uncompleted tasks will remain in the project scope.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={removeLoading}
      />

      {/* Assign Member Modal */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Member to ${project.name}`}
        description="Select an active organization member to allocate to this project initiative."
      >
        <form onSubmit={handleAssignMember} className="space-y-4 py-2">
          {assignError && (
            <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          {assignSuccess && (
            <div className="rounded-2xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3.5 text-xs text-wf-semantic-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{assignSuccess}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-wf-text-primary">
              Select Active Member *
            </label>
            {orgMembers.length === 0 ? (
              <p className="text-xs text-wf-semantic-warning">No active members found in organization.</p>
            ) : (
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none"
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
          <div className="space-y-2 pt-2 border-t border-wf-border-subtle">
            <label className="block text-xs font-semibold text-wf-text-primary">
              Optionally Assign Open Tasks from this Project:
            </label>
            {projectTasks.filter((t) => !t.assignedTo).length === 0 ? (
              <p className="text-[11px] text-wf-text-tertiary italic">
                No unassigned tasks found for this project.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-2">
                {projectTasks
                  .filter((t) => !t.assignedTo)
                  .map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 text-xs text-wf-text-secondary hover:text-wf-text-primary cursor-pointer p-1 rounded-lg"
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
                        className="rounded border-wf-border-default bg-wf-surface-card text-wf-brand-burgundy focus:ring-wf-brand-burgundy"
                      />
                      <span className="truncate">{t.title}</span>
                      <span className="text-[10px] text-wf-brand-burgundy dark:text-wf-cream font-mono ml-auto shrink-0">
                        {t.estimatedHours}h
                      </span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-subtle">
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

      {/* Edit Project Dialog */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Project: ${project.name}`}
        description="Update project milestones, priority, status, and budgeted capacity."
      >
        <form onSubmit={handleEditProjectSubmit} className="space-y-3.5 py-2">
          {editError && (
            <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <Input
            label="Project Name *"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-wf-text-primary">
              Project Description
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Select
              label="Designated Project Manager (Manager Role Only)"
              value={editManagerId}
              onChange={(e) => setEditManagerId(e.target.value)}
              options={[
                { label: '-- Unassigned / Select Manager --', value: '' },
                ...eligibleManagers.map((m: any) => ({
                  label: `${m.fullName} (${m.role.toUpperCase()} • ${m.department || 'Engineering'})`,
                  value: m.userId || m.id,
                })),
              ]}
            />
            {eligibleManagers.length === 0 && (
              <p className="text-[11px] text-wf-semantic-warning">
                Notice: No members with the Manager role exist in this organization. You can invite or assign a Manager under Employee Management.
              </p>
            )}
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
              label="Project Status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
              options={[
                { label: 'Planning', value: 'planning' },
                { label: 'In Progress', value: 'in_progress' },
                { label: 'On Hold', value: 'on_hold' },
                { label: 'Completed', value: 'completed' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Deadline"
              type="date"
              value={editTargetEndDate}
              onChange={(e) => setEditTargetEndDate(e.target.value)}
            />
            <Input
              label="Total Budgeted Hours"
              type="number"
              value={editTotalHours}
              onChange={(e) => setEditTotalHours(e.target.value)}
              min="1"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-subtle">
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

      {/* Delete Project Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Project Deletion"
        description="Are you sure you want to permanently delete this project? All associated tasks will be removed."
      >
        <div className="space-y-4 py-2">
          {deleteError && (
            <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg/50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-wf-semantic-danger shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-wf-text-primary">
                Warning: Irreversible Administrator Action
              </p>
              <p className="text-wf-text-secondary">
                Deleting <strong>{project.name}</strong> will permanently remove this project and cascade-delete its {projectTasks.length} associated task{projectTasks.length !== 1 ? 's' : ''}.
              </p>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-subtle">
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
              onClick={handleDeleteProject}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Project Permanently'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
