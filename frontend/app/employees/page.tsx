'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
import { Employee, UserRole } from '@/lib/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import {
  Users,
  Search,
  UserPlus,
  ArrowRight,
  MapPin,
  ShieldCheck,
  Briefcase,
  User,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

export default function EmployeesDirectoryPage() {
  const { isAuthenticated, organization, role: currentUserRole, user } = useAuth();
  const isOrganizer = currentUserRole === 'organizer';
  const isAdmin = currentUserRole === 'admin' || isOrganizer;
  const isManagerOrAdmin = currentUserRole === 'manager' || isAdmin;

  // Live Supabase organization members hook
  const {
    members: liveMembers,
    pendingInvitations: livePendingInvitations,
    isLoading: isLiveLoading,
    error: liveError,
    addMember,
    inviteMember,
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
  const { employees: mockEmployees, skills: mockSkills, addNewEmployee, activeRole: mockRole } = useMockStore();

  const isLive = Boolean(isAuthenticated && organization);
  const activeRole = isLive && currentUserRole ? currentUserRole : mockRole;

  // Filters state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDept, setSelectedDept] = React.useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = React.useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  // Project Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignTargetMember, setAssignTargetMember] = React.useState<{ userId: string; fullName: string } | null>(null);
  const [assignProjectId, setAssignProjectId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Add Member Modal Form State
  const [addMemberEmail, setAddMemberEmail] = React.useState('');
  const [addMemberRole, setAddMemberRole] = React.useState<UserRole>('employee');
  const [addMemberLoading, setAddMemberLoading] = React.useState(false);
  const [addMemberError, setAddMemberError] = React.useState<string | null>(null);
  const [addMemberSuccess, setAddMemberSuccess] = React.useState<string | null>(null);
  const [pendingDemoMembers, setPendingDemoMembers] = React.useState<
    Array<{ id: string; email: string; role: UserRole; createdAt: string }>
  >([]);

  // Card operation status
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Open assign modal with a preselected member
  const handleOpenAssignModal = (member?: { userId: string; fullName: string }) => {
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    if (member) {
      setAssignTargetMember(member);
      // Select first project where member is not yet allocated
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
    setAssignSuccess(`Successfully assigned ${assignTargetMember.fullName} to project.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  // Filter members based on search and filters
  const filteredLiveMembers = React.useMemo(() => {
    return liveMembers.filter((m) => {
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'all' || m.department === selectedDept;
      const matchesRole = selectedRoleFilter === 'all' || m.role === selectedRoleFilter;
      return matchesSearch && matchesDept && matchesRole;
    });
  }, [liveMembers, searchQuery, selectedDept, selectedRoleFilter]);

  const filteredMockEmployees = React.useMemo(() => {
    return mockEmployees.filter((emp) => {
      const matchesSearch =
        emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === 'all' || emp.department === selectedDept;
      const matchesRole = selectedRoleFilter === 'all' || emp.role === selectedRoleFilter;
      return matchesSearch && matchesDept && matchesRole;
    });
  }, [mockEmployees, searchQuery, selectedDept, selectedRoleFilter]);

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
        createdAt: 'Just now',
      };
      setPendingDemoMembers((prev) => [newPending, ...prev]);

      setAddMemberLoading(false);
      setAddMemberSuccess(`Member ${email} added successfully as ${addMemberRole.toUpperCase()} (Pending Setup).`);
      setAddMemberEmail('');
      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddMemberSuccess(null);
      }, 1500);
      return;
    }

    // LIVE MODE: Authenticated Supabase add member RPC
    const { error: addErr, data } = await addMember(email, addMemberRole);

    setAddMemberLoading(false);
    if (addErr) {
      setAddMemberError(addErr);
    } else {
      setAddMemberSuccess(
        data?.status === 'member_added'
          ? `Member ${email} was added directly as ${addMemberRole.toUpperCase()} (Active).`
          : `Member ${email} added successfully as ${addMemberRole.toUpperCase()} (Pending Setup).`
      );
      setAddMemberEmail('');
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
      setActionSuccess(`Member role updated to ${newRole} (Demo).`);
      setTimeout(() => setActionSuccess(null), 3000);
      return;
    }
    const { error } = await updateMemberRole(targetUserId, newRole);
    if (error) {
      setActionError(error);
    } else {
      setActionSuccess(`Member role updated to ${newRole}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleRemoveMember = async (targetId: string, targetName: string, isPending?: boolean) => {
    const trimmedId = (targetId || '').trim();
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!trimmedId || !UUID_REGEX.test(trimmedId)) {
      setActionError(`Cannot remove ${targetName}: Missing or invalid member identifier.`);
      return;
    }

    if (!confirm(`Are you sure you want to remove ${targetName} from the organization?`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    const { error } = await removeMember(trimmedId, { isPending });
    if (error) {
      setActionError(error);
    } else {
      // Invalidate and refresh tasks & projects so load hours and project allocations update immediately
      await Promise.all([
        refetchTasks(),
        refetchProjects(),
      ]);
      setActionSuccess(`${targetName} removed from workspace.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const displayCount = isLive ? filteredLiveMembers.length : filteredMockEmployees.length;
  const demoSummary = React.useMemo(() => {
    const capacity = mockEmployees.reduce(
      (sum, employee) => sum + employee.weeklyCapacityHours,
      0,
    );
    const load = mockEmployees.reduce(
      (sum, employee) => sum + employee.currentLoadHours,
      0,
    );

    return {
      total: mockEmployees.length,
      overloaded: mockEmployees.filter(
        (employee) =>
          employee.weeklyCapacityHours > 0 &&
          employee.currentLoadHours > employee.weeklyCapacityHours,
      ).length,
      utilization: capacity > 0 ? Math.round((load / capacity) * 100) : 0,
      departments: new Set(mockEmployees.map((employee) => employee.department)).size,
    };
  }, [mockEmployees]);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Talent Directory & Member Management
            </h2>
            <Badge variant="cyan" size="sm">
              {displayCount} {isLive ? 'Live Members' : 'Demo Members'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isLive
              ? `Managing members for workspace: ${organization?.name || 'Active Workspace'}`
              : 'Browse verified skills, monitor live capacity utilization, and inspect individual workloads'}
          </p>
        </div>

        {isLive ? (
          isManagerOrAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleOpenAssignModal()}
              >
                <FolderKanban className="h-4 w-4 mr-1.5 text-cyan-400" />
                <span>Assign to Project</span>
              </Button>
              {(isOrganizer || isAdmin) ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setAddMemberError(null);
                    setAddMemberSuccess(null);
                    setAddMemberRole('employee');
                    setIsAddModalOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  <span>Add Member</span>
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-navy-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span>Admin or Organizer required to add members</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-navy-900 border border-slate-800 px-3 py-2 rounded-xl">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>Admin or Organizer required to add members or modify roles</span>
            </div>
          )
        ) : (
          <Button variant="primary" size="md" onClick={() => {
            setAddMemberError(null);
            setAddMemberSuccess(null);
            setAddMemberRole('employee');
            setIsAddModalOpen(true);
          }}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            <span>Add Member (Demo)</span>
          </Button>
        )}
      </div>

      {/* Global Action Notices */}
      {actionError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Live Organization Summary Metrics */}
      {isLive && (
        <section
          aria-label="Live organization workforce summary"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6"
        >
          {[
            {
              label: 'Verified Members',
              value: liveMembers.length,
              detail: 'Active organization accounts',
              color: 'text-violet-300',
            },
            {
              label: 'Active Projects',
              value: dbProjects.length,
              detail: 'Organization project portfolio',
              color: 'text-cyan-300',
            },
            {
              label: 'Open Tasks',
              value: dbTasks.filter((t) => t.status !== 'completed').length,
              detail: 'Backlog and active tasks',
              color: 'text-amber-300',
            },
            {
              label: 'Total Effort',
              value: `${dbTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0)}h`,
              detail: 'Total tracked workload',
              color: 'text-emerald-300',
            },
          ].map((metric) => (
            <Card key={metric.label} className="border-slate-800/90">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {metric.label}
                </p>
                <p className={`mt-3 text-3xl font-bold ${metric.color}`}>
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Synthetic demo summary — hidden for live organization data */}
      {!isLive && (
        <section
          aria-label="Demo workforce summary"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6"
        >
          {[
            {
              label: 'Demo Employees',
              value: demoSummary.total,
              detail: 'Synthetic employee profiles',
              color: 'text-violet-300',
            },
            {
              label: 'Over Capacity',
              value: demoSummary.overloaded,
              detail: 'Load exceeds weekly capacity',
              color: 'text-rose-400',
            },
            {
              label: 'Team Utilization',
              value: `${demoSummary.utilization}%`,
              detail: 'Total load divided by capacity',
              color: 'text-cyan-300',
            },
            {
              label: 'Departments',
              value: demoSummary.departments,
              detail: 'Represented in demo data',
              color: 'text-emerald-300',
            },
          ].map((metric) => (
            <Card key={metric.label} className="border-slate-800/90">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {metric.label}
                </p>
                <p className={`mt-3 text-3xl font-bold ${metric.color}`}>
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
{/* Pending Live Members Banner */}
      {isLive && livePendingInvitations && livePendingInvitations.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Members Pending Account Setup ({livePendingInvitations.length})
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Added to workspace; awaiting first-time login &amp; password setup</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {livePendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-zinc-950/60 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-white truncate">{inv.email}</p>
                  <p className="text-[10px] text-zinc-400">
                    Assigned Role: <span className="text-violet-300 font-mono">{inv.role.toUpperCase()}</span>
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

      {/* Pending Demo Members Banner */}
      {!isLive && pendingDemoMembers.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-2 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Members Pending Account Setup ({pendingDemoMembers.length})
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Simulated in-memory demo state</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {pendingDemoMembers.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-zinc-950/60 text-xs"
              >
                <div className="truncate pr-2">
                  <span className="font-semibold text-white block truncate">{inv.email}</span>
                  <span className="text-[10px] text-zinc-400">Added {inv.createdAt}</span>
                </div>
                <Badge variant="amber" size="sm" className="text-[9px] shrink-0 font-mono">
                  {inv.role.toUpperCase()} • PENDING SETUP
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-slate-800 bg-navy-900/80 p-4 backdrop-blur-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, role, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Departments</option>
          <option value="Administration">Administration</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="Product">Product</option>
          <option value="DevOps">DevOps</option>
          <option value="QA">QA</option>
          <option value="People & Operations">People & Operations</option>
        </select>

        <select
          value={selectedRoleFilter}
          onChange={(e) => setSelectedRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="hr">HR</option>
          <option value="employee">Employee</option>
        </select>
      </div>

      {/* LIVE MEMBERS RENDERING */}
      {isLive ? (
        isLiveLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-8 w-8 mx-auto rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-400">Loading organization members...</p>
          </div>
        ) : liveError ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-6 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">Error loading live members</h4>
            <p className="text-xs text-slate-400">{liveError}</p>
          </div>
        ) : filteredLiveMembers.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLiveMembers.map((m) => {
              const initials = m.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2);

              const roleColors: Record<UserRole, { badge: 'violet' | 'cyan' | 'emerald' | 'slate'; label: string }> = {
                organizer: { badge: 'violet', label: 'Organizer' },
                admin: { badge: 'violet', label: 'Admin' },
                manager: { badge: 'cyan', label: 'Manager' },
                hr: { badge: 'emerald', label: 'HR' },
                employee: { badge: 'slate', label: 'Employee' },
              };
              const roleInfo = roleColors[m.role] || roleColors.employee;
              const loadInfo = memberLoads.get(m.userId) || { count: 0, hours: 0 };
              const cap = m.weeklyCapacityHours || 40;
              const utilPct = cap > 0 ? Math.round((loadInfo.hours / cap) * 100) : 0;

              // Derive real metrics from live tasks and projects
              const memberTasks = dbTasks.filter((t) => t.assignedTo === m.userId && t.status !== 'completed');
              const allocatedProjects = dbProjects.filter((p) => p.memberIds.includes(m.userId));

              return (
                <Card
                  key={m.id}
                  className="flex flex-col justify-between border-slate-800/90 hover:border-violet-500/50 hover:shadow-glow/20 transition-all duration-200 group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Link href={`/employees/${m.userId}`}>
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-sm font-bold text-white shadow-sm border border-violet-400/30 hover:scale-105 transition-transform cursor-pointer">
                            {initials}
                          </div>
                        </Link>
                        <div className="min-w-0">
                          <Link href={`/employees/${m.userId}`}>
                            <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate hover:underline cursor-pointer">
                              {m.fullName}
                            </h3>
                          </Link>
                          <p className="text-xs text-slate-400 truncate">{m.jobTitle}</p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={m.accountStatus === 'pending_setup' ? 'amber' : 'emerald'} size="sm">
                          {m.accountStatus === 'pending_setup' ? 'Pending Setup' : 'Active'}
                        </Badge>
                        <Badge variant={roleInfo.badge} size="sm">
                          {roleInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 flex-1">
                    <div className="space-y-2 border-b border-slate-800/60 pb-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">{m.department}</span>
                        <span className="font-mono text-slate-300 font-semibold">
                          {loadInfo.hours}h / {cap}h ({utilPct}%)
                        </span>
                      </div>
                      <ProgressBar value={utilPct} />
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Active Tasks: <strong className="text-slate-300">{loadInfo.count}</strong></span>
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
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Allocated Projects ({allocatedProjects.length})
                      </span>
                      {allocatedProjects.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Not allocated to any projects yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {allocatedProjects.map((p) => (
                            <Badge key={p.id} variant="cyan" size="sm">
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Role Administration Controls strictly for Workspace Organizer & Admin */}
                    {(isOrganizer || (isAdmin && m.role !== 'admin')) && m.role !== 'organizer' && (
                      <div className="space-y-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Assign Role
                          </label>
                          <span className="text-[10px] text-slate-500">
                            {isOrganizer ? 'Organizer' : 'Admin'}
                          </span>
                        </div>
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as UserRole)}
                          className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                        >
                          {isOrganizer && <option value="admin">Administrator</option>}
                          <option value="hr">HR</option>
                          <option value="manager">Manager (Planning &amp; Team Lead)</option>
                          <option value="employee">Employee (Contributor)</option>
                        </select>
                      </div>
                    )}
                    {m.role === 'organizer' && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[11px] text-violet-400 font-semibold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Organization Super Admin &amp; Owner</span>
                      </div>
                    )}
                  </CardContent>

                  <div className="border-t border-slate-800/80 bg-navy-950/40 p-3 px-5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {memberTasks.length} active task{memberTasks.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link href={`/employees/${m.userId}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <span>View Profile</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                      {isAdmin && m.userId !== user?.id && m.role !== 'organizer' && (isOrganizer || m.role !== 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const isPendingMember = Boolean(m.isPending || m.accountStatus === 'pending_setup');
                            const memberActualId = isPendingMember
                              ? (m.membershipId || (m.id && m.id.startsWith('pending-') ? m.id.replace('pending-', '') : m.id))
                              : m.userId;

                            if (!isPendingMember && (!m.userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.userId))) {
                              setActionError(`Cannot remove ${m.fullName}: Active member user identifier is missing or invalid.`);
                              return;
                            }
                            handleRemoveMember(memberActualId, m.fullName, isPendingMember);
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          title="Remove Profile"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          <span>Remove Profile</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-500 mb-3" />
            <h4 className="text-base font-bold text-white">No members matching criteria</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Try adjusting your search criteria or add new team members.
            </p>
          </div>
        )
      ) : (
        /* MOCK / DEMO DATA FALLBACK */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMockEmployees.map((emp) => {
            const utilPct = Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100);
            const initials = emp.fullName
              .split(' ')
              .map((n) => n[0])
              .join('');

            return (
              <Card
                key={emp.id}
                className="flex flex-col justify-between border-slate-800/90 hover:border-violet-500/50 hover:shadow-glow/20 transition-all duration-200 group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-sm font-bold text-white shadow-sm border border-violet-400/30">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors truncate">
                          {emp.fullName}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">{emp.jobTitle}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        utilPct > 100 ? 'rose' : utilPct >= 80 ? 'amber' : 'emerald'
                      }
                      size="sm"
                    >
                      {utilPct > 100
                        ? 'Overloaded'
                        : utilPct >= 80
                        ? 'Near Limit'
                        : 'Optimal'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-2.5">
                    <span className="font-semibold text-slate-300">{emp.department}</span>
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="h-3 w-3 text-slate-500" />
                      {emp.location}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Weekly Load</span>
                      <span
                        className={
                          utilPct > 100 ? 'text-rose-400 font-bold' : 'text-slate-200'
                        }
                      >
                        {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h ({utilPct}%)
                      </span>
                    </div>
                    <ProgressBar value={utilPct} />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Verified Skills
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {emp.skills.slice(0, 3).map((s) => (
                        <Badge key={s.skillId} variant="cyan" size="sm">
                          {s.skillName}
                          <span className="text-[9px] text-cyan-300 font-mono">
                            • {s.proficiency[0].toUpperCase()}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <div className="border-t border-slate-800/80 bg-navy-950/40 p-3 px-5 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {emp.activeTaskCount} active task{emp.activeTaskCount !== 1 ? 's' : ''}
                  </span>
                  <Link href={`/employees/${emp.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <span>View Profile</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Admin Add Member Dialog */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={isLive ? 'Add Organization Member' : 'Add Simulated Team Member'}
        description={
          isLive
            ? 'Add a member to your organization workspace. Details are immediately saved, and the member is enrolled with Pending Setup status until their first login.'
            : 'Simulated member addition for demo exploration.'
        }
      >
        <form onSubmit={handleAddMemberSubmit} className="space-y-4 py-2">
          {addMemberError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{addMemberError}</span>
            </div>
          )}

          {addMemberSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
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
            <label className="block text-xs font-semibold text-slate-300">
              Assigned Role *
            </label>
            <select
              value={addMemberRole}
              onChange={(e) => setAddMemberRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              {isOrganizer && <option value="admin">Administrator — Workspace management &amp; settings</option>}
              <option value="hr">HR — Talent management, rosters &amp; capacity oversight</option>
              <option value="manager">Manager — Team lead, allocations &amp; task management</option>
              <option value="employee">Employee — Direct contributor, tasks &amp; schedule</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Assigned role is saved immediately. When the member logs in for the first time, they verify their email and set their password.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
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

      {/* Project Assignment Workflow Dialog */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={assignTargetMember ? `Assign ${assignTargetMember.fullName} to Project` : 'Assign Member to Project'}
        description="Allocate an existing team member to an active project portfolio initiative and optionally assign open tasks."
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

          {!assignTargetMember && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Select Active Member *
              </label>
              <select
                onChange={(e) => {
                  const m = liveMembers.find((mem) => mem.userId === e.target.value);
                  if (m) setAssignTargetMember({ userId: m.userId, fullName: m.fullName });
                }}
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
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
            <label className="block text-xs font-semibold text-slate-300">
              Select Target Project *
            </label>
            {dbProjects.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300">
                No active projects exist in this workspace. Please create a project on the Projects page first.
              </div>
            ) : (
              <select
                value={assignProjectId}
                onChange={(e) => {
                  setAssignProjectId(e.target.value);
                  setAssignTaskIds([]);
                }}
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
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
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold text-slate-300">
                Optionally Assign Open Tasks from this Project:
              </label>
              {dbTasks.filter((t) => t.projectId === assignProjectId && !t.assignedTo).length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  No unassigned tasks found for this project.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-navy-950/60 p-2">
                  {dbTasks
                    .filter((t) => t.projectId === assignProjectId && !t.assignedTo)
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
              disabled={assignLoading || dbProjects.length === 0 || !assignProjectId}
            >
              {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
