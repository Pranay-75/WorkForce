'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
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
    refetch: refetchTasks,
  } = useTasks();

  // Mock store fallback for unauthenticated showcase
  const {
    employees: mockEmployees,
    tasks: mockTasks,
    redistributionProposals: mockProposals,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateTaskDetails: mockUpdateTaskDetails,
    applyRedistribution: mockApplyRedistribution,
  } = useMockStore();

  const activeRole = isLive ? authRole : mockRole;
  const currentUserId = isLive ? (user?.id || '') : mockUserId;
  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin';

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'overloaded' | 'near_limit' | 'optimal'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'util_desc' | 'util_asc' | 'hours_desc' | 'name_asc'>('util_desc');
  const [expandedEmpId, setExpandedEmpId] = React.useState<string | null>(null);

  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reconcile employees list with live assigned tasks
  const employees = React.useMemo(() => {
    if (isLive) {
      return liveMembers.map((m) => {
        const assigned = liveTasks.filter((t) => t.assignedTo === m.userId && t.status !== 'completed');
        const loadHours = assigned.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
        const capacity = m.weeklyCapacityHours || 40;

        return {
          id: m.userId,
          fullName: m.fullName,
          email: m.email,
          jobTitle: m.jobTitle || 'Team Member',
          department: m.department || 'Engineering',
          weeklyCapacityHours: capacity,
          currentLoadHours: loadHours,
          activeTaskCount: assigned.length,
        };
      });
    }
    return mockEmployees.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      email: e.email,
      jobTitle: e.jobTitle,
      department: e.department,
      weeklyCapacityHours: e.weeklyCapacityHours,
      currentLoadHours: e.currentLoadHours,
      activeTaskCount: e.activeTaskCount,
    }));
  }, [isLive, liveMembers, liveTasks, mockEmployees]);

  const tasks = isLive ? liveTasks : mockTasks;

  // Capacity Bands
  const overloadedStaff = employees.filter(
    (e) => e.weeklyCapacityHours > 0 && e.currentLoadHours / e.weeklyCapacityHours > 1.0
  );
  const nearLimitStaff = employees.filter((e) => {
    const r = e.weeklyCapacityHours > 0 ? e.currentLoadHours / e.weeklyCapacityHours : 0;
    return r >= 0.8 && r <= 1.0;
  });
  const optimalStaff = employees.filter((e) => {
    const r = e.weeklyCapacityHours > 0 ? e.currentLoadHours / e.weeklyCapacityHours : 0;
    return r < 0.8;
  });

  // Extract distinct departments
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  // Dynamic Redistribution Proposals for real or mock data
  const dynamicProposals = React.useMemo(() => {
    if (!isLive) return mockProposals;

    const proposals: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      taskHours: number;
      sourceEmployeeId: string;
      sourceEmployeeName: string;
      sourceCurrentLoad: number;
      sourceProjectedLoad: number;
      targetEmployeeId: string;
      targetEmployeeName: string;
      targetCurrentLoad: number;
      targetProjectedLoad: number;
      rationale: string;
    }> = [];

    // For every overloaded member, propose moving a task to an available optimal member
    overloadedStaff.forEach((overEmp) => {
      const assigned = tasks.filter((t) => t.assignedTo === overEmp.id && t.status !== 'completed');
      if (assigned.length === 0) return;

      const candidateTask = assigned[0];
      const taskHours = Number(candidateTask.estimatedHours) || 0;

      // Find an optimal candidate
      const targetEmp = optimalStaff.find((opt) => opt.id !== overEmp.id);
      if (targetEmp) {
        proposals.push({
          id: `prop-${candidateTask.id}`,
          taskId: candidateTask.id,
          taskTitle: candidateTask.title,
          taskHours: taskHours,
          sourceEmployeeId: overEmp.id,
          sourceEmployeeName: overEmp.fullName,
          sourceCurrentLoad: overEmp.currentLoadHours,
          sourceProjectedLoad: Math.max(0, overEmp.currentLoadHours - taskHours),
          targetEmployeeId: targetEmp.id,
          targetEmployeeName: targetEmp.fullName,
          targetCurrentLoad: targetEmp.currentLoadHours,
          targetProjectedLoad: targetEmp.currentLoadHours + taskHours,
          rationale: `Relieves ${overEmp.fullName} (+${overEmp.currentLoadHours - overEmp.weeklyCapacityHours}h overload) by shifting "${candidateTask.title}" to ${targetEmp.fullName} who has capacity available.`,
        });
      }
    });

    return proposals;
  }, [isLive, mockProposals, overloadedStaff, optimalStaff, tasks]);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Capacity Monitor & Workload Balancing
            </h2>
            <Badge variant="cyan" size="sm">
              {isLive ? 'PostgreSQL Live Telemetry' : 'Demo Telemetry'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
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
              ? 'border border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              : 'border border-rose-500/40 bg-rose-950/30 text-rose-300'
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
          className={`cursor-pointer transition-all border-rose-500/30 bg-rose-950/20 hover:border-rose-500/60 ${
            statusFilter === 'overloaded' ? 'ring-2 ring-rose-500' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-rose-300">
                Over-Allocated (&gt;100%)
              </span>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-0.5">
                {overloadedStaff.length} Member{overloadedStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-rose-400/80 mt-1 block">
                {statusFilter === 'overloaded' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <AlertTriangle className="h-8 w-8 text-rose-400 opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === 'near_limit' ? 'all' : 'near_limit')}
          className={`cursor-pointer transition-all border-amber-500/30 bg-amber-950/20 hover:border-amber-500/60 ${
            statusFilter === 'near_limit' ? 'ring-2 ring-amber-500' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-amber-300">
                Near Limit (80–99%)
              </span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-0.5">
                {nearLimitStaff.length} Member{nearLimitStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-amber-400/80 mt-1 block">
                {statusFilter === 'near_limit' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <BarChart3 className="h-8 w-8 text-amber-400 opacity-80" />
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter(statusFilter === 'optimal' ? 'all' : 'optimal')}
          className={`cursor-pointer transition-all border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/60 ${
            statusFilter === 'optimal' ? 'ring-2 ring-emerald-500' : ''
          }`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-emerald-300">
                Optimal / Available (&lt;80%)
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                {optimalStaff.length} Member{optimalStaff.length !== 1 ? 's' : ''}
              </div>
              <span className="text-[10px] text-emerald-400/80 mt-1 block">
                {statusFilter === 'optimal' ? 'Active Filter • Click to clear' : 'Click to filter roster'}
              </span>
            </div>
            <CheckCircle2 className="h-8 w-8 text-emerald-400 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Interactive Workload Redistribution Sandbox */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">
                Workload Redistribution Sandbox
              </h3>
            </div>
            <p className="text-xs text-slate-400">
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
                  className="border-violet-500/40 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card"
                >
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold font-mono text-cyan-400">
                          Task Transfer Candidate
                        </span>
                        <h4 className="text-base font-bold text-white">
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
                      <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-300">
                            Source: {prop.sourceEmployeeName}
                          </span>
                          <Badge variant="rose" size="sm">
                            Relieving -{prop.taskHours}h ({sourceBeforePct - sourceAfterPct}%)
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>Before: {prop.sourceCurrentLoad}h ({sourceBeforePct}%)</span>
                            <span className="text-emerald-400 font-bold">
                              After: {prop.sourceProjectedLoad}h ({sourceAfterPct}%)
                            </span>
                          </div>
                          <ProgressBar value={sourceAfterPct} />
                        </div>
                      </div>

                      {/* Target Employee */}
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-300">
                            Target: {prop.targetEmployeeName}
                          </span>
                          <Badge variant="emerald" size="sm">
                            Absorbing +{prop.taskHours}h ({targetAfterPct - targetBeforePct}%)
                          </Badge>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>Before: {prop.targetCurrentLoad}h ({targetBeforePct}%)</span>
                            <span className="text-cyan-400 font-bold">
                              After: {prop.targetProjectedLoad}h ({targetAfterPct}%)
                            </span>
                          </div>
                          <ProgressBar value={targetAfterPct} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-slate-400 italic">
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
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-1" />
            <h4 className="text-sm font-bold text-white">No Capacity Bottlenecks Detected</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
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
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-navy-900 px-3 py-1.5 pl-8 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none w-44"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-lg border border-slate-700 bg-navy-900 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
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
                className="rounded-lg border border-slate-700 bg-navy-900 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
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
                className="rounded-lg border border-slate-700 bg-navy-900 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
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
                      ? 'border-violet-500/60 bg-navy-900/90 shadow-lg'
                      : 'border-slate-800/80 bg-navy-900/50 hover:border-slate-700'
                  }`}
                >
                  {/* Summary Bar */}
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Employee Identity */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-800 text-xs font-bold text-white shadow-sm">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="text-sm font-bold text-white hover:text-violet-300 transition-colors truncate"
                          >
                            {emp.fullName}
                          </Link>
                          {emp.id === currentUserId && (
                            <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.2 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 block truncate">
                          {emp.jobTitle} • {emp.department}
                        </span>
                      </div>
                    </div>

                    {/* Progress & Live Calculated Numbers */}
                    <div className="flex-1 max-w-lg space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Allocated:</span>
                          <span
                            className={
                              isOverloaded
                                ? 'text-rose-400 font-bold'
                                : isNearLimit
                                ? 'text-amber-400 font-semibold'
                                : 'text-slate-200'
                            }
                          >
                            {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({util}%)
                          </span>
                        </div>

                        {/* Buffer / Deficit Indicator */}
                        <div>
                          {isOverloaded ? (
                            <span className="text-rose-400 font-bold text-[11px]">
                              +{Math.abs(bufferHours)}h over capacity
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-medium text-[11px]">
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
                    <div className="border-t border-slate-800/80 bg-navy-950/40 p-4 space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Active Assigned Tasks ({empTasks.length})
                        </h5>
                        <span className="text-[11px] text-slate-400">
                          Manager reassignments execute atomic database RPC transactions
                        </span>
                      </div>

                      {empTasks.length > 0 ? (
                        <div className="space-y-2">
                          {empTasks.map((t) => (
                            <div
                              key={t.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-navy-900/80 p-3"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className="text-xs font-bold text-white hover:text-violet-300"
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
                                <span className="text-[11px] text-slate-400">
                                  {t.projectName} • Status: {t.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {/* Hour Adjuster */}
                                {isManagerOrAdmin && (
                                  <div className="flex items-center gap-1 bg-navy-850 border border-slate-700/80 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustTaskHours(t.id, Number(t.estimatedHours) || 0, -1)}
                                      disabled={actionLoading || Number(t.estimatedHours) <= 1}
                                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                                      title="Decrease estimated hours"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="font-mono text-xs font-bold text-white px-1">
                                      {t.estimatedHours}h
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustTaskHours(t.id, Number(t.estimatedHours) || 0, 1)}
                                      disabled={actionLoading}
                                      className="p-1 text-slate-400 hover:text-white"
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
                                    className="rounded-lg border border-slate-700 bg-navy-850 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
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
                        <div className="p-4 text-center text-xs text-slate-400">
                          No active tasks assigned to this member.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Users className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                <p className="text-xs text-slate-300">No team members match current search or filters.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
