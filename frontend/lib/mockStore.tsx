'use client';

import * as React from 'react';
import {
  Employee,
  Project,
  Task,
  AIRecommendation,
  WorkloadRedistributionProposal,
  AuditEvent,
  NotificationItem,
  Skill,
  TaskStatus,
  UserRole,
} from './types';
import {
  initialEmployees,
  initialProjects,
  initialTasks,
  initialAIRecommendations,
  initialRedistributionProposals,
  initialAuditEvents,
  initialNotifications,
  initialSkills,
} from './mockData';
import { useAuth } from './authContext';

export interface DemoIdentity {
  id: string;
  name: string;
  role: UserRole;
  jobTitle: string;
  department: string;
  avatar: string;
}

export const demoIdentities: DemoIdentity[] = [
  {
    id: 'emp-org',
    name: 'Dr. Aris Thorne',
    role: 'organizer',
    jobTitle: 'Founder & Chief System Architect',
    department: 'Executive',
    avatar: 'AT',
  },
  {
    id: 'emp-8',
    name: 'Chloe Dubois',
    role: 'admin',
    jobTitle: 'VP of Operations & Workspace Admin',
    department: 'Executive Administration',
    avatar: 'CD',
  },
  {
    id: 'emp-1',
    name: 'Sarah Connor',
    role: 'manager',
    jobTitle: 'Engineering Lead & Architect',
    department: 'Engineering',
    avatar: 'SC',
  },
  {
    id: 'emp-hr',
    name: 'Elena Rostova',
    role: 'hr',
    jobTitle: 'Head of People & Workforce Analytics',
    department: 'Human Resources',
    avatar: 'ER',
  },
  {
    id: 'emp-2',
    name: 'Alex Chen',
    role: 'employee',
    jobTitle: 'Senior Frontend Engineer',
    department: 'Engineering',
    avatar: 'AC',
  },
  {
    id: 'emp-6',
    name: 'Priya Patel',
    role: 'employee',
    jobTitle: 'Full-Stack Software Engineer',
    department: 'Engineering',
    avatar: 'PP',
  },
];

export function calculateEmployeeWorkload(
  emp: Employee,
  allTasks: Task[]
): { currentLoadHours: number; activeTaskCount: number; burnoutRiskScore: number } {
  // Sum estimatedHours of all active (non-completed) tasks assigned to this employee
  const activeEmpTasks = allTasks.filter(
    (t) => t.assignedTo === emp.id && t.status !== 'completed'
  );
  const currentLoadHours = activeEmpTasks.reduce(
    (sum, t) => sum + (t.estimatedHours || 0),
    0
  );
  const activeTaskCount = activeEmpTasks.length;

  const utilizationRatio = emp.weeklyCapacityHours > 0 ? currentLoadHours / emp.weeklyCapacityHours : 0;
  const criticalTasks = activeEmpTasks.filter(
    (t) => t.priority === 'critical' || t.priority === 'high'
  ).length;

  let burnoutRiskScore = Math.min(
    Math.max(utilizationRatio * 0.7 + criticalTasks * 0.05, 0.05),
    1.0
  );
  if (utilizationRatio > 1.0) {
    burnoutRiskScore = Math.min(0.85 + (utilizationRatio - 1.0) * 0.5, 1.0);
  }

  return {
    currentLoadHours,
    activeTaskCount,
    burnoutRiskScore: Math.round(burnoutRiskScore * 100) / 100,
  };
}

