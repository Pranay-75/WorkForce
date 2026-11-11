'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
import { Employee, UserRole } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
import { MetricCard } from '@/components/ui/MetricCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/LoadingState';
import { AccessDenied } from '@/components/ui/AccessDenied';
import {
  Users,
  Search,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  FolderKanban,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmployeesDirectoryPage() {
  const { isAuthenticated, organization, role: currentUserRole, user } = useAuth();

  // Live Supabase organization members hook
  const {
    members: liveMembers,
    pendingInvitations: livePendingInvitations,
    isLoading: isLiveLoading,
    error: liveError,
    departments,
    addMember,
    updateMemberRole,
    removeMember,
  } = useOrganizationMembers();

  // Live projects and tasks hooks for project assignment workflow & workload tracking
  const {
    projects: dbProjects,
    addProjectMember,
    refetch: refetchProjects,
  } = useProjects();

  const {
    tasks: dbTasks,
    assignTask,
    refetch: refetchTasks,
  } = useTasks();

  const liveTasks = dbTasks;

  // Compute live load hours per member from active tasks
  const memberLoads = React.useMemo(() => {
    const map = new Map<string, { count: number; hours: number }>();
    liveTasks.forEach((t) => {
      if (t.assignedTo && t.status !== 'completed') {
        const cur = map.get(t.assignedTo) || { count: 0, hours: 0 };
        map.set(t.assignedTo, {
          count: cur.count + 1,
          hours: cur.hours + (Number(t.estimatedHours) || 0),
        });
      }
    });
    return map;
  }, [liveTasks]);

  // Mock store fallback for unauthenticated / demo exploration
  const { employees: mockEmployees, addNewEmployee, activeRole: mockRole } = useMockStore();

  const isLive = Boolean(isAuthenticated && organization);
  const activeRole = isLive && currentUserRole ? currentUserRole : mockRole;
  const isOrganizer = activeRole === 'organizer';
  const isAdmin = activeRole === 'admin' || isOrganizer;
  const isManagerOrAdmin = activeRole === 'manager' || isAdmin;

  // View presentation state
  const [viewMode, setViewMode] = React.useState<'grid' | 'table'>('grid');

  // Filters state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDept, setSelectedDept] = React.useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = React.useState<string>('all');
  const [selectedWorkloadFilter, setSelectedWorkloadFilter] = React.useState<string>('all');
  const [sortColumn, setSortColumn] = React.useState<string>('name');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Add Member Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [addMemberEmail, setAddMemberEmail] = React.useState('');
  const [addMemberDepartment, setAddMemberDepartment] = React.useState('Engineering');
  const [addMemberCustomDept, setAddMemberCustomDept] = React.useState('');
  const [addMemberRole, setAddMemberRole] = React.useState<UserRole>('employee');
  const [addMemberLoading, setAddMemberLoading] = React.useState(false);
  const [addMemberError, setAddMemberError] = React.useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = React.useState<string | null>(null);
  const [pendingDemoMembers, setPendingDemoMembers] = React.useState<
    Array<{ id: string; email: string; role: UserRole; department?: string; createdAt: string }>
  >([]);

  // Project Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignTargetMember, setAssignTargetMember] = React.useState<{ userId: string; fullName: string } | null>(null);
  const [assignProjectId, setAssignProjectId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Accessible Confirmation Dialog State for Deletion
  const [confirmRemoveTarget, setConfirmRemoveTarget] = React.useState<{
    isOpen: boolean;
    id: string;
    name: string;
    isPending?: boolean;
  } | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);

  // Global Action status notices
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Open assign modal with a preselected member
  const handleOpenAssignModal = (member?: { userId: string; fullName: string }) => {
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    if (member) {
      setAssignTargetMember(member);
      const unassignedProj = dbProjects.find((p) => !p.memberIds.includes(member.userId));
      setAssignProjectId(unassignedProj ? unassignedProj.id : (dbProjects[0]?.id || ''));
    } else {
      setAssignTargetMember(liveMembers.length > 0 ? { userId: liveMembers[0].userId, fullName: liveMembers[0].fullName } : null);
      setAssignProjectId(dbProjects[0]?.id || '');
    }
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetMember || !assignProjectId) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    // 1. Add project member
    const res = await addProjectMember(assignProjectId, assignTargetMember.userId);
    if (res.error) {
      setAssignLoading(false);
      setAssignError(res.error);
      return;
    }

    // 2. Optionally assign selected tasks
    if (assignTaskIds.length > 0) {
      for (const taskId of assignTaskIds) {
        await assignTask(taskId, assignTargetMember.userId);
      }
      await refetchTasks();
    }

    await refetchProjects();
    setAssignLoading(false);
    setAssignSuccess(`Successfully assigned ${assignTargetMember.fullName} to project initiative.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  // Available Department options dynamically aggregated from existing organization departments
  const availableDepartments = React.useMemo(() => {
    const deptSet = new Set<string>();
    departments.forEach((d) => {
      if (d.department && d.department.trim()) deptSet.add(d.department.trim());
    });
    ['Engineering', 'Product', 'Design', 'Operations', 'HR', 'Quality Assurance', 'Marketing', 'Sales'].forEach((d) => deptSet.add(d));
    return Array.from(deptSet);
  }, [departments]);

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLive && !isAdmin) {
      setAddMemberError('Only organization administrators or organizers can add members.');
      return;
    }
    if (addMemberRole === 'admin' && !isOrganizer) {
      setAddMemberError('Only the organization organizer can add or invite an administrator.');
      return;
    }
    const email = addMemberEmail.trim().toLowerCase();
    if (!email) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAddMemberError('Please enter a valid work email address (e.g. colleague@acme.corp).');
      return;
    }

    const effectiveDept = (addMemberDepartment === 'Other' ? addMemberCustomDept : addMemberDepartment).trim();
    if (!effectiveDept) {
      setAddMemberError('Please specify a department for this member.');
      return;
    }

    setAddMemberLoading(true);
    setAddMemberError(null);
    setAddMemberSuccess(null);

    // DEMO MODE: Simulate adding member in-memory without altering Supabase
    if (!isLive) {
      const existingMember = mockEmployees.find((emp) => emp.email.toLowerCase() === email);
      if (existingMember) {
        setAddMemberLoading(false);
        setAddMemberError(`A team member with email "${email}" is already enrolled as ${existingMember.fullName} (${existingMember.role.toUpperCase()}).`);
        return;
      }

      const existingPending = pendingDemoMembers.find((inv) => inv.email.toLowerCase() === email);
      if (existingPending) {
        setAddMemberLoading(false);
        setAddMemberError(`A member with email "${email}" has already been added as ${existingPending.role.toUpperCase()} (Pending Setup).`);
        return;
      }

      const newPending = {
        id: `demo-member-${Date.now()}`,
        email,
        role: addMemberRole as UserRole,
        department: effectiveDept,
        createdAt: 'Just now',
      };
      setPendingDemoMembers((prev) => [newPending, ...prev]);

      setAddMemberLoading(false);
      setAddMemberSuccess(`Member ${email} added successfully to ${effectiveDept} as ${addMemberRole.toUpperCase()} (Pending Setup).`);
      setAddMemberEmail('');
      setAddMemberCustomDept('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddMemberSuccess(null);
      }, 1500);
      return;
    }

    // LIVE MODE: Authenticated Supabase add member RPC with department
    const { error: addErr, data } = await addMember(email, addMemberRole, effectiveDept);

    setAddMemberLoading(false);
    if (addErr) {
      setAddMemberError(addErr);
    } else {
      setAddMemberSuccess(
        data?.status === 'member_added'
          ? `Member ${email} was added directly to ${effectiveDept} as ${addMemberRole.toUpperCase()} (Active).`
          : `Member ${email} added successfully to ${effectiveDept} as ${addMemberRole.toUpperCase()} (Pending Setup).`
      );
      setAddMemberEmail('');
      setAddMemberCustomDept('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddMemberSuccess(null);
      }, 1500);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    if (isLive && !isAdmin) {
      setActionError('Only organization administrators or organizers can update member roles.');
      return;
    }
    const allowedRoles: UserRole[] = ['admin', 'hr', 'manager', 'employee'];
    if (!allowedRoles.includes(newRole)) {
      setActionError('Invalid role. Allowed roles are: Administrator, HR, Manager, or Employee.');
      return;
    }
    if (newRole === 'admin' && !isOrganizer) {
      setActionError('Only the organization organizer can assign the administrator role.');
      return;
    }
    const targetMember = liveMembers.find((m) => m.userId === targetUserId);
    if (targetMember?.role === 'admin' && !isOrganizer) {
      setActionError('Only the organization organizer can modify an administrator role.');
      return;
    }
    if (targetMember?.role === 'organizer') {
      setActionError('Cannot demote the organization organizer. Ownership must be transferred.');
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    if (!isLive) {
      setActionSuccess(`Member role updated to ${newRole.toUpperCase()} (Demo).`);
      setTimeout(() => setActionSuccess(null), 3000);
      return;
    }
    const { error } = await updateMemberRole(targetUserId, newRole);
    if (error) {
      setActionError(error);
    } else {
      setActionSuccess(`Member role successfully updated to ${newRole.toUpperCase()}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const executeRemoveMember = async () => {
    if (!confirmRemoveTarget) return;
    const { id, name, isPending } = confirmRemoveTarget;
    const trimmedId = (id || '').trim();

    setRemoveLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const { error } = await removeMember(trimmedId, { isPending });
    setRemoveLoading(false);
    setConfirmRemoveTarget(null);

    if (error) {
      setActionError(error);
    } else {
      await Promise.all([refetchTasks(), refetchProjects()]);
      setActionSuccess(`${name} was successfully removed from workspace.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  // Filter members based on search, department, role, and workload
  const filteredLiveMembers = React.useMemo(() => {
    return liveMembers.filter((m) => {
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'all' || m.department === selectedDept;
      const matchesRole = selectedRoleFilter === 'all' || m.role === selectedRoleFilter;

      let matchesWorkload = true;
      if (selectedWorkloadFilter !== 'all') {
        const load = memberLoads.get(m.userId)?.hours || 0;
        const cap = m.weeklyCapacityHours || 40;
        const util = cap > 0 ? (load / cap) * 100 : 0;
        if (selectedWorkloadFilter === 'overloaded') matchesWorkload = util > 100;
        else if (selectedWorkloadFilter === 'near_limit') matchesWorkload = util >= 80 && util <= 100;
        else if (selectedWorkloadFilter === 'optimal') matchesWorkload = util < 80;
      }

      return matchesSearch && matchesDept && matchesRole && matchesWorkload;
    });
  }, [liveMembers, searchQuery, selectedDept, selectedRoleFilter, selectedWorkloadFilter, memberLoads]);

  const filteredMockEmployees = React.useMemo(() => {
    return mockEmployees.filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'all' || emp.department === selectedDept;
      const matchesRole = selectedRoleFilter === 'all' || emp.role === selectedRoleFilter;

      let matchesWorkload = true;
      if (selectedWorkloadFilter !== 'all') {
        const util = emp.weeklyCapacityHours > 0 ? (emp.currentLoadHours / emp.weeklyCapacityHours) * 100 : 0;
        if (selectedWorkloadFilter === 'overloaded') matchesWorkload = util > 100;
        else if (selectedWorkloadFilter === 'near_limit') matchesWorkload = util >= 80 && util <= 100;
        else if (selectedWorkloadFilter === 'optimal') matchesWorkload = util < 80;
      }

      return matchesSearch && matchesDept && matchesRole && matchesWorkload;
    });
  }, [mockEmployees, searchQuery, selectedDept, selectedRoleFilter, selectedWorkloadFilter]);

  // Sorting handler
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Sorted members for Table presentation
  const sortedLiveMembers = React.useMemo(() => {
    const list = [...filteredLiveMembers];
    list.sort((a, b) => {
      let valA: any = a.fullName;
      let valB: any = b.fullName;

      if (sortColumn === 'role') {
        valA = a.role;
        valB = b.role;
      } else if (sortColumn === 'department') {
        valA = a.department || '';
        valB = b.department || '';
      } else if (sortColumn === 'utilization') {
        const capA = a.weeklyCapacityHours || 40;
        const loadA = memberLoads.get(a.userId)?.hours || 0;
        valA = capA > 0 ? loadA / capA : 0;

        const capB = b.weeklyCapacityHours || 40;
        const loadB = memberLoads.get(b.userId)?.hours || 0;
        valB = capB > 0 ? loadB / capB : 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLiveMembers, sortColumn, sortDirection, memberLoads]);

  const sortedMockEmployees = React.useMemo(() => {
    const list = [...filteredMockEmployees];
    list.sort((a, b) => {
      let valA: any = a.fullName;
      let valB: any = b.fullName;

      if (sortColumn === 'role') {
        valA = a.role;
        valB = b.role;
      } else if (sortColumn === 'department') {
        valA = a.department || '';
        valB = b.department || '';
      } else if (sortColumn === 'utilization') {
        valA = a.weeklyCapacityHours > 0 ? a.currentLoadHours / a.weeklyCapacityHours : 0;
        valB = b.weeklyCapacityHours > 0 ? b.currentLoadHours / b.weeklyCapacityHours : 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredMockEmployees, sortColumn, sortDirection]);

  // Dynamic workforce metrics grounded purely in real data
  const summaryMetrics = React.useMemo(() => {
    if (isLive) {
      const total = liveMembers.length;
      const totalCapacity = liveMembers.reduce((sum, m) => sum + (m.weeklyCapacityHours || 40), 0);
      const totalLoad = liveMembers.reduce((sum, m) => sum + (memberLoads.get(m.userId)?.hours || 0), 0);
      const utilization = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;
      const overloaded = liveMembers.filter((m) => {
        const cap = m.weeklyCapacityHours || 40;
        const load = memberLoads.get(m.userId)?.hours || 0;
        return cap > 0 && load > cap;
      }).length;
      const departmentsCount = new Set(liveMembers.map((m) => m.department).filter(Boolean)).size;

      return {
        total,
        utilization,
        overloaded,
        departmentsCount,
        activeProjectsCount: dbProjects.length,
      };
    }

    const capacity = mockEmployees.reduce((sum, e) => sum + e.weeklyCapacityHours, 0);
    const load = mockEmployees.reduce((sum, e) => sum + e.currentLoadHours, 0);

    return {
      total: mockEmployees.length,
      utilization: capacity > 0 ? Math.round((load / capacity) * 100) : 0,
      overloaded: mockEmployees.filter((e) => e.weeklyCapacityHours > 0 && e.currentLoadHours > e.weeklyCapacityHours).length,
      departmentsCount: new Set(mockEmployees.map((e) => e.department)).size,
      activeProjectsCount: dbProjects.length || 3,
    };
  }, [isLive, liveMembers, memberLoads, mockEmployees, dbProjects]);

  const displayCount = isLive ? filteredLiveMembers.length : filteredMockEmployees.length;

  // Strict role guard: employees cannot view the directory
  if (activeRole === 'employee') {
    return (
      <AccessDenied
        resourceName="Employee Directory & Talent Matrix"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="The organization-wide talent roster, individual capacity allocations, and skill matrices are restricted to management and administrative personnel."
      />
    );
  }

  // Active filters helper
  const hasActiveFilters = searchQuery.trim() !== '' || selectedDept !== 'all' || selectedRoleFilter !== 'all' || selectedWorkloadFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDept('all');
    setSelectedRoleFilter('all');
    setSelectedWorkloadFilter('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Refined Directory Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-wf-border-default pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-wf-text-primary">
              Talent Directory &amp; Roster
            </h1>
            <Badge variant="burgundy" size="sm">
              {displayCount} {isLive ? 'Verified Members' : 'Demo Profiles'}
            </Badge>
            {isLive && organization?.name && (
              <Badge variant="slate" size="sm">
                {organization.name}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-wf-text-secondary">
            {isLive
              ? 'Real-time talent utilization, project participation, and operational workload distribution.'
              : 'Interactive demonstration of verified competencies, sprint capacity, and operational workload.'}
          </p>
        </div>

        {/* Authorized Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isManagerOrAdmin && isLive && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleOpenAssignModal()}
              className="gap-1.5"
            >
              <FolderKanban className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Assign to Project</span>
            </Button>
          )}

          {isAdmin ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setAddMemberError(null);
                setAddMemberSuccess(null);
                setAddMemberRole('employee');
                setAddMemberDepartment('Engineering');
                setAddMemberCustomDept('');
                setIsAddModalOpen(true);
              }}
              className="gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>{isLive ? 'Add Member' : 'Add Member (Demo)'}</span>
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 text-xs text-wf-text-secondary">
              <Lock className="h-3.5 w-3.5 text-wf-text-muted" />
              <span>Admin or Organizer required to add members</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Status Notices */}
      {actionError && (
        <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActionError(null)} className="h-6 w-6 p-0 text-wf-semantic-danger">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-2xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3.5 text-xs text-wf-semantic-success flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActionSuccess(null)} className="h-6 w-6 p-0 text-wf-semantic-success">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 2. Employee Summary Metrics */}
      <section
        aria-label="Talent capacity overview"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          title={isLive ? 'Verified Members' : 'Active Talent'}
          value={summaryMetrics.total}
          subtitle={isLive ? 'Active workspace accounts' : 'Synthetic team profiles'}
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Capacity Utilization"
          value={`${summaryMetrics.utilization}%`}
          subtitle="Total assigned effort vs capacity"
          progress={{
            value: summaryMetrics.utilization,
            colorScheme: summaryMetrics.utilization > 100 ? 'burgundy' : summaryMetrics.utilization >= 80 ? 'auto' : 'emerald',
          }}
          badgeText={summaryMetrics.utilization > 100 ? 'Over Limit' : summaryMetrics.utilization >= 80 ? 'Heavy Load' : 'Balanced'}
          badgeVariant={summaryMetrics.utilization > 100 ? 'rose' : summaryMetrics.utilization >= 80 ? 'amber' : 'emerald'}
        />
        <MetricCard
          title="Over Capacity"
          value={summaryMetrics.overloaded}
          subtitle="Load exceeds 100% weekly limit"
          badgeText={summaryMetrics.overloaded > 0 ? `${summaryMetrics.overloaded} Over` : 'None Overloaded'}
          badgeVariant={summaryMetrics.overloaded > 0 ? 'rose' : 'emerald'}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          title="Departments"
          value={summaryMetrics.departmentsCount}
          subtitle="Organizational functional units"
          icon={<SlidersHorizontal className="h-4 w-4" />}
        />
      </section>

      {/* Pending Setup Live Members Banner */}
      {isLive && livePendingInvitations && livePendingInvitations.length > 0 && (
        <div className="rounded-2xl border border-wf-semantic-warning-border bg-wf-semantic-warning-bg p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-wf-semantic-warning animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-wf-text-primary">
                Members Pending Account Setup ({livePendingInvitations.length})
              </h3>
            </div>
            <span className="text-[11px] text-wf-text-secondary">
              Added to workspace; awaiting initial authentication
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {livePendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-card text-xs shadow-sm"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-wf-text-primary truncate">{inv.email}</p>
                  <p className="text-[10px] text-wf-text-secondary">
                    Role: <span className="font-semibold text-wf-brand-burgundy dark:text-wf-cream uppercase">{inv.role}</span>
                  </p>
                </div>
                <Badge variant="amber" size="sm">
                  Pending Setup
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Setup Demo Members Banner */}
      {!isLive && pendingDemoMembers.length > 0 && (
        <div className="rounded-2xl border border-wf-semantic-warning-border bg-wf-semantic-warning-bg p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-wf-semantic-warning animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-wf-text-primary">
                Simulated Members Pending Setup ({pendingDemoMembers.length})
              </h3>
            </div>
            <span className="text-[11px] text-wf-text-secondary">Simulated demo state</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {pendingDemoMembers.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-card text-xs shadow-sm"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-wf-text-primary truncate">{inv.email}</p>
                  <p className="text-[10px] text-wf-text-secondary">
                    Role: <span className="font-semibold text-wf-brand-burgundy dark:text-wf-cream uppercase">{inv.role}</span>
                  </p>
                </div>
                <Badge variant="amber" size="sm">
                  Pending Setup
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Search, Filtering & View Switcher */}
      <div className="flex flex-col gap-3 rounded-2xl border border-wf-border-default bg-wf-surface-card p-4 shadow-card">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-wf-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search by member name, job title, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3.5 py-2 pl-9 text-xs text-wf-text-primary placeholder:text-wf-text-muted focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-wf-text-muted hover:text-wf-text-primary"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
              aria-label="Filter by department"
            >
              <option value="all">All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
              aria-label="Filter by role"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="manager">Manager</option>
              <option value="hr">HR</option>
              <option value="employee">Employee</option>
            </select>

            {/* Workload Status Filter */}
            <select
              value={selectedWorkloadFilter}
              onChange={(e) => setSelectedWorkloadFilter(e.target.value)}
              className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-xs text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
              aria-label="Filter by workload capacity"
            >
              <option value="all">All Workloads</option>
              <option value="overloaded">Overloaded (&gt;100%)</option>
              <option value="near_limit">Near Limit (80-100%)</option>
              <option value="optimal">Optimal (&lt;80%)</option>
            </select>

            {/* Grid / Table Presentation Switcher */}
            <div className="flex items-center rounded-xl border border-wf-border-default bg-wf-surface-subtle p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'grid'
                    ? 'bg-wf-surface-card text-wf-text-primary shadow-sm'
                    : 'text-wf-text-secondary hover:text-wf-text-primary'
                )}
                aria-label="Grid layout"
                title="Grid layout"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  viewMode === 'table'
                    ? 'bg-wf-surface-card text-wf-text-primary shadow-sm'
                    : 'text-wf-text-secondary hover:text-wf-text-primary'
                )}
                aria-label="Table roster layout"
                title="Table roster layout"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-wf-border-default text-xs">
            <span className="text-wf-text-muted text-[11px] font-semibold uppercase tracking-wider">
              Active Filters:
            </span>
            {searchQuery && (
              <Badge variant="slate" size="sm" className="gap-1">
                <span>Query: &ldquo;{searchQuery}&rdquo;</span>
                <button onClick={() => setSearchQuery('')} className="hover:text-wf-semantic-danger">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedDept !== 'all' && (
              <Badge variant="slate" size="sm" className="gap-1">
                <span>Dept: {selectedDept}</span>
                <button onClick={() => setSelectedDept('all')} className="hover:text-wf-semantic-danger">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedRoleFilter !== 'all' && (
              <Badge variant="slate" size="sm" className="gap-1">
                <span>Role: {selectedRoleFilter.toUpperCase()}</span>
                <button onClick={() => setSelectedRoleFilter('all')} className="hover:text-wf-semantic-danger">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedWorkloadFilter !== 'all' && (
              <Badge variant="slate" size="sm" className="gap-1">
                <span>Capacity: {selectedWorkloadFilter.replace('_', ' ').toUpperCase()}</span>
                <button onClick={() => setSelectedWorkloadFilter('all')} className="hover:text-wf-semantic-danger">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-[11px] h-6 px-2 text-wf-text-secondary">
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* 4. Directory Content Presentation (Live or Demo) */}
      {isLive ? (
        isLiveLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : liveError ? (
          <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-8 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-wf-semantic-danger mx-auto" />
            <h4 className="text-base font-bold text-wf-text-primary">Error loading live members</h4>
            <p className="text-xs text-wf-text-secondary">{liveError}</p>
          </div>
        ) : filteredLiveMembers.length === 0 ? (
          <EmptyState
            title="No team members match your criteria"
            description="Try modifying or clearing your search and filter parameters."
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === 'grid' ? (
          /* LIVE MEMBERS: GRID PRESENTATION */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLiveMembers.map((m) => {
              const loadInfo = memberLoads.get(m.userId) || { count: 0, hours: 0 };
              const cap = m.weeklyCapacityHours || 40;
              const utilPct = cap > 0 ? Math.round((loadInfo.hours / cap) * 100) : 0;
              const allocatedProjects = dbProjects.filter((p) => p.memberIds.includes(m.userId));

              const roleVariant =
                m.role === 'organizer' || m.role === 'admin'
                  ? 'burgundy'
                  : m.role === 'manager'
                  ? 'cyan'
                  : m.role === 'hr'
                  ? 'emerald'
                  : 'slate';

              return (
                <div
                  key={m.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-wf-border-default bg-wf-surface-card p-5 shadow-card transition-all duration-hover hover:border-wf-border-strong hover:shadow-elevated"
                >
                  {/* Card Header with InteractiveAvatar */}
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <InteractiveAvatar
                          name={m.fullName}
                          jobTitle={m.jobTitle}
                          department={m.department}
                          utilizationPct={utilPct}
                          weeklyCapacityHours={cap}
                          activeAssignedHours={loadInfo.hours}
                          employeeId={m.userId}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/employees/${m.userId}`}
                            className="text-sm font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate block"
                          >
                            {m.fullName}
                          </Link>
                          <p className="text-xs text-wf-text-secondary truncate mt-0.5">{m.jobTitle}</p>
                          <p className="text-[11px] text-wf-text-muted font-mono truncate">{m.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={roleVariant} size="sm">
                          {m.role.toUpperCase()}
                        </Badge>
                        {m.accountStatus === 'pending_setup' && (
                          <Badge variant="amber" size="sm" className="text-[9px]">
                            Pending Setup
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Workload Indicator */}
                    <div className="space-y-2 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-wf-text-secondary">{m.department || 'General'}</span>
                        <span className="font-mono font-bold text-wf-text-primary">
                          {loadInfo.hours}h / {cap}h ({utilPct}%)
                        </span>
                      </div>
                      <ProgressBar value={utilPct} colorScheme="auto" />
                      <div className="flex items-center justify-between text-[11px] text-wf-text-secondary pt-0.5">
                        <span>Active Tasks: <strong className="text-wf-text-primary font-mono">{loadInfo.count}</strong></span>
                        <Badge
                          variant={utilPct > 100 ? 'rose' : utilPct >= 80 ? 'amber' : 'emerald'}
                          size="sm"
                          className="text-[9px] py-0 px-1.5"
                        >
                          {utilPct > 100 ? 'Overloaded' : utilPct >= 80 ? 'Near Limit' : 'Optimal'}
                        </Badge>
                      </div>
                    </div>

                    {/* Allocated Projects */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-wf-text-muted">
                        Active Projects ({allocatedProjects.length})
                      </span>
                      {allocatedProjects.length === 0 ? (
                        <p className="text-[11px] text-wf-text-muted italic">Unallocated to projects</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {allocatedProjects.slice(0, 3).map((p) => (
                            <Badge key={p.id} variant="slate" size="sm" className="text-[10px]">
                              {p.name}
                            </Badge>
                          ))}
                          {allocatedProjects.length > 3 && (
                            <Badge variant="slate" size="sm" className="text-[10px]">
                              +{allocatedProjects.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role Administration for Admin / Organizer */}
                    {(isOrganizer || (isAdmin && m.role !== 'admin')) && m.role !== 'organizer' && (
                      <div className="space-y-1.5 pt-2 border-t border-wf-border-default">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-wf-text-muted">
                            Governance Role:
                          </label>
                        </div>
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as UserRole)}
                          className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-2.5 py-1 text-xs text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
                        >
                          {isOrganizer && <option value="admin">Administrator</option>}
                          <option value="hr">HR</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </select>
                      </div>
                    )}
                    {m.role === 'organizer' && (
                      <div className="pt-2 border-t border-wf-border-default flex items-center gap-1.5 text-[11px] text-wf-brand-burgundy dark:text-wf-cream font-semibold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Organization Owner</span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-wf-border-default flex items-center justify-between gap-2">
                    <Link href={`/employees/${m.userId}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <span>View Profile</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {isManagerOrAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenAssignModal({ userId: m.userId, fullName: m.fullName })}
                          className="text-xs text-wf-text-secondary hover:text-wf-text-primary"
                          title="Assign project"
                        >
                          <FolderKanban className="h-3.5 w-3.5 mr-1" />
                          <span className="hidden sm:inline">Assign</span>
                        </Button>
                      )}

                      {isAdmin && m.userId !== user?.id && m.role !== 'organizer' && (isOrganizer || m.role !== 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const isPendingMember = Boolean(m.isPending || m.accountStatus === 'pending_setup');
                            const memberActualId = isPendingMember
                              ? (m.membershipId || (m.id && m.id.startsWith('pending-') ? m.id.replace('pending-', '') : m.id))
                              : m.userId;

                            setConfirmRemoveTarget({
                              isOpen: true,
                              id: memberActualId,
                              name: m.fullName,
                              isPending: isPendingMember,
                            });
                          }}
                          className="text-xs text-wf-semantic-danger hover:bg-wf-semantic-danger-bg"
                          title="Remove Member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIVE MEMBERS: TABLE PRESENTATION */
          <DataTable
            columns={[
              {
                header: 'Member',
                accessorKey: 'name',
                sortable: true,
                cell: (m: any) => {
                  const cap = m.weeklyCapacityHours || 40;
                  const load = memberLoads.get(m.userId)?.hours || 0;
                  const util = cap > 0 ? Math.round((load / cap) * 100) : 0;
                  return (
                    <div className="flex items-center gap-3">
                      <InteractiveAvatar
                        name={m.fullName}
                        jobTitle={m.jobTitle}
                        department={m.department}
                        utilizationPct={util}
                        employeeId={m.userId}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/employees/${m.userId}`}
                          className="font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate block"
                        >
                          {m.fullName}
                        </Link>
                        <span className="text-[11px] text-wf-text-muted truncate block">{m.email}</span>
                      </div>
                    </div>
                  );
                },
              },
              {
                header: 'Role',
                accessorKey: 'role',
                sortable: true,
                cell: (m: any) => {
                  const roleVariant =
                    m.role === 'organizer' || m.role === 'admin'
                      ? 'burgundy'
                      : m.role === 'manager'
                      ? 'cyan'
                      : m.role === 'hr'
                      ? 'emerald'
                      : 'slate';
                  return (
                    <Badge variant={roleVariant} size="sm">
                      {m.role.toUpperCase()}
                    </Badge>
                  );
                },
              },
              {
                header: 'Department & Title',
                accessorKey: 'department',
                sortable: true,
                cell: (m: any) => (
                  <div>
                    <span className="text-wf-text-primary block font-medium">{m.department || 'General'}</span>
                    <span className="text-[11px] text-wf-text-muted block">{m.jobTitle}</span>
                  </div>
                ),
              },
              {
                header: 'Capacity Load',
                accessorKey: 'utilization',
                sortable: true,
                cell: (m: any) => {
                  const cap = m.weeklyCapacityHours || 40;
                  const load = memberLoads.get(m.userId)?.hours || 0;
                  const util = cap > 0 ? Math.round((load / cap) * 100) : 0;
                  return (
                    <div className="space-y-1 min-w-[120px]">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-wf-text-primary font-semibold">{load}h / {cap}h</span>
                        <span className="text-wf-text-secondary">{util}%</span>
                      </div>
                      <ProgressBar value={util} colorScheme="auto" />
                    </div>
                  );
                },
              },
              {
                header: 'Status',
                cell: (m: any) => {
                  const cap = m.weeklyCapacityHours || 40;
                  const load = memberLoads.get(m.userId)?.hours || 0;
                  const util = cap > 0 ? Math.round((load / cap) * 100) : 0;
                  return (
                    <Badge
                      variant={util > 100 ? 'rose' : util >= 80 ? 'amber' : 'emerald'}
                      size="sm"
                    >
                      {util > 100 ? 'Overloaded' : util >= 80 ? 'Near Limit' : 'Optimal'}
                    </Badge>
                  );
                },
              },
              {
                header: 'Actions',
                cell: (m: any) => (
                  <div className="flex items-center gap-1.5">
                    <Link href={`/employees/${m.userId}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Profile
                      </Button>
                    </Link>
                    {isManagerOrAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAssignModal({ userId: m.userId, fullName: m.fullName })}
                        className="text-xs text-wf-text-secondary hover:text-wf-text-primary"
                        title="Assign to project"
                      >
                        <FolderKanban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && m.userId !== user?.id && m.role !== 'organizer' && (isOrganizer || m.role !== 'admin') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const isPendingMember = Boolean(m.isPending || m.accountStatus === 'pending_setup');
                          const memberActualId = isPendingMember
                            ? (m.membershipId || (m.id && m.id.startsWith('pending-') ? m.id.replace('pending-', '') : m.id))
                            : m.userId;
                          setConfirmRemoveTarget({
                            isOpen: true,
                            id: memberActualId,
                            name: m.fullName,
                            isPending: isPendingMember,
                          });
                        }}
                        className="text-xs text-wf-semantic-danger hover:bg-wf-semantic-danger-bg"
                        title="Remove Member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            data={sortedLiveMembers}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )
      ) : (
        /* DEMO MODE PRESENTATION */
        filteredMockEmployees.length === 0 ? (
          <EmptyState
            title="No demo members match your criteria"
            description="Try modifying or clearing your search and filter parameters."
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : viewMode === 'grid' ? (
          /* DEMO MEMBERS: GRID PRESENTATION */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMockEmployees.map((emp) => {
              const utilPct = emp.weeklyCapacityHours > 0 ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100) : 0;
              const roleVariant =
                emp.role === 'admin' || emp.role === 'organizer'
                  ? 'burgundy'
                  : emp.role === 'manager'
                  ? 'cyan'
                  : emp.role === 'hr'
                  ? 'emerald'
                  : 'slate';

              return (
                <div
                  key={emp.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-wf-border-default bg-wf-surface-card p-5 shadow-card transition-all duration-hover hover:border-wf-border-strong hover:shadow-elevated"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <InteractiveAvatar
                          name={emp.fullName}
                          jobTitle={emp.jobTitle}
                          department={emp.department}
                          utilizationPct={utilPct}
                          weeklyCapacityHours={emp.weeklyCapacityHours}
                          activeAssignedHours={emp.currentLoadHours}
                          employeeId={emp.id}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/employees/${emp.id}`}
                            className="text-sm font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate block"
                          >
                            {emp.fullName}
                          </Link>
                          <p className="text-xs text-wf-text-secondary truncate mt-0.5">{emp.jobTitle}</p>
                          <p className="text-[11px] text-wf-text-muted font-mono truncate">{emp.email}</p>
                        </div>
                      </div>

                      <Badge variant={roleVariant} size="sm">
                        {emp.role.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Workload Indicator */}
                    <div className="space-y-2 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-wf-text-secondary">{emp.department}</span>
                        <span className="font-mono font-bold text-wf-text-primary">
                          {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({utilPct}%)
                        </span>
                      </div>
                      <ProgressBar value={utilPct} colorScheme="auto" />
                      <div className="flex items-center justify-between text-[11px] text-wf-text-secondary pt-0.5">
                        <span>Active Tasks: <strong className="text-wf-text-primary font-mono">{emp.activeTaskCount}</strong></span>
                        <Badge
                          variant={utilPct > 100 ? 'rose' : utilPct >= 80 ? 'amber' : 'emerald'}
                          size="sm"
                          className="text-[9px] py-0 px-1.5"
                        >
                          {utilPct > 100 ? 'Overloaded' : utilPct >= 80 ? 'Near Limit' : 'Optimal'}
                        </Badge>
                      </div>
                    </div>

                    {/* Verified Technical Skills (Supported in Demo Data) */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-wf-text-muted">
                        Verified Skills
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {emp.skills.slice(0, 3).map((s) => (
                          <Badge key={s.skillId} variant="slate" size="sm" className="text-[10px]">
                            {s.skillName} • {s.proficiency[0].toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-wf-border-default flex items-center justify-between">
                    <span className="text-[11px] text-wf-text-muted font-mono">
                      {emp.activeTaskCount} active task{emp.activeTaskCount !== 1 ? 's' : ''}
                    </span>
                    <Link href={`/employees/${emp.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <span>View Profile</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DEMO MEMBERS: TABLE PRESENTATION */
          <DataTable
            columns={[
              {
                header: 'Member',
                accessorKey: 'name',
                sortable: true,
                cell: (emp: any) => {
                  const util = emp.weeklyCapacityHours > 0 ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100) : 0;
                  return (
                    <div className="flex items-center gap-3">
                      <InteractiveAvatar
                        name={emp.fullName}
                        jobTitle={emp.jobTitle}
                        department={emp.department}
                        utilizationPct={util}
                        employeeId={emp.id}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/employees/${emp.id}`}
                          className="font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate block"
                        >
                          {emp.fullName}
                        </Link>
                        <span className="text-[11px] text-wf-text-muted truncate block">{emp.email}</span>
                      </div>
                    </div>
                  );
                },
              },
              {
                header: 'Role',
                accessorKey: 'role',
                sortable: true,
                cell: (emp: any) => {
                  const roleVariant =
                    emp.role === 'admin' || emp.role === 'organizer'
                      ? 'burgundy'
                      : emp.role === 'manager'
                      ? 'cyan'
                      : emp.role === 'hr'
                      ? 'emerald'
                      : 'slate';
                  return (
                    <Badge variant={roleVariant} size="sm">
                      {emp.role.toUpperCase()}
                    </Badge>
                  );
                },
              },
              {
                header: 'Department & Location',
                accessorKey: 'department',
                sortable: true,
                cell: (emp: any) => (
                  <div>
                    <span className="text-wf-text-primary block font-medium">{emp.department}</span>
                    <span className="text-[11px] text-wf-text-muted block">{emp.location || 'San Francisco, CA'}</span>
                  </div>
                ),
              },
              {
                header: 'Capacity Load',
                accessorKey: 'utilization',
                sortable: true,
                cell: (emp: any) => {
                  const util = emp.weeklyCapacityHours > 0 ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100) : 0;
                  return (
                    <div className="space-y-1 min-w-[120px]">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-wf-text-primary font-semibold">{emp.currentLoadHours}h / {emp.weeklyCapacityHours}h</span>
                        <span className="text-wf-text-secondary">{util}%</span>
                      </div>
                      <ProgressBar value={util} colorScheme="auto" />
                    </div>
                  );
                },
              },
              {
                header: 'Status',
                cell: (emp: any) => {
                  const util = emp.weeklyCapacityHours > 0 ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100) : 0;
                  return (
                    <Badge
                      variant={util > 100 ? 'rose' : util >= 80 ? 'amber' : 'emerald'}
                      size="sm"
                    >
                      {util > 100 ? 'Overloaded' : util >= 80 ? 'Near Limit' : 'Optimal'}
                    </Badge>
                  );
                },
              },
              {
                header: 'Actions',
                cell: (emp: any) => (
                  <Link href={`/employees/${emp.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Profile
                    </Button>
                  </Link>
                ),
              },
            ]}
            data={sortedMockEmployees}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )
      )}

      {/* 5. Add Member Dialog */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={isLive ? 'Add Organization Member' : 'Add Simulated Team Member'}
        description={
          isLive
            ? 'Add a member to your organization workspace. The member is immediately enrolled with Pending Setup status until their first login.'
            : 'Simulated member addition for interactive demonstration.'
        }
      >
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 py-2">
          {addMemberError && (
            <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addMemberError}</span>
            </div>
          )}

          {addMemberSuccess && (
            <div className="rounded-xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3 text-xs text-wf-semantic-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{addMemberSuccess}</span>
            </div>
          )}

          <Input
            label="Recipient Work Email *"
            type="email"
            placeholder="colleague@company.com"
            value={addMemberEmail}
            onChange={(e) => setAddMemberEmail(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label htmlFor="add-member-dept-select" className="block text-xs font-semibold text-wf-text-secondary">
              Department *
            </label>
            <select
              id="add-member-dept-select"
              value={addMemberDepartment}
              onChange={(e) => setAddMemberDepartment(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
              required
            >
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
              <option value="Other">Other (Specify Custom Department)</option>
            </select>
            {addMemberDepartment === 'Other' && (
              <Input
                label="Custom Department Name *"
                placeholder="e.g. Legal, Data Science"
                value={addMemberCustomDept}
                onChange={(e) => setAddMemberCustomDept(e.target.value)}
                required
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-wf-text-secondary">
              Assigned Role *
            </label>
            <select
              value={addMemberRole}
              onChange={(e) => setAddMemberRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
            >
              {isOrganizer && <option value="admin">Administrator — Workspace management &amp; settings</option>}
              <option value="hr">HR — Talent management &amp; capacity oversight</option>
              <option value="manager">Manager — Team lead, allocations &amp; task planning</option>
              <option value="employee">Employee — Direct contributor, tasks &amp; schedule</option>
            </select>
            <p className="text-[11px] text-wf-text-muted">
              Assigned role is applied immediately. When the member logs in for the first time, they verify their email and set their password.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-default">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={addMemberLoading || !addMemberEmail.trim()}
            >
              {addMemberLoading ? 'Adding Member...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 6. Project Assignment Workflow Dialog */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={assignTargetMember ? `Assign ${assignTargetMember.fullName} to Project` : 'Assign Member to Project'}
        description="Allocate an existing team member to an active project portfolio initiative and optionally assign open tasks."
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

          {!assignTargetMember && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-wf-text-secondary">
                Select Active Member *
              </label>
              <select
                onChange={(e) => {
                  const m = liveMembers.find((mem) => mem.userId === e.target.value);
                  if (m) setAssignTargetMember({ userId: m.userId, fullName: m.fullName });
                }}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
              >
                {liveMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName} ({m.role.toUpperCase()} • {m.department || 'Engineering'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-wf-text-secondary">
              Select Target Project *
            </label>
            {dbProjects.length === 0 ? (
              <div className="rounded-xl border border-wf-semantic-warning-border bg-wf-semantic-warning-bg p-3 text-xs text-wf-semantic-warning">
                No active projects exist in this workspace. Please create a project on the Projects page first.
              </div>
            ) : (
              <select
                value={assignProjectId}
                onChange={(e) => {
                  setAssignProjectId(e.target.value);
                  setAssignTaskIds([]);
                }}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-2 text-sm text-wf-text-primary focus:border-wf-brand-burgundy focus:outline-none dark:focus:border-wf-cream transition-colors"
                required
              >
                <option value="" disabled>-- Select a Project --</option>
                {dbProjects.map((p) => {
                  const isAllocated = assignTargetMember ? p.memberIds.includes(assignTargetMember.userId) : false;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priority.toUpperCase()} Priority) {isAllocated ? '— Already Allocated' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Optional Open Task Assignment */}
          {assignProjectId && (
            <div className="space-y-2 pt-2 border-t border-wf-border-default">
              <label className="block text-xs font-semibold text-wf-text-secondary">
                Optionally Assign Open Tasks from this Project:
              </label>
              {dbTasks.filter((t) => t.projectId === assignProjectId && !t.assignedTo).length === 0 ? (
                <p className="text-[11px] text-wf-text-muted italic">
                  No unassigned tasks found for this project initiative.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-2.5">
                  {dbTasks
                    .filter((t) => t.projectId === assignProjectId && !t.assignedTo)
                    .map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 text-xs text-wf-text-secondary hover:text-wf-text-primary cursor-pointer"
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
                        <span className="text-[10px] text-wf-brand-burgundy dark:text-wf-cream font-mono ml-auto shrink-0 font-semibold">
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
              disabled={assignLoading || dbProjects.length === 0 || !assignProjectId}
            >
              {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 7. Confirm Dialog for Member Removal */}
      <ConfirmDialog
        isOpen={Boolean(confirmRemoveTarget?.isOpen)}
        onClose={() => setConfirmRemoveTarget(null)}
        onConfirm={executeRemoveMember}
        title={`Remove ${confirmRemoveTarget?.name || 'Member'}?`}
        description={`Are you sure you want to remove ${confirmRemoveTarget?.name || 'this member'} from the organization? Their active task assignments and project allocations will be safely unlinked.`}
        confirmText="Remove Member"
        cancelText="Keep Member"
        variant="danger"
        isLoading={removeLoading}
      />
    </div>
  );
}
