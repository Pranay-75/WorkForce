'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMockStore } from '@/lib/mockStore';
import { useProjects } from '@/lib/hooks/useProjects';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import { MetricCard } from '@/components/ui/MetricCard';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
import {
  ArrowLeft,
  Mail,
  MapPin,
  Clock,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
  Award,
  Calendar,
  FolderKanban,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Edit3,
  Phone,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params?.id as string;

  const { isAuthenticated, organization, role: authRole, user } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);
  const isOrganizer = authRole === 'organizer';
  const isAdmin = authRole === 'admin' || isOrganizer;
  const isManagerOrAdmin = isAdmin || authRole === 'manager';

  // Live hooks
  const {
    members: liveMembers,
    isLoading: isMembersLoading,
    updateCurrentUserProfile,
    updateMemberRole,
    refetch: refetchMembers,
  } = useOrganizationMembers();
  const { projects: dbProjects, addProjectMember, refetch: refetchProjects } = useProjects();
  const { tasks: dbTasks, assignTask, refetch: refetchTasks } = useTasks();

  // Mock store fallback
  const {
    employees: mockEmployees,
    tasks: mockTasks,
    projects: mockProjects,
    activeRole: mockRole,
    currentUserId: mockUserId,
    updateEmployeeProfile,
  } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;

  // Project Assignment Dialog State
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [assignProjectId, setAssignProjectId] = React.useState<string>('');
  const [assignTaskIds, setAssignTaskIds] = React.useState<string[]>([]);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  // Edit Profile Dialog State
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editFullName, setEditFullName] = React.useState('');
  const [editJobTitle, setEditJobTitle] = React.useState('');
  const [editDepartment, setEditDepartment] = React.useState('Engineering');
  const [editCapacityHours, setEditCapacityHours] = React.useState<number>(40);
  const [editPhone, setEditPhone] = React.useState('');
  const [editLoading, setEditLoading] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editSuccess, setEditSuccess] = React.useState<string | null>(null);

  // Role Change State for Admins
  const [roleChangeLoading, setRoleChangeLoading] = React.useState(false);
  const [roleChangeError, setRoleChangeError] = React.useState<string | null>(null);
  const [roleChangeSuccess, setRoleChangeSuccess] = React.useState<string | null>(null);

  const isSelf = isLive
    ? Boolean(user?.id && (user.id === employeeId || liveMembers.some((m) => m.userId === user.id && (m.id === employeeId || m.userId === employeeId))))
    : (mockUserId === employeeId);

  // Mandatory role access guard (all React hooks must be declared above)
  if (activeRole === 'employee' && !isSelf) {
    return (
      <AccessDenied
        resourceName="Employee Profile & Allocation Detail"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="Viewing other employee profiles, performance insights, and allocation histories is restricted to management and administrative personnel."
      />
    );
  }

  // Loading skeleton for live mode
  if (isLive && isMembersLoading) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6">
        <div className="h-6 w-36 bg-wf-surface-subtle rounded-xl" />
        <div className="h-56 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
          <div className="h-28 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
          <div className="h-28 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
          <div className="h-28 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
          <div className="h-64 bg-wf-surface-card rounded-2xl border border-wf-border-default" />
        </div>
      </div>
    );
  }

  // Resolve employee either from live members or mock store
  const liveMember = isLive ? liveMembers.find((m) => m.userId === employeeId || m.id === employeeId) : null;
  const mockEmployee = !isLive ? mockEmployees.find((e) => e.id === employeeId) : null;

  if (!liveMember && !mockEmployee) {
    return (
      <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-12 text-center space-y-4 shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wf-surface-subtle border border-wf-border-default text-wf-text-muted">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-wf-text-primary">Employee Not Found</h3>
          <p className="text-xs text-wf-text-secondary max-w-sm mx-auto">
            The requested employee identifier does not exist in the active organization directory.
          </p>
        </div>
        <div>
          <Link href="/employees">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span>Back to Directory</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Unified employee representation
  const targetUid = isLive ? (liveMember?.userId || employeeId) : mockEmployee!.id;
  const fullName = isLive ? liveMember!.fullName : mockEmployee!.fullName;
  const email = isLive ? liveMember!.email : mockEmployee!.email;
  const role = isLive ? liveMember!.role : mockEmployee!.role;
  const department = isLive ? (liveMember!.department || 'Engineering') : mockEmployee!.department;
  const jobTitle = isLive ? (liveMember!.jobTitle || 'Team Member') : mockEmployee!.jobTitle;
  const weeklyCapacityHours = isLive ? (liveMember!.weeklyCapacityHours ?? 40) : mockEmployee!.weeklyCapacityHours;
  const phone = isLive ? liveMember?.phone : undefined;

  // Resolve assigned tasks
  const assignedTasks = isLive
    ? dbTasks.filter((t) => t.assignedTo === targetUid)
    : mockTasks.filter((t) => t.assignedTo === mockEmployee!.id);

  const activeTasks = assignedTasks.filter((t) => t.status !== 'completed');

  const currentLoadHours = isLive
    ? activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    : mockEmployee!.currentLoadHours;

  const utilPct = weeklyCapacityHours > 0 ? Math.round((currentLoadHours / weeklyCapacityHours) * 100) : 0;
  const riskIndex = Math.min(100, Math.round(utilPct * 0.9));

  // Resolve allocated projects for live and demo modes
  const allocatedProjects = isLive
    ? dbProjects.filter((p) => p.memberIds.includes(targetUid))
    : (mockProjects || []).filter((p) => p.memberIds.includes(targetUid));

  const employee = {
    id: targetUid,
    fullName,
    email,
    role,
    department,
    jobTitle,
    weeklyCapacityHours,
    currentLoadHours,
    burnoutRiskScore: Math.min(Math.round(utilPct) / 100, 1.0),
    skills: mockEmployee?.skills || [],
    avatarUrl: liveMember?.avatarUrl || mockEmployee?.avatarUrl,
    phone,
  };

  // Handle opening Project Assignment Modal
  const handleOpenAssignModal = () => {
    setAssignError(null);
    setAssignSuccess(null);
    setAssignTaskIds([]);
    const unallocated = dbProjects.find((p) => !p.memberIds.includes(targetUid));
    setAssignProjectId(unallocated ? unallocated.id : (dbProjects[0]?.id || ''));
    setIsAssignModalOpen(true);
  };

  // Submit Project & Tasks Assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignProjectId || !targetUid) return;

    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);

    // 1. Add project member
    const res = await addProjectMember(assignProjectId, targetUid);
    if (res.error) {
      setAssignLoading(false);
      setAssignError(res.error);
      return;
    }

    // 2. Optionally assign selected tasks
    if (assignTaskIds.length > 0) {
      for (const taskId of assignTaskIds) {
        await assignTask(taskId, targetUid);
      }
      await refetchTasks();
    }

    await refetchProjects();
    setAssignLoading(false);
    setAssignSuccess(`Assigned ${fullName} to project initiative.`);
    setTimeout(() => {
      setIsAssignModalOpen(false);
      setAssignSuccess(null);
    }, 1500);
  };

  // Handle opening Edit Profile Modal
  const handleOpenEditModal = () => {
    setEditFullName(fullName);
    setEditJobTitle(jobTitle);
    setEditDepartment(department);
    setEditCapacityHours(weeklyCapacityHours);
    setEditPhone(phone || '');
    setEditError(null);
    setEditSuccess(null);
    setIsEditModalOpen(true);
  };

  // Submit Profile Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    const trimmedName = editFullName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      setEditError('Full name must be between 2 and 100 characters.');
      return;
    }

    const trimmedJob = editJobTitle.trim();
    if (trimmedJob.length < 2 || trimmedJob.length > 100) {
      setEditError('Job title must be between 2 and 100 characters.');
      return;
    }

    const capacity = Number(editCapacityHours);
    if (isNaN(capacity) || capacity <= 0 || capacity > 168) {
      setEditError('Weekly capacity hours must be between 1 and 168 hours.');
      return;
    }

    setEditLoading(true);

    if (isLive) {
      const res = await updateCurrentUserProfile({
        fullName: trimmedName,
        phone: editPhone ? editPhone.trim() : null,
        department: editDepartment,
        jobTitle: trimmedJob,
        weeklyCapacityHours: capacity,
      });

      setEditLoading(false);
      if (res.error) {
        setEditError(res.error);
      } else {
        setEditSuccess('Profile details successfully updated in PostgreSQL database.');
        setTimeout(() => {
          setIsEditModalOpen(false);
          setEditSuccess(null);
        }, 1500);
      }
    } else {
      updateEmployeeProfile(targetUid, {
        fullName: trimmedName,
        jobTitle: trimmedJob,
        department: editDepartment as any,
        weeklyCapacityHours: capacity,
      });

      setEditLoading(false);
      setEditSuccess('Demo profile details updated in local state.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess(null);
      }, 1500);
    }
  };

  // Role Change Handler for Admins
  const handleRoleChange = async (newRole: UserRole) => {
    setRoleChangeError(null);
    setRoleChangeSuccess(null);
    setRoleChangeLoading(true);

    const { error: roleErr } = await updateMemberRole(targetUid, newRole);
    setRoleChangeLoading(false);

    if (roleErr) {
      setRoleChangeError(roleErr);
    } else {
      setRoleChangeSuccess(`Role successfully updated to ${newRole.toUpperCase()}.`);
      setTimeout(() => setRoleChangeSuccess(null), 3000);
    }
  };

  // 8-week capacity history for demo exploration
  const historyData = [
    { week: 'W1', load: Math.max(employee.weeklyCapacityHours - 4, 0), pct: 90 },
    { week: 'W2', load: Math.max(employee.weeklyCapacityHours - 2, 0), pct: 95 },
    { week: 'W3', load: Math.max(employee.weeklyCapacityHours - 8, 0), pct: 80 },
    { week: 'W4', load: employee.weeklyCapacityHours, pct: 100 },
    { week: 'W5', load: Math.max(employee.weeklyCapacityHours - 6, 0), pct: 85 },
    { week: 'W6', load: Math.max(employee.weeklyCapacityHours - 2, 0), pct: 95 },
    { week: 'W7', load: Math.round(employee.weeklyCapacityHours * 1.05), pct: 105 },
    { week: 'W8 (Now)', load: employee.currentLoadHours, pct: utilPct },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      {/* Back Navigation Bar & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link href="/employees">
          <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Back to Talent Directory</span>
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/* Self-Profile Edit Button */}
          {isSelf && (
            <Button variant="secondary" size="sm" onClick={handleOpenEditModal} className="text-xs">
              <Edit3 className="h-3.5 w-3.5 mr-1.5 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Edit Profile</span>
            </Button>
          )}

          {/* Project Assignment Action */}
          {isManagerOrAdmin && isLive && (
            <Button variant="secondary" size="sm" onClick={handleOpenAssignModal} className="text-xs">
              <FolderKanban className="h-3.5 w-3.5 mr-1.5 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Assign Project</span>
            </Button>
          )}

          <Badge variant="slate" size="sm" className="font-mono">
            ID: {employee.id.slice(0, 8)}
          </Badge>
          <Badge
            variant={utilPct > 100 ? 'danger' : utilPct >= 80 ? 'warning' : utilPct > 0 ? 'success' : 'slate'}
            size="sm"
          >
            {utilPct > 100 ? 'Overload Alert' : utilPct >= 80 ? 'Near Limit' : utilPct > 0 ? 'Optimal Capacity' : 'Available'}
          </Badge>
        </div>
      </div>

      {/* Role Administration Banner for Admins */}
      {isAdmin && isLive && !isSelf && role !== 'organizer' && (
        <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-4 sm:px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-card">
          <div className="flex items-center gap-2.5 text-xs text-wf-text-secondary">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wf-surface-subtle text-wf-brand-burgundy dark:text-wf-cream border border-wf-border-default shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span>Admin Governance: Manage membership role for <strong className="text-wf-text-primary font-semibold">{fullName}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-wf-text-muted uppercase tracking-wider font-semibold">
              Role:
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              disabled={roleChangeLoading || (!isOrganizer && role === 'admin')}
              className="rounded-xl border border-wf-border-default bg-wf-surface-subtle px-3 py-1.5 text-xs text-wf-text-primary focus:border-wf-border-focus focus:outline-none disabled:opacity-50 transition-colors"
            >
              {isOrganizer && <option value="admin">Administrator (Full Access)</option>}
              <option value="manager">Manager (Planning &amp; Team Lead)</option>
              <option value="hr">HR (People &amp; Capacity)</option>
              <option value="employee">Employee (Contributor)</option>
            </select>
          </div>
        </div>
      )}

      {/* Role Change Feedback */}
      {roleChangeSuccess && (
        <div className="rounded-2xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3.5 text-xs text-wf-semantic-success flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{roleChangeSuccess}</span>
        </div>
      )}
      {roleChangeError && (
        <div className="rounded-2xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{roleChangeError}</span>
        </div>
      )}

      {/* Hero Profile Header Card */}
      <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <InteractiveAvatar
              name={employee.fullName}
              jobTitle={employee.jobTitle}
              department={employee.department}
              avatarUrl={employee.avatarUrl}
              size="lg"
              utilizationPct={utilPct}
              weeklyCapacityHours={employee.weeklyCapacityHours}
              activeAssignedHours={employee.currentLoadHours}
              employeeId={employee.id}
              showPopover={false}
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-wf-text-primary">
                  {employee.fullName}
                </h1>
                <Badge
                  variant={
                    role === 'organizer'
                      ? 'burgundy'
                      : role === 'admin'
                      ? 'danger'
                      : role === 'manager'
                      ? 'warning'
                      : role === 'hr'
                      ? 'cyan'
                      : 'slate'
                  }
                  size="sm"
                  className="uppercase text-[10px] font-semibold tracking-wider"
                >
                  {role}
                </Badge>
                {isSelf && (
                  <Badge variant="sage" size="sm" className="text-[10px]">
                    You
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium text-wf-text-secondary">
                {jobTitle} <span className="text-wf-text-muted">•</span> {department}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-wf-text-muted pt-1">
                <span className="flex items-center gap-1.5 font-mono">
                  <Mail className="h-3.5 w-3.5 text-wf-text-tertiary" />
                  {email}
                </span>
                {phone && (
                  <span className="flex items-center gap-1.5 font-mono">
                    <Phone className="h-3.5 w-3.5 text-wf-text-tertiary" />
                    {phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-wf-text-tertiary" />
                  {isLive ? 'Active Organization Member' : 'San Francisco, CA'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between lg:justify-center gap-2 sm:gap-4 lg:gap-1.5 p-4 rounded-xl bg-wf-surface-subtle border border-wf-border-default min-w-[220px]">
            <span className="text-[11px] font-semibold text-wf-text-muted uppercase tracking-wider">
              Sprint Allocation
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-wf-text-primary">
              {currentLoadHours}h <span className="text-sm font-normal text-wf-text-secondary">/ {weeklyCapacityHours}h</span>
            </div>
            <div className="w-full sm:w-44 lg:w-48 pt-1">
              <ProgressBar value={utilPct} colorScheme="auto" />
            </div>
            <span className="text-[11px] text-wf-text-secondary">
              {utilPct}% of weekly capacity
            </span>
          </div>
        </div>
      </div>

      {/* Executive Workload & Capacity Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Weekly Capacity Baseline"
          value={`${weeklyCapacityHours}h`}
          subtitle="Contractual weekly hours"
          icon={<Clock className="h-4 w-4 text-wf-text-muted" />}
          badgeText="Baseline"
          badgeVariant="slate"
        />

        <MetricCard
          title="Active Assigned Load"
          value={`${currentLoadHours}h`}
          subtitle={`${activeTasks.length} active tasks scheduled`}
          icon={<CheckSquare className="h-4 w-4 text-wf-text-muted" />}
          badgeText={utilPct > 100 ? 'Over Limit' : utilPct >= 80 ? 'Heavy Load' : 'Optimal'}
          badgeVariant={utilPct > 100 ? 'danger' : utilPct >= 80 ? 'warning' : 'success'}
        />

        <MetricCard
          title="Capacity Utilization"
          value={`${utilPct}%`}
          subtitle={utilPct > 100 ? 'Requires task redistribution' : utilPct >= 80 ? 'Approaching max threshold' : 'Balanced distribution'}
          progress={{ value: utilPct, colorScheme: 'auto' }}
          badgeText={utilPct > 100 ? 'Overload' : utilPct >= 80 ? 'Near Limit' : 'Optimal'}
          badgeVariant={utilPct > 100 ? 'danger' : utilPct >= 80 ? 'warning' : 'success'}
        />

        <MetricCard
          title="Allocated Initiatives"
          value={allocatedProjects.length}
          subtitle="Active portfolio commitments"
          icon={<FolderKanban className="h-4 w-4 text-wf-text-muted" />}
          badgeText={allocatedProjects.length > 0 ? 'Assigned' : 'Unallocated'}
          badgeVariant={allocatedProjects.length > 0 ? 'burgundy' : 'slate'}
        />
      </div>

      {/* Allocated Projects & Verified Skills Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Allocated Projects Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                <CardTitle>Allocated Projects ({allocatedProjects.length})</CardTitle>
              </div>
              {isManagerOrAdmin && isLive && (
                <Button variant="ghost" size="sm" onClick={handleOpenAssignModal} className="text-xs text-wf-brand-burgundy dark:text-wf-cream hover:bg-wf-surface-subtle">
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  <span>Assign</span>
                </Button>
              )}
            </div>
            <CardDescription>
              Active project portfolio initiatives this member contributes to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocatedProjects.length > 0 ? (
              allocatedProjects.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3.5 hover:border-wf-border-focus/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-xs font-semibold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors flex items-center gap-1"
                      >
                        <span>{p.name}</span>
                        <ExternalLink className="h-3 w-3 text-wf-text-muted" />
                      </Link>
                      <Badge
                        variant={
                          p.priority === 'critical'
                            ? 'danger'
                            : p.priority === 'high'
                            ? 'warning'
                            : 'slate'
                        }
                        size="sm"
                      >
                        {p.priority}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {p.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-wf-text-secondary">
                      <span>Lead: {p.managerName || 'Assigned Lead'}</span>
                      {p.totalHours !== undefined && (
                        <>
                          <span className="text-wf-text-muted">•</span>
                          <span className="font-mono text-wf-text-primary">
                            {p.completedHours || 0}h / {p.totalHours}h
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <Link href={`/projects/${p.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      <span>View</span>
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-wf-text-secondary">
                <FolderKanban className="mx-auto h-8 w-8 text-wf-text-muted mb-2" />
                <p className="text-xs font-medium text-wf-text-primary">
                  Not allocated to any active projects
                </p>
                <p className="text-[11px] text-wf-text-muted mt-1 max-w-sm mx-auto">
                  {isManagerOrAdmin
                    ? 'Use the Assign action above to allocate this member to active initiatives.'
                    : 'No project allocations currently assigned to this profile.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verified Technical Skills Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
              <CardTitle>Skills &amp; Competencies ({employee.skills.length})</CardTitle>
            </div>
            <CardDescription>
              Verified technical capabilities used by deterministic matching and workload planning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {employee.skills.length > 0 ? (
              employee.skills.map((s) => (
                <div
                  key={s.skillId}
                  className="flex items-center justify-between rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-wf-text-primary">
                        {s.skillName}
                      </span>
                      <Badge variant="slate" size="sm">
                        {s.category}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-wf-text-muted">
                      Status: {s.verified ? 'Verified by Lead' : 'Self-Reported'}
                    </span>
                  </div>

                  <Badge
                    variant={
                      s.proficiency === 'expert'
                        ? 'burgundy'
                        : s.proficiency === 'advanced'
                        ? 'cyan'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {s.proficiency.toUpperCase()}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-wf-text-secondary">
                <Award className="mx-auto h-8 w-8 text-wf-text-muted mb-2" />
                <p className="text-xs font-medium text-wf-text-primary">
                  Default skills linked via department role ({employee.department})
                </p>
                <p className="text-[11px] text-wf-text-muted mt-1 max-w-sm mx-auto">
                  Technical skills are evaluated dynamically during project staffing and deterministic task assignment.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational Capacity Overview & Assigned Tasks Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Operational Capacity Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
              <CardTitle>Operational Capacity Overview</CardTitle>
            </div>
            <CardDescription>
              Sprint utilization benchmarks ({employee.weeklyCapacityHours}h standard baseline)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLive ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-wf-text-secondary">
                <Clock className="h-8 w-8 text-wf-text-muted mb-2" />
                <p className="text-xs font-medium text-wf-text-primary">
                  Current sprint utilization: {utilPct}% ({currentLoadHours}h / {weeklyCapacityHours}h)
                </p>
                <p className="text-[11px] text-wf-text-muted mt-1 max-w-sm">
                  Historical capacity trends will populate automatically as multi-week operational snapshots accumulate.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-2 h-36 pt-4 border-b border-wf-border-default pb-2">
                  {historyData.map((item, idx) => {
                    const heightPct = Math.min((item.load / (employee.weeklyCapacityHours * 1.25 || 50)) * 100, 100);
                    const isOver = item.pct > 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10px] font-mono text-wf-text-muted">
                          {item.load}h
                        </span>
                        <div
                          className={cn(
                            'w-full rounded-t-md transition-all duration-300',
                            isOver
                              ? 'bg-wf-semantic-danger shadow-sm'
                              : 'bg-wf-brand-burgundy/80 dark:bg-wf-cream/70'
                          )}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] font-semibold text-wf-text-muted">
                          {item.week}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs text-wf-text-secondary pt-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-wf-brand-burgundy dark:bg-wf-cream" />
                    <span>Standard Load</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-wf-semantic-danger" />
                    <span>Capacity Overload</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-wf-text-primary">
                    Avg: {Math.round(historyData.reduce((s, i) => s + i.pct, 0) / historyData.length)}%
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Assigned Tasks Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                <CardTitle>Currently Assigned Tasks ({assignedTasks.length})</CardTitle>
              </div>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                  Manage Tasks
                </Button>
              </Link>
            </div>
            <CardDescription>
              Active commitments contributing to this member&apos;s current weekly workload
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedTasks.length > 0 ? (
              <div className="divide-y divide-wf-border-default max-h-72 overflow-y-auto">
                {assignedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/tasks/${t.id}`}
                          className="text-xs font-semibold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors"
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
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-wf-text-secondary">
                        <span>{t.projectName}</span>
                        {t.dueDate && (
                          <>
                            <span className="text-wf-text-muted">•</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="h-3 w-3 text-wf-text-muted" /> Due {t.dueDate}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-wf-text-primary">
                        {t.estimatedHours} hrs
                      </span>
                      <Badge variant="outline" size="sm">
                        {t.status.replace('_', ' ').toUpperCase()}
                      </Badge>
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
              <div className="p-8 text-center text-wf-text-secondary">
                <CheckSquare className="mx-auto h-8 w-8 text-wf-text-muted mb-2" />
                <p className="text-xs font-medium text-wf-text-primary">
                  No active tasks assigned
                </p>
                <p className="text-[11px] text-wf-text-muted mt-1">
                  This employee has full open availability for new project allocations.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operational Risk Assessment Callout */}
      <div className="rounded-2xl border border-wf-border-default bg-wf-surface-card p-4.5 text-xs text-wf-text-secondary flex items-start gap-3.5 shadow-card">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wf-semantic-warning-bg text-wf-semantic-warning border border-wf-semantic-warning-border shrink-0 mt-0.5">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <span className="font-semibold text-wf-text-primary block">
            Transparent Heuristic Risk Model
          </span>
          <p className="leading-relaxed text-wf-text-secondary">
            Operational risk scores ({Math.round(employee.burnoutRiskScore * 100)}% index) reflect
            purely active assigned workload divided by weekly capacity.
            They are operational metrics designed to prevent delivery delays and over-allocation, not clinical or
            psychological predictions.
          </p>
        </div>
      </div>

      {/* Assign to Project Dialog */}
      <Dialog
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign ${fullName} to Project`}
        description="Allocate this team member to an active project portfolio initiative and optionally assign open deliverables."
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

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-wf-text-secondary">
              Select Target Project *
            </label>
            {dbProjects.length === 0 ? (
              <p className="text-xs text-wf-semantic-warning">No active projects found in workspace.</p>
            ) : (
              <select
                value={assignProjectId}
                onChange={(e) => {
                  setAssignProjectId(e.target.value);
                  setAssignTaskIds([]);
                }}
                className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
                required
              >
                <option value="" disabled>-- Select a Project --</option>
                {dbProjects.map((p) => {
                  const isAllocated = p.memberIds.includes(targetUid);
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
                  No unassigned tasks found for this project.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-2.5">
                  {dbTasks
                    .filter((t) => t.projectId === assignProjectId && !t.assignedTo)
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
              disabled={assignLoading || !assignProjectId}
            >
              {assignLoading ? 'Assigning...' : 'Confirm Project Assignment'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile Details"
        description={
          isLive
            ? 'Update your personal profile information. Profile changes are saved securely to your verified Supabase user profile.'
            : 'Update synthetic profile attributes for demo exploration.'
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
          {editError && (
            <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3 text-xs text-wf-semantic-danger flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          {editSuccess && (
            <div className="rounded-xl border border-wf-semantic-success-border bg-wf-semantic-success-bg p-3 text-xs text-wf-semantic-success flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{editSuccess}</span>
            </div>
          )}

          <Input
            label="Full Legal Name *"
            value={editFullName}
            onChange={(e) => setEditFullName(e.target.value)}
            placeholder="Jane Doe"
            required
          />

          <Input
            label="Professional Job Title *"
            value={editJobTitle}
            onChange={(e) => setEditJobTitle(e.target.value)}
            placeholder="Senior Software Engineer"
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Department *
            </label>
            <select
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              required
            >
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="QA">QA</option>
              <option value="DevOps">DevOps</option>
              <option value="Executive">Executive</option>
              <option value="Human Resources">Human Resources</option>
              <option value="Administration">Administration</option>
              <option value="People & Operations">People &amp; Operations</option>
            </select>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-wf-text-secondary select-none tracking-tight">
              Weekly Capacity Baseline (Hours/Week) *
            </label>
            <input
              type="number"
              min={1}
              max={168}
              step={0.5}
              value={editCapacityHours}
              onChange={(e) => setEditCapacityHours(parseFloat(e.target.value) || 0)}
              className="w-full rounded-xl border border-wf-border-default bg-wf-surface-card px-3.5 py-2 text-sm text-wf-text-primary focus:border-wf-border-focus focus:outline-none transition-colors"
              required
            />
            <p className="text-[11px] text-wf-text-muted">
              Standard full-time baseline is 40.0h. Used to calculate utilization and overload thresholds.
            </p>
          </div>

          <Input
            label="Contact Phone Number (Optional)"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+1 (555) 012-3456"
          />

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-wf-border-default">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={editLoading || !editFullName.trim() || !editJobTitle.trim()}
            >
              {editLoading ? 'Saving Changes...' : 'Save Profile Details'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