export function computeDynamicRedistributionProposals(
  employees: Employee[],
  tasks: Task[]
): WorkloadRedistributionProposal[] {
  const proposals: WorkloadRedistributionProposal[] = [];

  // 1. Find all overloaded employees (> 100% of weekly capacity)
  const overloadedEmps = employees
    .filter((e) => e.weeklyCapacityHours > 0 && e.currentLoadHours > e.weeklyCapacityHours)
    .sort(
      (a, b) =>
        b.currentLoadHours / b.weeklyCapacityHours - a.currentLoadHours / a.weeklyCapacityHours
    );

  for (const sourceEmp of overloadedEmps) {
    const sourceUtil = Math.round((sourceEmp.currentLoadHours / sourceEmp.weeklyCapacityHours) * 100);
    const sourceActiveTasks = tasks
      .filter((t) => t.assignedTo === sourceEmp.id && t.status !== 'completed')
      .sort((a, b) => b.estimatedHours - a.estimatedHours);

    for (const task of sourceActiveTasks) {
      // Find eligible targets with capacity buffer
      const eligibleTargets = employees
        .filter((target) => {
          if (target.id === sourceEmp.id) return false;
          if (target.weeklyCapacityHours <= 0) return false;
          const projectedTargetLoad = target.currentLoadHours + task.estimatedHours;
          // Must not exceed 95% capacity after accepting task
          return projectedTargetLoad <= target.weeklyCapacityHours * 0.95;
        })
        .sort((a, b) => {
          // Same department preference
          const sameDeptA = a.department === sourceEmp.department ? 1 : 0;
          const sameDeptB = b.department === sourceEmp.department ? 1 : 0;
          if (sameDeptA !== sameDeptB) return sameDeptB - sameDeptA;
          // Lower utilization preference
          return (
            a.currentLoadHours / a.weeklyCapacityHours -
            b.currentLoadHours / b.weeklyCapacityHours
          );
        });

      if (eligibleTargets.length > 0) {
        const targetEmp = eligibleTargets[0];
        const sourceProjectedLoad = Math.max(0, sourceEmp.currentLoadHours - task.estimatedHours);
        const sourceProjectedUtil = Math.round(
          (sourceProjectedLoad / sourceEmp.weeklyCapacityHours) * 100
        );
        const targetProjectedLoad = targetEmp.currentLoadHours + task.estimatedHours;
        const targetProjectedUtil = Math.round(
          (targetProjectedLoad / targetEmp.weeklyCapacityHours) * 100
        );

        proposals.push({
          id: `prop-${sourceEmp.id}-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          taskHours: task.estimatedHours,
          sourceEmployeeId: sourceEmp.id,
          sourceEmployeeName: sourceEmp.fullName,
          sourceCurrentLoad: sourceEmp.currentLoadHours,
          sourceProjectedLoad,
          targetEmployeeId: targetEmp.id,
          targetEmployeeName: targetEmp.fullName,
          targetCurrentLoad: targetEmp.currentLoadHours,
          targetProjectedLoad,
          rationale: `Transferring "${task.title}" (${task.estimatedHours}h) reduces ${sourceEmp.fullName} from an alarming ${sourceUtil}% overload down to ${sourceProjectedUtil}%, while ${targetEmp.fullName} (${Math.round((targetEmp.currentLoadHours / targetEmp.weeklyCapacityHours) * 100)}% load) safely absorbs the deliverable to ${targetProjectedUtil}%.`,
        });
        break; // 1 primary recommendation per overloaded employee
      }
    }
  }

  // 2. If no members are overloaded, find near-limit members (> 80%) that can be smoothed
  if (proposals.length === 0) {
    const nearLimitEmps = employees
      .filter((e) => e.weeklyCapacityHours > 0 && e.currentLoadHours / e.weeklyCapacityHours >= 0.8)
      .sort(
        (a, b) =>
          b.currentLoadHours / b.weeklyCapacityHours - a.currentLoadHours / a.weeklyCapacityHours
      );

    for (const sourceEmp of nearLimitEmps) {
      const sourceActiveTasks = tasks
        .filter((t) => t.assignedTo === sourceEmp.id && t.status !== 'completed')
        .sort((a, b) => b.estimatedHours - a.estimatedHours);

      for (const task of sourceActiveTasks) {
        const availableTargets = employees
          .filter((target) => {
            if (target.id === sourceEmp.id) return false;
            if (target.weeklyCapacityHours <= 0) return false;
            const projectedTargetLoad = target.currentLoadHours + task.estimatedHours;
            return projectedTargetLoad <= target.weeklyCapacityHours * 0.85;
          })
          .sort(
            (a, b) =>
              a.currentLoadHours / a.weeklyCapacityHours -
              b.currentLoadHours / b.weeklyCapacityHours
          );

        if (availableTargets.length > 0) {
          const targetEmp = availableTargets[0];
          const sourceUtil = Math.round(
            (sourceEmp.currentLoadHours / sourceEmp.weeklyCapacityHours) * 100
          );
          const sourceProjectedLoad = Math.max(0, sourceEmp.currentLoadHours - task.estimatedHours);
          const sourceProjectedUtil = Math.round(
            (sourceProjectedLoad / sourceEmp.weeklyCapacityHours) * 100
          );
          const targetProjectedLoad = targetEmp.currentLoadHours + task.estimatedHours;
          const targetProjectedUtil = Math.round(
            (targetProjectedLoad / targetEmp.weeklyCapacityHours) * 100
          );

          proposals.push({
            id: `prop-smooth-${sourceEmp.id}-${task.id}`,
            taskId: task.id,
            taskTitle: task.title,
            taskHours: task.estimatedHours,
            sourceEmployeeId: sourceEmp.id,
            sourceEmployeeName: sourceEmp.fullName,
            sourceCurrentLoad: sourceEmp.currentLoadHours,
            sourceProjectedLoad,
            targetEmployeeId: targetEmp.id,
            targetEmployeeName: targetEmp.fullName,
            targetCurrentLoad: targetEmp.currentLoadHours,
            targetProjectedLoad,
            rationale: `Proactive load smoothing: Reallocating "${task.title}" (${task.estimatedHours}h) prevents ${sourceEmp.fullName} (${sourceUtil}%) from reaching capacity limit, utilizing ${targetEmp.fullName}'s open bandwidth safely up to ${targetProjectedUtil}%.`,
          });
          break;
        }
      }
    }
  }

  return proposals;
}

