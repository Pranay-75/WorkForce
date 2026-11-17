'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useMockStore } from '@/lib/mockStore';
import {
  calculateEmployeeWorkload,
  computeDeterministicRedistributionProposals,
  isTaskActive,
  isTaskOverdue,
} from '@/lib/workloadEngine';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  BarChart3,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckSquare,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

export default function WorkloadCapacityPage() {
  const { isAuthenticated, user, organization, role: authRole } = useAuth();
  const isLive = Boolean(isAuthenticated && organization?.id);

  // Live hooks
  const {
    members: liveMembers,
    isLoading: isMembersLoading,
    refetch: refetchMembers,
  } = useOrganizationMembers();

  const {
    tasks: liveTasks,
    isLoading: isTasksLoading,
    assignTask: dbAssignTask,
    updateTaskDetails: dbUpdateTaskDetails,
    updateTaskStatus: dbUpdateTaskStatus,
    refetch: refetchTasks,
  } = useTasks();

  const { projects: liveProjects } = useProjects();

  // Mock store fallback for unauthenticated showcase
  const {
    employees: mockEmployees,
    projects: mockProjects,
    tasks: mockTasks,
    redistributionProposals: mockProposals,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateTaskDetails: mockUpdateTaskDetails,
    updateTaskStatus: mockUpdateTaskStatus,
    applyRedistribution: mockApplyRedistribution,
  } = useMockStore();

  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin' || activeRole === 'organizer';

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'overloaded' | 'near_limit' | 'optimal'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'util_desc' | 'util_asc' | 'hours_desc' | 'name_asc'>('util_desc');
  const [expandedEmpId, setExpandedEmpId] = React.useState<string | null>(null);

  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const tasks = isLive ? liveTasks : mockTasks;
  const projects = isLive ? liveProjects : mockProjects;

  // Reconcile employees list with live assigned tasks using shared workload engine
  const employees = React.useMemo(() => {
    if (isLive) {
      return liveMembers.map((m) => {
        const metrics = calculateEmployeeWorkload(
          { id: m.userId, weeklyCapacityHours: m.weeklyCapacityHours },
          tasks
        );

        return {
          id: m.userId,
          fullName: m.fullName,
          email: m.email,
          jobTitle: m.jobTitle || 'Team Member',
          department: m.department || 'Engineering',
          weeklyCapacityHours: metrics.weeklyCapacityHours,
          currentLoadHours: metrics.activeAssignedHours,
          activeTaskCount: metrics.activeTaskCount,
          overdueTaskCount: metrics.overdueTaskCount,
          capacityBand: metrics.capacityBand,
        };
      });
    }
    return mockEmployees.map((e) => {
      const metrics = calculateEmployeeWorkload(
        { id: e.id, weeklyCapacityHours: e.weeklyCapacityHours },
        tasks
      );
      return {
        id: e.id,
        fullName: e.fullName,
        email: e.email,
        jobTitle: e.jobTitle,
        department: e.department,
        weeklyCapacityHours: metrics.weeklyCapacityHours,
        currentLoadHours: metrics.activeAssignedHours,
        activeTaskCount: metrics.activeTaskCount,
        overdueTaskCount: metrics.overdueTaskCount,
        capacityBand: metrics.capacityBand,
      };
    });
  }, [isLive, liveMembers, tasks, mockEmployees]);

  // Capacity Bands
  const overloadedStaff = employees.filter((e) => e.capacityBand === 'overallocated');
  const nearLimitStaff = employees.filter((e) => e.capacityBand === 'near_limit');
  const optimalStaff = employees.filter((e) => e.capacityBand === 'optimal' || e.capacityBand === 'underutilized');

  // Extract distinct departments
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Dynamic Redistribution Proposals using shared workload engine
  const dynamicProposals = React.useMemo(() => {
    const computed = computeDeterministicRedistributionProposals(employees as any, tasks, projects);
    if (computed.length > 0) return computed;
    if (!isLive && mockProposals.length > 0) return mockProposals;
    return computed;
  }, [isLive, mockProposals, employees, tasks, projects]);

  // Filter and sort roster
  const filteredEmployees = React.useMemo(() => {
    return employees
      .filter((emp) => {
        const util = emp.weeklyCapacityHours > 0 ? emp.currentLoadHours / emp.weeklyCapacityHours : 0;

        const matchesSearch =
          emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.department.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesStatus = true;
        if (statusFilter === 'overloaded') matchesStatus = util > 1.0;
        if (statusFilter === 'near_limit') matchesStatus = util >= 0.8 && util <= 1.0;
        if (statusFilter === 'optimal') matchesStatus = util < 0.8;

        const matchesDept = departmentFilter === 'all' || emp.department === departmentFilter;

        return matchesSearch && matchesStatus && matchesDept;
      })
      .sort((a, b) => {
        const utilA = a.weeklyCapacityHours > 0 ? a.currentLoadHours / a.weeklyCapacityHours : 0;
        const utilB = b.weeklyCapacityHours > 0 ? b.currentLoadHours / b.weeklyCapacityHours : 0;

        if (sortBy === 'util_desc') return utilB - utilA;
        if (sortBy === 'util_asc') return utilA - utilB;
        if (sortBy === 'hours_desc') return b.currentLoadHours - a.currentLoadHours;
        if (sortBy === 'name_asc') return a.fullName.localeCompare(b.fullName);
        return 0;
      });
  }, [employees, searchQuery, statusFilter, departmentFilter, sortBy]);

  if (activeRole === 'employee') {
    return (
      <AccessDenied
        resourceName="Team Workload & Capacity Monitor"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="Organization-wide workload heatmaps, capacity thresholds, and AI redistribution proposals are restricted to management and HR."
      />
    );
  }

  const toggleExpand = (empId: string) => {
    setExpandedEmpId((prev) => (prev === empId ? null : empId));
  };

  const handleAdjustTaskHours = async (taskId: string, currentHours: number, delta: number) => {
    const newHours = Math.max(1, currentHours + delta);
    setActionLoading(true);
    setActionMessage(null);

    if (isLive) {
      const res = await dbUpdateTaskDetails(taskId, { estimatedHours: newHours });
      setActionLoading(false);
      if (res.error) {
        setActionMessage({ text: res.error, type: 'error' });
      } else {
        setActionMessage({ text: `Task hours updated to ${newHours}h.`, type: 'success' });
      }
    } else {
      mockUpdateTaskDetails(taskId, { estimatedHours: newHours });
      setActionLoading(false);
      setActionMessage({ text: `Task hours updated to ${newHours}h (Demo).`, type: 'success' });
    }
  };

  const handleReassignTask = async (taskId: string, targetEmpId: string) => {
    setActionLoading(true);
    setActionMessage(null);

    const assignee = targetEmpId === 'unassigned' ? null : targetEmpId;

    if (isLive) {
      const res = await dbAssignTask(taskId, assignee);
      setActionLoading(false);
      if (res.error) {
        setActionMessage({ text: res.error, type: 'error' });
      } else {
        setActionMessage({ text: 'Task reassigned successfully.', type: 'success' });
      }
    } else {
      mockUpdateTaskDetails(taskId, {
        assignedTo: targetEmpId === 'unassigned' ? undefined : targetEmpId,
      });
      setActionLoading(false);
      setActionMessage({ text: 'Task reassigned (Demo).', type: 'success' });
    }
  };

  const handleApplyTransfer = async (taskId: string, targetEmpId: string) => {
    await handleReassignTask(taskId, targetEmpId);
  };

  const handleCompleteTask = async (taskId: string) => {
    if (isLive) {
      await dbUpdateTaskStatus(taskId, 'completed');
    } else {
      mockUpdateTaskStatus(taskId, 'completed');
    }
  };

  if (isLive && (isMembersLoading || isTasksLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-wf-brand-burgundy dark:text-wf-cream" />
        <p className="text-sm text-wf-text-secondary">Loading live organization telemetry &amp; workload allocations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wf-border-default pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-wf-text-primary">
              Capacity Monitor &amp; Workload Balancing
            </h2>
            <Badge variant="cyan" size="sm">
              {isLive ? 'PostgreSQL Live Telemetry' : 'Demo Telemetry'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-wf-text-secondary mt-1">
            Deterministic capacity tracking, live bottleneck diagnostics, and interactive sprint rebalancing
          </p>
        </div>

        {isLive && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              refetchMembers();
              refetchTasks();
            }}
            disabled={isMembersLoading || isTasksLoading || actionLoading}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isMembersLoading || isTasksLoading ? 'animate-spin' : ''}`} />
            <span>Recalculate Workload</span>
          </Button>
        )}
      </div>

      {actionMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-xs ${
            actionMessage.type === 'success'
              ? 'border border-wf-semantic-success-border bg-wf-semantic-success-bg text-wf-semantic-success'
              : 'border border-wf-semantic-danger-border bg-wf-semantic-danger-bg text-wf-semantic-danger'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Summary Band Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          onClick={() => setStatusFilter(statusFilter === 'overloaded' ? 'all' : 'overloaded')}
          className={`cursor-pointer transition-all border border-wf-semantic-danger-border bg-wf-semantic-danger-bg/40 hover:border-wf-semantic-danger ${
            statusFilter === 'overloaded' ? 'ring-2 ring-wf-semantic-danger' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-wf-semantic-danger">
                Over-Allocated (&gt;100%)
              </span>
              <div className="text-2xl font-bold font-mono text-wf-semantic-danger mt-0.5">
                {overloadedStaff.length} Member{overloadedStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-wf-semantic-danger/80 mt-1 block">
                {statusFilter === 'overloaded' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <AlertTriangle className="h-8 w-8 text-wf-semantic-danger opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === 'near_limit' ? 'all' : 'near_limit')}
          className={`cursor-pointer transition-all border border-wf-semantic-warning-border bg-wf-semantic-warning-bg/40 hover:border-wf-semantic-warning ${
            statusFilter === 'near_limit' ? 'ring-2 ring-wf-semantic-warning' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-wf-semantic-warning">
                Near Limit (80–99%)
              </span>
              <div className="text-2xl font-bold font-mono text-wf-semantic-warning mt-0.5">
                {nearLimitStaff.length} Member{nearLimitStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-wf-semantic-warning/80 mt-1 block">
                {statusFilter === 'near_limit' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <BarChart3 className="h-8 w-8 text-wf-semantic-warning opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === 'optimal' ? 'all' : 'optimal')}
          className={`cursor-pointer transition-all border border-wf-semantic-success-border bg-wf-semantic-success-bg/40 hover:border-wf-semantic-success ${
            statusFilter === 'optimal' ? 'ring-2 ring-wf-semantic-success' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-wf-semantic-success">
                Optimal / Available (&lt;80%)
              </span>
              <div className="text-2xl font-bold font-mono text-wf-semantic-success mt-0.5">
                {optimalStaff.length} Member{optimalStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-wf-semantic-success/80 mt-1 block">
                {statusFilter === 'optimal' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <CheckCircle2 className="h-8 w-8 text-wf-semantic-success opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Interactive Workload Redistribution Sandbox */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />
              <h3 className="text-lg font-bold text-wf-text-primary tracking-tight">
                Workload Redistribution Sandbox
              </h3>
            </div>
            <p className="text-xs text-wf-text-secondary">
              Proactive task transfer proposals to resolve capacity bottlenecks
            </p>
          </div>

          <Badge variant="violet" size="sm">
            {dynamicProposals.length} Proposed Transfer{dynamicProposals.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {dynamicProposals.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {dynamicProposals.map((prop) => {
              const sourceEmp = employees.find((e) => e.id === prop.sourceEmployeeId);
              const targetEmp = employees.find((e) => e.id === prop.targetEmployeeId);

              const sourceCap = sourceEmp?.weeklyCapacityHours || 40;
              const targetCap = targetEmp?.weeklyCapacityHours || 40;

              const sourceBeforePct = Math.round((prop.sourceCurrentLoad / sourceCap) * 100);
              const sourceAfterPct = Math.round((prop.sourceProjectedLoad / sourceCap) * 100);

              const targetBeforePct = Math.round((prop.targetCurrentLoad / targetCap) * 100);
              const targetAfterPct = Math.round((prop.targetProjectedLoad / targetCap) * 100);

              return (
                <Card
                  key={prop.id}
                  className="border-wf-border-default bg-wf-surface-card p-5 shadow-card"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-wf-border-subtle">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold font-mono text-wf-brand-burgundy dark:text-wf-cream">
                          Task Transfer Candidate
                        </span>
                        <h4 className="text-base font-bold text-wf-text-primary">
                          {prop.taskTitle} ({prop.taskHours}h)
                        </h4>
                      </div>
                      <Badge variant={sourceBeforePct > 100 ? 'rose' : 'amber'} size="sm">
                        {sourceBeforePct > 100 ? 'Overload Risk Mitigation' : 'Capacity Load Smoothing'}
                      </Badge>
                    </div>

                    {/* Redistribution Comparison Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source Employee */}
                      <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-wf-semantic-danger">
                            Source: {prop.sourceEmployeeName}
                          </span>
                          <Badge variant="rose" size="sm">
                            Relieving -{prop.taskHours}h ({sourceBeforePct - sourceAfterPct}%)
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between text-wf-semantic-danger">
                            <span>Before: {prop.sourceCurrentLoad}h ({sourceBeforePct}%)</span>
                            <span className="font-bold">
                              After: {prop.sourceProjectedLoad}h ({sourceAfterPct}%)
                            </span>
                          </div>
                          <ProgressBar value={sourceAfterPct} />
                        </div>
                      </div>

                      {/* Target Employee */}
                      <div className="rounded-xl border border-wf-semantic-success-border bg-wf-semantic-success-bg/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-wf-semantic-success">
                            Target: {prop.targetEmployeeName}
                          </span>
                          <Badge variant="emerald" size="sm">
                            Absorbing +{prop.taskHours}h ({targetAfterPct - targetBeforePct}%)
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between text-wf-semantic-success">
                            <span>Before: {prop.targetCurrentLoad}h ({targetBeforePct}%)</span>
                            <span className="font-bold">
                              After: {prop.targetProjectedLoad}h ({targetAfterPct}%)
                            </span>
                          </div>
                          <ProgressBar value={targetAfterPct} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-wf-text-secondary italic">
                        {prop.rationale}
                      </p>
                      {isManagerOrAdmin && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApplyTransfer(prop.taskId, prop.targetEmployeeId)}
                          disabled={actionLoading}
                          className="shrink-0"
                        >
                          <span>Apply Reassignment</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : overloadedStaff.length > 0 ? (
          <div className="rounded-2xl border border-wf-semantic-warning-border bg-wf-semantic-warning-bg/40 p-6 text-center text-wf-text-primary space-y-3">
            <AlertTriangle className="mx-auto h-8 w-8 text-wf-semantic-warning" />
            <h4 className="text-base font-bold text-wf-text-primary">
              Overload Detected — Automated Reallocation Constrained
            </h4>
            <p className="text-xs text-wf-semantic-warning max-w-lg mx-auto">
              {overloadedStaff.length} team member{overloadedStaff.length > 1 ? 's are' : ' is'} currently overallocated ({overloadedStaff.map(e => `${e.fullName}: ${e.currentLoadHours}h/${e.weeklyCapacityHours}h`).join(', ')}), but automated 1-to-1 task redistribution cannot safely transfer individual deliverables without pushing other team members past 100% capacity.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1 text-xs">
              <span className="rounded-xl bg-wf-surface-card border border-wf-border-default px-3 py-1 text-wf-text-secondary">
                Action: Break down large deliverables into smaller sub-tasks or expand team capacity.
              </span>
            </div>
          </div>
        ) : nearLimitStaff.length > 0 ? (
          <div className="rounded-2xl border border-wf-border-default bg-wf-surface-subtle/50 p-6 text-center text-wf-text-secondary space-y-2">
            <Clock className="mx-auto h-7 w-7 text-wf-brand-burgundy dark:text-wf-cream mb-1" />
            <h4 className="text-sm font-bold text-wf-text-primary">Safe Operating Range</h4>
            <p className="text-xs text-wf-text-secondary max-w-md mx-auto">
              {nearLimitStaff.length} team member{nearLimitStaff.length > 1 ? 's are' : ' is'} operating near capacity limit (80-100%), and no immediate transfers are required.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-wf-border-default bg-wf-surface-subtle/50 p-8 text-center text-wf-text-secondary space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-wf-semantic-success mb-1" />
            <h4 className="text-sm font-bold text-wf-text-primary">No Capacity Bottlenecks Detected</h4>
            <p className="text-xs text-wf-text-secondary max-w-md mx-auto">
              All active team members are currently operating within safe weekly thresholds.
            </p>
          </div>
        )}
      </div>

      {/* Team Roster Capacity Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Team Member Workload Roster</CardTitle>
              <CardDescription>
                Detailed breakdown of assigned commitments, estimated hours, and available bandwidth
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-wf-text-tertiary" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 pl-8 text-xs text-wf-text-primary placeholder:text-wf-text-tertiary focus:border-wf-border-focus focus:outline-none w-44 transition-colors"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 text-xs text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              >
                <option value="all">All Statuses ({employees.length})</option>
                <option value="overloaded">Overloaded &gt;100% ({overloadedStaff.length})</option>
                <option value="near_limit">Near Limit 80-99% ({nearLimitStaff.length})</option>
                <option value="optimal">Optimal &lt;80% ({optimalStaff.length})</option>
              </select>

              {/* Department Filter */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 text-xs text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 text-xs text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              >
                <option value="util_desc">Highest Utilization %</option>
                <option value="util_asc">Lowest Utilization %</option>
                <option value="hours_desc">Most Allocated Hours</option>
                <option value="name_asc">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {filteredEmployees.map((emp) => {
              const util = emp.weeklyCapacityHours > 0
                ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100)
                : 0;

              const isOverloaded = util > 100;
              const isNearLimit = util >= 80 && util <= 100;
              const isOptimal = util < 80;
              const isExpanded = expandedEmpId === emp.id;

              const empTasks = tasks.filter(
                (t) => t.assignedTo === emp.id && t.status !== 'completed'
              );
              const bufferHours = emp.weeklyCapacityHours - emp.currentLoadHours;

              const initials = emp.fullName
                .split(' ')
                .filter(Boolean)
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'EM';

              return (
                <div
                  key={emp.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? 'border-wf-border-strong bg-wf-surface-subtle shadow-md'
                      : 'border-wf-border-default bg-wf-surface-card hover:border-wf-border-strong shadow-card'
                  }`}
                >
                  {/* Summary Bar */}
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Employee Identity */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wf-brand-burgundy text-xs font-bold text-white shadow-sm">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="text-sm font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate"
                          >
                            {emp.fullName}
                          </Link>
                          {emp.id === currentUserId && (
                            <span className="text-[10px] font-mono font-bold text-wf-brand-burgundy dark:text-wf-cream bg-wf-brand-burgundy/15 border border-wf-brand-burgundy/30 px-1.5 py-0.2 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-wf-text-secondary block truncate">
                          {emp.jobTitle} • {emp.department}
                        </span>
                      </div>
                    </div>

                    {/* Progress & Live Calculated Numbers */}
                    <div className="flex-1 max-w-lg space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-wf-text-secondary">Allocated:</span>
                          <span
                            className={
                              isOverloaded
                                ? 'text-wf-semantic-danger font-bold'
                                : isNearLimit
                                ? 'text-wf-semantic-warning font-semibold'
                                : 'text-wf-text-primary'
                            }
                          >
                            {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({util}%)
                          </span>
                        </div>

                        {/* Buffer / Deficit Indicator */}
                        <div>
                          {isOverloaded ? (
                            <span className="text-wf-semantic-danger font-bold text-[11px]">
                              +{Math.abs(bufferHours)}h over capacity
                            </span>
                          ) : (
                            <span className="text-wf-semantic-success font-medium text-[11px]">
                              {bufferHours}h buffer left
                            </span>
                          )}
                        </div>
                      </div>
                      <ProgressBar value={util} />
                    </div>

                    {/* Capacity Limits & Inspect Toggle */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
                      <Badge
                        variant={
                          isOverloaded
                            ? 'rose'
                            : isNearLimit
                            ? 'amber'
                            : 'emerald'
                        }
                        size="sm"
                      >
                        {isOverloaded
                          ? 'Overloaded'
                          : isNearLimit
                          ? 'Near Limit'
                          : 'Optimal'}
                      </Badge>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleExpand(emp.id)}
                        className="text-xs flex items-center gap-1"
                      >
                        <span>{empTasks.length} Tasks</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Task List & Rebalancing Drawer */}
                  {isExpanded && (
                    <div className="border-t border-wf-border-subtle bg-wf-surface-subtle/50 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-wf-text-primary">
                          Active Assigned Tasks ({empTasks.length})
                        </h5>
                        <span className="text-[11px] text-wf-text-secondary">
                          Manager reassignments execute atomic database RPC transactions
                        </span>
                      </div>

                      {empTasks.length > 0 ? (
                        <div className="space-y-2">
                          {empTasks.map((t) => (
                            <div
                              key={t.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-wf-border-default bg-wf-surface-card p-3 shadow-sm"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className="text-xs font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream"
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
                                <span className="text-[11px] text-wf-text-secondary">
                                  {t.projectName} • Status: {t.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Hour Adjuster */}
                                {isManagerOrAdmin && (
                                  <div className="flex items-center gap-1 bg-wf-surface-subtle border border-wf-border-default rounded-xl p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustTaskHours(t.id, Number(t.estimatedHours) || 0, -1)}
                                      disabled={actionLoading || Number(t.estimatedHours) <= 1}
                                      className="p-1 text-wf-text-secondary hover:text-wf-text-primary disabled:opacity-30"
                                      title="Decrease estimated hours"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="font-mono text-xs font-bold text-wf-text-primary px-1">
                                      {t.estimatedHours}h
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustTaskHours(t.id, Number(t.estimatedHours) || 0, 1)}
                                      disabled={actionLoading}
                                      className="p-1 text-wf-text-secondary hover:text-wf-text-primary"
                                      title="Increase estimated hours"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}

                                {/* Reassign Dropdown */}
                                {isManagerOrAdmin && (
                                  <select
                                    value={t.assignedTo || 'unassigned'}
                                    onChange={(e) => handleReassignTask(t.id, e.target.value)}
                                    disabled={actionLoading}
                                    className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-2 py-1 text-xs text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
                                  >
                                    <option value="unassigned">Unassigned (Backlog)</option>
                                    {employees.map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        Reassign to: {opt.fullName} ({opt.currentLoadHours}h)
                                      </option>
                                    ))}
                                  </select>
                                )}

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
                        <div className="p-4 text-center text-xs text-wf-text-secondary">
                          No active tasks assigned to this member.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="p-8 text-center text-wf-text-secondary">
                <Users className="mx-auto h-8 w-8 text-wf-text-tertiary mb-2" />
                <p className="text-xs text-wf-text-secondary">No team members match current search or filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
