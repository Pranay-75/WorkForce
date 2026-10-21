'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  initialEmployees,
  initialProjects,
  initialTasks,
  initialAIRecommendations,
  initialAuditEvents,
  deriveSyntheticCandidateEvaluations,
  calculateWorkforceCapacitySummary,
  evaluateRedistributionForTask,
  RedistributionCandidateEvaluation,
  RedistributionProposalResult,
  getEmployeeIntelligenceProfile,
  EmployeeIntelligenceProfile,
} from '@/lib/mockData';
import { Employee, Project, Task, AIRecommendation, UserRole, AuditEvent } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MetricCard } from '@/components/ui/MetricCard';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  Zap,
  Search,
  Filter,
  X,
  ChevronRight,
  ChevronLeft,
  Menu,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Activity,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock,
  Award,
  Sliders,
  TrendingUp,
  RotateCcw,
  XCircle,
  Info,
  Scale,
  RefreshCw,
  ArrowRightLeft,
  History,
} from 'lucide-react';

type DemoView = 'dashboard' | 'employees' | 'projects' | 'tasks' | 'workload' | 'matching' | 'reports';

interface NavItem {
  id: DemoView;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const demoNavigationGroups: NavGroup[] = [
  {
    label: 'Core Workspace',
    items: [
      { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
      { id: 'employees', name: 'Employees', icon: Users },
      { id: 'projects', name: 'Projects', icon: FolderKanban },
      { id: 'tasks', name: 'Tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'AI & Capacity',
    items: [
      { id: 'matching', name: 'AI Recommendations', icon: Sparkles, badge: 'AI' },
      { id: 'workload', name: 'Workload', icon: BarChart3 },
    ],
  },
  {
    label: 'Governance',
    items: [
      { id: 'reports', name: 'Reports', icon: FileSpreadsheet },
    ],
  },
];

const viewMetaMap: Record<DemoView, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Executive Overview',
    subtitle: 'Workforce capacity, active initiatives & synthetic operational overview',
  },
  employees: {
    title: 'Employee Directory',
    subtitle: 'Talent roster, skill matrices & individual capacity allocation',
  },
  projects: {
    title: 'Project Portfolio',
    subtitle: 'Ongoing initiatives, milestone hours & team member allocations',
  },
  tasks: {
    title: 'Task Management',
    subtitle: 'Priorities, deadlines, skill prerequisites & assignments',
  },
  workload: {
    title: 'Capacity Monitor',
    subtitle: 'Organization-wide workload balance, overload detection & risk factors',
  },
  matching: {
    title: 'Explainable AI Task Matching Hub',
    subtitle: 'Deterministic candidate pre-filtering combined with natural-language explainability',
  },
  reports: {
    title: 'Reports & Operational Analytics',
    subtitle: 'Capacity utilization, AI matching effectiveness & data exports',
  },
};

function PresentationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = (searchParams.get('view') as DemoView) || 'dashboard';
  const fromParam = searchParams.get('from');
  const returnToDashboard = fromParam === 'dashboard' || fromParam === '/dashboard';
  const exitHref = returnToDashboard ? '/dashboard' : '/login';

  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // ===========================================================================
  // SHARED CONNECTED DEMO STATE
  // ===========================================================================
  const [demoTasks, setDemoTasks] = React.useState<Task[]>(initialTasks);
  const [demoEmployees, setDemoEmployees] = React.useState<Employee[]>(initialEmployees);
  const [demoProjects, setDemoProjects] = React.useState<Project[]>(initialProjects);
  const [demoAuditEvents, setDemoAuditEvents] = React.useState<AuditEvent[]>(initialAuditEvents);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>('task-104');
  const [approvalDecisions, setApprovalDecisions] = React.useState<
    Record<
      string,
      {
        decision: 'approved' | 'rejected';
        candidateId: string;
        candidateName: string;
        taskId: string;
        taskTitle: string;
        allocatedHours: number;
        timestamp: string;
        reason?: string;
      }
    >
  >({});
  const [redistributionDecisions, setRedistributionDecisions] = React.useState<
    Record<
      string,
      {
        proposalKey: string;
        taskId: string;
        taskTitle: string;
        sourceEmployeeId: string;
        targetEmployeeId: string;
        taskHours: number;
        decision: 'approved' | 'rejected';
        timestamp: string;
        reason?: string;
      }
    >
  >({});
  const [feedbackBanner, setFeedbackBanner] = React.useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const setView = (view: DemoView) => {
    setIsMobileOpen(false);
    const query = returnToDashboard
      ? `/presentation?view=${view}&from=dashboard`
      : `/presentation?view=${view}`;
    router.push(query, { scroll: false });
  };

  const handleSelectTaskForMatching = (taskId: string) => {
    setSelectedTaskId(taskId);
    setView('matching');
  };

  const handleApprove = (rec: AIRecommendation) => {
    const task = demoTasks.find((t) => t.id === rec.taskId);
    if (!task) return;

    const emp = demoEmployees.find((e) => e.id === rec.candidateId);
    if (!emp) return;

    const taskHours = task.estimatedHours || 8;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;

    // 1. Update task: assign employee, set status to in_progress
    setDemoTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assignedTo: emp.id,
              assignedEmployeeName: emp.fullName,
              assignedEmployeeAvatar: emp.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
              status: 'in_progress',
            }
          : t
      )
    );

    // 2. Update employee: increase currentLoadHours, increase activeTaskCount
    setDemoEmployees((prevEmps) =>
      prevEmps.map((e) => {
        if (e.id === emp.id) {
          const newLoad = e.currentLoadHours + taskHours;
          const newUtil = Math.round((newLoad / e.weeklyCapacityHours) * 100);
          return {
            ...e,
            currentLoadHours: newLoad,
            activeTaskCount: e.activeTaskCount + 1,
            burnoutRiskScore: Math.min(1.0, Math.round((newUtil / 100) * 0.7 * 100) / 100),
          };
        }
        return e;
      })
    );

    // 3. Record decision
    setApprovalDecisions((prev) => ({
      ...prev,
      [rec.id]: {
        decision: 'approved',
        candidateId: emp.id,
        candidateName: emp.fullName,
        taskId: task.id,
        taskTitle: task.title,
        allocatedHours: taskHours,
        timestamp: timeStr,
      },
    }));

    // 4. Record audit event
    const newAudit: AuditEvent = {
      id: `aud-demo-${Date.now()}`,
      actorId: 'emp-1',
      actorName: 'Sarah Connor (Lead Manager)',
      action: 'Approved AI Recommendation',
      entityType: 'Recommendation',
      entityId: rec.id,
      entityTitle: `${emp.fullName} -> ${task.title}`,
      details: `Manager approved ${rec.matchScore}% match score. Assigned ${taskHours}h. Updated load to ${emp.currentLoadHours + taskHours}h (${Math.round(((emp.currentLoadHours + taskHours) / emp.weeklyCapacityHours) * 100)}%).`,
      timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
    };
    setDemoAuditEvents((prev) => [newAudit, ...prev]);

    setFeedbackBanner({
      type: 'success',
      message: `Simulated Approval Applied: ${emp.fullName} assigned to "${task.title}" (+${taskHours}h). Workload metrics, tasks, and reports updated across the demo.`,
    });
  };

  const handleReject = (rec: AIRecommendation, reason: string) => {
    const task = demoTasks.find((t) => t.id === rec.taskId);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;

    setApprovalDecisions((prev) => ({
      ...prev,
      [rec.id]: {
        decision: 'rejected',
        candidateId: rec.candidateId,
        candidateName: rec.candidateName,
        taskId: rec.taskId,
        taskTitle: rec.taskTitle,
        allocatedHours: 0,
        timestamp: timeStr,
        reason: reason || 'Capacity allocated to alternative priority',
      },
    }));

    const newAudit: AuditEvent = {
      id: `aud-demo-${Date.now()}`,
      actorId: 'emp-1',
      actorName: 'Sarah Connor (Lead Manager)',
      action: 'Rejected AI Recommendation',
      entityType: 'Recommendation',
      entityId: rec.id,
      entityTitle: `${rec.candidateName} -> ${rec.taskTitle}`,
      details: `Recommendation dismissed by manager. Reason: ${reason || 'Capacity allocated to alternative priority'}. Task remains in backlog for matching review.`,
      timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
    };
    setDemoAuditEvents((prev) => [newAudit, ...prev]);

    setFeedbackBanner({
      type: 'warning',
      message: `Recommendation Dismissed: ${rec.candidateName} was not assigned to "${task?.title || rec.taskTitle}". Task remains in backlog for matching review.`,
    });
  };

  const handleRevoke = (recId: string) => {
    const decision = approvalDecisions[recId];
    if (!decision) return;

    if (decision.decision === 'approved') {
      // Revert employee load
      setDemoEmployees((prevEmps) =>
        prevEmps.map((e) => {
          if (e.id === decision.candidateId) {
            const revertedLoad = Math.max(0, e.currentLoadHours - decision.allocatedHours);
            const revertedUtil = Math.round((revertedLoad / e.weeklyCapacityHours) * 100);
            return {
              ...e,
              currentLoadHours: revertedLoad,
              activeTaskCount: Math.max(0, e.activeTaskCount - 1),
              burnoutRiskScore: Math.min(1.0, Math.round((revertedUtil / 100) * 0.7 * 100) / 100),
            };
          }
          return e;
        })
      );

      // Revert task assignment to original baseline
      const originalTask = initialTasks.find((t) => t.id === decision.taskId);
      setDemoTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === decision.taskId
            ? {
                ...t,
                assignedTo: originalTask?.assignedTo,
                assignedEmployeeName: originalTask?.assignedEmployeeName,
                assignedEmployeeAvatar: originalTask?.assignedEmployeeAvatar,
                status: originalTask?.status || 'todo',
              }
            : t
        )
      );
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
      const newAudit: AuditEvent = {
        id: `aud-demo-${Date.now()}`,
        actorId: 'emp-1',
        actorName: 'Sarah Connor (Lead Manager)',
        action: 'Reverted Assignment (Manager Reversal)',
        entityType: 'Recommendation',
        entityId: recId,
        entityTitle: `${decision.candidateName} <- ${decision.taskTitle}`,
        details: `Manager reversed prior assignment. Deliverable "${decision.taskTitle}" returned to unassigned backlog and ${decision.allocatedHours}h removed from ${decision.candidateName}. Capacity restored without double-counting.`,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
      };
      setDemoAuditEvents((prev) => [newAudit, ...prev]);
    } else if (decision.decision === 'rejected') {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
      const newAudit: AuditEvent = {
        id: `aud-demo-${Date.now()}`,
        actorId: 'emp-1',
        actorName: 'Sarah Connor (Lead Manager)',
        action: 'Reverted Dismissal (Manager Reversal)',
        entityType: 'Recommendation',
        entityId: recId,
        entityTitle: `${decision.candidateName} -> ${decision.taskTitle}`,
        details: `Manager withdrew prior dismissal for candidate ${decision.candidateName} on task "${decision.taskTitle}". Recommendation returned to active review queue.`,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
      };
      setDemoAuditEvents((prev) => [newAudit, ...prev]);
    }

    setApprovalDecisions((prev) => {
      const next = { ...prev };
      delete next[recId];
      return next;
    });

    setFeedbackBanner({
      type: 'info',
      message: `Decision reverted for "${decision.taskTitle}". Workload and task state restored. Reversal logged in governance audit trail.`,
    });
  };

  // ===========================================================================
  // PHASE 3: WORKLOAD REDISTRIBUTION HANDLERS
  // ===========================================================================
  const handleApplyRedistribution = (
    task: Task,
    sourceEmp: Employee,
    targetEmp: Employee
  ) => {
    const taskHours = task.estimatedHours || 8;
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
    const proposalKey = `${task.id}-${sourceEmp.id}-${targetEmp.id}`;

    // 1. Update task: assign to targetEmp
    setDemoTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              assignedTo: targetEmp.id,
              assignedEmployeeName: targetEmp.fullName,
              assignedEmployeeAvatar: targetEmp.fullName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
            }
          : t
      )
    );

    // 2. Update employee loads
    setDemoEmployees((prevEmps) =>
      prevEmps.map((e) => {
        if (e.id === sourceEmp.id) {
          const newLoad = Math.max(0, e.currentLoadHours - taskHours);
          const newUtil = Math.round((newLoad / e.weeklyCapacityHours) * 100);
          return {
            ...e,
            currentLoadHours: newLoad,
            activeTaskCount: Math.max(0, e.activeTaskCount - 1),
            burnoutRiskScore: Math.min(1.0, Math.round((newUtil / 100) * 0.7 * 100) / 100),
          };
        }
        if (e.id === targetEmp.id) {
          const newLoad = e.currentLoadHours + taskHours;
          const newUtil = Math.round((newLoad / e.weeklyCapacityHours) * 100);
          return {
            ...e,
            currentLoadHours: newLoad,
            activeTaskCount: e.activeTaskCount + 1,
            burnoutRiskScore: Math.min(1.0, Math.round((newUtil / 100) * 0.7 * 100) / 100),
          };
        }
        return e;
      })
    );

    // 3. Record decision
    setRedistributionDecisions((prev) => ({
      ...prev,
      [proposalKey]: {
        proposalKey,
        taskId: task.id,
        taskTitle: task.title,
        sourceEmployeeId: sourceEmp.id,
        targetEmployeeId: targetEmp.id,
        taskHours,
        decision: 'approved',
        timestamp: timeStr,
      },
    }));

    // 4. Record audit event
    const sourceProjectedLoad = Math.max(0, sourceEmp.currentLoadHours - taskHours);
    const sourceProjectedUtil = Math.round((sourceProjectedLoad / sourceEmp.weeklyCapacityHours) * 100);
    const targetProjectedLoad = targetEmp.currentLoadHours + taskHours;
    const targetProjectedUtil = Math.round((targetProjectedLoad / targetEmp.weeklyCapacityHours) * 100);

    const newAudit: AuditEvent = {
      id: `aud-demo-${Date.now()}`,
      actorId: 'emp-1',
      actorName: 'Sarah Connor (Lead Manager)',
      action: 'Approved Workload Redistribution',
      entityType: 'Workload',
      entityId: proposalKey,
      entityTitle: `${task.title}: ${sourceEmp.fullName} -> ${targetEmp.fullName}`,
      details: `Transferred ${taskHours}h task "${task.title}" from ${sourceEmp.fullName} (relieved from ${Math.round((sourceEmp.currentLoadHours / sourceEmp.weeklyCapacityHours) * 100)}% to ${sourceProjectedUtil}% load) to ${targetEmp.fullName} (absorbed to ${targetProjectedUtil}% load). Capacity bottleneck resolved.`,
      timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
    };
    setDemoAuditEvents((prev) => [newAudit, ...prev]);

    setFeedbackBanner({
      type: 'success',
      message: `Workload Redistribution Applied: Reassigned "${task.title}" (${taskHours}h) from ${sourceEmp.fullName} to ${targetEmp.fullName}. ${sourceEmp.fullName}'s workload reduced to ${sourceProjectedUtil}% (Optimal). Bottleneck eliminated.`,
    });
  };

  const handleRejectRedistribution = (
    task: Task,
    sourceEmp: Employee,
    targetEmp: Employee,
    reason: string
  ) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
    const proposalKey = `${task.id}-${sourceEmp.id}-${targetEmp.id}`;

    setRedistributionDecisions((prev) => ({
      ...prev,
      [proposalKey]: {
        proposalKey,
        taskId: task.id,
        taskTitle: task.title,
        sourceEmployeeId: sourceEmp.id,
        targetEmployeeId: targetEmp.id,
        taskHours: task.estimatedHours,
        decision: 'rejected',
        timestamp: timeStr,
        reason: reason || 'Capacity allocated to alternative sprint commitment',
      },
    }));

    const newAudit: AuditEvent = {
      id: `aud-demo-${Date.now()}`,
      actorId: 'emp-1',
      actorName: 'Sarah Connor (Lead Manager)',
      action: 'Rejected Workload Redistribution',
      entityType: 'Workload',
      entityId: proposalKey,
      entityTitle: `${task.title}: ${sourceEmp.fullName} -> ${targetEmp.fullName}`,
      details: `Redistribution proposal dismissed by manager. Reason: ${reason || 'Capacity allocated to alternative sprint commitment'}. Task assignment and workload remain unchanged.`,
      timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
    };
    setDemoAuditEvents((prev) => [newAudit, ...prev]);

    setFeedbackBanner({
      type: 'warning',
      message: `Workload Redistribution Dismissed: Task "${task.title}" remains assigned to ${sourceEmp.fullName}. No workload changes applied.`,
    });
  };

  const handleRevokeRedistribution = (proposalKey: string) => {
    const decision = redistributionDecisions[proposalKey];
    if (!decision) return;

    if (decision.decision === 'approved') {
      const originalSource = initialEmployees.find((e) => e.id === decision.sourceEmployeeId);
      // Revert task assignment back to sourceEmployeeId
      setDemoTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === decision.taskId
            ? {
                ...t,
                assignedTo: decision.sourceEmployeeId,
                assignedEmployeeName: originalSource?.fullName || 'Assigned',
                assignedEmployeeAvatar: originalSource?.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase(),
              }
            : t
        )
      );

      // Revert employee loads
      setDemoEmployees((prevEmps) =>
        prevEmps.map((e) => {
          if (e.id === decision.sourceEmployeeId) {
            const newLoad = e.currentLoadHours + decision.taskHours;
            const newUtil = Math.round((newLoad / e.weeklyCapacityHours) * 100);
            return {
              ...e,
              currentLoadHours: newLoad,
              activeTaskCount: e.activeTaskCount + 1,
              burnoutRiskScore: Math.min(1.0, Math.round((newUtil / 100) * 0.7 * 100) / 100),
            };
          }
          if (e.id === decision.targetEmployeeId) {
            const newLoad = Math.max(0, e.currentLoadHours - decision.taskHours);
            const newUtil = Math.round((newLoad / e.weeklyCapacityHours) * 100);
            return {
              ...e,
              currentLoadHours: newLoad,
              activeTaskCount: Math.max(0, e.activeTaskCount - 1),
              burnoutRiskScore: Math.min(1.0, Math.round((newUtil / 100) * 0.7 * 100) / 100),
            };
          }
          return e;
        })
      );
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
      const newAudit: AuditEvent = {
        id: `aud-demo-${Date.now()}`,
        actorId: 'emp-1',
        actorName: 'Sarah Connor (Lead Manager)',
        action: 'Reverted Workload Redistribution (Manager Reversal)',
        entityType: 'Workload',
        entityId: proposalKey,
        entityTitle: `${decision.taskTitle}: ${decision.sourceEmployeeId} <- ${decision.targetEmployeeId}`,
        details: `Manager reversed workload transfer. Deliverable "${decision.taskTitle}" (${decision.taskHours}h) returned to original assignee. Capacities restored without double-counting.`,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
      };
      setDemoAuditEvents((prev) => [newAudit, ...prev]);
    } else if (decision.decision === 'rejected') {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} UTC`;
      const newAudit: AuditEvent = {
        id: `aud-demo-${Date.now()}`,
        actorId: 'emp-1',
        actorName: 'Sarah Connor (Lead Manager)',
        action: 'Reverted Dismissal (Manager Reversal)',
        entityType: 'Workload',
        entityId: proposalKey,
        entityTitle: `${decision.taskTitle}`,
        details: `Manager withdrew prior dismissal of redistribution for "${decision.taskTitle}". Proposal returned to active review queue.`,
        timestamp: `${now.toISOString().split('T')[0]} ${timeStr}`,
      };
      setDemoAuditEvents((prev) => [newAudit, ...prev]);
    }

    setRedistributionDecisions((prev) => {
      const next = { ...prev };
      delete next[proposalKey];
      return next;
    });

    setFeedbackBanner({
      type: 'info',
      message: `Redistribution reverted for "${decision.taskTitle}". Task assignment and workload levels restored. Reversal logged in governance audit trail.`,
    });
  };

  const handleResetDemo = () => {
    setDemoTasks(initialTasks);
    setDemoEmployees(initialEmployees);
    setDemoProjects(initialProjects);
    setDemoAuditEvents(initialAuditEvents);
    setSelectedTaskId('task-104');
    setApprovalDecisions({});
    setRedistributionDecisions({});
    setFeedbackBanner({
      type: 'info',
      message: 'Demo session reset: All tasks, employee workloads, and evaluations restored to initial baseline.',
    });
  };

  const meta = viewMetaMap[currentView] || viewMetaMap.dashboard;

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-slate-800/80 bg-navy-900 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Branding Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center gap-3 overflow-hidden group text-left focus:outline-none"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 shadow-sm group-hover:bg-white transition-colors">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  WorkForce
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    SaaS
                  </span>
                </span>
                <span className="text-[10px] text-zinc-400 font-medium tracking-wide">
                  AI Capacity Platform
                </span>
              </div>
            )}
          </button>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 lg:flex focus:outline-none"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Demo Tag Indicator */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Presentation Demo · Connected Workflow
            </div>
          </div>
        )}

        {/* Navigation Groups */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {demoNavigationGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = currentView === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      className={cn(
                        'w-full group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 select-none text-left',
                        isActive
                          ? 'bg-zinc-800/80 text-white border border-zinc-700/60'
                          : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white" />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                        )}
                      />
                      {!isCollapsed && <span className="truncate flex-1">{item.name}</span>}
                      {!isCollapsed && item.badge && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-950 font-mono">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-navy-950/60 p-2.5 border border-slate-800/60">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700">
              AC
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-200">Alex Chen</p>
                <p className="truncate text-[10px] text-slate-400">Demo Persona · Eng Lead</p>
              </div>
            )}
            <Link
              href={exitHref}
              title={returnToDashboard ? 'Return to Dashboard' : 'Return to Login'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-navy-900/90 px-4 sm:px-6 backdrop-blur-md">
          {/* Left section: Mobile menu + Breadcrumbs & Page Meta */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="rounded-lg p-2 text-slate-400 hover:bg-navy-800 hover:text-white lg:hidden focus:outline-none"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <span className="text-blue-400 font-semibold">WorkForce AI</span>
                <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />
                <span className="capitalize text-slate-200 truncate">{currentView}</span>
              </div>
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
                {meta.title}
              </h1>
            </div>
          </div>

          {/* Right section: Reset State & Exit Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetDemo}
              className="text-xs text-slate-300 hover:text-white"
              title="Reset all simulated demo modifications back to initial baseline"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1 text-slate-400" />
              <span className="hidden sm:inline">Reset Demo State</span>
            </Button>

            <div className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              SYNTHETIC DATA DEMO
            </div>

            <Link href={exitHref}>
              <Button
                variant="secondary"
                size="sm"
                className="text-xs text-slate-300 hover:text-white"
                title={returnToDashboard ? 'Return to Dashboard' : 'Return to Login'}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                <span>Exit Demo</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Global Feedback Banner for Interactive Demo Actions */}
        {feedbackBanner && (
          <div
            className={cn(
              'mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-xl border p-3.5 flex items-center justify-between gap-3 text-xs transition-all animate-in fade-in',
              feedbackBanner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200'
                : feedbackBanner.type === 'warning'
                ? 'border-amber-500/40 bg-amber-950/40 text-amber-200'
                : 'border-violet-500/40 bg-violet-950/40 text-violet-200'
            )}
          >
            <div className="flex items-center gap-2.5">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : feedbackBanner.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              ) : (
                <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
              )}
              <span className="font-medium">{feedbackBanner.message}</span>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-400 hover:text-white focus:outline-none p-1 rounded-md"
              aria-label="Dismiss message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Demo View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {currentView === 'dashboard' && (
            <DemoDashboardView
              employees={demoEmployees}
              tasks={demoTasks}
              projects={demoProjects}
              onNavigate={setView}
              onSelectTaskForMatching={handleSelectTaskForMatching}
            />
          )}
          {currentView === 'employees' && (
            <DemoEmployeesView
              employees={demoEmployees}
              tasks={demoTasks}
              projects={demoProjects}
              onNavigate={setView}
              onSelectTaskForMatching={handleSelectTaskForMatching}
            />
          )}
          {currentView === 'projects' && (
            <DemoProjectsView
              projects={demoProjects}
              tasks={demoTasks}
              onSelectTaskForMatching={handleSelectTaskForMatching}
            />
          )}
          {currentView === 'tasks' && (
            <DemoTasksView
              tasks={demoTasks}
              employees={demoEmployees}
              projects={demoProjects}
              onSelectTaskForMatching={handleSelectTaskForMatching}
            />
          )}
          {currentView === 'workload' && (
            <DemoWorkloadView
              employees={demoEmployees}
              tasks={demoTasks}
              redistributionDecisions={redistributionDecisions}
              onApplyRedistribution={handleApplyRedistribution}
              onRejectRedistribution={handleRejectRedistribution}
              onRevokeRedistribution={handleRevokeRedistribution}
            />
          )}
          {currentView === 'matching' && (
            <DemoMatchingView
              tasks={demoTasks}
              employees={demoEmployees}
              selectedTaskId={selectedTaskId}
              onSelectTaskId={setSelectedTaskId}
              approvalDecisions={approvalDecisions}
              onApprove={handleApprove}
              onReject={handleReject}
              onRevoke={handleRevoke}
            />
          )}
          {currentView === 'reports' && (
            <DemoReportsView
              employees={demoEmployees}
              projects={demoProjects}
              auditEvents={demoAuditEvents}
              onNavigate={setView}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 1: DASHBOARD
// =============================================================================
function DemoDashboardView({
  employees,
  tasks,
  projects,
  onNavigate,
  onSelectTaskForMatching,
}: {
  employees: Employee[];
  tasks: Task[];
  projects: Project[];
  onNavigate: (view: DemoView) => void;
  onSelectTaskForMatching: (taskId: string) => void;
}) {
  const capacitySummary = calculateWorkforceCapacitySummary(employees);
  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Headcount"
          value={capacitySummary.totalEmployees}
          subtitle={`Across ${capacitySummary.departmentBreakdowns.length} functional departments`}
          icon={<Users className="h-5 w-5 text-zinc-300" />}
          sparkline={[6, 7, 7, 8, 8, 8, 8]}
        />

        <MetricCard
          title="Active Projects"
          value={projects.length}
          subtitle={`${projects.filter((p) => p.status === 'in_progress').length} In Progress · ${projects.filter((p) => p.status === 'planning').length} Planning`}
          icon={<FolderKanban className="h-5 w-5 text-zinc-300" />}
          sparkline={[2, 3, 3, 4, 4, 4, 4]}
        />

        <MetricCard
          title="Active Tasks"
          value={activeTasks.length}
          subtitle={`${tasks.filter((t) => t.status === 'in_progress').length} In Progress · ${tasks.filter((t) => t.status === 'completed').length} Completed`}
          icon={<CheckSquare className="h-5 w-5 text-zinc-300" />}
          sparkline={[11, 13, 14, 16, 15, 17, 18]}
        />

        <MetricCard
          title="Team Capacity"
          value={`${capacitySummary.averageUtilizationPct}%`}
          subtitle={`${capacitySummary.totalAllocatedHours}h allocated / ${capacitySummary.totalCapacityHours}h capacity`}
          icon={<Activity className="h-5 w-5 text-zinc-300" />}
          sparkline={[50, 55, 62, 60, 68, 70, 71]}
          progress={{ value: capacitySummary.averageUtilizationPct, max: 100 }}
        />
      </div>

      {/* Main Grid: Projects & Workload Highlights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Projects Spotlight */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-zinc-800 bg-zinc-900/90">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-zinc-100">Active Project Initiatives</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Real-time milestone tracking and resource distribution
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('projects')}
                className="text-xs text-zinc-300 hover:text-white"
              >
                View all ({projects.length})
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              {projects.map((proj) => {
                const pct = proj.totalHours > 0 ? Math.round((proj.completedHours / proj.totalHours) * 100) : 0;
                return (
                  <div key={proj.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{proj.name}</h4>
                        <p className="text-xs text-zinc-400 line-clamp-1">{proj.description}</p>
                      </div>
                      <Badge
                        variant={
                          proj.status === 'in_progress' ? 'cyan' : proj.status === 'completed' ? 'emerald' : 'slate'
                        }
                        size="sm"
                      >
                        {proj.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Milestone Progress</span>
                        <span>{proj.completedHours}h / {proj.totalHours}h ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-100"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Overload Alerts & AI Recs */}
        <div className="space-y-6">
          {/* Overload Alert Card */}
          <Card className="border-zinc-800 bg-zinc-900/90">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-rose-400" />
                <CardTitle className="text-sm font-semibold text-white">Capacity Warnings</CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-400">
                {capacitySummary.overloadedCount} employee{capacitySummary.overloadedCount === 1 ? '' : 's'} exceeding weekly allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              {capacitySummary.overloadedEmployees.map((emp) => (
                <div key={emp.id} className="rounded-lg border border-rose-500/20 bg-rose-950/20 p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{emp.fullName}</p>
                      <p className="text-[11px] text-zinc-400">{emp.jobTitle}</p>
                    </div>
                    <Badge variant="rose" size="sm">
                      {Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100)}% Load
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-rose-300">
                    Allocated {emp.currentLoadHours}h against {emp.weeklyCapacityHours}h maximum capacity.
                  </p>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('workload')}
                className="w-full text-xs text-zinc-200 hover:text-white"
              >
                Inspect Workload Balance
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* AI Matching Teaser */}
          <Card className="border-zinc-800 bg-zinc-900/90">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-zinc-300" />
                <h4 className="text-sm font-semibold text-white">Explainable AI Matching</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Review candidate recommendations calculated deterministically from skill matrices and available capacity with operational constraint enforcement.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate('matching')}
                className="w-full text-xs"
              >
                Open AI Matching Hub
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 2: EMPLOYEES (ENHANCED DIRECTORY)
// =============================================================================
function DemoEmployeesView({
  employees,
  tasks,
  projects,
  onNavigate,
  onSelectTaskForMatching,
}: {
  employees: Employee[];
  tasks: Task[];
  projects: Project[];
  onNavigate: (view: DemoView) => void;
  onSelectTaskForMatching: (taskId: string) => void;
}) {
  const capacitySummary = calculateWorkforceCapacitySummary(employees);
  const [employeeSearch, setEmployeeSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState('All');
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string | null>(null);

  const departments = ['All', ...capacitySummary.departmentBreakdowns.map((d) => d.department)];

  const filteredEmployees = employees.filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      employee.fullName.toLowerCase().includes(query) ||
      employee.jobTitle.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query);
    const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  // Active employee intelligence profile if selected
  const activeProfile = selectedEmployeeId
    ? getEmployeeIntelligenceProfile(selectedEmployeeId, employees, tasks, projects)
    : null;

  // If viewing an individual employee intelligence profile
  if (activeProfile && selectedEmployeeId) {
    const { employee, history, riskAnalysis, anomaly, growthOpportunities, assignedTasks, contributingProjects, actualAssignedHours, actualUtilizationPct } = activeProfile;
    const isOverloaded = actualUtilizationPct > 100;
    const isNearLimit = actualUtilizationPct >= 85 && actualUtilizationPct <= 100;

    const initials = employee.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Top Header & Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployeeId(null)}
              className="border-slate-700 bg-navy-950 text-slate-300 hover:bg-slate-800 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Talent Directory
            </Button>
            <div className="hidden sm:block h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Badge variant="violet" size="sm">
                AI Employee Intelligence
              </Badge>
              <Badge variant="slate" size="sm" className="hidden md:inline-flex">
                Operational Scheduling Metric
              </Badge>
            </div>
          </div>

          {/* Quick Switcher Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Switch Contributor:</span>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-navy-950 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-sm focus:border-violet-500 focus:outline-none"
            >
              {employees.map((emp) => {
                const empTasks = tasks.filter((t) => t.assignedTo === emp.id);
                const empLoad = empTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
                const empPct = emp.weeklyCapacityHours > 0 ? Math.round((empLoad / emp.weeklyCapacityHours) * 100) : 0;
                return (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({empPct}% - {emp.department})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Hero Profile Header Card */}
        <Card className="relative overflow-hidden border-slate-700 bg-slate-900/90 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-xl font-bold text-slate-100 border border-slate-700 shadow-sm">
                {initials}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white">{employee.fullName}</h2>
                  <Badge variant="slate" size="sm">
                    {employee.id}
                  </Badge>
                  <Badge
                    variant={isOverloaded ? 'rose' : isNearLimit ? 'amber' : 'emerald'}
                    size="sm"
                  >
                    {isOverloaded ? 'Over Capacity' : isNearLimit ? 'Near Limit' : 'Optimal Load'}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm font-medium text-violet-300">
                  {employee.jobTitle} • <span className="text-slate-400">{employee.department}</span>
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                  <span>{employee.email}</span>
                  <span>•</span>
                  <span>{employee.location}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Capacity Summary & Contextual Action */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 w-full lg:w-auto">
              <div className="text-left lg:text-right">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Current Weekly Allocation
                </span>
                <div className="text-2xl font-bold font-mono text-white mt-0.5">
                  <span
                    className={
                      isOverloaded ? 'text-rose-400' : isNearLimit ? 'text-amber-400' : 'text-emerald-400'
                    }
                  >
                    {actualAssignedHours}h
                  </span>{' '}
                  <span className="text-slate-400 text-sm">/ {employee.weeklyCapacityHours}h ({actualUtilizationPct}%)</span>
                </div>
                <div className="w-56 mt-1.5">
                  <ProgressBar value={Math.min(actualUtilizationPct, 100)} />
                </div>
              </div>

              {/* Contextual Action Button */}
              {isOverloaded ? (
                <Button
                  size="sm"
                  onClick={() => onNavigate('workload')}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-glow mt-1"
                >
                  <Scale className="h-3.5 w-3.5 mr-1.5" />
                  Rebalance in Workload Sandbox
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onNavigate('tasks')}
                  variant="outline"
                  className="border-violet-500/40 text-violet-300 hover:bg-violet-900/30 text-xs font-semibold mt-1"
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                  View Assigned Tasks ({assignedTasks.length})
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Ethical Risk Metric Notice */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-cyan-300 block">
                Ethical Framework & Operational Metric Guidelines
              </span>
              <p className="leading-relaxed">
                WorkForce strictly frames all risk and capacity indicators as <strong>operational scheduling congestion metrics</strong>. Calculated from scheduled hours, concurrent delivery deadlines, and sprint lookaheads, these heuristics assist managers with sustainable resourcing and do not constitute clinical or psychological predictions.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Summary Diagnostic Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-navy-900/90">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Operational Congestion
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold font-mono text-white">
                  {Math.round(riskAnalysis.riskScore * 100)}%
                </span>
                <Badge
                  variant={
                    riskAnalysis.severity === 'Critical Overload'
                      ? 'rose'
                      : riskAnalysis.severity === 'Moderate Congestion'
                      ? 'amber'
                      : riskAnalysis.severity === 'Safe Headroom'
                      ? 'emerald'
                      : 'slate'
                  }
                  size="sm"
                >
                  {riskAnalysis.severity}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                {isOverloaded
                  ? 'Exceeds standard 40h weekly limit'
                  : isNearLimit
                  ? 'Approaching maximum capacity threshold'
                  : 'Operating with healthy buffer'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-navy-900/90">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Active Deliverables
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold font-mono text-violet-300">
                  {assignedTasks.length} Tasks
                </span>
                <Badge variant="violet" size="sm">
                  {actualAssignedHours}h scheduled
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Across {contributingProjects.length} active initiatives
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-navy-900/90">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                On-Time Completion
              </span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold font-mono text-cyan-300">
                  {employee.onTimeCompletionRate}%
                </span>
                <Badge variant="cyan" size="sm">
                  Historical
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Milestone delivery reliability
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-navy-900/90">
            <CardContent className="p-4 space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Data Confidence Index
              </span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-200">
                  {riskAnalysis.dataConfidence === 'High Confidence'
                    ? 'High (6 Sprints)'
                    : 'Illustrative Baseline'}
                </span>
                <Badge
                  variant={
                    riskAnalysis.dataConfidence === 'High Confidence' ? 'emerald' : 'amber'
                  }
                  size="sm"
                >
                  {riskAnalysis.dataConfidence === 'High Confidence' ? 'Validated' : 'Sample Limited'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {riskAnalysis.dataConfidence === 'High Confidence'
                  ? '6-sprint statistical baseline'
                  : 'Onboarding ramp-up period'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section A & B: Workload Risk Diagnostics + Historical Capacity Trend */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Section A: Explainable Workload & Congestion Diagnostics */}
          <Card className="border-slate-800 bg-navy-900/90">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-400" />
                  <CardTitle className="text-base text-white">
                    Operational Workload Diagnostic
                  </CardTitle>
                </div>
                <Badge
                  variant={
                    riskAnalysis.severity === 'Critical Overload'
                      ? 'rose'
                      : riskAnalysis.severity === 'Moderate Congestion'
                      ? 'amber'
                      : 'emerald'
                  }
                  size="sm"
                >
                  {riskAnalysis.severity}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Evidence breakdown and contributing factors to scheduling pressure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sustained Overload Banner */}
              {riskAnalysis.isSustainedOverload && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-300">
                    <Flame className="h-4 w-4 text-rose-400" />
                    <span>Sustained Multi-Sprint Over-Allocation Alert</span>
                  </div>
                  <p className="leading-relaxed">
                    Weekly assigned deliverables have exceeded 40h standard ceiling for{' '}
                    <strong>{riskAnalysis.consecutiveOverloadSprints} consecutive sprints</strong>. Immediate manager action is recommended to avert delivery delays.
                  </p>
                </div>
              )}

              {/* Contributing Factors Table */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Contributing Factors
                </span>
                <div className="space-y-2">
                  {riskAnalysis.contributingFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-800/80 bg-navy-950/70 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{factor.factor}</span>
                        <Badge
                          variant={
                            factor.impact === 'High'
                              ? 'rose'
                              : factor.impact === 'Medium'
                              ? 'amber'
                              : 'slate'
                          }
                          size="sm"
                        >
                          {factor.impact} Impact
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">{factor.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Manager Action */}
              <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-3 space-y-1">
                <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  Recommended Manager Action
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {riskAnalysis.recommendedManagerAction}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Historical Capacity Baseline & Trend */}
          <Card className="border-slate-800 bg-navy-900/90">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <CardTitle className="text-base text-white">
                    Sprint Capacity History
                  </CardTitle>
                </div>
                <Badge
                  variant={
                    riskAnalysis.dataConfidence === 'High Confidence' ? 'cyan' : 'amber'
                  }
                  size="sm"
                >
                  {riskAnalysis.dataConfidence}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Weekly allocated load against 40h standard ceiling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Insufficient History Warning (Acceptance Test 4) */}
              {riskAnalysis.confidenceNote && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Sample Size Limitation (Onboarding Baseline)</span>
                  </div>
                  <p className="leading-relaxed">{riskAnalysis.confidenceNote}</p>
                </div>
              )}

              {/* Historical Sprint Bars */}
              <div className="space-y-3 pt-1">
                {history.map((sprint) => {
                  const isCurrent = Boolean(sprint.isCurrent);
                  const isOver = sprint.utilizationPct > 100;
                  const isNear = sprint.utilizationPct >= 85 && sprint.utilizationPct <= 100;

                  return (
                    <div
                      key={sprint.sprint}
                      className={cn(
                        'rounded-lg p-2.5 transition-all text-xs border',
                        isCurrent
                          ? 'border-violet-500/50 bg-violet-950/20 shadow-sm'
                          : 'border-slate-800/80 bg-navy-950/40'
                      )}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-semibold', isCurrent ? 'text-violet-300' : 'text-slate-300')}>
                            {sprint.sprint}
                          </span>
                          {isCurrent && (
                            <Badge variant="violet" size="sm">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">{sprint.allocatedHours}h / {sprint.capacityHours}h</span>
                          <Badge
                            variant={isOver ? 'rose' : isNear ? 'amber' : 'emerald'}
                            size="sm"
                          >
                            {sprint.utilizationPct}%
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            isOver ? 'bg-rose-500' : isNear ? 'bg-amber-400' : 'bg-emerald-400'
                          )}
                          style={{ width: `${Math.min(sprint.utilizationPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section C: Anomaly Investigation & Operational Context (Non-Punitive) */}
        <Card className="border-slate-800 bg-navy-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    'h-4 w-4',
                    anomaly.severity === 'High'
                      ? 'text-rose-400'
                      : anomaly.severity === 'Medium'
                      ? 'text-amber-400'
                      : 'text-cyan-400'
                  )}
                />
                <CardTitle className="text-base text-white">
                  Anomaly Investigation & Operational Context
                </CardTitle>
              </div>
              <Badge
                variant={
                  anomaly.severity === 'High'
                    ? 'rose'
                    : anomaly.severity === 'Medium'
                    ? 'amber'
                    : 'slate'
                }
                size="sm"
              >
                {anomaly.anomalyTitle}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Objective operational signals analyzed without personal attribution or punitive deduction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Left Column: Observed Empirical Evidence */}
              <div className="rounded-xl border border-slate-800/80 bg-navy-950/70 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  Observed Empirical Evidence
                </span>
                <ul className="space-y-2 text-xs text-slate-300">
                  {anomaly.observedEvidence.map((evidence, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      <span className="leading-relaxed">{evidence}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Operational Context & Governance */}
              <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-navy-950 to-violet-950/20 p-4 space-y-2">
                <span className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                  Operational Context & Non-Punitive Rationale
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {anomaly.operationalContext}
                </p>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  Governance Policy: Patterns are framed as structural workflow observations. No punitive penalty or character inference is recorded.
                </div>
              </div>
            </div>

            {/* Manager Review Checklist */}
            <div className="rounded-xl border border-slate-800 bg-navy-950/50 p-4 space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Manager Review Checklist
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {anomaly.recommendedReviewChecklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-slate-800/70 bg-navy-900/60 p-2.5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section D: Growth & Stretch Opportunities */}
        <Card className="border-slate-800 bg-navy-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <CardTitle className="text-base text-white">
                  Growth & Stretch Opportunities
                </CardTitle>
              </div>
              <Badge variant="violet" size="sm">
                Skill Development
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Evaluated deliverables matching employee strengths with capacity gating safeguards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {growthOpportunities.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                No active stretch deliverables available in current sprint scope.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {growthOpportunities.map((opp) => (
                  <div
                    key={opp.taskId}
                    className={cn(
                      'rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all',
                      opp.isCapacityGated
                        ? 'border-amber-500/30 bg-amber-950/10'
                        : 'border-slate-800 bg-navy-950/70 hover:border-violet-500/40'
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-white leading-tight">
                          {opp.taskTitle}
                        </span>
                        <Badge
                          variant={opp.isCapacityGated ? 'amber' : 'emerald'}
                          size="sm"
                          className="shrink-0"
                        >
                          {opp.isCapacityGated ? 'Capacity Gated' : 'Safe Headroom'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{opp.projectName} • {opp.estimatedHours}h</p>

                      <div className="space-y-1 text-xs">
                        <div className="text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">Foundational Strengths:</span>{' '}
                          {opp.matchedStrengths.join(', ')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="font-semibold text-violet-300">Growth Domain:</span>{' '}
                          {opp.growthSkill}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed border-t border-slate-800/80 pt-2">
                        {opp.recommendationRationale}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60">
                      {opp.isCapacityGated ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onNavigate('workload')}
                          className="w-full text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/30"
                        >
                          Rebalance First
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onSelectTaskForMatching(opp.taskId)}
                          className="w-full text-xs bg-violet-600 hover:bg-violet-500 text-white"
                        >
                          Evaluate Candidate Match
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section E: Active Assigned Deliverables & Projects */}
        <Card className="border-slate-800 bg-navy-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-base text-white">
                  Active Assigned Deliverables ({assignedTasks.length})
                </CardTitle>
              </div>
              <Badge variant="emerald" size="sm">
                {actualAssignedHours}h Total Allocated
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Deliverables contributing dynamically to weekly load ({actualUtilizationPct}% of capacity)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignedTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                No active tasks assigned. Contributor has 100% available headroom.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-slate-800 bg-navy-950/70 p-3.5 space-y-2 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-white line-clamp-1">{t.title}</span>
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
                        +{t.estimatedHours}h
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{t.projectName}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Due: {t.dueDate}</span>
                      <Badge variant="violet" size="sm">
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section F: Verified Skills Matrix */}
        <Card className="border-slate-800 bg-navy-900/90">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-base text-white">Verified Technical Skills Matrix</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Verified skills used for deterministic AI matching and capacity balancing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {employee.skills.map((s) => (
                <div
                  key={s.skillId}
                  className="rounded-lg border border-slate-800 bg-navy-950/60 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{s.skillName}</span>
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
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{s.category}</span>
                    <span className="text-emerald-400">✓ Verified</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // DIRECTORY VIEW (DEFAULT)
  // =========================================================================
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Demo Employees', value: capacitySummary.totalEmployees, detail: 'Synthetic profiles', color: 'text-violet-300', icon: Users },
          { label: 'Over Capacity', value: capacitySummary.overloadedCount, detail: 'Exceeding weekly limit (>100%)', color: 'text-rose-400', icon: Flame },
          { label: 'Team Utilization', value: `${capacitySummary.averageUtilizationPct}%`, detail: `${capacitySummary.totalAllocatedHours}h / ${capacitySummary.totalCapacityHours}h weekly`, color: 'text-cyan-300', icon: Activity },
          { label: 'Departments', value: capacitySummary.departmentBreakdowns.length, detail: 'Functional units', color: 'text-emerald-300', icon: Building2 },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="border-slate-800 bg-navy-900/90">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{metric.label}</p>
                  <Icon className={cn('h-5 w-5', metric.color)} />
                </div>
                <p className={cn('mt-3 text-3xl font-bold tracking-tight', metric.color)}>{metric.value}</p>
                <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Directory Card with Native SaaS Look */}
      <Card className="border-slate-800 bg-navy-900/90">
        <CardContent className="p-5 space-y-4">
          {/* Search & Filter Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search by name, job title, or email..."
                className="w-full rounded-lg border border-slate-700/80 bg-navy-950 pl-9 pr-8 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
              />
              {employeeSearch && (
                <button
                  type="button"
                  onClick={() => setEmployeeSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="sm:w-56">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700/80 bg-navy-950 px-3 py-2 text-sm text-slate-200 shadow-sm transition-all focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
              >
                <option value="All">All Departments</option>
                {departments
                  .filter((d) => d !== 'All')
                  .map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Result Count & Reset Filter Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
            <span>
              Showing <strong className="font-semibold text-slate-200">{filteredEmployees.length}</strong> of{' '}
              <strong className="font-semibold text-slate-200">{employees.length}</strong> employees
              {(employeeSearch.trim() !== '' || departmentFilter !== 'All') && (
                <span className="ml-1.5 text-violet-400">(filtered)</span>
              )}
            </span>
            {(employeeSearch.trim() !== '' || departmentFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setEmployeeSearch('');
                  setDepartmentFilter('All');
                }}
                className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Table / Empty State */}
          {filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-navy-950/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60 mb-3">
                <Users className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No employees found</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                No synthetic team members match &ldquo;{employeeSearch}&rdquo;
                {departmentFilter !== 'All' ? ` in ${departmentFilter}` : ''}.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmployeeSearch('');
                  setDepartmentFilter('All');
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="pb-3 pr-4 font-medium">Employee Profile</th>
                    <th className="pb-3 pr-4 font-medium">Department</th>
                    <th className="pb-3 pr-4 font-medium">Workload / Capacity</th>
                    <th className="pb-3 pr-4 font-medium">Utilization</th>
                    <th className="pb-3 text-right font-medium">AI Intelligence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => {
                    const assignedForEmp = tasks.filter((t) => t.assignedTo === employee.id);
                    const dynamicLoad = assignedForEmp.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
                    const percent =
                      employee.weeklyCapacityHours > 0
                        ? Math.round((dynamicLoad / employee.weeklyCapacityHours) * 100)
                        : 0;

                    const isOverloaded = percent > 100;
                    const isHighLoad = percent >= 85 && percent <= 100;

                    const badgeVariant = isOverloaded ? 'rose' : isHighLoad ? 'amber' : 'emerald';
                    const badgeLabel = isOverloaded ? 'Over capacity' : isHighLoad ? 'High load' : 'Normal load';
                    const barColor = isOverloaded ? 'bg-rose-500' : isHighLoad ? 'bg-amber-400' : 'bg-emerald-400';

                    const initials = employee.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <tr
                        key={employee.id}
                        className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/40 transition-colors cursor-pointer group"
                        onClick={() => setSelectedEmployeeId(employee.id)}
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-xs font-bold text-violet-300 border border-violet-500/30 group-hover:border-violet-400 transition-colors">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-100 group-hover:text-violet-300 transition-colors truncate">
                                {employee.fullName}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{employee.jobTitle}</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{employee.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4 align-top sm:align-middle">
                          <Badge variant="slate" size="sm">
                            {employee.department}
                          </Badge>
                        </td>
                        <td className="py-3.5 pr-4 whitespace-nowrap align-top sm:align-middle">
                          <span className="font-medium text-slate-200">{dynamicLoad}h</span>{' '}
                          <span className="text-xs text-slate-400">/ {employee.weeklyCapacityHours}h</span>
                          <span className="block text-[11px] text-slate-500">weekly capacity</span>
                        </td>
                        <td className="py-3.5 pr-4 align-top sm:align-middle min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <Badge variant={badgeVariant} size="sm">
                              {percent}% · {badgeLabel}
                            </Badge>
                          </div>
                          <div className="mt-2 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={cn('h-full rounded-full transition-all duration-300', barColor)}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 text-right align-top sm:align-middle">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-violet-300 hover:text-white hover:bg-violet-600/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(employee.id);
                            }}
                          >
                            Explore Intelligence
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 3: PROJECTS
// =============================================================================
function DemoProjectsView({
  projects,
  tasks,
  onSelectTaskForMatching,
}: {
  projects: Project[];
  tasks: Task[];
  onSelectTaskForMatching: (taskId: string) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = projects.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or scope..."
            className="w-full rounded-lg border border-slate-700/80 bg-navy-900/90 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-navy-900/90 px-3 py-2 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Project Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-navy-900/40">
          <FolderKanban className="h-8 w-8 text-slate-500 mb-2" />
          <p className="text-sm font-semibold text-slate-300">No projects found</p>
          <p className="text-xs text-slate-400 mt-1">
            No projects match &ldquo;{search}&rdquo;{statusFilter !== 'all' ? ` with status ${statusFilter.replace('_', ' ')}` : ''}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((proj) => {
            const pct = proj.totalHours > 0 ? Math.round((proj.completedHours / proj.totalHours) * 100) : 0;
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            const doneCount = projTasks.filter((t) => t.status === 'completed').length;
            const inProgCount = projTasks.filter((t) => t.status === 'in_progress').length;
            const unassignedTasks = projTasks.filter((t) => !t.assignedTo || t.status === 'todo');

            return (
              <Card key={proj.id} className="border-slate-800 bg-navy-900/90 hover:border-slate-700 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-white">{proj.name}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={proj.priority === 'critical' ? 'rose' : proj.priority === 'high' ? 'amber' : 'slate'} size="sm">
                        {proj.priority}
                      </Badge>
                      <Badge variant={proj.status === 'in_progress' ? 'cyan' : proj.status === 'completed' ? 'emerald' : 'slate'} size="sm">
                        {proj.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {proj.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span>Manager: <strong className="text-slate-200">{proj.managerName || 'Unassigned'}</strong></span>
                    <span>
                      {proj.memberIds.length} Team {proj.memberIds.length === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>

                  {/* Hours Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Target Milestone Scope</span>
                      <span>{proj.completedHours}h / {proj.totalHours}h ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Connected Tasks Breakdown */}
                  <div className="rounded-lg bg-navy-950/70 p-3 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
                        Connected Tasks:
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {projTasks.length} Total · {doneCount} Done · {inProgCount} Active
                      </span>
                    </div>

                    {unassignedTasks.length > 0 ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          {unassignedTasks.length} unassigned task{unassignedTasks.length > 1 ? 's' : ''} require staffing
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectTaskForMatching(unassignedTasks[0].id)}
                          className="text-xs text-violet-300 hover:text-white border-violet-500/40 py-1 px-2.5 h-auto flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3 text-violet-400" />
                          <span>Match Task</span>
                          <ArrowRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 pt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>All project tasks staffed & in progress</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DEMO VIEW 4: TASKS
// =============================================================================
function DemoTasksView({
  tasks,
  employees,
  projects,
  onSelectTaskForMatching,
}: {
  tasks: Task[];
  employees: Employee[];
  projects: Project[];
  onSelectTaskForMatching: (taskId: string) => void;
}) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState('all');

  const filtered = tasks.filter((t) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.requiredSkills.some((s) => s.skillName.toLowerCase().includes(q)) ||
      (t.assignedEmployeeName && t.assignedEmployeeName.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesProject = projectFilter === 'all' || t.projectId === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title, skill, or assignee..."
            className="w-full rounded-lg border border-slate-700/80 bg-navy-900/90 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-navy-900/90 px-3 py-2 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-navy-900/90 px-3 py-2 text-sm text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Task Statuses</option>
            <option value="todo">To Do (Pending Staffing)</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <Card className="border-slate-800 bg-navy-900/90">
        <CardContent className="p-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-navy-950/40">
              <CheckSquare className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No tasks found</p>
              <p className="text-xs text-slate-400 mt-1">
                No tasks match your current search and filter criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="pb-3 pr-4 font-medium">Task & Project</th>
                    <th className="pb-3 pr-4 font-medium">Priority & Complexity</th>
                    <th className="pb-3 pr-4 font-medium">Deadline & Effort</th>
                    <th className="pb-3 pr-4 font-medium">Required Skills</th>
                    <th className="pb-3 pr-4 font-medium">Assigned</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">AI Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const assignedEmp = employees.find((e) => e.id === t.assignedTo);
                    const isUnassigned = !t.assignedTo || t.status === 'todo';

                    return (
                      <tr key={t.id} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/40">
                        {/* Task & Project */}
                        <td className="py-3.5 pr-4 max-w-xs">
                          <p className="font-semibold text-slate-100">{t.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                            <FolderKanban className="h-3 w-3 text-slate-500 shrink-0" />
                            <span className="truncate">{t.projectName}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.description}</p>
                        </td>

                        {/* Priority & Complexity */}
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={
                                t.priority === 'critical'
                                  ? 'rose'
                                  : t.priority === 'high'
                                  ? 'amber'
                                  : t.priority === 'medium'
                                  ? 'cyan'
                                  : 'slate'
                              }
                              size="sm"
                              className="w-fit"
                            >
                              {t.priority}
                            </Badge>
                            <span className="text-[11px] text-slate-400">
                              Complexity: <strong className="text-slate-300">{t.complexity}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Deadline & Effort */}
                        <td className="py-3.5 pr-4 whitespace-nowrap text-xs text-slate-300">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold font-mono text-slate-200">{t.estimatedHours} Hours</span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-500" />
                              Due {t.dueDate}
                            </span>
                          </div>
                        </td>

                        {/* Required Skills */}
                        <td className="py-3.5 pr-4 max-w-[200px]">
                          <div className="flex flex-wrap gap-1">
                            {t.requiredSkills && t.requiredSkills.length > 0 ? (
                              t.requiredSkills.map((s, idx) => (
                                <Badge key={idx} variant="violet" size="sm" className="text-[10px]">
                                  {s.skillName} ({s.minProficiency})
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-500 text-[11px]">General criteria</span>
                            )}
                          </div>
                        </td>

                        {/* Assigned Staff */}
                        <td className="py-3.5 pr-4 text-xs whitespace-nowrap">
                          {assignedEmp ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-[10px] font-bold text-violet-300 border border-violet-500/40">
                                {assignedEmp.fullName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')}
                              </div>
                              <div>
                                <p className="font-medium text-slate-200">{assignedEmp.fullName}</p>
                                <p className="text-[10px] text-slate-400">{assignedEmp.jobTitle}</p>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="slate" size="sm" className="text-slate-400">
                              Unassigned
                            </Badge>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <Badge
                            variant={
                              t.status === 'completed'
                                ? 'emerald'
                                : t.status === 'in_progress'
                                ? 'cyan'
                                : t.status === 'in_review'
                                ? 'amber'
                                : 'slate'
                            }
                            size="sm"
                          >
                            {t.status.replace('_', ' ')}
                          </Badge>
                        </td>

                        {/* AI Recommendation Action */}
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant={isUnassigned ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => onSelectTaskForMatching(t.id)}
                            className="text-xs inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{isUnassigned ? 'Find Match' : 'Inspect'}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 5: WORKLOAD
// =============================================================================
// =============================================================================
// DEMO VIEW 5: WORKLOAD & WORKLOAD BALANCING
// =============================================================================
function DemoWorkloadView({
  employees,
  tasks,
  redistributionDecisions,
  onApplyRedistribution,
  onRejectRedistribution,
  onRevokeRedistribution,
}: {
  employees: Employee[];
  tasks: Task[];
  redistributionDecisions: Record<
    string,
    {
      proposalKey: string;
      taskId: string;
      taskTitle: string;
      sourceEmployeeId: string;
      targetEmployeeId: string;
      taskHours: number;
      decision: 'approved' | 'rejected';
      timestamp: string;
      reason?: string;
    }
  >;
  onApplyRedistribution: (task: Task, sourceEmp: Employee, targetEmp: Employee) => void;
  onRejectRedistribution: (task: Task, sourceEmp: Employee, targetEmp: Employee, reason: string) => void;
  onRevokeRedistribution: (proposalKey: string) => void;
}) {
  const capacitySummary = calculateWorkforceCapacitySummary(employees);

  // Filter state for roster
  const [capacityFilter, setCapacityFilter] = React.useState<'all' | 'overloaded' | 'near_limit' | 'optimal'>('all');

  // Overloaded employees
  const overloadedEmployees = React.useMemo(() => {
    return employees.filter(
      (e) => e.weeklyCapacityHours > 0 && e.currentLoadHours > e.weeklyCapacityHours
    );
  }, [employees]);

  // Selected source employee for redistribution sandbox (defaults to first overloaded employee, e.g. David Kim)
  const [selectedSourceEmpId, setSelectedSourceEmpId] = React.useState<string>(
    overloadedEmployees[0]?.id || employees[2]?.id || employees[0]?.id
  );

  // Synchronize selectedSourceEmpId if employees list updates and current selected doesn't exist
  const sourceEmp = employees.find((e) => e.id === selectedSourceEmpId) || employees[0];

  // Active tasks assigned to source employee
  const sourceActiveTasks = React.useMemo(() => {
    return tasks.filter((t) => t.assignedTo === sourceEmp.id && t.status !== 'completed');
  }, [tasks, sourceEmp.id]);

  // Selected task to reallocate
  const [selectedTaskId, setSelectedTaskId] = React.useState<string>(
    sourceActiveTasks[0]?.id || ''
  );

  // If selectedTaskId is not among sourceActiveTasks, default to first available
  React.useEffect(() => {
    if (sourceActiveTasks.length > 0 && !sourceActiveTasks.some((t) => t.id === selectedTaskId)) {
      setSelectedTaskId(sourceActiveTasks[0].id);
    }
  }, [sourceActiveTasks, selectedTaskId]);

  const activeTask = sourceActiveTasks.find((t) => t.id === selectedTaskId) || sourceActiveTasks[0];

  // Compute redistribution candidate evaluations
  const redistributionResult = React.useMemo(() => {
    if (!activeTask || !sourceEmp) return null;
    return evaluateRedistributionForTask(activeTask, sourceEmp, employees);
  }, [activeTask, sourceEmp, employees]);

  // Manager dismissal state
  const [isDismissing, setIsDismissing] = React.useState(false);
  const [dismissReason, setDismissReason] = React.useState(
    'Critical path specialist required for architecture integrity'
  );

  // Key for tracking current proposal decision
  const currentProposalKey =
    activeTask && redistributionResult?.recommendedCandidate
      ? `${activeTask.id}-${sourceEmp.id}-${redistributionResult.recommendedCandidate.candidate.id}`
      : activeTask
      ? `${activeTask.id}-${sourceEmp.id}-none`
      : '';

  const currentDecision = redistributionDecisions[currentProposalKey];
  const isApproved =
    currentDecision?.decision === 'approved' || (activeTask && activeTask.assignedTo !== sourceEmp.id);
  const isRejected = currentDecision?.decision === 'rejected';

  // Filtered employees for the roster
  const filteredEmployees = React.useMemo(() => {
    return employees.filter((emp) => {
      const pct = emp.weeklyCapacityHours > 0 ? (emp.currentLoadHours / emp.weeklyCapacityHours) * 100 : 0;
      if (capacityFilter === 'overloaded') return pct > 100;
      if (capacityFilter === 'near_limit') return pct >= 85 && pct <= 100;
      if (capacityFilter === 'optimal') return pct < 85;
      return true;
    });
  }, [employees, capacityFilter]);

  const isSourceOverloaded = sourceEmp.weeklyCapacityHours > 0 && sourceEmp.currentLoadHours > sourceEmp.weeklyCapacityHours;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Capacity Bands Cards with Clickable Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          onClick={() => setCapacityFilter(capacityFilter === 'overloaded' ? 'all' : 'overloaded')}
          className={cn(
            'border-rose-900/40 bg-navy-900/90 cursor-pointer transition-all hover:border-rose-500/60',
            capacityFilter === 'overloaded' && 'ring-2 ring-rose-500/80 bg-rose-950/20 shadow-glow'
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                Over Capacity (&gt;100%)
              </span>
              <Flame className="h-5 w-5 text-rose-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-rose-400">{capacitySummary.overloadedCount}</p>
            <p className="mt-1 text-xs text-slate-400">
              {capacityFilter === 'overloaded' ? 'Showing filtered roster · Click to reset' : 'Requires workload balancing'}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setCapacityFilter(capacityFilter === 'near_limit' ? 'all' : 'near_limit')}
          className={cn(
            'border-amber-900/40 bg-navy-900/90 cursor-pointer transition-all hover:border-amber-500/60',
            capacityFilter === 'near_limit' && 'ring-2 ring-amber-500/80 bg-amber-950/20 shadow-glow'
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Near Limit (85–100%)
              </span>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-400">{capacitySummary.nearLimitCount}</p>
            <p className="mt-1 text-xs text-slate-400">
              {capacityFilter === 'near_limit' ? 'Showing filtered roster · Click to reset' : 'Approaching maximum allocation'}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setCapacityFilter(capacityFilter === 'optimal' ? 'all' : 'optimal')}
          className={cn(
            'border-emerald-900/40 bg-navy-900/90 cursor-pointer transition-all hover:border-emerald-500/60',
            capacityFilter === 'optimal' && 'ring-2 ring-emerald-500/80 bg-emerald-950/20 shadow-glow'
          )}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Optimal Load (&lt;85%)
              </span>
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-400">{capacitySummary.optimalCount}</p>
            <p className="mt-1 text-xs text-slate-400">
              {capacityFilter === 'optimal' ? 'Showing filtered roster · Click to reset' : 'Available capacity for new tasks'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overload Detection & Status Banner */}
      {capacitySummary.overloadedCount > 0 ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Flame className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-rose-200">
                Capacity Bottleneck Detected ({capacitySummary.overloadedCount} Member Overloaded)
              </p>
              <p className="text-xs text-slate-300">
                {overloadedEmployees.map((e) => `${e.fullName} (${Math.round((e.currentLoadHours / e.weeklyCapacityHours) * 100)}% load)`).join(', ')} has exceeded maximum capacity. WorkForce AI evaluates skill compatibility and available headroom below to rebalance workload safely.
              </p>
            </div>
          </div>
          <Badge variant="rose" size="sm" className="shrink-0 self-start sm:self-auto">
            Action Required
          </Badge>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-200">
                Capacity Balanced across All Team Members
              </p>
              <p className="text-xs text-slate-300">
                Zero overloaded employees detected. Average organization utilization is healthy at {capacitySummary.averageUtilizationPct}% ({capacitySummary.totalAllocatedHours}h allocated of {capacitySummary.totalCapacityHours}h pool).
              </p>
            </div>
          </div>
          <Badge variant="emerald" size="sm" className="shrink-0 self-start sm:self-auto">
            Optimal State
          </Badge>
        </div>
      )}

      {/* ===================================================================== */}
      {/* INTELLIGENT WORKLOAD REDISTRIBUTION SANDBOX                           */}
      {/* ===================================================================== */}
      <Card className="border-zinc-800 bg-zinc-900/90 shadow-sm">
        <CardHeader className="border-b border-zinc-800 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-white flex items-center gap-2">
                  Intelligent Workload Balancing Sandbox
                  <Badge variant="violet" size="sm" className="text-[10px]">
                    Heuristic Safety Pipeline
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Select an overloaded employee deliverable to evaluate qualified alternatives, preview before/after impact, and rebalance capacity.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="cyan" size="sm">
                Human-in-the-Loop Approval
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Step 1 & 2: Select Overloaded Employee & Active Deliverable */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Employee Selector */}
            <div className="space-y-2 rounded-xl bg-navy-950/60 p-4 border border-slate-800/80">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-violet-400" />
                1. Focus Employee:
              </label>
              <select
                value={selectedSourceEmpId}
                onChange={(e) => {
                  setSelectedSourceEmpId(e.target.value);
                  setIsDismissing(false);
                }}
                className="w-full rounded-lg border border-slate-700 bg-navy-900 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-violet-500 focus:outline-none"
              >
                {employees.map((emp) => {
                  const pct = Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100);
                  const isOver = pct > 100;
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.currentLoadHours}h / {emp.weeklyCapacityHours}h - {pct}%) {isOver ? '⚠️ OVERLOADED' : pct >= 85 ? '⚡ Near Limit' : '✓ Optimal'}
                    </option>
                  );
                })}
              </select>

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Current Status:</span>
                <Badge variant={isSourceOverloaded ? 'rose' : 'emerald'} size="sm">
                  {Math.round((sourceEmp.currentLoadHours / sourceEmp.weeklyCapacityHours) * 100)}% Utilized · {sourceEmp.currentLoadHours}h / {sourceEmp.weeklyCapacityHours}h
                </Badge>
              </div>
            </div>

            {/* Active Deliverable Selector */}
            <div className="space-y-2 rounded-xl bg-navy-950/60 p-4 border border-slate-800/80">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
                2. Select Active Task to Reallocate:
              </label>
              {sourceActiveTasks.length === 0 ? (
                <div className="py-2 text-xs text-slate-400 italic">
                  No active tasks assigned to {sourceEmp.fullName}.
                </div>
              ) : (
                <select
                  value={selectedTaskId}
                  onChange={(e) => {
                    setSelectedTaskId(e.target.value);
                    setIsDismissing(false);
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-navy-900 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-violet-500 focus:outline-none truncate"
                >
                  {sourceActiveTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.estimatedHours}h - {t.priority})
                    </option>
                  ))}
                </select>
              )}

              {activeTask && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="text-slate-400">Scope & Deadline:</span>
                  <span className="font-mono text-slate-200">
                    {activeTask.estimatedHours}h · Due {activeTask.dueDate}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Active Task Attribute Summary */}
          {activeTask && (
            <div className="rounded-xl bg-navy-950/80 p-3.5 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant={activeTask.priority === 'critical' ? 'rose' : 'amber'} size="sm">
                  {activeTask.priority}
                </Badge>
                <span className="font-semibold text-white truncate">{activeTask.title}</span>
                <span className="text-slate-400">({activeTask.projectName})</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-400 text-[11px] uppercase font-semibold">Prerequisites:</span>
                {activeTask.requiredSkills.map((s, idx) => (
                  <Badge key={idx} variant="violet" size="sm" className="text-[10px]">
                    {s.skillName} ({s.minProficiency})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 & 4: Alternative Candidate Evaluation & Before/After Comparison */}
          {redistributionResult && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  3. Redistribution Candidate Evaluation & Safety Analysis
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {redistributionResult.candidates.length} Team Members Evaluated
                </span>
              </div>

              {/* Special Case: No eligible alternative exists (Scenario 3) */}
              {!redistributionResult.hasEligibleCandidate ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-200">
                        No Eligible Alternative Available for Transfer
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {redistributionResult.explanation}
                      </p>
                      {redistributionResult.bottleneckReason && (
                        <p className="text-xs text-amber-300/90 font-mono pt-1">
                          Reason: {redistributionResult.bottleneckReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20 text-xs text-slate-400">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <span>
                      WorkForce AI enforces deterministic skill gating. Automated reassignment is safely disabled to prevent project delivery failure.
                    </span>
                  </div>
                </div>
              ) : (
                /* Suitable candidate found (Scenario 1 & 2) */
                <div className="space-y-4">
                  {/* Before & After Workload Comparison Grid (Section 2C) */}
                  <div className="rounded-xl border border-violet-500/30 bg-navy-950/90 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider block">
                          Before-and-After Workload Impact (Preview)
                        </span>
                        <h4 className="text-sm font-bold text-white">
                          Proposed Transfer: &ldquo;{activeTask.title}&rdquo; ({activeTask.estimatedHours}h)
                        </h4>
                      </div>
                      <Badge variant="cyan" size="sm">
                        Simulated Preview · Pending Approval
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Source Employee (Relieved) */}
                      <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-300">
                            Source: {sourceEmp.fullName}
                          </span>
                          <Badge variant="rose" size="sm">
                            Relieving -{activeTask.estimatedHours}h (-{redistributionResult.sourceBeforeUtilPct - redistributionResult.sourceAfterUtilPct}%)
                          </Badge>
                        </div>
                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>Before: {redistributionResult.sourceBeforeLoad}h ({redistributionResult.sourceBeforeUtilPct}%)</span>
                            <span className="text-emerald-400 font-bold">
                              After: {redistributionResult.sourceAfterLoad}h ({redistributionResult.sourceAfterUtilPct}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                              style={{ width: `${Math.min(redistributionResult.sourceAfterUtilPct, 100)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-emerald-300">
                          ✓ Overload bottleneck eliminated; returns to healthy {redistributionResult.sourceAfterUtilPct}% capacity.
                        </p>
                      </div>

                      {/* Target Employee (Absorbing) */}
                      {redistributionResult.recommendedCandidate && (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300">
                              Target: {redistributionResult.recommendedCandidate.candidate.fullName}
                            </span>
                            <Badge variant="emerald" size="sm">
                              Absorbing +{activeTask.estimatedHours}h (+{redistributionResult.recommendedCandidate.projectedUtilPct - Math.round((redistributionResult.recommendedCandidate.currentLoadHours / redistributionResult.recommendedCandidate.candidate.weeklyCapacityHours) * 100)}%)
                            </Badge>
                          </div>
                          <div className="space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between text-slate-300">
                              <span>
                                Before: {redistributionResult.recommendedCandidate.currentLoadHours}h (
                                {Math.round(
                                  (redistributionResult.recommendedCandidate.currentLoadHours /
                                    redistributionResult.recommendedCandidate.candidate.weeklyCapacityHours) *
                                    100
                                )}
                                %)
                              </span>
                              <span className="text-cyan-400 font-bold">
                                After: {redistributionResult.recommendedCandidate.projectedLoadHours}h (
                                {redistributionResult.recommendedCandidate.projectedUtilPct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-cyan-400 transition-all duration-300"
                                style={{
                                  width: `${Math.min(
                                    redistributionResult.recommendedCandidate.projectedUtilPct,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-cyan-300">
                            ✓ Safely absorbed within {redistributionResult.recommendedCandidate.projectedUtilPct}% threshold; zero burnout risk.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rationale & Safety Trade-off Explanation (Scenario 2) */}
                    <div className="rounded-lg bg-navy-900/80 p-3 border border-slate-800 space-y-1 text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                        AI Redistribution Analysis:
                      </span>
                      <p className="text-slate-300 leading-relaxed">
                        {redistributionResult.explanation}
                      </p>
                    </div>

                    {/* Candidate Evaluation Cards */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
                        Candidate Breakdown & Safety Ranking:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {redistributionResult.candidates.slice(0, 4).map((c, idx) => {
                          const isTop = c.candidate.id === redistributionResult.recommendedCandidate?.candidate.id;
                          return (
                            <div
                              key={c.candidate.id}
                              className={cn(
                                'rounded-lg p-3 border text-xs space-y-1.5 transition-all',
                                isTop
                                  ? 'border-emerald-500/50 bg-emerald-950/20'
                                  : c.isOverloaded
                                  ? 'border-rose-900/40 bg-navy-950/40 opacity-80'
                                  : 'border-slate-800 bg-navy-950/60'
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">
                                  #{idx + 1} {c.candidate.fullName}
                                </span>
                                <Badge variant={isTop ? 'emerald' : c.isOverloaded ? 'rose' : 'slate'} size="sm">
                                  {isTop ? '★ Safest Fit' : c.isOverloaded ? '⚠️ Overload Risk' : 'Eligible'}
                                </Badge>
                              </div>
                              <div className="flex justify-between text-slate-400 text-[11px]">
                                <span>Skill Match: <strong className="text-slate-200">{c.skillMatchScore}%</strong></span>
                                <span>Projected Load: <strong className={c.isOverloaded ? 'text-rose-400' : 'text-slate-200'}>{c.projectedUtilPct}%</strong></span>
                              </div>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {c.matchedSkills.map((s, sIdx) => (
                                  <Badge key={sIdx} variant="cyan" size="sm" className="text-[10px]">
                                    {s}
                                  </Badge>
                                ))}
                                {c.missingSkills.map((s, sIdx) => (
                                  <Badge key={sIdx} variant="slate" size="sm" className="text-[10px]">
                                    Missing: {s}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 5: Manager Action & Human Sign-off Controls */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        {isApproved ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="emerald" size="sm" className="gap-1.5 py-1 px-2.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Redistribution Applied in Demo</span>
                            </Badge>
                            {currentDecision?.timestamp && (
                              <span className="text-[11px] text-slate-400">
                                Approved at {currentDecision.timestamp}
                              </span>
                            )}
                            <button
                              onClick={() => onRevokeRedistribution(currentProposalKey)}
                              className="text-[11px] text-slate-400 hover:text-rose-300 underline focus:outline-none ml-1"
                            >
                              Revert Transfer
                            </button>
                          </div>
                        ) : isRejected ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="rose" size="sm" className="gap-1.5 py-1 px-2.5">
                              <XCircle className="h-3.5 w-3.5 text-rose-400" />
                              <span>Proposal Dismissed ({currentDecision?.reason})</span>
                            </Badge>
                            <button
                              onClick={() => onRevokeRedistribution(currentProposalKey)}
                              className="text-[11px] text-slate-400 hover:text-violet-300 underline focus:outline-none ml-1"
                            >
                              Reconsider
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-xs flex items-center gap-1.5"
                              onClick={() => {
                                if (redistributionResult.recommendedCandidate) {
                                  onApplyRedistribution(
                                    activeTask,
                                    sourceEmp,
                                    redistributionResult.recommendedCandidate.candidate
                                  );
                                }
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-0.5" />
                              <span>Approve Redistribution (Demo)</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/20"
                              onClick={() => setIsDismissing(true)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              <span>Dismiss</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Human-in-the-Loop Governance</span>
                        <Badge variant="slate" size="sm" className="text-[10px]">
                          Advisory Simulation
                        </Badge>
                      </div>
                    </div>

                    {/* Dismiss Reason Form Drawer */}
                    {isDismissing && (
                      <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 space-y-2 text-xs">
                        <p className="font-semibold text-rose-300">
                          Select manager reason for dismissing this redistribution proposal:
                        </p>
                        <select
                          value={dismissReason}
                          onChange={(e) => setDismissReason(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-navy-950 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          <option value="Critical path specialist required for architecture integrity">
                            Critical path specialist required for architecture integrity
                          </option>
                          <option value="Deliverable deadline deferred by product management">
                            Deliverable deadline deferred by product management
                          </option>
                          <option value="Alternative cross-team contractor resource scheduled">
                            Alternative cross-team contractor resource scheduled
                          </option>
                          <option value="Pair-programming knowledge transfer scheduled prior to handoff">
                            Pair-programming knowledge transfer scheduled prior to handoff
                          </option>
                        </select>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              if (redistributionResult.recommendedCandidate) {
                                onRejectRedistribution(
                                  activeTask,
                                  sourceEmp,
                                  redistributionResult.recommendedCandidate.candidate,
                                  dismissReason
                                );
                              }
                              setIsDismissing(false);
                            }}
                            className="text-xs py-1 px-3 h-auto"
                          >
                            Confirm Dismissal
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsDismissing(false)}
                            className="text-xs text-slate-400 py-1 px-2.5 h-auto"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================== */}
      {/* DETAILED WORKLOAD ROSTER & CONTRIBUTING TASKS                         */}
      {/* ===================================================================== */}
      <Card className="border-slate-800 bg-navy-900/90">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-white">Live Capacity & Heatmap Roster</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Allocated hours dynamically computed from active task assignments across all {employees.length} team members
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Filter:</span>
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value as any)}
              className="rounded-lg border border-slate-700 bg-navy-950 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Capacity Bands ({employees.length})</option>
              <option value="overloaded">Over Capacity (&gt;100%) ({capacitySummary.overloadedCount})</option>
              <option value="near_limit">Near Limit (85–100%) ({capacitySummary.nearLimitCount})</option>
              <option value="optimal">Optimal Load (&lt;85%) ({capacitySummary.optimalCount})</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 space-y-4">
          {filteredEmployees.map((emp) => {
            const pct = emp.weeklyCapacityHours > 0 ? Math.round((emp.currentLoadHours / emp.weeklyCapacityHours) * 100) : 0;
            const isOver = pct > 100;
            const isNear = pct >= 85 && pct <= 100;
            const empTasks = tasks.filter((t) => t.assignedTo === emp.id && t.status !== 'completed');

            return (
              <div key={emp.id} className="rounded-xl border border-slate-800/80 bg-navy-950/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-white">{emp.fullName}</span>
                    <span className="ml-2 text-xs text-slate-400">{emp.jobTitle} · {emp.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isOver ? 'rose' : isNear ? 'amber' : 'emerald'} size="sm">
                      {pct}% Utilized
                    </Badge>
                    <span className="text-xs text-slate-400 font-mono">
                      {emp.currentLoadHours}h / {emp.weeklyCapacityHours}h max
                    </span>
                    {isOver && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedSourceEmpId(emp.id);
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        className="text-xs text-violet-300 border-violet-500/40 py-1 px-2.5 h-auto ml-1"
                      >
                        <Scale className="h-3 w-3 mr-1" />
                        Rebalance
                      </Button>
                    )}
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', isOver ? 'bg-rose-500' : isNear ? 'bg-amber-400' : 'bg-emerald-400')}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Contributing Active Tasks Breakdown (Section 2A) */}
                <div className="pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1.5">
                    Contributing Active Deliverables ({empTasks.length}):
                  </span>
                  {empTasks.length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No active deliverables currently assigned.</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {empTasks.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-md bg-navy-900 border border-slate-800 px-2.5 py-1 text-xs flex items-center gap-2"
                        >
                          <span className="text-slate-200 font-medium truncate max-w-[220px]">{t.title}</span>
                          <span className="text-cyan-400 font-mono text-[11px] font-bold">+{t.estimatedHours}h</span>
                          <Badge variant={t.priority === 'critical' ? 'rose' : 'slate'} size="sm" className="text-[9px] py-0 px-1">
                            {t.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 6: AI RECOMMENDATIONS
// =============================================================================
function DemoMatchingView({
  tasks,
  employees,
  selectedTaskId,
  onSelectTaskId,
  approvalDecisions,
  onApprove,
  onReject,
  onRevoke,
}: {
  tasks: Task[];
  employees: Employee[];
  selectedTaskId: string;
  onSelectTaskId: (taskId: string) => void;
  approvalDecisions: Record<
    string,
    {
      decision: 'approved' | 'rejected';
      candidateId: string;
      candidateName: string;
      taskId: string;
      taskTitle: string;
      allocatedHours: number;
      timestamp: string;
      reason?: string;
    }
  >;
  onApprove: (rec: AIRecommendation) => void;
  onReject: (rec: AIRecommendation, reason: string) => void;
  onRevoke: (recId: string) => void;
}) {
  const [rejectingRecId, setRejectingRecId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState<string>('Capacity allocated to alternative critical sprint');

  const currentTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const matchedRecs = React.useMemo(() => {
    return deriveSyntheticCandidateEvaluations(currentTask, employees);
  }, [currentTask, employees]);

  const assignedEmp = employees.find((e) => e.id === currentTask.assignedTo);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Advisory & Fairness Guardrail Banner */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-violet-200">
                Fairness by Design & Explainable AI Matching (Human-in-the-Loop)
              </p>
              <p className="text-xs text-slate-300">
                Evaluates candidates using deterministic skill compatibility and live capacity metrics. Approving, rejecting, or reverting updates the active task, staff allocation, and governance audit history across all views in real time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Badge variant="violet" size="sm">
              Simulated Demo Evaluation
            </Badge>
            <Badge variant="cyan" size="sm">
              Human Approval Required
            </Badge>
          </div>
        </div>

        {/* Ethical Risk & Fairness Guardrail Callout */}
        <div className="rounded-lg bg-navy-950/80 p-2.5 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-100 font-semibold">Fairness & Algorithmic Guardrail:</strong>{' '}
            Candidate scores are heuristic recommendations derived strictly from recorded technical skill levels and available weekly headroom. The engine does NOT infer demographic or personal characteristics, assess clinical health, or automate employment decisions. All staffing actions require explicit human manager approval.
          </div>
        </div>
      </div>

      {/* Target Task Selector & Rich Task Context Card */}
      <div className="rounded-xl border border-slate-800 bg-navy-900/90 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider block">
              Active Evaluation Task
            </span>
            <div className="flex items-center gap-2.5 mt-0.5">
              <h3 className="text-base font-bold text-white">{currentTask.title}</h3>
              <Badge
                variant={
                  currentTask.status === 'completed'
                    ? 'emerald'
                    : currentTask.status === 'in_progress'
                    ? 'cyan'
                    : currentTask.status === 'in_review'
                    ? 'amber'
                    : 'slate'
                }
                size="sm"
              >
                {currentTask.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Select Task:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => {
                onSelectTaskId(e.target.value);
                setRejectingRecId(null);
              }}
              className="rounded-lg border border-slate-700/80 bg-navy-950 px-3 py-2 text-xs font-semibold text-slate-200 focus:border-violet-500 focus:outline-none max-w-xs sm:max-w-md truncate"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.estimatedHours}h - {t.priority}) {!t.assignedTo ? '★ Needs Staffing' : `✓ ${t.assignedEmployeeName || 'Assigned'}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Task Attributes Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-navy-950/70 p-2.5 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Project</span>
            <span className="font-semibold text-slate-200 truncate block mt-0.5">{currentTask.projectName}</span>
          </div>
          <div className="rounded-lg bg-navy-950/70 p-2.5 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Effort & Deadline</span>
            <span className="font-semibold text-slate-200 font-mono mt-0.5 block">
              {currentTask.estimatedHours} Hours · Due {currentTask.dueDate}
            </span>
          </div>
          <div className="rounded-lg bg-navy-950/70 p-2.5 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Priority / Complexity</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="capitalize font-semibold text-slate-200">{currentTask.priority}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 font-medium">{currentTask.complexity} Complexity</span>
            </div>
          </div>
          <div className="rounded-lg bg-navy-950/70 p-2.5 border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Assignment</span>
            <div className="mt-0.5">
              {assignedEmp ? (
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {assignedEmp.fullName}
                </span>
              ) : (
                <span className="font-medium text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Unassigned (Backlog)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Required Skills Row */}
        <div className="rounded-lg bg-navy-950/50 p-2.5 border border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 text-[10px] uppercase font-semibold">Required Skills:</span>
          {currentTask.requiredSkills && currentTask.requiredSkills.length > 0 ? (
            currentTask.requiredSkills.map((s, idx) => (
              <Badge key={idx} variant="violet" size="sm" className="text-[11px]">
                {s.skillName} ({s.minProficiency})
              </Badge>
            ))
          ) : (
            <span className="text-slate-500 text-xs italic">General operational requirements</span>
          )}
        </div>
      </div>

      {/* Section Subheading & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">
            Ranked Candidate Suggestions ({matchedRecs.length})
          </h4>
          <p className="text-xs text-slate-400">
            Evaluated deterministically across technical skills, current capacity, and projected burnout risk
          </p>
        </div>
        <span className="text-xs text-slate-400 font-mono self-start sm:self-auto">
          Deterministic Heuristic Engine
        </span>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {matchedRecs.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-navy-900/40">
            <Sparkles className="h-6 w-6 text-slate-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Candidate Evaluations Found for this Task</p>
            <p className="text-xs text-slate-400 mt-1">Please select another demo task from the dropdown above.</p>
          </div>
        ) : (
          matchedRecs.map((rec, rankIdx) => {
            const emp = employees.find((e) => e.id === rec.candidateId);
            const decision = approvalDecisions[rec.id];
            const isApproved =
              decision?.decision === 'approved' ||
              (currentTask.assignedTo === rec.candidateId && currentTask.status === 'in_progress');
            const isRejected = decision?.decision === 'rejected';

            const isOverloaded = (rec.workloadImpact?.projectedUtilizationPct ?? 0) > 100;
            const isNearLimit = (rec.workloadImpact?.projectedUtilizationPct ?? 0) >= 85 && !isOverloaded;
            const isRejectingThis = rejectingRecId === rec.id;

            return (
              <Card
                key={rec.id}
                className={cn(
                  'border-slate-800 bg-navy-900/90 transition-all',
                  isApproved && 'border-emerald-500/50 bg-emerald-950/10 shadow-lg shadow-emerald-950/20',
                  isRejected && 'border-rose-900/40 bg-navy-950/40 opacity-75'
                )}
              >
                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Candidate Header & Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-sm font-bold text-violet-300 border border-violet-500/30">
                        {rec.candidateAvatar || 'EM'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-slate-400">#{rankIdx + 1}</span>
                          <h4 className="font-semibold text-white truncate">{rec.candidateName}</h4>
                          {isApproved && (
                            <Badge variant="emerald" size="sm" className="text-[10px] gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Assigned (Demo)
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="rose" size="sm" className="text-[10px] gap-1">
                              <XCircle className="h-3 w-3" />
                              Dismissed (Demo)
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {rec.candidateTitle || emp?.jobTitle} · {rec.candidateDepartment || emp?.department}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="flex items-center gap-1.5 sm:justify-end">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                            Heuristic Score
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-navy-950 text-violet-300 border border-violet-500/30 font-medium">
                            Calculated
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-2xl font-extrabold font-mono',
                            rec.matchScore >= 85
                              ? 'text-emerald-400'
                              : rec.matchScore >= 70
                              ? 'text-cyan-400'
                              : rec.matchScore >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          )}
                        >
                          {rec.matchScore}%
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          55% Skill / 45% Headroom
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Factor Metrics: Skill Compatibility & Workload/Capacity */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* 1. Skill Compatibility */}
                    <div className="rounded-lg bg-navy-950/70 p-3 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-cyan-400" />
                          Skill Compatibility:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-navy-950 text-slate-400 border border-slate-800">
                            Measured Fact
                          </span>
                          <span className="font-mono text-cyan-300 font-semibold">
                            {rec.skillMatchBreakdown.skillScore}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rec.skillMatchBreakdown.matchedSkills.map((ms, idx) => (
                          <Badge key={idx} variant="cyan" size="sm" className="text-[10px]">
                            {ms.skill}: {ms.candidateLevel}
                          </Badge>
                        ))}
                        {rec.skillMatchBreakdown.missingSkills.map((ms, idx) => (
                          <Badge key={idx} variant="slate" size="sm" className="text-[10px] text-slate-400">
                            Missing: {ms}
                          </Badge>
                        ))}
                        {rec.skillMatchBreakdown.matchedSkills.length === 0 && rec.skillMatchBreakdown.missingSkills.length === 0 && (
                          <span className="text-slate-400 text-[11px] italic">General qualifications apply</span>
                        )}
                      </div>
                    </div>

                    {/* 2. Workload / Capacity Impact */}
                    <div className="rounded-lg bg-navy-950/70 p-3 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-violet-400" />
                          Workload & Capacity:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-navy-950 text-slate-400 border border-slate-800">
                            Measured Fact
                          </span>
                          <span
                            className={cn(
                              'font-mono font-semibold text-xs',
                              isOverloaded
                                ? 'text-rose-400'
                                : isNearLimit
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            )}
                          >
                            {rec.workloadImpact?.projectedUtilizationPct ?? 0}% Projected
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">
                        Allocated:{' '}
                        <strong className="text-slate-100">
                          {rec.workloadImpact?.currentLoadHours ?? emp?.currentLoadHours ?? 0}h
                        </strong>{' '}
                        →{' '}
                        <strong
                          className={
                            isOverloaded
                              ? 'text-rose-400'
                              : isNearLimit
                              ? 'text-amber-300'
                              : 'text-emerald-300'
                          }
                        >
                          {rec.workloadImpact?.projectedLoadHours ??
                            (emp?.currentLoadHours ?? 0) + currentTask.estimatedHours}h
                        </strong>{' '}
                        / {rec.workloadImpact?.weeklyCapacityHours ?? emp?.weeklyCapacityHours ?? 40}h capacity
                      </p>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Badge
                          variant={isOverloaded ? 'rose' : isNearLimit ? 'amber' : 'emerald'}
                          size="sm"
                          className="text-[10px]"
                        >
                          {isOverloaded
                            ? 'Capacity Overload Constraint'
                            : isNearLimit
                            ? 'Near-Limit Bandwidth'
                            : 'Optimal Available Capacity'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Explainable Matching Rationale & Evidence */}
                  <div className="rounded-lg bg-navy-950/70 p-3.5 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                        Deterministic Evaluation & Trade-off:
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Rule-Based Evidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rec.rationale}</p>
                    <p className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/50">
                      Algorithmic Note: Heuristic scores evaluate recorded task prerequisites and weekly bandwidth. They do not represent objective candidate superiority or personal ratings.
                    </p>
                  </div>

                  {/* Identified Operational Risk Factors */}
                  {rec.riskFactors && rec.riskFactors.length > 0 && (
                    <div className="rounded-lg bg-navy-950/50 p-3 border border-slate-800/60 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        Operational Risk Indicators:
                      </p>
                      <ul className="space-y-1">
                        {rec.riskFactors.map((rf, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{rf}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Reject Reason Form (if active) */}
                  {isRejectingThis && (
                    <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 space-y-2">
                      <p className="text-xs font-semibold text-rose-300">
                        Specify manager reason for dismissing {rec.candidateName}:
                      </p>
                      <select
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-navy-950 px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                      >
                        <option value="Capacity allocated to alternative critical sprint">
                          Capacity allocated to alternative critical sprint
                        </option>
                        <option value="Technical skill gap requires senior pairing or onboarding">
                          Technical skill gap requires senior pairing or onboarding
                        </option>
                        <option value="Candidate scheduled for upcoming PTO or compliance training">
                          Candidate scheduled for upcoming PTO or compliance training
                        </option>
                        <option value="Task priority deferred to next planning cycle">
                          Task priority deferred to next planning cycle
                        </option>
                      </select>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            onReject(rec, rejectReason);
                            setRejectingRecId(null);
                          }}
                          className="text-xs py-1 px-3 h-auto"
                        >
                          Confirm Dismissal
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRejectingRecId(null)}
                          className="text-xs text-slate-400 py-1 px-2.5 h-auto"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Interactive Manager Approval / Reject Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                    <div className="flex flex-wrap items-center gap-2">
                      {isApproved ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="emerald" size="sm" className="gap-1.5 py-1 px-2.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Assigned to Task</span>
                          </Badge>
                          {decision?.timestamp && (
                            <span className="text-[11px] text-slate-400">
                              Approved at {decision.timestamp}
                            </span>
                          )}
                          <button
                            onClick={() => onRevoke(rec.id)}
                            className="text-[11px] text-slate-400 hover:text-rose-300 underline focus:outline-none ml-1"
                          >
                            Revert Assignment
                          </button>
                        </div>
                      ) : isRejected ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="rose" size="sm" className="gap-1.5 py-1 px-2.5">
                            <XCircle className="h-3.5 w-3.5 text-rose-400" />
                            <span>Dismissed ({decision?.reason || 'Alternative priority'})</span>
                          </Badge>
                          <button
                            onClick={() => onRevoke(rec.id)}
                            className="text-[11px] text-slate-400 hover:text-violet-300 underline focus:outline-none ml-1"
                          >
                            Reconsider
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs flex items-center gap-1.5"
                            onClick={() => onApprove(rec)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-0.5" />
                            <span>Approve & Assign (Demo)</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/20"
                            onClick={() => setRejectingRecId(rec.id)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            <span>Dismiss</span>
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>Simulated demo evaluation · In-memory session · Non-punitive heuristic</span>
                      <Badge variant="slate" size="sm" className="text-[10px]">
                        Advisory Only
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DEMO VIEW 7: REPORTS & AI GOVERNANCE AUDIT LOG
// =============================================================================
function DemoReportsView({
  employees,
  projects,
  auditEvents,
  onNavigate,
}: {
  employees: Employee[];
  projects: Project[];
  auditEvents: AuditEvent[];
  onNavigate: (view: DemoView) => void;
}) {
  const capacitySummary = calculateWorkforceCapacitySummary(employees);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterAction, setFilterAction] = React.useState('all');

  const handleDownloadCSV = () => {
    const headers = ['Employee ID', 'Full Name', 'Department', 'Job Title', 'Capacity Hours', 'Allocated Hours', 'Utilization Pct'];
    const rows = employees.map((e) => [
      e.id,
      `"${e.fullName}"`,
      e.department,
      `"${e.jobTitle}"`,
      e.weeklyCapacityHours,
      e.currentLoadHours,
      `${Math.round((e.currentLoadHours / e.weeklyCapacityHours) * 100)}%`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workforce_demo_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPlannedHours = projects.reduce((s, p) => s + p.totalHours, 0);
  const totalCompletedHours = projects.reduce((s, p) => s + p.completedHours, 0);
  const completedPct = totalPlannedHours > 0 ? Math.round((totalCompletedHours / totalPlannedHours) * 100) : 0;

  // Real audit stats: count logged recommendation decisions and reversals from audit trail
  const approvedCount = auditEvents.filter((a) => a.action.includes('Approved')).length;
  const rejectedCount = auditEvents.filter((a) => a.action.includes('Rejected')).length;
  const revertedCount = auditEvents.filter((a) => a.action.includes('Reverted')).length;
  const workloadCount = auditEvents.filter((a) => a.entityType === 'Workload').length;
  const baselineCount = auditEvents.filter(
    (a) => !a.action.includes('Approved') && !a.action.includes('Rejected') && !a.action.includes('Reverted')
  ).length;

  const filteredEvents = auditEvents.filter((ev) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ev.action.toLowerCase().includes(q) ||
      ev.entityTitle.toLowerCase().includes(q) ||
      ev.actorName.toLowerCase().includes(q) ||
      ev.details.toLowerCase().includes(q);

    let matchesFilter = true;
    if (filterAction === 'approved') {
      matchesFilter = ev.action.includes('Approved');
    } else if (filterAction === 'rejected') {
      matchesFilter = ev.action.includes('Rejected');
    } else if (filterAction === 'reverted') {
      matchesFilter = ev.action.includes('Reverted');
    } else if (filterAction === 'workload') {
      matchesFilter = ev.entityType === 'Workload';
    } else if (filterAction === 'baseline') {
      matchesFilter =
        !ev.action.includes('Approved') &&
        !ev.action.includes('Rejected') &&
        !ev.action.includes('Reverted');
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header with Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-lg font-bold text-white">Operational Analytics & AI Governance</h3>
          <p className="text-xs text-slate-400">
            Chronological decision ledger, capacity compliance, and CSV reporting (Pitch Deck Page 7: &ldquo;AI Recommendations. Human Decisions.&rdquo;)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="violet" size="sm">
            Session Decision Trail
          </Badge>
          <Button variant="primary" size="sm" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            <span>Export CSV Report</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-800 bg-navy-900/90">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Planned Portfolio Scope</span>
            <p className="mt-2 text-2xl font-bold font-mono text-white">{totalPlannedHours} Hours</p>
            <p className="mt-1 text-xs text-slate-400">
              {totalCompletedHours}h completed ({completedPct}%) across {projects.length} portfolio initiatives
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-navy-900/90">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Capacity Utilization</span>
            <p className="mt-2 text-2xl font-bold font-mono text-cyan-400">
              {capacitySummary.averageUtilizationPct}%
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {capacitySummary.totalAllocatedHours}h allocated / {capacitySummary.totalCapacityHours}h pool
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-navy-900/90">
          <CardContent className="p-5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Governance Log</span>
            <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">{approvedCount} Approved</p>
            <p className="mt-1 text-xs text-slate-400">
              {rejectedCount} dismissed · {revertedCount} reversed · {auditEvents.length} total session records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Session Governance Notice */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <span className="font-semibold text-cyan-300 block">
              In-Memory Session Decision Log & Governance Integrity (Non-Production Notice)
            </span>
            <p className="leading-relaxed">
              All events recorded below capture <strong>human manager decisions</strong> (approvals, dismissals, workload rebalances, and reversals) executed in real time during this presentation walkthrough. WorkForce enforces human sign-off before assignments or redistributions take effect. To guarantee presentation isolation, these records are stored in memory and do not write to persistent production databases.
            </p>
          </div>
        </div>
      </div>

      {/* AI Governance Log & Decision Review Card */}
      <Card className="border-slate-800 bg-navy-900/90">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-400" />
                <CardTitle className="text-base text-white">AI Governance & Human Decision Log</CardTitle>
                <Badge variant="violet" size="sm">
                  {filteredEvents.length} Records
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                Chronological ledger of manager approvals, rejections, transfers, and reversals with rationale tracking
              </CardDescription>
            </div>

            {/* Quick Filter Pill / Button */}
            {(searchQuery.trim() !== '' || filterAction !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterAction('all');
                }}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors self-start sm:self-auto"
              >
                Reset filters
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border border-slate-800 bg-navy-950">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search actions, candidates, tasks, or reasons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-navy-900 px-3 py-1.5 pl-8 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-md border border-slate-700 bg-navy-900 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="all">All Decision Types ({auditEvents.length})</option>
              <option value="approved">Approvals Only ({approvedCount})</option>
              <option value="rejected">Dismissals Only ({rejectedCount})</option>
              <option value="reverted">Reversals Only ({revertedCount})</option>
              <option value="workload">Workload Transfers ({workloadCount})</option>
              <option value="baseline">Baseline System Records ({baselineCount})</option>
            </select>
          </div>

          {/* Timeline List of Events */}
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-navy-950/40 space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-1">
                <History className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">No Governance Events Found</h4>
              <p className="max-w-sm text-xs text-slate-400 leading-relaxed">
                {auditEvents.length === 0
                  ? 'No audit events recorded in this session. Take an approval, dismissal, or rebalancing action to generate a log.'
                  : `No records match the active filter "${filterAction}"${searchQuery ? ` and query "${searchQuery}"` : ''}.`}
              </p>
              {(searchQuery.trim() !== '' || filterAction !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterAction('all');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
                >
                  Clear search & filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => {
                const isApproved = ev.action.includes('Approved');
                const isRejected = ev.action.includes('Rejected');
                const isReverted = ev.action.includes('Reverted');

                const actionBadgeVariant = isApproved
                  ? 'emerald'
                  : isRejected
                  ? 'rose'
                  : isReverted
                  ? 'amber'
                  : 'slate';

                return (
                  <div
                    key={ev.id}
                    className={cn(
                      'rounded-xl border p-4 space-y-2.5 transition-all text-xs',
                      isApproved
                        ? 'border-emerald-500/30 bg-emerald-950/10'
                        : isRejected
                        ? 'border-rose-900/30 bg-rose-950/10'
                        : isReverted
                        ? 'border-amber-500/30 bg-amber-950/10'
                        : 'border-slate-800 bg-navy-950/60'
                    )}
                  >
                    {/* Top Row: Action Badge, Entity Type, Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={actionBadgeVariant} size="sm" className="font-semibold">
                          {isApproved && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                          {isRejected && <XCircle className="h-3 w-3 mr-1 inline" />}
                          {isReverted && <RotateCcw className="h-3 w-3 mr-1 inline" />}
                          {ev.action}
                        </Badge>
                        <Badge variant="slate" size="sm">
                          {ev.entityType}
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-400">ID: {ev.id}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{ev.timestamp}</span>
                    </div>

                    {/* Title & Actor */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                      <h4 className="font-bold text-white text-sm">{ev.entityTitle}</h4>
                      <span className="text-slate-400 text-[11px]">
                        Actor: <strong className="text-slate-200">{ev.actorName}</strong>
                      </span>
                    </div>

                    {/* Details / Manager Rationale */}
                    <p className="text-slate-300 text-xs leading-relaxed bg-navy-900/60 p-2.5 rounded-lg border border-slate-800/80">
                      {ev.details}
                    </p>

                    {/* Navigation Link CTA */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-slate-500 italic">
                        {isReverted
                          ? 'Reversal Action · Task & capacity restored without erasing history'
                          : isApproved
                          ? 'Manager Signed Off · Updated across active workload & tasks'
                          : isRejected
                          ? 'Manager Dismissed · Task retained in backlog'
                          : 'System Baseline Event'}
                      </span>

                      {ev.entityType === 'Recommendation' && (
                        <button
                          type="button"
                          onClick={() => onNavigate('matching')}
                          className="text-violet-400 hover:text-violet-300 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          Inspect in AI Matching
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                      {ev.entityType === 'Workload' && (
                        <button
                          type="button"
                          onClick={() => onNavigate('workload')}
                          className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          Inspect in Workload
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                      {ev.entityType === 'Task' && (
                        <button
                          type="button"
                          onClick={() => onNavigate('tasks')}
                          className="text-slate-300 hover:text-white font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          Inspect in Tasks
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Breakdown Table */}
      <Card className="border-slate-800 bg-navy-900/90">
        <CardHeader>
          <CardTitle className="text-base text-white">Department Capacity Breakdown</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Reconciles directly with organization-wide capacity pool ({capacitySummary.totalAllocatedHours}h allocated / {capacitySummary.totalCapacityHours}h total capacity)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Department</th>
                  <th className="pb-3 pr-4 font-medium">Headcount</th>
                  <th className="pb-3 pr-4 font-medium">Weekly Allocated</th>
                  <th className="pb-3 pr-4 font-medium">Capacity Pool</th>
                  <th className="pb-3 font-medium">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {capacitySummary.departmentBreakdowns.map((dept) => (
                  <tr key={dept.department} className="border-b border-slate-800/70 last:border-0 hover:bg-slate-900/40">
                    <td className="py-3 pr-4 font-semibold text-white">{dept.department}</td>
                    <td className="py-3 pr-4 text-slate-300">
                      {dept.headcount} {dept.headcount === 1 ? 'member' : 'members'}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{dept.allocatedHours}h</td>
                    <td className="py-3 pr-4 text-slate-300">{dept.capacityHours}h</td>
                    <td className="py-3">
                      <Badge variant={dept.utilizationPct > 100 ? 'rose' : dept.utilizationPct >= 85 ? 'amber' : 'emerald'} size="sm">
                        {dept.utilizationPct}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-navy-950/60 font-semibold text-xs text-slate-200">
                  <td className="py-3.5 pr-4 text-white">Total / Reconciled Team Pool</td>
                  <td className="py-3.5 pr-4 text-slate-200">
                    {capacitySummary.totalEmployees} {capacitySummary.totalEmployees === 1 ? 'member' : 'members'}
                  </td>
                  <td className="py-3.5 pr-4 text-slate-200">{capacitySummary.totalAllocatedHours}h</td>
                  <td className="py-3.5 pr-4 text-slate-200">{capacitySummary.totalCapacityHours}h</td>
                  <td className="py-3">
                    <Badge variant={capacitySummary.averageUtilizationPct > 100 ? 'rose' : capacitySummary.averageUtilizationPct >= 85 ? 'amber' : 'emerald'} size="sm">
                      {capacitySummary.averageUtilizationPct}%
                    </Badge>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            * All department metrics reconcile with the team capacity pool ({capacitySummary.totalAllocatedHours}h allocated of {capacitySummary.totalCapacityHours}h across {capacitySummary.totalEmployees} members).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// ROOT EXPORT (WITH SUSPENSE BOUNDARY)
// =============================================================================
export default function PresentationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-navy-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <span className="text-xs text-slate-400 font-mono">Loading presentation demo...</span>
          </div>
        </div>
      }
    >
      <PresentationContent />
    </React.Suspense>
  );
}