interface MockStoreContextType {
  employees: Employee[];
  projects: Project[];
  tasks: Task[];
  recommendations: AIRecommendation[];
  redistributionProposals: WorkloadRedistributionProposal[];
  auditEvents: AuditEvent[];
  notifications: NotificationItem[];
  skills: Skill[];

  // Demo Mode & Identity
  isDemoMode: boolean;
  enterDemoMode: (target?: UserRole | string) => void;
  exitDemoMode: () => void;
  activeRole: UserRole;
  currentUserId: string;
  currentUser: DemoIdentity;
  switchDemoRole: (identityIdOrRole: string) => void;

  // Actions
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => void;
  updateTaskDetails: (taskId: string, updates: Partial<Task>) => void;
  approveRecommendation: (recId: string) => void;
  rejectRecommendation: (recId: string, reason: string) => void;
  applyRedistribution: (proposalId: string) => void;
  markNotificationAsRead: (notifId: string) => void;
  markAllNotificationsAsRead: () => void;
  addNewTask: (newTask: Omit<Task, 'id' | 'createdAt'>) => void;
  addNewProject: (newProj: Omit<Project, 'id' | 'completedHours'>) => void;
  addNewEmployee: (
    newEmp: Omit<
      Employee,
      'id' | 'currentLoadHours' | 'burnoutRiskScore' | 'activeTaskCount' | 'onTimeCompletionRate'
    >
  ) => void;
  updateEmployeeWeeklyCapacity: (employeeId: string, newCapacityHours: number) => void;
  resetAllSyntheticData: () => void;
  feedbackMessage: string | null;
  setFeedbackMessage: (msg: string | null) => void;
}

const MockStoreContext = React.createContext<MockStoreContextType | null>(null);

