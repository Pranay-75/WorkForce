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

export default function EmployeesDirectoryPage() {
  const { isAuthenticated, organization, role: currentUserRole, user } = useAuth();
  const isOrganizer = currentUserRole === 'organizer';
  const isAdmin = currentUserRole === 'admin' || isOrganizer;

  // Live Supabase organization members hook
  const {
    members: liveMembers,
    isLoading: isLiveLoading,
    error: liveError,
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
  const { employees: mockEmployees, skills: mockSkills, addNewEmployee } = useMockStore();

  const isLive = Boolean(isAuthenticated && organization);

  // Filters state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDept, setSelectedDept] = React.useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = React.useState<string>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false);

  // Project Assignment Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignTargetMember, setAssignTargetMember] = React.useState<{ userId: string; fullName: string } | null>(null);
  const [assignProjectId, setAssignProjectId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Invite Modal Form State
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<UserRole>('employee');
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = React.useState<string | null>(null);

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

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    const { error: invErr, data } = await inviteMember(inviteEmail.trim(), inviteRole);

    setInviteLoading(false);
    if (invErr) {
      setInviteError(invErr);
    } else {
      setInviteSuccess(
        data?.status === 'member_added'
          ? `User ${inviteEmail.trim()} was added directly as ${inviteRole}.`
          : `Invitation created for ${inviteEmail.trim()} as ${inviteRole}.`
      );
      setInviteEmail('');
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(null);
      }, 1500);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    setActionError(null);
    setActionSuccess(null);
    const { error } = await updateMemberRole(targetUserId, newRole);
    if (error) {
      setActionError(error);
    } else {
      setActionSuccess(`Member role updated to ${newRole}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleRemoveMember = async (targetUserId: string, targetName: string) => {
    if (!confirm(`Are you sure you want to remove ${targetName} from the organization?`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    const { error } = await removeMember(targetUserId);
    if (error) {
      setActionError(error);
    } else {
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
            {isLive && (
              <Badge variant="emerald" size="sm">
                Connected to Supabase
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isLive
              ? `Managing members for workspace: ${organization?.name || 'Active Workspace'}`
              : 'Browse verified skills, monitor live capacity utilization, and inspect individual workloads'}
          </p>
        </div>

        {isLive ? (
          isAdmin ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => handleOpenAssignModal()}
              >
                <FolderKanban className="h-4 w-4 mr-1.5 text-cyan-400" />
                <span>Assign to Project</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setInviteError(null);
                  setInviteSuccess(null);
                  setIsInviteModalOpen(true);
                }}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                <span>Invite Member</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-navy-900 border border-slate-800 px-3 py-2 rounded-xl">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              <span>Only organization admins can invite or assign roles</span>
            </div>
          )
        ) : (
          <Button variant="primary" size="md" onClick={() => setIsInviteModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            <span>Add Employee (Demo)</span>
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

      {/* LIVE SUPABASE MEMBERS RENDERING */}
      {isLive ? (
        isLiveLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-8 w-8 mx-auto rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-400">Loading organization members from Supabase...</p>
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
                      <Badge variant={roleInfo.badge} size="sm">
                        {roleInfo.label}
                      </Badge>
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

                    {/* Role Administration Controls for Organization Admin / Organizer */}
                    {isAdmin && m.role !== 'organizer' && (
                      <div className="space-y-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Assign Role
                          </label>
                          <span className="text-[10px] text-slate-500">Database Enforced</span>
                        </div>
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as UserRole)}
                          disabled={!isOrganizer && m.role === 'admin'}
                          className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-2 py-1 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:opacity-50"
                        >
                          {isOrganizer && <option value="admin">Administrator (Full Access)</option>}
                          <option value="manager">Manager (Planning &amp; Team Lead)</option>
                          <option value="hr">HR (People &amp; Capacity)</option>
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
                      {isAdmin && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenAssignModal({ userId: m.userId, fullName: m.fullName })}
                          className="text-xs"
                        >
                          <FolderKanban className="h-3.5 w-3.5 mr-1 text-cyan-400" />
                          <span>Assign Project</span>
                        </Button>
                      )}
                      <Link href={`/employees/${m.userId}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <span>Profile</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                      {isAdmin && m.userId !== user?.id && m.role !== 'organizer' && (isOrganizer || m.role !== 'admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(m.userId, m.fullName)}
                          className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
              Try adjusting your search criteria or invite team members.
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

      {/* Admin Invite Member Dialog */}
      <Dialog
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title={isLive ? 'Invite Organization Member' : 'Add Simulated Team Member'}
        description={
          isLive
            ? 'Only organization administrators can invite members and assign roles. Invitations are verified and enforced in PostgreSQL.'
            : 'Simulated profile creation for demo exploration.'
        }
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
          {inviteError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {inviteSuccess && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          <Input
            label="Recipient Work Email *"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Assigned Role *
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="employee">Employee — Direct contributor, tasks &amp; schedule</option>
              <option value="manager">Manager — Team lead, allocations &amp; task management</option>
              {isOrganizer && (
                <option value="admin">Administrator — Workspace management &amp; project admin</option>
              )}
            </select>
            <p className="text-[11px] text-slate-400">
              {isOrganizer
                ? 'As Founding Organizer, you can invite Administrators, Managers, and Employees directly.'
                : 'Assigned role is saved to the database. Administrator invitations require Organizer authority.'}
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={inviteLoading || !inviteEmail.trim()}
            >
              {inviteLoading ? 'Sending Invitation...' : 'Send Secure Invitation'}
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
