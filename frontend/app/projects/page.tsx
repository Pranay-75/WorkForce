'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { PriorityLevel, ProjectStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  ArrowRight,
  Plus,
  Clock,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UserPlus,
} from 'lucide-react';

export default function ProjectsPage() {
  const { isAuthenticated, user, organization, role: authRole } = useAuth();

  // Supabase Phase 2.2B real data hooks
  const {
    projects: dbProjects,
    isLoading: isProjectsLoading,
    error: projectsError,
    refetch: refetchProjects,
    createProject,
    addProjectMember,
  } = useProjects();

  const { tasks: dbTasks, isLoading: isTasksLoading, assignTask, refetch: refetchTasks } = useTasks();
  const { members: orgMembers } = useOrganizationMembers();

  // Mock store fallback for unauthenticated showcase
  const {
    projects: mockProjects,
    employees: mockEmployees,
    tasks: mockTasks,
    activeRole: mockRole,
    currentUser: mockUser,
    addNewProject: mockAddNewProject,
  } = useMockStore();

  const isLive = isAuthenticated && Boolean(organization?.id);
  const projects = isLive ? dbProjects : mockProjects;
  const tasks = isLive ? dbTasks : mockTasks;
  const activeRole = isLive ? authRole : mockRole;
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'organizer';

  // Member Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [targetProjectId, setTargetProjectId] = React.useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  const handleOpenAssignModal = (projId: string) => {
    setTargetProjectId(projId);
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    const proj = projects.find((p) => p.id === projId);
    const unallocated = orgMembers.find((m) => proj && !proj.memberIds.includes(m.userId));
    setSelectedMemberId(unallocated ? unallocated.userId : (orgMembers[0]?.userId || ''));
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProjectId || !selectedMemberId) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    const res = await addProjectMember(targetProjectId, selectedMemberId);
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
    setAssignSuccess(`Assigned ${assignedMember?.fullName || 'member'} to project.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  // Available employees/members for assignment
  const selectableMembers = React.useMemo(() => {
    if (isLive) {
      return orgMembers.map((m) => {
        const load = tasks
          .filter((t) => t.assignedTo === m.userId && t.status !== 'completed')
          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
        return {
          id: m.userId,
          fullName: m.fullName,
          department: m.department || 'Engineering',
          currentLoadHours: load,
        };
      });
    }
    return mockEmployees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      department: e.department,
      currentLoadHours: e.currentLoadHours,
    }));
  }, [isLive, orgMembers, mockEmployees, tasks]);

  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Form State
  const [projectName, setProjectName] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [priority, setPriority] = React.useState<PriorityLevel>('high');
  const [status, setStatus] = React.useState<ProjectStatus>('in_progress');
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [targetEndDate, setTargetEndDate] = React.useState('2026-12-31');
  const [totalHours, setTotalHours] = React.useState('200');
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);

  // Initialize selected member to current user if available
  React.useEffect(() => {
    if (isLive && user?.id) {
      setSelectedMemberIds([user.id]);
    } else if (mockUser?.id) {
      setSelectedMemberIds([mockUser.id]);
    }
  }, [isLive, user?.id, mockUser?.id]);

  const filteredProjects = projects.filter((p) =>
    selectedStatus === 'all' ? true : p.status === selectedStatus
  );

  const toggleMemberSelection = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setFormError('Project name is required.');
      return;
    }

    const parsedHours = parseFloat(totalHours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('Total allocated hours must be a positive number.');
      return;
    }

    if (startDate && targetEndDate && new Date(targetEndDate) < new Date(startDate)) {
      setFormError('Target end date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    if (isLive) {
      const res = await createProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
        priority,
        status,
        startDate: startDate || undefined,
        targetEndDate: targetEndDate || undefined,
        managerId: user?.id || null,
        totalHours: parseFloat(totalHours) || 160,
        memberIds: selectedMemberIds,
      });

      setSubmitting(false);

      if (res.error) {
        setFormError(res.error);
        return;
      }
    } else {
      mockAddNewProject({
        name: projectName,
        description: projectDesc || 'Strategic engineering initiative delivering key product milestones.',
        priority,
        status,
        startDate,
        targetEndDate,
        managerId: mockUser.id,
        managerName: mockUser.name,
        memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : [mockUser.id],
        totalHours: parseFloat(totalHours) || 160,
      });
      setSubmitting(false);
    }

    setIsCreateModalOpen(false);
    setProjectName('');
    setProjectDesc('');
    setFormError(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Project Portfolio & Delivery Benchmarks
            </h2>
            <Badge variant="violet" size="sm">
              {projects.filter((p) => p.status === 'in_progress').length} Active / {projects.length} Total Projects
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Monitor delivery milestones, tracked project effort, and team member commitments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Project Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>

          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {isLive && projectsError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{projectsError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetchProjects()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLive && isProjectsLoading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-64 rounded-xl border border-slate-800 bg-navy-900/40 p-6 animate-pulse space-y-4"
            >
              <div className="h-5 w-48 bg-slate-800 rounded" />
              <div className="h-4 w-full bg-slate-800/60 rounded" />
              <div className="h-8 w-full bg-slate-800/40 rounded mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isProjectsLoading && filteredProjects.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-12 text-center space-y-3">
          <FolderKanban className="mx-auto h-10 w-10 text-slate-500" />
          <h3 className="text-base font-bold text-white">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isManagerOrAdmin
              ? 'No project initiatives match your criteria. Click "Create Project" to launch your first delivery milestone.'
              : 'There are currently no active projects assigned to your team in this organization.'}
          </p>
          {isManagerOrAdmin && (
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                <span>Launch New Project</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {!isProjectsLoading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredProjects.map((proj) => {
            const projectTasks = tasks.filter((t) => t.projectId === proj.id);
            const completedTasksHours = projectTasks
              .filter((t) => t.status === 'completed')
              .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
            const completedHours = isLive ? completedTasksHours : (proj.completedHours || completedTasksHours);
            const totalTaskHours = projectTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
            const totalEffortHours = Math.max(proj.totalHours || 0, totalTaskHours);
            const progressPct =
              totalEffortHours > 0
                ? Math.min(100, Math.round((completedHours / totalEffortHours) * 100))
                : 0;

            return (
              <Card
                key={proj.id}
                className="flex flex-col justify-between border-slate-800/90 hover:border-violet-500/50 transition-all hover:shadow-card group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-violet-400" />
                        <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                          {proj.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        proj.priority === 'critical'
                          ? 'rose'
                          : proj.priority === 'high'
                          ? 'amber'
                          : 'slate'
                      }
                      size="sm"
                    >
                      {proj.priority}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Total Completion</span>
                      <span className="text-slate-200 font-bold">
                        {completedHours}h / {totalEffortHours}h ({progressPct}%)
                      </span>
                    </div>
                    <ProgressBar value={progressPct} />
                  </div>

                  {/* Dates & Lead */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400 rounded-xl bg-navy-900/60 p-3 border border-slate-800/60">
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">Target Deadline</span>
                      <span className="text-slate-200 font-mono font-semibold flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-cyan-400" />
                        {proj.targetEndDate || 'Unscheduled'}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-slate-400 block">Project Lead</span>
                      <span className="text-slate-200 font-semibold truncate block">
                        {proj.managerName || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Member Count & Task Count */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Users className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{proj.memberIds.length} member{proj.memberIds.length !== 1 ? 's' : ''} allocated</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
                      <span className="font-mono">
                        {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <div className="border-t border-slate-800/80 bg-navy-950/40 p-3 px-5 flex flex-wrap items-center justify-between gap-2">
                  <Badge variant={proj.status === 'in_progress' ? 'cyan' : 'slate'} size="sm">
                    {proj.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {isManagerOrAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAssignModal(proj.id)}
                        className="text-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1 text-cyan-400" />
                        <span>Assign Member</span>
                      </Button>
                    )}
                    <Link href={`/projects/${proj.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <span>Project Dashboard</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Project Dialog Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project Initiative"
        description="Author a new project portfolio initiative for your organization."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 py-2">
          {formError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-2.5 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <Input
            label="Project Name *"
            placeholder="e.g. Edge Ingestion Pipeline v3"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Project Description & Scope
            </label>
            <textarea
              rows={3}
              placeholder="Outline project deliverables, core architectural components, and milestones..."
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-700/80 bg-navy-850 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              options={[
                { label: 'High Priority', value: 'high' },
                { label: 'Critical Priority', value: 'critical' },
                { label: 'Medium Priority', value: 'medium' },
                { label: 'Low Priority', value: 'low' },
              ]}
            />
            <Select
              label="Initial Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              options={[
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Planning', value: 'planning' },
              ]}
            />
            <Input
              label="Effort Budget (Hours) *"
              type="number"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              min="1"
              max="10000"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Target Completion Date"
              type="date"
              value={targetEndDate}
              onChange={(e) => setTargetEndDate(e.target.value)}
            />
          </div>

          {/* Team Members Assignment Selector */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-medium text-slate-300">
              Allocate Team Members ({selectedMemberIds.length} Selected)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-navy-950/60 p-2.5">
              {selectableMembers.map((emp) => {
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={() => toggleMemberSelection(emp.id)}
                    className={`flex items-center justify-between rounded-lg p-2 text-left text-xs transition-colors border ${
                      isSelected
                        ? 'border-violet-500/60 bg-violet-950/30 text-white'
                        : 'border-slate-800 bg-navy-900/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-[10px] font-bold text-white shrink-0">
                        {emp.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {emp.department}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-cyan-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  <span>Launching...</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  <span>Launch Project</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Quick Member Assignment Modal */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Team Member to Project"
        description="Select an active team member from your organization to allocate to this initiative."
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
                  const targetProj = projects.find((p) => p.id === targetProjectId);
                  const isAllocated = targetProj?.memberIds.includes(m.userId);
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
          {targetProjectId && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                Optionally Assign Open Tasks from this Project:
              </label>
              {tasks.filter((t) => t.projectId === targetProjectId && !t.assignedTo).length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No unassigned tasks found for this project.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-navy-950/60 p-2">
                  {tasks
                    .filter((t) => t.projectId === targetProjectId && !t.assignedTo)
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
          )}

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
