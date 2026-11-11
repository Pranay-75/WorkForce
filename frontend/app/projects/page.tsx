'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { PriorityLevel, ProjectStatus, Project } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
import {
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  ArrowRight,
  Plus,
  Clock,
  ShieldCheck,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Search,
  Filter,
  X,
  LayoutGrid,
  List,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectsPage() {
  const { isAuthenticated, user, organization, role: authRole } = useAuth();

  // Supabase real data hooks
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

  // Presentation State
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [selectedPriority, setSelectedPriority] = React.useState<string>('all');
  const [selectedManager, setSelectedManager] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'deadline' | 'name' | 'priority' | 'progress'>('deadline');

  // Member Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [targetProjectId, setTargetProjectId] = React.useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Create Project Modal State
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
  const [selectedManagerId, setSelectedManagerId] = React.useState<string>('');

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

  // Eligible Managers filter: strictly 'manager' and 'admin' roles only
  const eligibleManagers = React.useMemo(() => {
    if (isLive) {
      return orgMembers.filter(
        (m) => m.role === 'manager' || m.role === 'admin'
      );
    }
    return mockEmployees.filter(
      (e) => e.role === 'manager' || e.role === 'admin'
    );
  }, [isLive, orgMembers, mockEmployees]);

  // Distinct managers present in the current projects list for the filter dropdown
  const distinctProjectManagers = React.useMemo(() => {
    const managersMap = new Map<string, string>();
    projects.forEach((p) => {
      if (p.managerName) {
        managersMap.set(p.managerId || p.managerName, p.managerName);
      }
    });
    return Array.from(managersMap.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);

  // Portfolio Summary Metrics strictly calculated from accessible project data
  const portfolioMetrics = React.useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const planning = projects.filter((p) => p.status === 'planning').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const completedHoursSum = projects.reduce((sum, p) => sum + (p.completedHours || 0), 0);
    const inProgressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;

    return {
      total,
      inProgress,
      planning,
      completed,
      completedHoursSum,
      inProgressPct,
    };
  }, [projects]);

  // Combined Filter and Sort Pipeline
  const filteredProjects = React.useMemo(() => {
    return projects
      .filter((p) => {
        // Status filter
        if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
        // Priority filter
        if (selectedPriority !== 'all' && p.priority !== selectedPriority) return false;
        // Manager filter
        if (selectedManager !== 'all') {
          if (p.managerId !== selectedManager && p.managerName !== selectedManager) {
            return false;
          }
        }
        // Text search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchDesc = p.description?.toLowerCase().includes(q) || false;
          const matchLead = p.managerName?.toLowerCase().includes(q) || false;
          if (!matchName && !matchDesc && !matchLead) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'priority') {
          const weight: Record<PriorityLevel, number> = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1,
          };
          return (weight[b.priority] || 0) - (weight[a.priority] || 0);
        }
        if (sortBy === 'progress') {
          const aEffort = a.totalHours || 1;
          const bEffort = b.totalHours || 1;
          const aPct = (a.completedHours || 0) / aEffort;
          const bPct = (b.completedHours || 0) / bEffort;
          return bPct - aPct;
        }
        // Default: deadline (earliest target completion first)
        if (!a.targetEndDate) return 1;
        if (!b.targetEndDate) return -1;
        return new Date(a.targetEndDate).getTime() - new Date(b.targetEndDate).getTime();
      });
  }, [projects, selectedStatus, selectedPriority, selectedManager, searchQuery, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedStatus !== 'all' ||
    selectedPriority !== 'all' ||
    selectedManager !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedManager('all');
  };

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

    const chosenManagerId = selectedManagerId.trim() || null;
    const chosenManager = eligibleManagers.find(
      (m: any) => (m.userId || m.id) === chosenManagerId
    );

    if (isLive) {
      const res = await createProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
        priority,
        status,
        startDate: startDate || undefined,
        targetEndDate: targetEndDate || undefined,
        managerId: chosenManagerId,
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
        managerId: chosenManagerId || '',
        managerName: chosenManager ? chosenManager.fullName : (chosenManagerId ? 'Assigned Manager' : 'Unassigned'),
        memberIds: selectedMemberIds,
        totalHours: parseFloat(totalHours) || 160,
      });
      setSubmitting(false);
    }

    setIsCreateModalOpen(false);
    setProjectName('');
    setProjectDesc('');
    setSelectedManagerId('');
    setSelectedMemberIds([]);
    setFormError(null);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Portfolio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-wf-text-primary">
              Project Portfolio
            </h1>
            <Badge variant="burgundy" size="sm" className="font-medium">
              {portfolioMetrics.inProgress} In Flight • {portfolioMetrics.total} Total
            </Badge>
            <Badge variant={isLive ? 'success' : 'slate'} size="sm" className="text-[10px]">
              {isLive ? 'Live PostgreSQL' : 'Demo Workspace'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-wf-text-secondary mt-1 max-w-2xl leading-relaxed">
            Portfolio initiatives, allocated resource capacity, and milestone delivery progress across active engineering streams.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-wf-border-default bg-wf-surface-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid layout"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors',
                viewMode === 'grid'
                  ? 'bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream font-semibold shadow-xs'
                  : 'text-wf-text-secondary hover:text-wf-text-primary'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Table roster layout"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors',
                viewMode === 'table'
                  ? 'bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream font-semibold shadow-xs'
                  : 'text-wf-text-secondary hover:text-wf-text-primary'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {/* Role-Governed Create Project Action */}
          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setFormError(null);
                setIsCreateModalOpen(true);
              }}
              className="shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Portfolio Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Portfolio Initiatives"
          value={portfolioMetrics.total}
          subtitle="Active workspace scope"
          icon={<FolderKanban className="h-4 w-4 text-wf-text-muted" />}
          badgeText="Portfolio"
          badgeVariant="slate"
        />

        <MetricCard
          title="In Active Delivery"
          value={portfolioMetrics.inProgress}
          subtitle={`${portfolioMetrics.inProgressPct}% of portfolio in delivery`}
          progress={{ value: portfolioMetrics.inProgressPct, colorScheme: 'burgundy' }}
          icon={<Clock className="h-4 w-4 text-wf-text-muted" />}
          badgeText={portfolioMetrics.inProgress > 0 ? 'In Flight' : 'None'}
          badgeVariant="burgundy"
        />

        <MetricCard
          title="Planning & Scoping"
          value={portfolioMetrics.planning}
          subtitle="Upcoming strategic initiatives"
          icon={<Calendar className="h-4 w-4 text-wf-text-muted" />}
          badgeText="Queued"
          badgeVariant="sage"
        />

        <MetricCard
          title="Completed & Delivered"
          value={portfolioMetrics.completed}
          subtitle={`${portfolioMetrics.completedHoursSum}h tracked delivered effort`}
          icon={<CheckCircle2 className="h-4 w-4 text-wf-text-muted" />}
          badgeText={portfolioMetrics.completed > 0 ? 'Delivered' : 'Zero'}
          badgeVariant="success"
        />
      </div>

      {/* Error Banner */}
      {isLive && projectsError && (
        <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-4 text-xs text-wf-semantic-danger flex items-center justify-between shadow-card">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{projectsError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetchProjects()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {/* Search & Combined Filter Bar */}
      <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-4 sm:p-5 shadow-card space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-wf-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search initiatives, scope, or leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle pl-10 pr-4 py-2 text-xs sm:text-sm text-wf-text-primary placeholder:text-wf-text-muted focus:border-wf-border-focus focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-text-muted hover:text-wf-text-primary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs sm:text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="planning">Planning</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs sm:text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Manager / Lead Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs sm:text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
            >
              <option value="all">All Project Leads</option>
              {distinctProjectManagers.map((mgr) => (
                <option key={mgr.id} value={mgr.id}>
                  {mgr.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="lg:col-span-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs sm:text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors appearance-none pr-8"
              >
                <option value="deadline">Sort: Deadline</option>
                <option value="priority">Sort: Priority</option>
                <option value="progress">Sort: Progress</option>
                <option value="name">Sort: Name (A-Z)</option>
              </select>
              <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-wf-text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Active Filter Chips Row */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-wf-border-default text-xs">
            <span className="text-[11px] font-semibold text-wf-text-muted uppercase tracking-wider">
              Filters:
            </span>

            {searchQuery.trim() && (
              <Badge variant="slate" size="sm" className="flex items-center gap-1">
                <span>&ldquo;{searchQuery}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-wf-text-primary ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {selectedStatus !== 'all' && (
              <Badge variant="slate" size="sm" className="flex items-center gap-1">
                <span>Status: {selectedStatus.replace('_', ' ')}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('all')}
                  className="hover:text-wf-text-primary ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {selectedPriority !== 'all' && (
              <Badge variant="slate" size="sm" className="flex items-center gap-1">
                <span>Priority: {selectedPriority}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPriority('all')}
                  className="hover:text-wf-text-primary ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            {selectedManager !== 'all' && (
              <Badge variant="slate" size="sm" className="flex items-center gap-1">
                <span>
                  Lead: {distinctProjectManagers.find((m) => m.id === selectedManager)?.name || selectedManager}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedManager('all')}
                  className="hover:text-wf-text-primary ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-medium text-wf-brand-burgundy dark:text-wf-cream hover:underline ml-1"
            >
              Clear all
            </button>

            <span className="text-[11px] text-wf-text-muted ml-auto font-mono">
              Showing {filteredProjects.length} of {projects.length}
            </span>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLive && isProjectsLoading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-wf-border-default bg-wf-surface-card p-6 animate-pulse space-y-4 shadow-card"
            >
              <div className="h-5 w-48 bg-wf-surface-subtle rounded-xl" />
              <div className="h-4 w-full bg-wf-surface-subtle rounded-xl" />
              <div className="h-4 w-3/4 bg-wf-surface-subtle rounded-xl" />
              <div className="h-8 w-full bg-wf-surface-subtle rounded-xl mt-6" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isProjectsLoading && filteredProjects.length === 0 && (
        <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-12 text-center space-y-4 shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wf-surface-subtle border border-wf-border-default text-wf-text-muted">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-wf-text-primary">
              {hasActiveFilters ? 'No Matching Projects Found' : 'No Projects in Workspace'}
            </h3>
            <p className="text-xs text-wf-text-secondary max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? 'No project portfolio initiatives match your active filter criteria. Try adjusting your search term, priority, or status filters.'
                : isManagerOrAdmin
                ? 'No project portfolio initiatives have been authored yet. Launch your first delivery stream using the action below.'
                : 'There are currently no active projects assigned to your team in this organization.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2">
            {hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                <span>Reset All Filters</span>
              </Button>
            ) : isManagerOrAdmin ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setFormError(null);
                  setIsCreateModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                <span>Launch New Project</span>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Projects Grid View */}
      {!isProjectsLoading && filteredProjects.length > 0 && viewMode === 'grid' && (
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
                className="flex flex-col justify-between border-wf-border-default hover:border-wf-border-focus/50 transition-all hover:shadow-elevated group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream border border-wf-border-default shrink-0">
                          <FolderKanban className="h-3.5 w-3.5" />
                        </div>
                        <Link
                          href={`/projects/${proj.id}`}
                          className="text-base font-bold text-wf-text-primary group-hover:text-wf-brand-burgundy dark:group-hover:text-wf-cream transition-colors truncate"
                        >
                          {proj.name}
                        </Link>
                      </div>
                      <p className="text-xs text-wf-text-secondary line-clamp-2 leading-relaxed">
                        {proj.description || 'Strategic workforce initiative driving core organizational delivery.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant={
                          proj.priority === 'critical'
                            ? 'danger'
                            : proj.priority === 'high'
                            ? 'warning'
                            : 'slate'
                        }
                        size="sm"
                        className="capitalize"
                      >
                        {proj.priority}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  {/* Progress Bar & Milestone Completion */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-wf-text-secondary">Milestone Progress</span>
                      <span className="text-wf-text-primary font-bold">
                        {completedHours}h / {totalEffortHours}h ({progressPct}%)
                      </span>
                    </div>
                    <ProgressBar
                      value={progressPct}
                      colorScheme={progressPct >= 100 ? 'emerald' : 'auto'}
                    />
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs text-wf-text-secondary rounded-xl bg-wf-surface-subtle p-3 border border-wf-border-default">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-wf-text-muted uppercase tracking-wider font-semibold block">
                        Target Deadline
                      </span>
                      <span className="text-wf-text-primary font-mono font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-wf-text-muted" />
                        {proj.targetEndDate || 'Unscheduled'}
                      </span>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[11px] text-wf-text-muted uppercase tracking-wider font-semibold block">
                        Project Lead
                      </span>
                      <span className="text-wf-text-primary font-medium truncate block">
                        {proj.managerName || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {/* Team Members & Tasks Count */}
                  <div className="flex items-center justify-between pt-0.5 text-xs text-wf-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-wf-text-muted" />
                      <span>{proj.memberIds.length} team member{proj.memberIds.length !== 1 ? 's' : ''}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <CheckSquare className="h-3.5 w-3.5 text-wf-text-muted" />
                      <span>{projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardContent>

                {/* Footer Actions */}
                <div className="border-t border-wf-border-default bg-wf-surface-subtle p-3 px-5 flex flex-wrap items-center justify-between gap-2 rounded-b-2xl">
                  <Badge
                    variant={
                      proj.status === 'in_progress'
                        ? 'burgundy'
                        : proj.status === 'completed'
                        ? 'success'
                        : proj.status === 'planning'
                        ? 'sage'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {proj.status.replace('_', ' ').toUpperCase()}
                  </Badge>

                  <div className="flex items-center gap-2">
                    {isManagerOrAdmin && isLive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAssignModal(proj.id)}
                        className="text-xs"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        <span>Assign</span>
                      </Button>
                    )}
                    <Link href={`/projects/${proj.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Projects Table View */}
      {!isProjectsLoading && filteredProjects.length > 0 && viewMode === 'table' && (
        <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-wf-border-default bg-wf-surface-subtle text-[11px] font-semibold text-wf-text-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Initiative Name &amp; Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Project Lead</th>
                  <th className="py-3 px-4 min-w-[180px]">Delivery Progress</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wf-border-default text-wf-text-secondary">
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
                    <tr
                      key={proj.id}
                      className="hover:bg-wf-surface-subtle transition-colors group"
                    >
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          href={`/projects/${proj.id}`}
                          className="font-bold text-wf-text-primary group-hover:text-wf-brand-burgundy dark:group-hover:text-wf-cream transition-colors block truncate text-sm"
                        >
                          {proj.name}
                        </Link>
                        <p className="text-[11px] text-wf-text-muted line-clamp-1 mt-0.5">
                          {proj.description || 'Strategic workforce initiative'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            proj.status === 'in_progress'
                              ? 'burgundy'
                              : proj.status === 'completed'
                              ? 'success'
                              : proj.status === 'planning'
                              ? 'sage'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {proj.status.replace('_', ' ')}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            proj.priority === 'critical'
                              ? 'danger'
                              : proj.priority === 'high'
                              ? 'warning'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {proj.priority}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-wf-text-primary font-medium">
                        {proj.managerName || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono">
                            <span className="text-wf-text-primary font-semibold">{progressPct}%</span>
                            <span className="text-wf-text-muted">{completedHours}h / {totalEffortHours}h</span>
                          </div>
                          <ProgressBar value={progressPct} colorScheme={progressPct >= 100 ? 'emerald' : 'auto'} />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-wf-text-primary">
                        {proj.targetEndDate || 'Unscheduled'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isManagerOrAdmin && isLive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenAssignModal(proj.id)}
                              className="text-xs"
                            >
                              Assign
                            </Button>
                          )}
                          <Link href={`/projects/${proj.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              <span>View</span>
                              <ChevronRight className="h-3 w-3 ml-0.5" />
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
        </div>
      )}

      {/* Create Project Dialog Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project Initiative"
        description="Author a new project portfolio initiative for your organization workspace."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 py-2">
          {formError && (
            <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Project Name *"
            placeholder="e.g. Edge Ingestion Pipeline v3"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Project Description &amp; Scope
            </label>
            <textarea
              rows={3}
              placeholder="Outline project deliverables, core architectural components, and milestones..."
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card p-3 text-sm text-wf-text-primary placeholder:text-wf-text-muted focus:border-wf-border-focus focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Project Lead (Manager or Admin Role Required)
            </label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
            >
              <option value="">-- Select a Project Manager (Manager/Admin Required) --</option>
              {eligibleManagers.map((m: any) => (
                <option key={m.userId || m.id} value={m.userId || m.id}>
                  {m.fullName} ({m.role.toUpperCase()} • {m.department || 'Engineering'})
                </option>
              ))}
            </select>
            {eligibleManagers.length === 0 && (
              <p className="text-[11px] text-wf-semantic-warning">
                Notice: No members with Manager role exist in this organization. You can assign a Manager under Employee Management.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              >
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              >
                <option value="in_progress">In Progress</option>
                <option value="planning">Planning</option>
              </select>
            </div>

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
          <div className="space-y-2 pt-1 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Allocate Team Members ({selectedMemberIds.length} Selected)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-wf-border-default bg-wf-surface-subtle p-2.5">
              {selectableMembers.map((emp) => {
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={() => toggleMemberSelection(emp.id)}
                    className={cn(
                      'flex items-center justify-between rounded-xl p-2.5 text-left text-xs transition-colors border',
                      isSelected
                        ? 'border-wf-brand-burgundy/40 bg-wf-brand-burgundy/10 text-wf-text-primary shadow-xs'
                        : 'border-wf-border-default bg-wf-surface-card text-wf-text-secondary hover:text-wf-text-primary'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-wf-surface-subtle text-[10px] font-bold text-wf-text-primary border border-wf-border-default shrink-0">
                        {emp.fullName
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-wf-text-primary truncate">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] text-wf-text-muted truncate">
                          {emp.department} • {emp.currentLoadHours}h load
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-default">
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
            <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{assignError}</span>
            </div>
          )}

          {assignSuccess && (
            <div className="rounded-xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3 text-xs text-wf-semantic-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{assignSuccess}</span>
            </div>
          )}

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Select Active Member *
            </label>
            {orgMembers.length === 0 ? (
              <p className="text-xs text-wf-semantic-warning">No active members found in organization.</p>
            ) : (
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
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
            <div className="space-y-2 pt-2 border-t border-wf-border-default text-left">
              <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
                Optionally Assign Open Tasks from this Project:
              </label>
              {tasks.filter((t) => t.projectId === targetProjectId && !t.assignedTo).length === 0 ? (
                <p className="text-[11px] text-wf-text-muted italic">
                  No unassigned tasks found for this project.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-2.5">
                  {tasks
                    .filter((t) => t.projectId === targetProjectId && !t.assignedTo)
                    .map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-xs text-wf-text-secondary hover:text-wf-text-primary cursor-pointer p-1 rounded-lg hover:bg-wf-surface-card"
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
                          className="rounded border-wf-border-default bg-wf-surface-card text-wf-brand-burgundy focus:ring-wf-border-focus"
                        />
                        <span className="truncate">{t.title}</span>
                        <span className="text-[10px] text-wf-text-muted font-mono ml-auto shrink-0">
                          {t.estimatedHours}h
                        </span>
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-default">
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
