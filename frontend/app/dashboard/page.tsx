'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  Users,
  CheckSquare,
  Sparkles,
  Flame,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  CheckCircle2,
  Calendar,
  Layers,
  AlertTriangle,
  Clock,
  Award,
  ShieldCheck,
  Building2,
  History,
} from 'lucide-react';

export default function DashboardPage() {
  const { organization, profile, user } = useAuth();
  const {
    members,
    isLoading: isMembersLoading,
    error: membersError,
    refetch: refetchMembers,
    totalMembers,
    totalCapacityHours,
    departments: realDepartments,
  } = useOrganizationMembers();

  const {
    employees,
    projects,
    tasks,
    recommendations,
    auditEvents,
    activeRole,
    currentUser,
    currentUserId,
    approveRecommendation,
    updateTaskStatus,
  } = useMockStore();

  // Find employee entity matching current user or construct from authenticated session
  const currentEmp = React.useMemo(() => {
    const userCapacity = profile?.weeklyCapacityHours ?? 40;
    const foundMember = members.find((m) => m.userId === user?.id);
    const foundEmp = employees.find((e) => e.id === currentUserId);

    return {
      id: user?.id || currentUserId,
      fullName: profile?.fullName || currentUser.name,
      role: activeRole,
      jobTitle: profile?.jobTitle || foundMember?.jobTitle || currentUser.jobTitle,
      department: profile?.department || foundMember?.department || currentUser.department,
      skills: foundEmp?.skills || [],
      weeklyCapacityHours: userCapacity,
      currentLoadHours: 0,
      burnoutRiskScore: 0.05,
      activeTaskCount: 0,
      onTimeCompletionRate: 100,
    };
  }, [profile, user, currentUserId, currentUser, activeRole, members, employees]);

  const myTasks = tasks.filter((t) => t.assignedTo === currentEmp.id);
  const myCompletedTasks = myTasks.filter((t) => t.status === 'completed');
  const myActiveTasks = myTasks.filter((t) => t.status !== 'completed');
  const myUtilPct =
    currentEmp.weeklyCapacityHours > 0
      ? Math.round(((currentEmp.currentLoadHours || 0) / currentEmp.weeklyCapacityHours) * 100)
      : 0;

  // Real organization headcount and capacity derived strictly from Supabase
  const totalEmployees = totalMembers;
  const totalCapacity = totalCapacityHours;

  const memberUserIds = React.useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const pendingRecommendations = recommendations.filter((r) => r.status === 'pending');

  const totalAllocated = React.useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'completed' && t.assignedTo && memberUserIds.has(t.assignedTo))
      .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [tasks, memberUserIds]);

  const orgUtilizationPct = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  // Real departmental workload aggregation derived strictly from Supabase members
  const deptData = React.useMemo(() => {
    return realDepartments.map((d) => {
      const deptMemberIds = new Set(
        members.filter((m) => m.department === d.department).map((m) => m.userId)
      );
      const load = tasks
        .filter((t) => t.status !== 'completed' && t.assignedTo && deptMemberIds.has(t.assignedTo))
        .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const util = d.totalCapacityHours > 0 ? Math.round((load / d.totalCapacityHours) * 100) : 0;
      return {
        dept: d.department,
        count: d.headcount,
        capacity: d.totalCapacityHours,
        load,
        util,
      };
    });
  }, [realDepartments, members, tasks]);

  // -------------------------------------------------------------
  // 1. EMPLOYEE PERSONAL DASHBOARD VIEW
  // -------------------------------------------------------------
  if (activeRole === 'employee') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Welcome back, {currentUser.name}
              </h2>
              <Badge variant="cyan" size="sm">
                Employee Portal
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {currentEmp.jobTitle} • {currentEmp.department}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={
                myUtilPct > 100 ? 'rose' : myUtilPct >= 80 ? 'amber' : 'emerald'
              }
              size="sm"
            >
              {myUtilPct > 100
                ? 'Overloaded'
                : myUtilPct >= 80
                ? 'Near Limit'
                : 'Optimal Workload'}
            </Badge>
          </div>
        </div>

        {/* Personal Metrics Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="My Weekly Workload"
            value={`${currentEmp.currentLoadHours}h`}
            subtitle={`of ${currentEmp.weeklyCapacityHours}h standard sprint (${myUtilPct}%)`}
            progress={{ value: myUtilPct, max: 100 }}
          />
          <MetricCard
            title="Assigned Tasks"
            value={myActiveTasks.length}
            subtitle={`${myCompletedTasks.length} completed recently`}
            badgeText="In Progress"
            badgeVariant="violet"
            icon={<CheckSquare className="h-5 w-5 text-violet-400" />}
          />
          <MetricCard
            title="On-Time Delivery Rate"
            value={`${currentEmp.onTimeCompletionRate}%`}
            subtitle="Sprint benchmark velocity"
            badgeText="Top 10%"
            badgeVariant="emerald"
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
          />
          <MetricCard
            title="Verified Skills"
            value={currentEmp.skills.length}
            subtitle="Validated by Engineering Lead"
            badgeText="Active Matrix"
            badgeVariant="cyan"
            icon={<Award className="h-5 w-5 text-cyan-400" />}
          />
        </div>

        {/* My Tasks Queue + Skills Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* My Active Tasks (2 cols) */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>My Active Tasks ({myActiveTasks.length})</CardTitle>
                <CardDescription>
                  Deliverables prioritized for your current sprint
                </CardDescription>
              </div>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs">
                  <span>View Kanban Board</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {myActiveTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-800 bg-navy-900/60 p-4 space-y-2.5 transition-colors hover:bg-navy-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                        {t.projectName}
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {t.title}
                      </h4>
                    </div>
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

                  <p className="text-xs text-slate-300 line-clamp-2">
                    {t.description}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
                    <div className="flex items-center gap-3 text-slate-400 font-mono">
                      <span className="text-cyan-400 font-bold">
                        {t.estimatedHours}h effort
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" /> Due {t.dueDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status === 'todo' && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs"
                          onClick={() => updateTaskStatus(t.id, 'in_progress')}
                        >
                          Start Progress
                        </Button>
                      )}
                      {t.status === 'in_progress' && (
                        <Button
                          variant="accent"
                          size="sm"
                          className="text-xs"
                          onClick={() => updateTaskStatus(t.id, 'in_review')}
                        >
                          Submit for Review
                        </Button>
                      )}
                      {t.status === 'in_review' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                          onClick={() => updateTaskStatus(t.id, 'completed')}
                        >
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {myActiveTasks.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-1" />
                  <p className="text-xs font-medium text-slate-200">
                    All assigned tasks completed!
                  </p>
                  <p className="text-[11px] text-slate-400">
                    You have open capacity available for upcoming sprint items.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Skills & Availability (1 col) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-cyan-400" />
                <CardTitle>My Skill Matrix</CardTitle>
              </div>
              <CardDescription>
                Proficiency levels used for AI task matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentEmp.skills.map((s) => (
                <div
                  key={s.skillId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/60 p-3"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">
                      {s.skillName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {s.category}
                    </span>
                  </div>
                  <Badge
                    variant={
                      s.proficiency === 'expert'
                        ? 'violet'
                        : s.proficiency === 'advanced'
                        ? 'cyan'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {s.proficiency.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. ADMIN / HR DASHBOARD VIEW
  // -------------------------------------------------------------
  if (activeRole === 'admin') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Organization Administration & HR Governance
              </h2>
              <Badge variant="rose" size="sm">
                Admin / HR View
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {organization?.name || 'WorkForce Workspace'} • Multi-tenant workspace administration and compliance logs
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="primary" size="sm">
                <Building2 className="h-4 w-4 mr-1.5" />
                <span>Workspace Settings</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Admin KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Headcount"
            value={isMembersLoading ? '...' : totalEmployees}
            subtitle={
              isMembersLoading
                ? 'Loading workspace roster...'
                : totalEmployees === 0
                ? 'Zero members enrolled'
                : `Across ${deptData.length} Functional Department${deptData.length === 1 ? '' : 's'}`
            }
            icon={<Users className="h-5 w-5 text-cyan-400" />}
            badgeText={isMembersLoading ? 'Loading' : totalEmployees > 0 ? 'All Active' : 'Empty'}
            badgeVariant={totalEmployees > 0 ? 'emerald' : 'slate'}
          />
          <MetricCard
            title="Total Weekly Capacity"
            value={isMembersLoading ? '...' : `${totalCapacity}h`}
            subtitle={
              isMembersLoading
                ? 'Calculating bandwidth...'
                : totalCapacity === 0
                ? '0h capacity registered'
                : `${totalAllocated}h allocated of ${totalCapacity}h total`
            }
            icon={<Layers className="h-5 w-5 text-violet-400" />}
            progress={{ value: orgUtilizationPct }}
          />
          <MetricCard
            title="Active Initiatives"
            value={projects.length}
            subtitle={projects.length === 0 ? '0 Project Teams' : `${projects.length} Project Teams`}
            icon={<FolderKanban className="h-5 w-5 text-amber-400" />}
            badgeText={projects.length > 0 ? 'On Track' : 'Standby'}
            badgeVariant={projects.length > 0 ? 'cyan' : 'slate'}
          />
          <MetricCard
            title="Compliance Audit Logs"
            value={auditEvents.length}
            subtitle="100% immutable action logs"
            icon={<History className="h-5 w-5 text-emerald-400" />}
            badgeText="Verified"
            badgeVariant="emerald"
          />
        </div>

        {/* Department Roster + Audit Quick List */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Department Headcounts & Bandwidth</CardTitle>
                <CardDescription>
                  Functional unit allocations and capacity margins
                </CardDescription>
              </div>
              <Link href="/employees">
                <Button variant="ghost" size="sm" className="text-xs">
                  Directory
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {isMembersLoading && (
                <div className="space-y-3 py-2">
                  <div className="h-14 rounded-xl border border-slate-800 bg-navy-900/40 animate-pulse" />
                  <div className="h-14 rounded-xl border border-slate-800 bg-navy-900/40 animate-pulse" />
                </div>
              )}

              {!isMembersLoading && membersError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 text-center space-y-3">
                  <AlertTriangle className="mx-auto h-6 w-6 text-rose-400" />
                  <p className="text-xs font-semibold text-rose-200">Unable to load team members</p>
                  <p className="text-[11px] text-rose-300/80">{membersError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-rose-500/50 hover:bg-rose-500/20"
                    onClick={() => refetchMembers()}
                  >
                    Retry Connection
                  </Button>
                </div>
              )}

              {!isMembersLoading && !membersError && deptData.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400 space-y-2">
                  <Users className="mx-auto h-8 w-8 text-slate-500 mb-1" />
                  <p className="text-xs font-medium text-slate-200">No team members enrolled</p>
                  <p className="text-[11px] text-slate-400">
                    Members enrolled in this workspace will automatically appear with their departmental capacity.
                  </p>
                </div>
              )}

              {!isMembersLoading &&
                !membersError &&
                deptData.map((d) => (
                  <div
                    key={d.dept}
                    className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {d.dept} ({d.count} staff)
                      </span>
                      <span className="font-mono text-xs text-slate-300">
                        {d.load}h / {d.capacity}h ({d.util}%)
                      </span>
                    </div>
                    <ProgressBar value={d.util} />
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Recent Compliance Actions</CardTitle>
                <CardDescription>
                  Audit log of recent system modifications
                </CardDescription>
              </div>
              <Link href="/audit">
                <Button variant="ghost" size="sm" className="text-xs">
                  Full Log
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditEvents.slice(0, 4).map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-800 bg-navy-900/60 p-3 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{ev.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {ev.timestamp}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">
                    {ev.entityTitle}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. MANAGER CAPACITY DASHBOARD VIEW (Default)
  // -------------------------------------------------------------
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Workforce Capacity & Executive Overview
            </h2>
            <Badge variant="violet" size="sm">
              Manager View
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time talent utilization, project velocity, and human-in-the-loop AI matching
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/matching">
            <Button variant="primary" size="sm">
              <Sparkles className="h-4 w-4 mr-1.5" />
              <span>Review AI Matches ({pendingRecommendations.length})</span>
            </Button>
          </Link>
          <Link href="/workload">
            <Button variant="secondary" size="sm">
              <Layers className="h-4 w-4 mr-1.5" />
              <span>Workload Sandbox</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Org Capacity Utilization"
          value={isMembersLoading ? '...' : `${orgUtilizationPct}%`}
          subtitle={
            isMembersLoading
              ? 'Calculating load...'
              : `${totalAllocated}h allocated of ${totalCapacity}h total`
          }
          trend={{ value: 3.8, isPositiveGood: true }}
          progress={{ value: orgUtilizationPct, max: 100 }}
        />
        <MetricCard
          title="Active Workforce"
          value={isMembersLoading ? '...' : totalEmployees}
          subtitle={
            isMembersLoading
              ? 'Querying team roster...'
              : totalEmployees === 0
              ? 'Zero members enrolled'
              : `${totalEmployees} verified staff in roster`
          }
          badgeText={isMembersLoading ? 'Loading' : totalEmployees > 0 ? 'Active Roster' : 'Empty'}
          badgeVariant={totalEmployees > 0 ? 'emerald' : 'slate'}
          icon={<Users className="h-5 w-5 text-cyan-400" />}
        />
        <MetricCard
          title="Active Tasks"
          value={activeTasks.length}
          subtitle={`${completionRate}% overall completion rate`}
          trend={{ value: 12.5, isPositiveGood: true }}
          icon={<CheckSquare className="h-5 w-5 text-violet-400" />}
        />
        <MetricCard
          title="Overload Risk Flags"
          value={0}
          subtitle="Zero overloaded members"
          badgeText="Optimal"
          badgeVariant="emerald"
          icon={<Flame className="h-5 w-5 text-rose-400" />}
        />
      </div>

      {/* Main Grid: Workload Heatmap + AI Recommendation Previews */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Department Workload Heatmap (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>Department Capacity Heatmap</CardTitle>
              <CardDescription>
                Weekly allocated load vs. total bandwidth by functional group
              </CardDescription>
            </div>
            <Link href="/workload">
              <Button variant="ghost" size="sm">
                <span>View Full Map</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {isMembersLoading && (
              <div className="space-y-3 py-2">
                <div className="h-16 rounded-xl border border-slate-800 bg-navy-900/40 animate-pulse" />
                <div className="h-16 rounded-xl border border-slate-800 bg-navy-900/40 animate-pulse" />
              </div>
            )}

            {!isMembersLoading && membersError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 text-center space-y-3">
                <AlertTriangle className="mx-auto h-6 w-6 text-rose-400" />
                <p className="text-xs font-semibold text-rose-200">Unable to load department capacity</p>
                <p className="text-[11px] text-rose-300/80">{membersError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-rose-500/50 hover:bg-rose-500/20"
                  onClick={() => refetchMembers()}
                >
                  Retry Connection
                </Button>
              </div>
            )}

            {!isMembersLoading && !membersError && deptData.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400 space-y-2">
                <Users className="mx-auto h-8 w-8 text-slate-500 mb-1" />
                <p className="text-xs font-medium text-slate-200">No department capacity data available</p>
                <p className="text-[11px] text-slate-400">
                  Add team members to your organization to view departmental workload and capacity distribution.
                </p>
              </div>
            )}

            {!isMembersLoading && !membersError && deptData.length > 0 && (
              <div className="space-y-3">
                {deptData.map((d) => (
                  <div
                    key={d.dept}
                    className="rounded-xl border border-slate-800/80 bg-navy-900/60 p-3.5 transition-all hover:bg-navy-900"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {d.dept}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          ({d.count} member{d.count === 1 ? '' : 's'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span
                          className={
                            d.util > 100
                              ? 'text-rose-400 font-bold'
                              : d.util >= 80
                              ? 'text-amber-400 font-semibold'
                              : 'text-slate-300'
                          }
                        >
                          {d.load}h / {d.capacity}h
                        </span>
                        <Badge
                          variant={
                            d.util > 100
                              ? 'rose'
                              : d.util >= 80
                              ? 'amber'
                              : 'emerald'
                          }
                          size="sm"
                        >
                          {d.util}%
                        </Badge>
                      </div>
                    </div>
                    <ProgressBar value={d.util} />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
              <div className="rounded-lg bg-navy-900/80 p-2 border border-slate-800">
                <div className="text-slate-400">Under-Utilized</div>
                <div className="text-base font-bold text-cyan-400 font-mono">
                  {totalEmployees === 0
                    ? 0
                    : members.filter((m) => {
                        const load = tasks
                          .filter((t) => t.status !== 'completed' && t.assignedTo === m.userId)
                          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
                        return m.weeklyCapacityHours > 0 && load / m.weeklyCapacityHours < 0.5;
                      }).length}
                </div>
              </div>
              <div className="rounded-lg bg-navy-900/80 p-2 border border-slate-800">
                <div className="text-slate-400">Optimal Load</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {totalEmployees === 0
                    ? 0
                    : members.filter((m) => {
                        const load = tasks
                          .filter((t) => t.status !== 'completed' && t.assignedTo === m.userId)
                          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
                        const r = m.weeklyCapacityHours > 0 ? load / m.weeklyCapacityHours : 0;
                        return r >= 0.5 && r <= 0.9;
                      }).length}
                </div>
              </div>
              <div className="rounded-lg bg-navy-900/80 p-2 border border-slate-800">
                <div className="text-slate-400">At/Over Capacity</div>
                <div className="text-base font-bold text-rose-400 font-mono">
                  {totalEmployees === 0
                    ? 0
                    : members.filter((m) => {
                        const load = tasks
                          .filter((t) => t.status !== 'completed' && t.assignedTo === m.userId)
                          .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
                        return m.weeklyCapacityHours > 0 && load / m.weeklyCapacityHours > 0.9;
                      }).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Recommendations Queue (1 col) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <CardTitle>AI Match Previews</CardTitle>
              </div>
              <Badge variant="violet" size="sm">
                Gemini Advisory
              </Badge>
            </div>
            <CardDescription>
              Ranked candidate suggestions awaiting manager approval
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 space-y-3.5">
            {pendingRecommendations.slice(0, 2).map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-violet-500/30 bg-navy-900/80 p-4 space-y-3 shadow-sm hover:border-violet-500/60 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-violet-400 font-semibold block">
                      Task Match
                    </span>
                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {rec.taskTitle}
                    </h4>
                  </div>
                  <Badge variant="cyan" size="sm">
                    {rec.matchScore}% Score
                  </Badge>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg bg-navy-850 p-2 border border-slate-800">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-[10px] font-bold text-white">
                    {rec.candidateAvatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {rec.candidateName}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Current: {rec.workloadImpact.currentLoadHours}h → Projected:{' '}
                      {rec.workloadImpact.projectedLoadHours}h (
                      {rec.workloadImpact.projectedUtilizationPct}%)
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2 italic">
                  &ldquo;{rec.rationale}&rdquo;
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => approveRecommendation(rec.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Approve
                  </Button>
                  <Link href="/matching">
                    <Button variant="outline" size="sm" className="text-xs">
                      Inspect
                    </Button>
                  </Link>
                </div>
              </div>
            ))}

            {pendingRecommendations.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                <p className="text-xs font-medium text-slate-200">
                  All recommendations reviewed!
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Create new unassigned tasks to generate candidate rankings.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
