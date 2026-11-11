'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useAuditLogs } from '@/lib/hooks/useAuditLogs';
import {
  isTaskActive,
  isTaskOverdue,
  calculateEmployeeWorkload,
  computeDeterministicMatchScores,
} from '@/lib/workloadEngine';
import { getAIWorkloadInsights, WorkloadInsightsResult } from '@/lib/aiService';
import { AuditEvent, Task, Project } from '@/lib/types';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { InteractiveAvatar } from '@/components/ui/InteractiveAvatar';
import { InteractiveProjectCover } from '@/components/ui/InteractiveProjectCover';
import { cn } from '@/lib/utils';
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
  Activity,
  AlertCircle,
  BarChart3,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Check,
} from 'lucide-react';

// =============================================================================
// HELPER FUNCTIONS & DEMO BANNER
// =============================================================================
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function DemoModeBanner() {
  const { currentUser } = useMockStore();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#DFD7CB] bg-gradient-to-r from-[#F7F3EC] via-[#FAF8F5] to-[#F7F3EC] dark:bg-none dark:bg-wf-surface-card dark:border-wf-border-default p-4 sm:p-5 shadow-sm transition-colors select-none">
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-wf-brand-burgundy dark:bg-wf-cream animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-wf-brand-burgundy dark:text-wf-cream">
              Active Demo Session
            </span>
            <Badge variant="burgundy" size="sm" className="hidden sm:inline-flex text-[10px]">
              Acme Systems Engineering
            </Badge>
          </div>
          <h3 className="text-base font-bold text-wf-text-primary tracking-tight">
            Navigating as {currentUser.name} ({currentUser.role.toUpperCase()})
          </h3>
          <p className="text-xs text-wf-text-secondary leading-relaxed">
            Exploring an isolated synthetic multi-department workforce dataset (25 team members, 6 projects, 45 tasks). All metrics and actions operate in-memory without altering production data.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/presentation?from=dashboard">
            <Button
              variant="primary"
              size="sm"
              className="px-3.5 py-2 text-xs flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-white" />
              <span>Interactive Tour</span>
              <ArrowRight className="h-3.5 w-3.5 ml-0.5 text-white" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 1. EXECUTIVE HORIZON DASHBOARD (ORGANIZER & ADMIN)
// =============================================================================
interface ExecutiveHorizonViewProps {
  organization: any;
  profile: any;
  user: any;
  session: any;
  isLive: boolean;
  role: string;
  members: any[];
  isMembersLoading: boolean;
  membersError: string | null;
  refetchMembers: () => Promise<void>;
  projects: any[];
  isProjectsLoading: boolean;
  projectsError: string | null;
  refetchProjects: () => Promise<void>;
  tasks: any[];
  isTasksLoading: boolean;
  tasksError: string | null;
  refetchTasks: () => Promise<void>;
  auditEvents: AuditEvent[];
  isAuditLoading: boolean;
  refetchAudit: () => Promise<void>;
  totalEmployees: number;
  totalCapacity: number;
  totalAllocated: number;
  orgUtilizationPct: number;
  displayRoster: any[];
  deptData: any[];
  pendingRecommendations: any[];
  onApproveRecommendation: (rec: any) => Promise<void>;
  approvingRecId: string | null;
  approveFeedback: { text: string; type: 'success' | 'error' } | null;
}

function ExecutiveHorizonView({
  organization,
  profile,
  user,
  session,
  isLive,
  role,
  members,
  isMembersLoading,
  membersError,
  refetchMembers,
  projects,
  isProjectsLoading,
  projectsError,
  refetchProjects,
  tasks,
  isTasksLoading,
  tasksError,
  refetchTasks,
  auditEvents,
  isAuditLoading,
  refetchAudit,
  totalEmployees,
  totalCapacity,
  totalAllocated,
  orgUtilizationPct,
  displayRoster,
  deptData,
  pendingRecommendations,
  onApproveRecommendation,
  approvingRecId,
  approveFeedback,
}: ExecutiveHorizonViewProps) {
  const anyDataError = membersError || projectsError || tasksError;

  // Workload calculations across active team members
  const employeeWorkloadList = React.useMemo(() => {
    return displayRoster.map((e) => {
      const metrics = calculateEmployeeWorkload(
        { id: e.userId || e.id, weeklyCapacityHours: e.weeklyCapacityHours },
        tasks
      );
      return {
        id: e.id,
        userId: e.userId || e.id,
        fullName: e.fullName,
        email: e.email,
        role: e.role,
        department: e.department || 'General',
        jobTitle: e.jobTitle || 'Team Member',
        weeklyCapacityHours: metrics.weeklyCapacityHours,
        activeAssignedHours: metrics.activeAssignedHours,
        utilizationPercentage: metrics.utilizationPercentage,
        capacityBand: metrics.capacityBand,
        isOverallocated: metrics.capacityBand === 'overallocated',
      };
    });
  }, [displayRoster, tasks]);

  const capacityBands = React.useMemo(() => {
    const overloaded = employeeWorkloadList.filter((e) => e.capacityBand === 'overallocated');
    const nearLimit = employeeWorkloadList.filter((e) => e.capacityBand === 'near_limit');
    const optimal = employeeWorkloadList.filter((e) => e.capacityBand === 'optimal');
    const underutilized = employeeWorkloadList.filter((e) => e.capacityBand === 'underutilized');
    return { overloaded, nearLimit, optimal, underutilized };
  }, [employeeWorkloadList]);

  // Operational telemetry
  const overdueTasks = React.useMemo(() => tasks.filter((t) => isTaskActive(t) && isTaskOverdue(t)), [tasks]);
  const activeDeliverables = React.useMemo(() => tasks.filter((t) => isTaskActive(t)), [tasks]);
  const unassignedDeliverables = React.useMemo(() => tasks.filter((t) => isTaskActive(t) && !t.assignedTo), [tasks]);

  // AI Executive Workload Synthesis
  const [aiInsights, setAiInsights] = React.useState<WorkloadInsightsResult | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState<boolean>(false);

  const loadAIInsights = React.useCallback(async () => {
    setIsAiLoading(true);
    const overallocatedList = capacityBands.overloaded.map((e) => ({
      name: e.fullName,
      hours: e.activeAssignedHours,
      capacity: e.weeklyCapacityHours,
      utilization: e.utilizationPercentage,
    }));

    const res = await getAIWorkloadInsights(
      {
        total_capacity_hours: totalCapacity,
        total_active_hours: totalAllocated,
        average_utilization_pct: orgUtilizationPct,
        overallocated_count: capacityBands.overloaded.length,
        near_limit_count: capacityBands.nearLimit.length,
        optimal_count: capacityBands.optimal.length,
        underutilized_count: capacityBands.underutilized.length,
        overdue_tasks_count: overdueTasks.length,
        unassigned_tasks_count: unassignedDeliverables.length,
        overallocated_members: overallocatedList,
      },
      session?.access_token,
      organization?.id
    );
    setAiInsights(res);
    setIsAiLoading(false);
  }, [
    capacityBands,
    totalCapacity,
    totalAllocated,
    orgUtilizationPct,
    overdueTasks.length,
    unassignedDeliverables.length,
    session?.access_token,
    organization?.id,
  ]);

  React.useEffect(() => {
    if (!aiInsights && (totalEmployees > 0 || tasks.length > 0)) {
      loadAIInsights();
    }
  }, [aiInsights, totalEmployees, tasks.length, loadAIInsights]);

  return (
    <div className="space-y-8 animate-in fade-in duration-reveal">
      {/* 1. Executive Horizon Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wf-border-default pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={cn(
                'flex h-2.5 w-2.5 rounded-full animate-pulse',
                isLive ? 'bg-emerald-500' : 'bg-wf-brand-burgundy dark:bg-wf-cream'
              )}
            />
            <h2 className="text-2xl font-extrabold tracking-tight text-wf-text-primary">
              {organization?.name || 'WorkForce Horizon'}
            </h2>
            <Badge variant={isLive ? 'emerald' : 'burgundy'} size="sm" className="font-mono text-[10px]">
              {isLive ? 'LIVE WORKSPACE' : 'DEMO MODE'}
            </Badge>
            <Badge variant="slate" size="sm">
              {role === 'organizer' ? 'Organizer / Root' : 'Executive Admin'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-wf-text-secondary">
            Executive Horizon • Organizational capacity landscape, decision approvals & live talent radar
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link href="/employees">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-sm text-xs font-semibold">
              <Users className="h-4 w-4" />
              <span>Invite Member</span>
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
              <FolderKanban className="h-4 w-4 text-emerald-500" />
              <span>New Initiative</span>
            </Button>
          </Link>
          <Link href="/workload">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs border-wf-border-default hover:border-wf-border-strong text-wf-text-primary">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
              <span>Workload Sandbox</span>
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs border-wf-border-default hover:border-wf-border-strong text-wf-text-primary">
              <Building2 className="h-4 w-4 text-zinc-400" />
              <span>Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Demo Session Notice */}
      {!isLive && <DemoModeBanner />}

      {/* Query Error Notice */}
      {isLive && anyDataError && (
        <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-wf-semantic-danger shrink-0" />
            <div>
              <span className="text-xs font-bold text-wf-text-primary block">Workspace Telemetry Notice</span>
              <span className="text-[11px] text-wf-text-secondary">{membersError || projectsError || tasksError}</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              refetchMembers();
              refetchProjects();
              refetchTasks();
              refetchAudit();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* =====================================================================
          SECTION A: ORGANIZATIONAL CAPACITY LANDSCAPE
          ===================================================================== */}
      <section className="space-y-4" aria-labelledby="capacity-landscape-title">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 id="capacity-landscape-title" className="text-base sm:text-lg font-bold text-wf-text-primary tracking-tight">
              Organizational Capacity Landscape
            </h3>
            <p className="text-xs text-wf-text-secondary">
              Real-time talent utilization, safe workload limits, and departmental bandwidth
            </p>
          </div>
          <Badge variant="slate" size="sm" className="font-mono text-[10px]">
            {totalAllocated}h / {totalCapacity}h Allocated ({orgUtilizationPct}%)
          </Badge>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Headcount"
            value={isMembersLoading ? '...' : totalEmployees.toString()}
            subtitle={`${deptData.length} functional unit${deptData.length === 1 ? '' : 's'} active`}
            icon={<Users className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
            badgeText={totalEmployees > 1 ? 'Multi-Member' : 'Solo Root'}
            badgeVariant={totalEmployees > 1 ? 'emerald' : 'slate'}
            sparkline={totalEmployees > 1 ? [Math.max(1, totalEmployees - 2), totalEmployees - 1, totalEmployees, totalEmployees] : [1, 1]}
          />
          <MetricCard
            title="Weekly Bandwidth"
            value={isMembersLoading ? '...' : `${totalCapacity}h`}
            subtitle={`${totalAllocated}h assigned across active sprint deliverables`}
            icon={<Clock className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
            badgeText={totalCapacity >= 40 ? 'Calibrated' : 'Uncalibrated'}
            badgeVariant={totalCapacity >= 40 ? 'cyan' : 'slate'}
            sparkline={[Math.round(totalCapacity * 0.85), Math.round(totalCapacity * 0.95), totalCapacity, totalCapacity]}
          />
          <MetricCard
            title="Active Initiatives"
            value={isProjectsLoading ? '...' : projects.length.toString()}
            subtitle={`${projects.filter((p) => p.status === 'in_progress').length} In Progress · ${projects.filter((p) => p.status === 'completed').length} Completed`}
            icon={<FolderKanban className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
            badgeText={projects.length > 0 ? 'Active' : 'Standby'}
            badgeVariant={projects.length > 0 ? 'emerald' : 'slate'}
            sparkline={projects.length > 0 ? [projects.length - 1, projects.length, projects.length] : [0, 0]}
          />
          <MetricCard
            title="Capacity Utilization"
            value={isMembersLoading || isTasksLoading ? '...' : `${orgUtilizationPct}%`}
            subtitle={`${totalAllocated}h allocated of ${totalCapacity}h safe limit`}
            icon={<Activity className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
            progress={{ value: orgUtilizationPct, max: 100 }}
            badgeText={
              orgUtilizationPct > 100
                ? 'Overloaded'
                : orgUtilizationPct >= 80
                ? 'Near Limit'
                : orgUtilizationPct >= 40
                ? 'Optimal'
                : 'Available'
            }
            badgeVariant={orgUtilizationPct > 100 ? 'rose' : orgUtilizationPct >= 80 ? 'amber' : 'emerald'}
          />
        </div>

        {/* Capacity Bands Distribution Landscape Bar */}
        <Card className="p-5 sm:p-6 space-y-3 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-wf-text-primary uppercase tracking-wider select-none">
              Organizational Workload Distribution
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <span className="h-2 w-2 rounded-full bg-wf-semantic-danger" />
                <span>Overloaded ({capacityBands.overloaded.length})</span>
              </span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <span className="h-2 w-2 rounded-full bg-wf-semantic-warning" />
                <span>Near Limit ({capacityBands.nearLimit.length})</span>
              </span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <span className="h-2 w-2 rounded-full bg-wf-semantic-success" />
                <span>Optimal ({capacityBands.optimal.length})</span>
              </span>
              <span className="flex items-center gap-1.5 text-wf-text-secondary">
                <span className="h-2 w-2 rounded-full bg-wf-border-default" />
                <span>Underutilized ({capacityBands.underutilized.length})</span>
              </span>
            </div>
          </div>

          {/* Segmented Capacity Bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-wf-surface-subtle border border-wf-border-default">
            {totalEmployees > 0 && (
              <>
                <div
                  style={{ width: `${(capacityBands.overloaded.length / totalEmployees) * 100}%` }}
                  className="bg-wf-semantic-danger transition-all duration-chart"
                  title={`Overloaded: ${capacityBands.overloaded.length}`}
                />
                <div
                  style={{ width: `${(capacityBands.nearLimit.length / totalEmployees) * 100}%` }}
                  className="bg-wf-semantic-warning transition-all duration-chart"
                  title={`Near Limit: ${capacityBands.nearLimit.length}`}
                />
                <div
                  style={{ width: `${(capacityBands.optimal.length / totalEmployees) * 100}%` }}
                  className="bg-wf-semantic-success transition-all duration-chart"
                  title={`Optimal: ${capacityBands.optimal.length}`}
                />
                <div
                  style={{ width: `${(capacityBands.underutilized.length / totalEmployees) * 100}%` }}
                  className="bg-wf-brand-sage/60 transition-all duration-chart"
                  title={`Underutilized: ${capacityBands.underutilized.length}`}
                />
              </>
            )}
          </div>
        </Card>

        {/* AI Executive Capacity Synthesis Card */}
        <Card className="border-[#DFD7CB] bg-[#F7F3EC] dark:border-wf-border-default dark:bg-wf-surface-card shadow-card transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#E8E1D5] dark:border-wf-border-subtle">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                <CardTitle className="text-sm font-bold text-wf-text-primary tracking-tight">
                  AI Executive Capacity Synthesis
                </CardTitle>
                <Badge variant="burgundy" size="sm" className="text-[10px]">
                  {aiInsights?.is_ai_generated ? 'Powered by Gemini 3.8-Flash' : 'Deterministic Advisory'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-wf-text-secondary">
                Strategic operational analysis synthesized from organization-wide allocation telemetry
              </CardDescription>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadAIInsights}
              disabled={isAiLoading}
              className="text-xs text-wf-text-secondary hover:text-wf-text-primary flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isAiLoading && 'animate-spin')} />
              <span>{isAiLoading ? 'Analyzing...' : 'Refresh AI Insights'}</span>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {isAiLoading ? (
              <div className="space-y-3 py-2 animate-pulse">
                <div className="h-4 bg-[#E8E1D5] dark:bg-wf-surface-subtle rounded w-3/4" />
                <div className="h-3 bg-[#E8E1D5]/60 dark:bg-wf-surface-subtle/60 rounded w-1/2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="h-16 bg-[#EDE7DD] border border-[#DFD7CB] dark:bg-wf-surface-subtle dark:border-wf-border-default rounded-lg" />
                  <div className="h-16 bg-[#EDE7DD] border border-[#DFD7CB] dark:bg-wf-surface-subtle dark:border-wf-border-default rounded-lg" />
                </div>
              </div>
            ) : aiInsights ? (
              <div className="space-y-4">
                <p className="text-xs sm:text-sm text-wf-text-primary leading-relaxed font-medium">
                  {aiInsights.executive_summary}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Identified Operational Risks */}
                  <div className="rounded-xl border border-amber-500/30 dark:border-amber-500/20 bg-[#FFF9EE] dark:bg-amber-950/15 p-3.5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                        Identified Operational Risks
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#2A2725] dark:text-zinc-300">
                      {aiInsights.identified_risks.slice(0, 3).map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-600 dark:text-amber-400 text-sm leading-none">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommended Executive Actions */}
                  <div className="rounded-xl border border-emerald-500/30 dark:border-emerald-500/20 bg-[#F2FAF5] dark:bg-emerald-950/15 p-3.5 space-y-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                        Recommended Staffing Actions
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#2A2725] dark:text-zinc-300">
                      {aiInsights.actionable_recommendations.slice(0, 3).map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400 text-sm leading-none">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-wf-text-secondary">
                Telemetry analysis initialized. Click Refresh to synthesize executive capacity insights.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* =====================================================================
          SECTION B: HUMAN-IN-THE-LOOP APPROVAL DECK
          ===================================================================== */}
      <section className="space-y-4" aria-labelledby="approval-deck-title">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 id="approval-deck-title" className="text-base sm:text-lg font-bold text-wf-text-primary tracking-tight flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Human-in-the-Loop Approval Deck</span>
              {pendingRecommendations.length > 0 && (
                <Badge variant="rose" size="sm" className="ml-1 font-mono">
                  {pendingRecommendations.length} Action{pendingRecommendations.length === 1 ? '' : 's'} Required
                </Badge>
              )}
            </h3>
            <p className="text-xs text-wf-text-secondary">
              Review and approve deterministic AI candidate rankings before task allocation is finalized
            </p>
          </div>
          <Link href="/matching">
            <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
              <span>View All Matches</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {/* Inline Feedback Banner */}
        {approveFeedback && (
          <div
            className={cn(
              'rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2 animate-in fade-in',
              approveFeedback.type === 'success'
                ? 'bg-wf-semantic-success-bg border border-wf-semantic-success-border text-wf-semantic-success'
                : 'bg-wf-semantic-danger-bg border border-wf-semantic-danger-border text-wf-semantic-danger'
            )}
          >
            {approveFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{approveFeedback.text}</span>
          </div>
        )}

        {/* Approval Items Deck */}
        {pendingRecommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRecommendations.slice(0, 3).map((rec) => {
              const candidate = displayRoster.find((e) => e.userId === rec.candidateId || e.id === rec.candidateId);
              const isApproving = approvingRecId === rec.id;

              return (
                <Card
                  key={rec.id}
                  className="p-5 flex flex-col justify-between space-y-4 shadow-card hover:border-wf-border-strong transition-all duration-hover"
                >
                  <div className="space-y-3">
                    {/* Header: Candidate Identity with Interactive Avatar */}
                    <div className="flex items-center justify-between gap-3 border-b border-wf-border-subtle pb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <InteractiveAvatar
                          name={rec.candidateName}
                          size="md"
                          utilizationPct={rec.candidateCapacityDelta?.beforePct || 70}
                          jobTitle={candidate?.jobTitle || 'Team Member'}
                          department={candidate?.department || 'Engineering'}
                          employeeId={candidate?.id}
                          showPopover={true}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-wf-text-primary tracking-tight truncate">
                            {rec.candidateName}
                          </h4>
                          <span className="text-[11px] text-wf-text-secondary truncate block">
                            {candidate?.jobTitle || 'Candidate'}
                          </span>
                        </div>
                      </div>
                      <Badge variant="emerald" size="sm" className="font-mono text-[10px] shrink-0 font-bold">
                        {rec.matchScore}% Match
                      </Badge>
                    </div>

                    {/* Task & Impact Summary */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-wf-text-tertiary block">
                        Target Task Deliverable
                      </span>
                      <p className="text-xs font-bold text-wf-text-primary line-clamp-1">
                        {rec.taskTitle}
                      </p>
                      <p className="text-[11px] text-wf-text-secondary line-clamp-2 leading-relaxed">
                        {rec.reasoningSummary || 'Candidate possesses verified skill alignment and balanced weekly capacity.'}
                      </p>
                    </div>

                    {/* Workload Impact Delta */}
                    {rec.candidateCapacityDelta && (
                      <div className="rounded-lg bg-wf-surface-subtle p-2.5 space-y-1 border border-wf-border-default text-[11px] font-mono tabular-nums">
                        <div className="flex justify-between text-wf-text-secondary">
                          <span>Capacity Impact:</span>
                          <span className="font-semibold text-wf-text-primary">
                            +{rec.candidateCapacityDelta.deltaHours}h ({rec.candidateCapacityDelta.beforePct}% → {rec.candidateCapacityDelta.afterPct}%)
                          </span>
                        </div>
                        <ProgressBar value={rec.candidateCapacityDelta.afterPct} max={100} colorScheme={rec.candidateCapacityDelta.afterPct > 100 ? 'auto' : 'violet'} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-wf-border-subtle flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onApproveRecommendation(rec)}
                      isLoading={isApproving}
                      className="flex-1 text-xs"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      <span>Approve Assignment</span>
                    </Button>
                    <Link href="/matching">
                      <Button variant="outline" size="sm" className="text-xs px-2.5" title="Inspect full match breakdown">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center shadow-card">
            <EmptyState
              icon={<CheckCircle2 className="h-8 w-8 text-wf-semantic-success" />}
              title="Approval Deck Clear"
              description="All staffing recommendations and candidate matches have been reviewed and approved. Organizational capacity remains calibrated."
              action={
                <Link href="/matching">
                  <Button variant="secondary" size="sm" className="text-xs">
                    <span>Inspect AI Matching Hub</span>
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              }
            />
          </Card>
        )}
      </section>

      {/* =====================================================================
          SECTION C: ACTIVE INITIATIVE MATRIX
          ===================================================================== */}
      <section className="space-y-4" aria-labelledby="initiatives-matrix-title">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 id="initiatives-matrix-title" className="text-base sm:text-lg font-bold text-wf-text-primary tracking-tight flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-emerald-500" />
              <span>Active Initiative Matrix ({projects.length})</span>
            </h3>
            <p className="text-xs text-wf-text-secondary">
              Strategic projects, allocated teams, milestone velocity & target deadlines
            </p>
          </div>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
              <span>View All Initiatives</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.slice(0, 6).map((proj) => {
              const projTasks = tasks.filter((t) => t.projectId === proj.id);
              const doneHours = projTasks
                .filter((t) => t.status === 'completed')
                .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
              const totalHours = projTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);

              // Assigned member identities with capacity status
              const assignedMembers = displayRoster
                .filter((m) => proj.memberIds?.includes(m.userId || m.id))
                .map((m) => {
                  const workload = calculateEmployeeWorkload({ id: m.userId || m.id, weeklyCapacityHours: m.weeklyCapacityHours }, tasks);
                  return {
                    id: m.userId || m.id,
                    name: m.fullName,
                    utilizationPct: workload.utilizationPercentage,
                  };
                });

              return (
                <InteractiveProjectCover
                  key={proj.id}
                  project={proj}
                  members={assignedMembers}
                  completedHours={doneHours}
                  totalHours={totalHours}
                />
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center shadow-card">
            <EmptyState
              icon={<FolderKanban className="h-8 w-8 text-wf-text-tertiary" />}
              title="No Initiatives Registered"
              description="Register strategic projects to track sprint deliverables, milestones, and cross-functional team allocations."
              action={
                <Link href="/projects">
                  <Button variant="primary" size="sm" className="text-xs">
                    <span>Create Initiative</span>
                  </Button>
                </Link>
              }
            />
          </Card>
        )}
      </section>

      {/* =====================================================================
          SECTION D: LIVE TALENT RADAR
          ===================================================================== */}
      <section className="space-y-4" aria-labelledby="talent-radar-title">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 id="talent-radar-title" className="text-base sm:text-lg font-bold text-wf-text-primary tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-500" />
              <span>Live Talent Radar ({totalEmployees})</span>
            </h3>
            <p className="text-xs text-wf-text-secondary">
              Real-time talent roster with interactive capacity halos, verified skills & allocation bands
            </p>
          </div>
          <Link href="/employees">
            <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
              <span>Talent Directory</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {employeeWorkloadList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {employeeWorkloadList.slice(0, 8).map((emp) => {
              const bandVariant =
                emp.capacityBand === 'overallocated'
                  ? 'rose'
                  : emp.capacityBand === 'near_limit'
                  ? 'amber'
                  : emp.capacityBand === 'optimal'
                  ? 'emerald'
                  : 'slate';

              return (
                <Card
                  key={emp.id}
                  className="p-4 flex flex-col justify-between space-y-3 shadow-card hover:border-wf-border-strong transition-all duration-hover"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <InteractiveAvatar
                          name={emp.fullName}
                          size="md"
                          utilizationPct={emp.utilizationPercentage}
                          jobTitle={emp.jobTitle}
                          department={emp.department}
                          weeklyCapacityHours={emp.weeklyCapacityHours}
                          activeAssignedHours={emp.activeAssignedHours}
                          employeeId={emp.userId || emp.id}
                          showPopover={true}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/employees/${emp.userId || emp.id}`}
                            className="text-xs font-bold text-wf-text-primary hover:text-wf-brand-burgundy dark:hover:text-wf-cream transition-colors truncate block"
                          >
                            {emp.fullName}
                          </Link>
                          <span className="text-[11px] text-wf-text-secondary truncate block">
                            {emp.jobTitle}
                          </span>
                        </div>
                      </div>
                      <Badge variant={bandVariant} size="sm" className="text-[9px] capitalize shrink-0">
                        {emp.capacityBand.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Workload Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-wf-text-secondary font-mono tabular-nums">
                        <span>Sprint Load</span>
                        <span className="font-semibold text-wf-text-primary">
                          {emp.activeAssignedHours}h / {emp.weeklyCapacityHours}h ({emp.utilizationPercentage}%)
                        </span>
                      </div>
                      <ProgressBar
                        value={emp.utilizationPercentage}
                        max={100}
                        colorScheme={emp.capacityBand === 'overallocated' ? 'auto' : 'violet'}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-wf-border-subtle flex items-center justify-between text-[11px]">
                    <span className="text-wf-text-tertiary font-mono">{emp.department}</span>
                    <Link
                      href={`/employees/${emp.userId || emp.id}`}
                      className="text-wf-brand-burgundy dark:text-wf-cream font-semibold hover:underline flex items-center gap-0.5"
                    >
                      <span>Profile</span>
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-8 text-center shadow-card">
            <EmptyState
              icon={<Users className="h-8 w-8 text-wf-text-tertiary" />}
              title="No Team Members Enrolled"
              description="Invite team members to begin talent capacity mapping and AI matching."
              action={
                <Link href="/employees">
                  <Button variant="primary" size="sm" className="text-xs">
                    <span>Invite Team Members</span>
                  </Button>
                </Link>
              }
            />
          </Card>
        )}
      </section>

      {/* 5. Recent Organization Activity & Governance Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Compliance Audit Trail Stream */}
        <Card className="p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-wf-border-subtle pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
              <CardTitle className="text-sm font-bold text-wf-text-primary">Compliance Audit Trail</CardTitle>
            </div>
            <Link href="/audit">
              <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                <span>View Full Trail</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2.5">
            {auditEvents.slice(0, 4).map((evt) => (
              <div
                key={evt.id}
                className="p-2.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 space-y-0.5"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-wf-text-primary">{evt.actorName}</span>
                  <span className="text-[10px] text-wf-text-tertiary font-mono">
                    {formatRelativeTime(evt.timestamp)}
                  </span>
                </div>
                <p className="text-[11px] text-wf-text-secondary line-clamp-1">
                  {evt.action}: {evt.entityTitle}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Executive Management Tools */}
        <Card className="p-5 sm:p-6 shadow-card space-y-4">
          <div className="border-b border-wf-border-subtle pb-3">
            <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
              <span>Executive Management Tools</span>
            </CardTitle>
            <CardDescription className="text-xs text-wf-text-secondary mt-0.5">
              Direct access to governance, balancing and compliance modules
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Link
              href="/matching"
              className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 hover:bg-wf-surface-subtle hover:border-wf-border-strong transition-all text-xs"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                <span className="text-wf-text-primary font-medium">AI Matching Hub</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-wf-text-tertiary" />
            </Link>
            <Link
              href="/workload"
              className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 hover:bg-wf-surface-subtle hover:border-wf-border-strong transition-all text-xs"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-500" />
                <span className="text-wf-text-primary font-medium">Workload Sandbox</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-wf-text-tertiary" />
            </Link>
            <Link
              href="/reports"
              className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 hover:bg-wf-surface-subtle hover:border-wf-border-strong transition-all text-xs"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-wf-text-primary font-medium">Reports & Analytics</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-wf-text-tertiary" />
            </Link>
            <Link
              href="/settings"
              className="flex items-center justify-between p-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 hover:bg-wf-surface-subtle hover:border-wf-border-strong transition-all text-xs"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span className="text-wf-text-primary font-medium">Workspace Settings</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-wf-text-tertiary" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT EXPORT (DASHBOARD ROUTE CONTROLLER)
// =============================================================================
export default function DashboardPage() {
  const router = useRouter();
  const { role, organization, profile, user, session, isAuthenticated, isLoading: authLoading } = useAuth();
  const authRole = role;
  const isLive = Boolean(isAuthenticated && organization?.id);

  // Supabase hooks for live organization data
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
    projects: dbProjects,
    isLoading: isProjectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const {
    tasks: dbTasks,
    isLoading: isTasksLoading,
    error: tasksError,
    refetch: refetchTasks,
    updateTaskStatus: dbUpdateTaskStatus,
    assignTask: dbAssignTask,
  } = useTasks();

  const {
    auditLogs: liveAuditLogs,
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useAuditLogs();

  // Mock Store for simulated demo session
  const {
    employees: mockEmployees,
    projects: mockProjects,
    tasks: mockTasks,
    recommendations: mockRecommendations,
    auditEvents: mockAuditEvents,
    activeRole: mockRole,
    currentUser: mockUser,
    currentUserId: mockUserId,
    approveRecommendation,
    updateTaskStatus: mockUpdateTaskStatus,
    isDemoMode,
  } = useMockStore();

  const [approvingRecId, setApprovingRecId] = React.useState<string | null>(null);
  const [approveFeedback, setApproveFeedback] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Compute live recommendations for unassigned tasks in live mode
  const liveRecommendations = React.useMemo(() => {
    if (!isLive || !members.length || !dbTasks.length) return [];

    const unassignedTasks = dbTasks.filter((t) => !t.assignedTo && isTaskActive(t));
    if (unassignedTasks.length === 0) return [];

    const candidatesList = members.map((m) => ({
      id: m.userId,
      fullName: m.fullName,
      jobTitle: m.jobTitle || 'Team Member',
      department: m.department || 'Engineering',
      weeklyCapacityHours: m.weeklyCapacityHours || 40,
      skills: [],
    }));

    const recsList: typeof mockRecommendations = [];

    for (const task of unassignedTasks.slice(0, 5)) {
      const proj = dbProjects.find((p) => p.id === task.projectId);
      const projMemberIds = proj?.memberIds || [];
      const computed = computeDeterministicMatchScores(
        task,
        candidatesList as any,
        dbTasks,
        projMemberIds
      );
      if (computed.length > 0) {
        const topCandidate = computed.sort((a, b) => b.matchScore - a.matchScore)[0];
        recsList.push({
          ...topCandidate,
          id: `live-rec-${task.id}-${topCandidate.candidateId}`,
          candidateAvatar: topCandidate.candidateName
            ? topCandidate.candidateName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : 'U',
          status: 'pending',
        });
      }
    }

    return recsList;
  }, [isLive, members, dbTasks, dbProjects]);

  const projects = isLive ? dbProjects : mockProjects;
  const tasks = isLive ? dbTasks : mockTasks;
  const auditEvents = isLive ? liveAuditLogs : mockAuditEvents;
  const recommendations = isLive ? liveRecommendations : mockRecommendations;
  const activeRole = isLive ? authRole : mockRole;
  const effectiveRole = activeRole;
  const updateTaskStatus = isLive ? dbUpdateTaskStatus : mockUpdateTaskStatus;

  // Real action handler for Human-in-the-Loop approvals
  const handleApproveRecommendation = async (rec: (typeof recommendations)[0]) => {
    setApprovingRecId(rec.id);
    setApproveFeedback(null);
    try {
      if (isLive) {
        const res = await dbAssignTask(rec.taskId, rec.candidateId);
        if (res.error) {
          setApproveFeedback({ text: res.error, type: 'error' });
        } else {
          setApproveFeedback({
            text: `Assigned "${rec.taskTitle}" to ${rec.candidateName} successfully.`,
            type: 'success',
          });
          await refetchTasks();
        }
      } else {
        approveRecommendation(rec.id);
        setApproveFeedback({
          text: `Assigned "${rec.taskTitle}" to ${rec.candidateName} (Demo).`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setApproveFeedback({
        text: err?.message || 'Failed to approve recommendation.',
        type: 'error',
      });
    } finally {
      setApprovingRecId(null);
    }
  };

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated && !isDemoMode) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, isDemoMode, router]);

  // Total organization headcount and capacity calculations
  const totalEmployees = isLive ? totalMembers : mockEmployees.length;
  const totalCapacity = isLive ? totalCapacityHours : mockEmployees.reduce((sum, e) => sum + e.weeklyCapacityHours, 0);

  const displayRoster = React.useMemo(() => {
    if (isLive) {
      const seenIds = new Set<string>();
      return members
        .map((m) => {
          const stableId =
            m.id ||
            m.membershipId ||
            (m.userId ? m.userId : '') ||
            (m.email ? `member-${m.email}` : '');
          return {
            id: stableId,
            membershipId: m.membershipId || m.id,
            userId: m.userId,
            fullName: m.fullName,
            email: m.email,
            role: m.role,
            department: m.department || 'General',
            jobTitle: m.jobTitle || 'Team Member',
            weeklyCapacityHours: m.weeklyCapacityHours,
            isCurrentUser: Boolean(user?.id && m.userId && m.userId === user.id),
          };
        })
        .filter((m) => {
          if (!m.id) return false;
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        });
    }
    const seenIds = new Set<string>();
    return mockEmployees
      .map((e) => ({
        id: e.id,
        membershipId: e.id,
        userId: e.id,
        fullName: e.fullName,
        email: e.email,
        role: e.role,
        department: e.department || 'General',
        jobTitle: e.jobTitle || 'Team Member',
        weeklyCapacityHours: e.weeklyCapacityHours,
        isCurrentUser: e.id === mockUserId,
      }))
      .filter((e) => {
        if (!e.id) return false;
        if (seenIds.has(e.id)) return false;
        seenIds.add(e.id);
        return true;
      });
  }, [isLive, members, user, mockEmployees, mockUserId]);

  const memberUserIds = React.useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const activeTasks = tasks.filter((t) => isTaskActive(t));
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
  const pendingRecommendations = recommendations.filter((r) => r.status === 'pending');

  const totalAllocated = React.useMemo(() => {
    if (isLive) {
      return tasks
        .filter((t) => isTaskActive(t) && t.assignedTo && memberUserIds.has(t.assignedTo))
        .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    }
    return tasks
      .filter((t) => isTaskActive(t) && t.assignedTo)
      .reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  }, [isLive, tasks, memberUserIds]);

  const orgUtilizationPct = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  // Departmental capacity aggregation
  const deptData = React.useMemo(() => {
    if (isLive) {
      return realDepartments.map((d) => {
        const deptMemberIds = new Set(
          members.filter((m) => m.department === d.department).map((m) => m.userId)
        );
        const load = tasks
          .filter((t) => isTaskActive(t) && t.assignedTo && deptMemberIds.has(t.assignedTo))
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
    }
    const mockDeptNames = Array.from(new Set(mockEmployees.map((e) => e.department)));
    return mockDeptNames.map((dept) => {
      const deptEmps = mockEmployees.filter((e) => e.department === dept);
      const deptEmpIds = new Set(deptEmps.map((e) => e.id));
      const capacity = deptEmps.reduce((sum, e) => sum + e.weeklyCapacityHours, 0);
      const load = tasks
        .filter((t) => isTaskActive(t) && t.assignedTo && deptEmpIds.has(t.assignedTo))
        .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
      const util = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
      return {
        dept,
        count: deptEmps.length,
        capacity,
        load,
        util,
      };
    });
  }, [isLive, realDepartments, members, tasks, mockEmployees]);

  // Overload calculations
  const memberLoads = React.useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.assignedTo && isTaskActive(t)) {
        map.set(t.assignedTo, (map.get(t.assignedTo) || 0) + (Number(t.estimatedHours) || 0));
      }
    });
    return map;
  }, [tasks]);

  const overloadedCount = React.useMemo(() => {
    if (isLive) {
      return members.filter((m) => {
        const load = memberLoads.get(m.userId) || 0;
        return m.weeklyCapacityHours > 0 && load > m.weeklyCapacityHours;
      }).length;
    }
    return mockEmployees.filter((e) => {
      const load = memberLoads.get(e.id) || 0;
      return e.weeklyCapacityHours > 0 && load > e.weeklyCapacityHours;
    }).length;
  }, [isLive, members, memberLoads, mockEmployees]);

  // Construct current employee entity & compute verified delivery metric
  const currentEmp = React.useMemo(() => {
    const userCapacity = profile?.weeklyCapacityHours ?? 40;
    const foundMember = members.find((m) => m.userId === user?.id);
    const foundEmp = mockEmployees.find((e) => e.id === mockUserId);

    const myActive = tasks.filter((t) => (t.assignedTo === user?.id || t.assignedTo === mockUserId) && isTaskActive(t));
    const myCompleted = tasks.filter((t) => (t.assignedTo === user?.id || t.assignedTo === mockUserId) && t.status === 'completed');
    const myTotal = tasks.filter((t) => (t.assignedTo === user?.id || t.assignedTo === mockUserId));
    const loadHours = myActive.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);

    // =========================================================================
    // SPEC REQUIREMENT 5: EMPLOYEE DELIVERY METRIC CORRECTION
    // If valid historical delivery data exists, calculate actual rate.
    // If zero assigned tasks exist, return null ('N/A'). Do NOT fabricate 100%.
    // =========================================================================
    const hasHistoricalDelivery = myTotal.length > 0;
    const onTimeCompletionRate: number | null = hasHistoricalDelivery
      ? Math.round((myCompleted.length / myTotal.length) * 100)
      : null;

    return {
      id: isLive ? (user?.id || '') : mockUserId,
      fullName: isLive ? (profile?.fullName || user?.email || 'User') : mockUser.name,
      role: activeRole,
      jobTitle: isLive ? (profile?.jobTitle || foundMember?.jobTitle || 'Team Member') : mockUser.jobTitle,
      department: isLive ? (profile?.department || foundMember?.department || 'Engineering') : mockUser.department,
      skills: foundEmp?.skills || [],
      weeklyCapacityHours: userCapacity,
      currentLoadHours: loadHours,
      burnoutRiskScore: Math.min(Math.round(((loadHours / (userCapacity || 40))) * 100) / 100, 1.0),
      activeTaskCount: myActive.length,
      onTimeCompletionRate,
    };
  }, [isLive, profile, user, mockUserId, mockUser, activeRole, members, mockEmployees, tasks]);

  const myTasks = tasks.filter((t) => t.assignedTo === currentEmp.id);
  const myCompletedTasks = myTasks.filter((t) => t.status === 'completed');
  const myActiveTasks = myTasks.filter((t) => isTaskActive(t));
  const myUtilPct =
    currentEmp.weeklyCapacityHours > 0
      ? Math.round(((currentEmp.currentLoadHours || 0) / currentEmp.weeklyCapacityHours) * 100)
      : 0;

  if (authLoading || (!isAuthenticated && !isDemoMode)) {
    return (
      <div className="min-h-screen bg-wf-canvas flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
        <div className="h-8 w-8 rounded-full border-2 border-wf-brand-burgundy border-t-transparent animate-spin mb-3" />
        <span className="text-xs text-wf-text-secondary font-mono">Verifying workspace session...</span>
      </div>
    );
  }

  // ===========================================================================
  // 1. EMPLOYEE PERSONAL WORKSPACE ("MY FOCUS")
  // ===========================================================================
  if (effectiveRole === 'employee') {
    return (
      <div className="space-y-8 animate-in fade-in duration-reveal">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wf-border-default pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-wf-text-primary">
                Welcome back, {currentEmp.fullName || profile?.fullName || 'Colleague'}
              </h2>
              <Badge variant="burgundy" size="sm">
                Employee Portal
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-wf-text-secondary">
              {currentEmp.jobTitle} • {currentEmp.department}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isLive && (
              <Link href="/presentation?from=dashboard">
                <Button variant="outline" size="sm" className="text-xs">
                  <Sparkles className="h-4 w-4 mr-1.5 text-wf-brand-burgundy dark:text-wf-cream" />
                  <span>Explore Demo Mode</span>
                </Button>
              </Link>
            )}
            <Badge
              variant={myUtilPct > 100 ? 'rose' : myUtilPct >= 80 ? 'amber' : 'emerald'}
              size="sm"
            >
              {myUtilPct > 100 ? 'Overloaded' : myUtilPct >= 80 ? 'Near Limit' : 'Optimal Workload'}
            </Badge>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {!isLive && <DemoModeBanner />}

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
            badgeVariant="burgundy"
            icon={<CheckSquare className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
          />
          {/* SPRINT COMPLETION RATE METRIC */}
          <MetricCard
            title="Sprint Completion Rate"
            value={currentEmp.onTimeCompletionRate !== null ? `${currentEmp.onTimeCompletionRate}%` : 'N/A'}
            subtitle={
              currentEmp.onTimeCompletionRate !== null
                ? 'Sprint benchmark velocity'
                : 'No completed sprint history'
            }
            badgeText={currentEmp.onTimeCompletionRate !== null ? 'Calibrated' : 'Unrated'}
            badgeVariant={currentEmp.onTimeCompletionRate !== null ? 'emerald' : 'slate'}
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            emptyText="N/A"
          />
          <MetricCard
            title="Verified Skills"
            value={currentEmp.skills.length}
            subtitle="Validated by Engineering Lead"
            badgeText="Active Matrix"
            badgeVariant="cyan"
            icon={<Award className="h-5 w-5 text-cyan-500" />}
          />
        </div>

        {/* My Tasks Queue + Skills Sidebar */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* My Active Tasks (2 cols) */}
          <Card className="lg:col-span-2 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-wf-border-subtle">
              <div>
                <CardTitle className="text-sm font-bold text-wf-text-primary">
                  My Active Tasks ({myActiveTasks.length})
                </CardTitle>
                <CardDescription className="text-xs text-wf-text-secondary">
                  Sprint deliverables currently assigned to your workload
                </CardDescription>
              </div>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                  <span>View All Tasks</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {myActiveTasks.length === 0 ? (
                <div className="rounded-xl border border-wf-border-default bg-wf-surface-card p-8 text-center space-y-2 select-none">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-wf-text-primary">All assigned tasks completed!</p>
                  <p className="text-xs text-wf-text-secondary max-w-sm mx-auto leading-relaxed">
                    You have open capacity available for upcoming sprint items.
                  </p>
                </div>
              ) : (
                myActiveTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 transition-colors hover:border-wf-border-strong"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold text-wf-brand-burgundy dark:text-wf-cream">
                          {t.projectName || 'General Sprint'}
                        </span>
                        <Badge
                          variant={t.priority === 'critical' ? 'rose' : t.priority === 'high' ? 'amber' : 'slate'}
                          size="sm"
                          className="text-[9px]"
                        >
                          {t.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <h4 className="text-xs font-bold text-wf-text-primary">{t.title}</h4>
                      {t.dueDate && (
                        <p className="text-[11px] text-wf-text-secondary flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          <span>Due {t.dueDate}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-semibold text-wf-text-secondary mr-2">
                        {t.estimatedHours || 0}h
                      </span>
                      {t.status === 'todo' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateTaskStatus(t.id, 'in_progress')}
                          className="text-xs"
                        >
                          Start Progress
                        </Button>
                      )}
                      {t.status === 'in_progress' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateTaskStatus(t.id, 'in_review')}
                          className="text-xs"
                        >
                          Submit for Review
                        </Button>
                      )}
                      {t.status === 'in_review' && (
                        <Badge variant="amber" size="sm" className="text-[10px]">
                          Pending Review
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Verified Skills Matrix (1 col) */}
          <Card className="shadow-card">
            <CardHeader className="pb-3 border-b border-wf-border-subtle">
              <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
                <Award className="h-4 w-4 text-cyan-500" />
                <span>Verified Skill Matrix</span>
              </CardTitle>
              <CardDescription className="text-xs text-wf-text-secondary">
                Prerequisites matched against sprint requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {currentEmp.skills.length > 0 ? (
                <div className="space-y-3">
                  {currentEmp.skills.map((skill: any, idx: number) => {
                    const skillName = typeof skill === 'string' ? skill : skill.name;
                    const level = typeof skill === 'string' ? 'Expert' : skill.level || 'Intermediate';
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-wf-border-default bg-wf-surface-subtle/50 text-xs">
                        <span className="font-semibold text-wf-text-primary">{skillName}</span>
                        <Badge variant="cyan" size="sm" className="text-[9px]">
                          {level}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-wf-text-secondary text-center py-4">
                  No verified skill prerequisites cataloged.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // 2. ORGANIZER / ADMIN EXECUTIVE HORIZON DASHBOARD
  // ===========================================================================
  if (effectiveRole === 'organizer' || effectiveRole === 'admin') {
    return (
      <ExecutiveHorizonView
        organization={organization}
        profile={profile}
        user={user}
        session={session}
        isLive={isLive}
        role={effectiveRole}
        members={members}
        isMembersLoading={isMembersLoading}
        membersError={membersError}
        refetchMembers={refetchMembers}
        projects={projects}
        isProjectsLoading={isProjectsLoading}
        projectsError={projectsError}
        refetchProjects={refetchProjects}
        tasks={tasks}
        isTasksLoading={isTasksLoading}
        tasksError={tasksError}
        refetchTasks={refetchTasks}
        auditEvents={auditEvents}
        isAuditLoading={isAuditLoading}
        refetchAudit={refetchAudit}
        totalEmployees={totalEmployees}
        totalCapacity={totalCapacity}
        totalAllocated={totalAllocated}
        orgUtilizationPct={orgUtilizationPct}
        displayRoster={displayRoster}
        deptData={deptData}
        pendingRecommendations={pendingRecommendations}
        onApproveRecommendation={handleApproveRecommendation}
        approvingRecId={approvingRecId}
        approveFeedback={approveFeedback}
      />
    );
  }

  // ===========================================================================
  // 3. MANAGER CAPACITY & EXECUTION DASHBOARD
  // ===========================================================================
  if (effectiveRole === 'manager') {
    return (
      <div className="space-y-8 animate-in fade-in duration-reveal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wf-border-default pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-wf-text-primary">
                Workforce Capacity & Team Operations
              </h2>
              <Badge variant="burgundy" size="sm">
                Manager Operations View
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-wf-text-secondary">
              Real-time talent utilization, project velocity, and human-in-the-loop task matching
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/matching">
              <Button variant="primary" size="sm" className="text-xs">
                <Sparkles className="h-4 w-4 mr-1.5" />
                <span>Review Matches ({pendingRecommendations.length})</span>
              </Button>
            </Link>
            <Link href="/workload">
              <Button variant="secondary" size="sm" className="text-xs">
                <Layers className="h-4 w-4 mr-1.5" />
                <span>Workload Sandbox</span>
              </Button>
            </Link>
          </div>
        </div>

        {!isLive && <DemoModeBanner />}

        {/* Manager Metric Cards Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Team Capacity Utilization"
            value={`${orgUtilizationPct}%`}
            subtitle={`${totalAllocated}h allocated of ${totalCapacity}h total`}
            progress={{ value: orgUtilizationPct, max: 100 }}
          />
          <MetricCard
            title="Active Workforce"
            value={totalEmployees}
            subtitle={`${totalEmployees} verified staff in roster`}
            icon={<Users className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
          />
          <MetricCard
            title="Active Tasks"
            value={activeTasks.length}
            subtitle={`${completionRate}% sprint completion rate`}
            icon={<CheckSquare className="h-5 w-5 text-cyan-500" />}
          />
          <MetricCard
            title="Overload Risk Flags"
            value={overloadedCount}
            subtitle={overloadedCount === 0 ? 'Zero overloaded members' : `${overloadedCount} staff exceeding weekly limit`}
            badgeText={overloadedCount === 0 ? 'Optimal' : 'Overload Alert'}
            badgeVariant={overloadedCount === 0 ? 'emerald' : 'rose'}
            icon={<Flame className="h-5 w-5 text-rose-500" />}
          />
        </div>

        {/* Manager Approval Deck Preview */}
        {pendingRecommendations.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-wf-text-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                <span>Matching Recommendations Awaiting Approval ({pendingRecommendations.length})</span>
              </h3>
              <Link href="/matching">
                <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                  <span>Open Matching Hub</span>
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingRecommendations.slice(0, 3).map((rec) => (
                <Card key={rec.id} className="p-4 space-y-3 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-wf-text-primary">{rec.candidateName}</span>
                    <Badge variant="emerald" size="sm">{rec.matchScore}% Match</Badge>
                  </div>
                  <p className="text-xs text-wf-text-secondary line-clamp-1">{rec.taskTitle}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => handleApproveRecommendation(rec)}
                    isLoading={approvingRecId === rec.id}
                  >
                    Approve Assignment
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Active Initiatives & Department Capacity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-wf-border-subtle pb-3">
              <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-emerald-500" />
                <span>Active Project Execution ({projects.length})</span>
              </CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                  <span>View All</span>
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {projects.slice(0, 3).map((proj) => (
                <div key={proj.id} className="p-3 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-wf-text-primary">{proj.name}</h5>
                    <Badge variant={proj.status === 'in_progress' ? 'cyan' : 'emerald'} size="sm" className="text-[9px]">
                      {proj.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <ProgressBar value={proj.completedHours || 0} max={proj.totalHours || 100} showLabel />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 sm:p-6 shadow-card space-y-4">
            <div className="border-b border-wf-border-subtle pb-3">
              <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-500" />
                <span>Department Capacity Heatmap</span>
              </CardTitle>
            </div>
            <div className="space-y-3">
              {deptData.map((d) => (
                <div key={d.dept} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-wf-text-primary">{d.dept} ({d.count} staff)</span>
                    <span className="text-wf-text-secondary font-mono">{d.load}h / {d.capacity}h ({d.util}%)</span>
                  </div>
                  <ProgressBar value={d.util} max={100} colorScheme={d.util > 90 ? 'auto' : 'violet'} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // 4. HR PEOPLE & TALENT OPERATIONS DASHBOARD
  // ===========================================================================
  return (
    <div className="space-y-8 animate-in fade-in duration-reveal">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-wf-border-default pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-wf-text-primary">
              HR Governance & Talent Operations
            </h2>
            <Badge variant="cyan" size="sm">
              HR Operations View
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-wf-text-secondary">
            Talent roster, skill distributions, capacity margins, and employee insights
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/employees">
            <Button variant="primary" size="sm" className="text-xs">
              <Users className="h-4 w-4 mr-1.5" />
              <span>Talent Directory</span>
            </Button>
          </Link>
          <Link href="/insights">
            <Button variant="secondary" size="sm" className="text-xs">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              <span>Employee Insights</span>
            </Button>
          </Link>
        </div>
      </div>

      {!isLive && <DemoModeBanner />}

      {/* HR Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Headcount"
          value={totalEmployees}
          subtitle={`Across ${deptData.length} functional departments`}
          icon={<Users className="h-5 w-5 text-wf-brand-burgundy dark:text-wf-cream" />}
        />
        <MetricCard
          title="Total Weekly Bandwidth"
          value={`${totalCapacity}h`}
          subtitle={`${totalAllocated}h currently allocated`}
          progress={{ value: orgUtilizationPct }}
        />
        <MetricCard
          title="Overload Risk Flags"
          value={overloadedCount}
          subtitle={overloadedCount === 0 ? 'Safe organization balance' : `${overloadedCount} members exceed limit`}
          badgeText={overloadedCount === 0 ? 'Optimal' : 'Alert'}
          badgeVariant={overloadedCount === 0 ? 'emerald' : 'rose'}
          icon={<Flame className="h-5 w-5 text-rose-500" />}
        />
        <MetricCard
          title="Compliance Audit Trail"
          value={auditEvents.length}
          subtitle="Immutable operational records"
          badgeText="Verified"
          badgeVariant="emerald"
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />}
        />
      </div>

      {/* HR Talent Radar & Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-wf-border-subtle pb-3">
            <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              <span>Active Talent Roster ({displayRoster.length})</span>
            </CardTitle>
            <Link href="/employees">
              <Button variant="ghost" size="sm" className="text-xs text-wf-text-secondary hover:text-wf-text-primary">
                <span>Manage</span>
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="space-y-2.5">
            {displayRoster.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl border border-wf-border-default bg-wf-surface-subtle/50 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <InteractiveAvatar name={m.fullName} size="sm" employeeId={m.userId || m.id} showPopover={false} />
                  <div className="truncate">
                    <span className="font-bold text-wf-text-primary block truncate">{m.fullName}</span>
                    <span className="text-[11px] text-wf-text-secondary block truncate">{m.jobTitle} • {m.department}</span>
                  </div>
                </div>
                <Badge variant="slate" size="sm" className="text-[10px] capitalize">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 shadow-card space-y-4">
          <div className="border-b border-wf-border-subtle pb-3">
            <CardTitle className="text-sm font-bold text-wf-text-primary flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-500" />
              <span>Department Headcounts & Bandwidth</span>
            </CardTitle>
          </div>
          <div className="space-y-3">
            {deptData.map((d) => (
              <div key={d.dept} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-wf-text-primary">{d.dept} ({d.count} staff)</span>
                  <span className="text-wf-text-secondary font-mono">{d.load}h / {d.capacity}h ({d.util}%)</span>
                </div>
                <ProgressBar value={d.util} max={100} colorScheme={d.util > 90 ? 'auto' : 'violet'} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
