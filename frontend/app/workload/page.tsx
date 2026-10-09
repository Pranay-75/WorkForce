'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMockStore } from '@/lib/mockStore';
import { TaskStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  BarChart3,
  Layers,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  RefreshCw,
  Users,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckSquare,
  Plus,
  Minus,
  Sliders,
  FolderKanban,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

export default function WorkloadCapacityPage() {
  const {
    employees,
    tasks,
    redistributionProposals,
    applyRedistribution,
    updateTaskDetails,
    updateTaskStatus,
    updateEmployeeWeeklyCapacity,
    activeRole,
    currentUserId,
  } = useMockStore();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'overloaded' | 'near_limit' | 'optimal'>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'util_desc' | 'util_asc' | 'hours_desc' | 'name_asc'>('util_desc');
  const [expandedEmpId, setExpandedEmpId] = React.useState<string | null>(null);

  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin';

  // Live Capacity Bands
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

  // Filter and sort roster
  const filteredEmployees = React.useMemo(() => {
    return employees
      .filter((emp) => {
        const util = emp.weeklyCapacityHours > 0 ? emp.currentLoadHours / emp.weeklyCapacityHours : 0;

        // Search match
        const matchesSearch =
          emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp.department.toLowerCase().includes(searchQuery.toLowerCase());

        // Status match
        let matchesStatus = true;
        if (statusFilter === 'overloaded') matchesStatus = util > 1.0;
        if (statusFilter === 'near_limit') matchesStatus = util >= 0.8 && util <= 1.0;
        if (statusFilter === 'optimal') matchesStatus = util < 0.8;

        // Department match
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

  const handleAdjustTaskHours = (taskId: string, currentHours: number, delta: number) => {
    const newHours = Math.max(1, currentHours + delta);
    updateTaskDetails(taskId, { estimatedHours: newHours });
  };

  const handleReassignTask = (taskId: string, targetEmpId: string) => {
    updateTaskDetails(taskId, {
      assignedTo: targetEmpId === 'unassigned' ? undefined : targetEmpId,
    });
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
              Live Telemetry
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic capacity tracking, live bottleneck diagnostics, and interactive sprint rebalancing
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
          <span>Target Maximum Load:</span>
          <Badge variant="emerald" size="sm">
            85% Capacity
          </Badge>
        </div>
      </div>

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
                {optimalStaff.length} Members
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
                AI Workload Redistribution Sandbox
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Proactive task transfer proposals to resolve capacity bottlenecks
            </p>
          </div>

          <Badge variant="violet" size="sm">
            {redistributionProposals.length} Proposed Transfers
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {redistributionProposals.map((prop) => {
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

                  {/* Rationale & Execution CTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                    <p className="text-slate-300 italic flex-1">
                      &ldquo;{prop.rationale}&rdquo;
                    </p>

                    <Button
                      variant="accent"
                      size="md"
                      onClick={() => applyRedistribution(prop.id)}
                      className="shrink-0"
                    >
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      <span>Apply Redistribution</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {redistributionProposals.length === 0 && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-8 text-center text-slate-300 space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-1" />
              <h4 className="text-sm font-bold text-white">
                Team Workload Fully Balanced
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active reallocation proposals are pending. All team member capacities remain under optimal margins.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Individual Employee Capacity Roster Hub */}
      <Card className="border-slate-800">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-violet-400" />
                <CardTitle>Team Member Capacity Roster</CardTitle>
                <Badge variant="slate" size="sm">
                  {filteredEmployees.length} of {employees.length} Members
                </Badge>
              </div>
              <CardDescription>
                Live allocations, weekly sprint limits, and interactive task rebalancing per team member
              </CardDescription>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Link href="/employees">
                <Button variant="ghost" size="sm" className="text-xs">
                  <span>Directory</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Roster Controls: Search, Status Filter, Dept Filter, Sorting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff, role, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-navy-900 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
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
                        {emp.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
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
                      {/* Status Badge */}
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

                      {/* Capacity Modifier for Managers */}
                      {isManagerOrAdmin && (
                        <div className="flex items-center gap-1 bg-navy-950 px-2 py-1 rounded-lg border border-slate-800" title="Adjust weekly target sprint capacity">
                          <span className="text-[10px] text-slate-400 font-mono">Sprint:</span>
                          <span className="text-xs font-bold font-mono text-cyan-400">
                            {emp.weeklyCapacityHours}h
                          </span>
                          <div className="flex items-center ml-1">
                            <button
                              onClick={() => updateEmployeeWeeklyCapacity(emp.id, emp.weeklyCapacityHours - 5)}
                              disabled={emp.weeklyCapacityHours <= 10}
                              className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Decrease target capacity by 5h"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => updateEmployeeWeeklyCapacity(emp.id, emp.weeklyCapacityHours + 5)}
                              disabled={emp.weeklyCapacityHours >= 60}
                              className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Increase target capacity by 5h"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Expand / Collapse Button */}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleExpand(emp.id)}
                        className="text-xs"
                      >
                        <span>{empTasks.length} Active Task{empTasks.length !== 1 ? 's' : ''}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 ml-1" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 ml-1" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Task Breakdown & Inline Rebalancing Tray */}
                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-navy-950/70 p-4 space-y-3 rounded-b-2xl animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-cyan-400" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            Active Tasks for {emp.fullName} ({empTasks.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Adjust effort hours, reassign, or mark completed to recalculate load
                        </span>
                      </div>

                      {empTasks.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
                          No active sprint tasks currently assigned. Full capacity is available for new assignments.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5">
                          {empTasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-slate-800/90 bg-navy-900/80 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              {/* Task Metadata */}
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className="text-xs font-bold text-white hover:text-violet-300 transition-colors truncate"
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
                                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                  <span>{t.projectName}</span>
                                  <span>•</span>
                                  <span>Due: {t.dueDate}</span>
                                </div>
                              </div>

                              {/* Interactive Effort Adjustment (+/-) */}
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-navy-850 px-2.5 py-1 rounded-lg border border-slate-700/80">
                                  <Clock className="h-3 w-3 text-cyan-400" />
                                  <span className="text-xs font-bold font-mono text-cyan-400">
                                    {t.estimatedHours}h
                                  </span>
                                  {isManagerOrAdmin && (
                                    <div className="flex items-center gap-0.5 ml-1">
                                      <button
                                        onClick={() => handleAdjustTaskHours(t.id, t.estimatedHours, -2)}
                                        disabled={t.estimatedHours <= 2}
                                        className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                                        title="Reduce effort by 2h"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleAdjustTaskHours(t.id, t.estimatedHours, 2)}
                                        className="rounded p-0.5 text-slate-400 hover:text-white"
                                        title="Increase effort by 2h"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Reassign Task to another employee */}
                                {isManagerOrAdmin && (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={t.assignedTo || 'unassigned'}
                                      onChange={(e) => handleReassignTask(t.id, e.target.value)}
                                      className="rounded-lg border border-slate-700 bg-navy-850 px-2.5 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                                    >
                                      <option value={emp.id}>Assigned: {emp.fullName.split(' ')[0]}</option>
                                      <option value="unassigned">Unassign (AI Pool)</option>
                                      {employees
                                        .filter((other) => other.id !== emp.id)
                                        .map((other) => (
                                          <option key={other.id} value={other.id}>
                                            Reassign: {other.fullName} ({other.currentLoadHours}h / {other.weeklyCapacityHours}h)
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                )}

                                {/* Status transition / Complete */}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => updateTaskStatus(t.id, 'completed')}
                                  className="text-xs whitespace-nowrap"
                                  title="Mark completed to deduct hours from sprint"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                                  <span>Complete</span>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="rounded-2xl border border-slate-800 bg-navy-900/40 p-12 text-center text-slate-400 space-y-2">
                <Users className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                <h4 className="text-base font-bold text-white">No Team Members Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  No staff members match the current filter or search query. Try clearing search or selecting &ldquo;All Statuses&rdquo;.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDepartmentFilter('all');
                  }}
                >
                  Reset Roster Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