export function MockStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, role: authRole, isAuthenticated } = useAuth();

  const [rawEmployees, setRawEmployees] = React.useState<Employee[]>(initialEmployees);
  const [projects, setProjects] = React.useState<Project[]>(initialProjects);
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [recommendations, setRecommendations] = React.useState<AIRecommendation[]>(initialAIRecommendations);
  const [auditEvents, setAuditEvents] = React.useState<AuditEvent[]>(initialAuditEvents);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(initialNotifications);
  const [skills, setSkills] = React.useState<Skill[]>(initialSkills);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  // Demo Mode state
  const [isDemoMode, setIsDemoMode] = React.useState<boolean>(false);
  const [demoUserId, setDemoUserId] = React.useState<string>('emp-1'); // Default Sarah Connor (Manager)

  // Initialize and synchronize demo mode lifecycle with authentication state
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isAuthenticated) {
      // When a real Supabase session is authenticated, clear demo mode from storage and state
      localStorage.removeItem('workforce_demo_mode');
      localStorage.removeItem('workforce_demo_user_id');
      setIsDemoMode(false);
      setDemoUserId('emp-1');
    } else {
      const savedMode = localStorage.getItem('workforce_demo_mode') === 'true';
      if (savedMode) {
        setIsDemoMode(true);
        const savedId = localStorage.getItem('workforce_demo_user_id');
        if (savedId && demoIdentities.some((i) => i.id === savedId)) {
          setDemoUserId(savedId);
        }
      } else {
        setIsDemoMode(false);
      }
    }
  }, [isAuthenticated]);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const currentUser: DemoIdentity = React.useMemo(() => {
    if (isAuthenticated && user) {
      const name = profile?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Lead';
      const initials = name
        .split(' ')
        .filter(Boolean)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'TL';
      return {
        id: user.id,
        name,
        role: authRole,
        jobTitle: profile?.jobTitle || (authRole === 'admin' ? 'Workspace Administrator' : 'Software Engineer'),
        department: profile?.department || 'Engineering',
        avatar: initials,
      };
    }
    return demoIdentities.find((i) => i.id === demoUserId) || demoIdentities[0];
  }, [isAuthenticated, user, profile, authRole, demoUserId]);

  const activeRole: UserRole = isAuthenticated ? authRole : currentUser.role;
  const currentUserId: string = currentUser.id;

  // Deterministic live workload recalculation across all employees
  const employees = React.useMemo(() => {
    return rawEmployees.map((emp) => {
      const stats = calculateEmployeeWorkload(emp, tasks);
      return {
        ...emp,
        currentLoadHours: stats.currentLoadHours,
        activeTaskCount: stats.activeTaskCount,
        burnoutRiskScore: stats.burnoutRiskScore,
      };
    });
  }, [rawEmployees, tasks]);

  // Dynamic AI Workload Redistribution Proposals derived directly from live employees & tasks
  const redistributionProposals = React.useMemo(() => {
    return computeDynamicRedistributionProposals(employees, tasks);
  }, [employees, tasks]);

  const enterDemoMode = (target?: UserRole | string) => {
    if (isAuthenticated) {
      showFeedback('Demo mode cannot be entered while a real authenticated session is active.');
      return;
    }
    setIsDemoMode(true);
    let identity = demoIdentities.find((i) => i.id === 'emp-1') || demoIdentities[0];
    if (target) {
      const byRole = demoIdentities.find((i) => i.role === target);
      const byId = demoIdentities.find((i) => i.id === target);
      identity = byRole || byId || identity;
    }
    setDemoUserId(identity.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('workforce_demo_mode', 'true');
      localStorage.setItem('workforce_demo_user_id', identity.id);
    }
    showFeedback(`Entered Demo Showcase as ${identity.name} (${identity.role.toUpperCase()})`);
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    setDemoUserId('emp-1');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('workforce_demo_mode');
      localStorage.removeItem('workforce_demo_user_id');
    }
    showFeedback('Exited Demo Mode. Returning to standard authentication.');
  };

  const switchDemoRole = (identityIdOrRole: string) => {
    if (isAuthenticated) {
      showFeedback('Simulated role switching is rejected for authenticated sessions.');
      return;
    }
    const ident = demoIdentities.find(
      (i) => i.id === identityIdOrRole || i.role === identityIdOrRole
    );
    if (!ident) return;
    setDemoUserId(ident.id);
    if (typeof window !== 'undefined' && isDemoMode) {
      localStorage.setItem('workforce_demo_user_id', ident.id);
    }
    showFeedback(`Switched demo role to ${ident.name} (${ident.role.toUpperCase()})`);
  };

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (activeRole === 'employee' && targetTask.assignedTo !== currentUserId) {
      showFeedback('Permission Denied: Employees can only update their own assigned tasks.');
      return;
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const oldStatus = t.status;
          const newAudit: AuditEvent = {
            id: `aud-${Date.now()}`,
            actorId: currentUser.id,
            actorName: `${currentUser.name} (${currentUser.role})`,
            action: 'Task Status Updated',
            entityType: 'Task',
            entityId: t.id,
            entityTitle: t.title,
            details: `Status transitioned from ${oldStatus} to ${newStatus}. Workload auto-recalculated.`,
            timestamp: 'Just now',
          };
          setAuditEvents((a) => [newAudit, ...a]);
          return { ...t, status: newStatus };
        }
        return t;
      })
    );
    showFeedback(
      `Task status changed to "${newStatus}". Workload auto-recalculated for assignee.`
    );
  };

  const updateTaskDetails = (taskId: string, updates: Partial<Task>) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    if (activeRole === 'employee' && targetTask.assignedTo !== currentUserId) {
      showFeedback('Permission Denied: Employees can only edit their own assigned tasks.');
      return;
    }

    // Resolve assignee name & avatar if assignedTo changed
    let assignedEmployeeName = targetTask.assignedEmployeeName;
    let assignedEmployeeAvatar = targetTask.assignedEmployeeAvatar;
    if (updates.assignedTo !== undefined) {
      const newEmp = employees.find((e) => e.id === updates.assignedTo);
      assignedEmployeeName = newEmp ? newEmp.fullName : undefined;
      assignedEmployeeAvatar = newEmp
        ? newEmp.fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
        : undefined;
    }

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            ...updates,
            assignedEmployeeName,
            assignedEmployeeAvatar,
          };
        }
        return t;
      })
    );

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Task Details / Effort Updated',
      entityType: 'Task',
      entityId: taskId,
      entityTitle: targetTask.title,
      details: `Updated task parameters. Effort: ${updates.estimatedHours ?? targetTask.estimatedHours}h. Workload recalculated.`,
      timestamp: 'Just now',
    };
    setAuditEvents((a) => [newAudit, ...a]);

    showFeedback(
      `Task "${targetTask.title}" updated! Workload automatically recalculated across all team members.`
    );
  };

  const approveRecommendation = (recId: string) => {
    const targetRec = recommendations.find((r) => r.id === recId);
    if (!targetRec) return;

    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, status: 'accepted' } : r))
    );

    // Assign task - employee workload recalculates automatically via useMemo!
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === targetRec.taskId) {
          return {
            ...t,
            status: 'in_progress',
            assignedTo: targetRec.candidateId,
            assignedEmployeeName: targetRec.candidateName,
            assignedEmployeeAvatar: targetRec.candidateAvatar || 'EM',
          };
        }
        return t;
      })
    );

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Approved AI Recommendation',
      entityType: 'Recommendation',
      entityId: recId,
      entityTitle: `${targetRec.candidateName} -> ${targetRec.taskTitle}`,
      details: `Manager approved match score ${targetRec.matchScore}%. ${targetRec.workloadImpact.taskEstimatedHours}h allocated to ${targetRec.candidateName}. Workload recalculated.`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Task Assignment Confirmed',
      message: `${currentUser.name} approved assigning "${targetRec.taskTitle}" to ${targetRec.candidateName}.`,
      type: 'task_assigned',
      linkUrl: `/tasks/${targetRec.taskId}`,
      isRead: false,
      timestamp: 'Just now',
    };
    setNotifications((prev) => [newNotif, ...prev]);

    showFeedback(
      `Approved! ${targetRec.candidateName} assigned to "${targetRec.taskTitle}". Workload updated live.`
    );
  };

  const rejectRecommendation = (recId: string, reason: string) => {
    setRecommendations((prev) =>
      prev.map((r) =>
        r.id === recId ? { ...r, status: 'rejected', decisionReason: reason } : r
      )
    );

    const rec = recommendations.find((r) => r.id === recId);
    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Rejected AI Recommendation',
      entityType: 'Recommendation',
      entityId: recId,
      entityTitle: `${rec?.candidateName} -> ${rec?.taskTitle}`,
      details: `Manager rejected recommendation. Reason: "${reason}".`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);

    showFeedback(`Rejected recommendation for ${rec?.candidateName}.`);
  };

  const applyRedistribution = (proposalId: string) => {
    const proposal = redistributionProposals.find((p) => p.id === proposalId);
    if (!proposal) return;

    // Reassign task - employee workload recalculates automatically via useMemo!
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === proposal.taskId) {
          return {
            ...t,
            assignedTo: proposal.targetEmployeeId,
            assignedEmployeeName: proposal.targetEmployeeName,
            assignedEmployeeAvatar: proposal.targetEmployeeName
              .split(' ')
              .map((n) => n[0])
              .join(''),
          };
        }
        return t;
      })
    );

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Executed Workload Rebalance',
      entityType: 'Workload',
      entityId: proposalId,
      entityTitle: `Rebalance: ${proposal.sourceEmployeeName} -> ${proposal.targetEmployeeName}`,
      details: `Transferred "${proposal.taskTitle}" (${proposal.taskHours}h). Relieved overload on ${proposal.sourceEmployeeName}. Workload auto-recalculated.`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);

    showFeedback(
      `Rebalancing applied! Transferred "${proposal.taskTitle}" to ${proposal.targetEmployeeName}. Workloads recalculated live!`
    );
  };

  const markNotificationAsRead = (notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showFeedback('All notifications marked as read.');
  };

  const addNewTask = (newTask: Omit<Task, 'id' | 'createdAt'>) => {
    if (activeRole === 'employee') {
      showFeedback('Permission Denied: Employees cannot create or add new tasks.');
      return;
    }

    const created: Task = {
      ...newTask,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTasks((prev) => [created, ...prev]);

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Created Task',
      entityType: 'Task',
      entityId: created.id,
      entityTitle: created.title,
      details: `Task created with ${created.estimatedHours}h estimate in project ${created.projectName}. Workload updated.`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);
    showFeedback(`Task "${created.title}" created! Workload updated.`);
  };

  const addNewProject = (newProj: Omit<Project, 'id' | 'completedHours'>) => {
    const created: Project = {
      ...newProj,
      id: `proj-${Date.now()}`,
      completedHours: 0,
    };
    setProjects((prev) => [created, ...prev]);

    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Created Project',
      entityType: 'Project',
      entityId: created.id,
      entityTitle: created.name,
      details: `Project created by manager ${currentUser.name} with ${created.totalHours}h budget, priority: ${created.priority}, target deadline: ${created.targetEndDate}.`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);
    showFeedback(`Project "${created.name}" created successfully!`);
  };

  const addNewEmployee = (
    newEmp: Omit<
      Employee,
      'id' | 'currentLoadHours' | 'burnoutRiskScore' | 'activeTaskCount' | 'onTimeCompletionRate'
    >
  ) => {
    const created: Employee = {
      ...newEmp,
      id: `emp-${Date.now()}`,
      currentLoadHours: 0,
      burnoutRiskScore: 0.1,
      activeTaskCount: 0,
      onTimeCompletionRate: 100,
    };
    setRawEmployees((prev) => [...prev, created]);
    showFeedback(`Employee ${created.fullName} added to the directory.`);
  };

  const updateEmployeeWeeklyCapacity = (employeeId: string, newCapacityHours: number) => {
    const validHours = Math.max(5, Math.min(80, newCapacityHours));
    setRawEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, weeklyCapacityHours: validHours } : e))
    );

    const emp = rawEmployees.find((e) => e.id === employeeId);
    const newAudit: AuditEvent = {
      id: `aud-${Date.now()}`,
      actorId: currentUser.id,
      actorName: `${currentUser.name} (${currentUser.role})`,
      action: 'Updated Capacity Target',
      entityType: 'Employee',
      entityId: employeeId,
      entityTitle: emp?.fullName || employeeId,
      details: `Weekly capacity target adjusted to ${validHours}h/week. Utilization ratios recalculated.`,
      timestamp: 'Just now',
    };
    setAuditEvents((prev) => [newAudit, ...prev]);
    showFeedback(`Updated weekly capacity for ${emp?.fullName || 'employee'} to ${validHours}h/week.`);
  };

  const resetAllSyntheticData = () => {
    setRawEmployees(initialEmployees);
    setProjects(initialProjects);
    setTasks(initialTasks);
    setRecommendations(initialAIRecommendations);
    setAuditEvents(initialAuditEvents);
    setNotifications(initialNotifications);
    setSkills(initialSkills);
    showFeedback('Synthetic workspace reset to default baseline.');
  };

  return (
    <MockStoreContext.Provider
      value={{
        employees,
        projects,
        tasks,
        recommendations,
        redistributionProposals,
        auditEvents,
        notifications,
        skills,
        isDemoMode,
        enterDemoMode,
        exitDemoMode,
        activeRole,
        currentUserId,
        currentUser,
        switchDemoRole,
        updateTaskStatus,
        updateTaskDetails,
        approveRecommendation,
        rejectRecommendation,
        applyRedistribution,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNewTask,
        addNewProject,
        addNewEmployee,
        updateEmployeeWeeklyCapacity,
        resetAllSyntheticData,
        feedbackMessage,
        setFeedbackMessage,
      }}
    >
      {children}
    </MockStoreContext.Provider>
  );
}

export function useMockStore() {
  const context = React.useContext(MockStoreContext);
  if (!context) {
    throw new Error('useMockStore must be used within a MockStoreProvider');
  }
  return context;
}
