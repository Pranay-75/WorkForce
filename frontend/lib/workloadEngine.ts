/**
 * WorkForce Deterministic Workload Intelligence Engine
 *
 * Single source of truth for:
 * 1. Task activity and overdue evaluation.
 * 2. Employee and organization-level capacity calculations.
 * 3. Transparent workload balancing and redistribution proposals.
 * 4. Deterministic candidate matching scoring with explainable factors.
 *
 * Directives:
 * - Deterministic arithmetic only: never let an LLM override capacity bounds or eligibility.
 * - Active tasks are strictly defined as: 'todo', 'in_progress', 'in_review', 'blocked'.
 * - 'completed' and 'cancelled' tasks are strictly excluded from active workload.
 * - Zero or negative capacity is handled safely without division by zero.
 */

import { Task, Employee, AIRecommendation, WorkloadRedistributionProposal, Project, RecommendationStatus } from '@/lib/types';

export const ACTIVE_TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'blocked'] as const;

export type CapacityBand = 'overallocated' | 'near_limit' | 'optimal' | 'underutilized';

export interface EmployeeWorkloadMetrics {
  employeeId: string;
  weeklyCapacityHours: number;
  activeAssignedHours: number;
  remainingCapacityHours: number;
  utilizationPercentage: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  capacityBand: CapacityBand;
  burnoutRiskScore: number; // 0.00 to 1.00 operational congestion index
}

export interface OrganizationWorkloadSummary {
  totalCapacityHours: number;
  totalActiveHours: number;
  averageUtilizationPercentage: number;
  overallocatedCount: number;
  nearLimitCount: number;
  optimalCount: number;
  underutilizedCount: number;
  totalOverdueTasksCount: number;
  unassignedTasksCount: number;
  totalEmployeesCount: number;
  totalActiveTasksCount: number;
}

/**
 * Checks if a task represents active in-flight workload.
 */
export function isTaskActive(task: { status: string }): boolean {
  return ACTIVE_TASK_STATUSES.includes(task.status as any);
}

/**
 * Checks if a task is overdue relative to midnight today.
 */
export function isTaskOverdue(task: { status: string; dueDate?: string | null }): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  if (isNaN(due.getTime())) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return due < startOfToday;
}

/**
 * Computes deterministic workload metrics for an individual employee.
 */
export function calculateEmployeeWorkload(
  employee: { id: string; weeklyCapacityHours?: number },
  tasks: Task[]
): EmployeeWorkloadMetrics {
  const empId = employee.id;
  const weeklyCap = Math.max(0, Number(employee.weeklyCapacityHours) || 40);

  const empTasks = tasks.filter((t) => t.assignedTo === empId && isTaskActive(t));
  const activeHours = empTasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
  const remainingHours = Math.max(0, weeklyCap - activeHours);

  const utilPct = weeklyCap > 0 ? Math.round((activeHours / weeklyCap) * 100) : (activeHours > 0 ? 999 : 0);

  const overdueCount = empTasks.filter(isTaskOverdue).length;

  let capacityBand: CapacityBand = 'optimal';
  if (weeklyCap === 0 || utilPct > 100) {
    capacityBand = 'overallocated';
  } else if (utilPct >= 80) {
    capacityBand = 'near_limit';
  } else if (utilPct < 40) {
    capacityBand = 'underutilized';
  } else {
    capacityBand = 'optimal';
  }

  // Operational congestion index (0.0 to 1.0)
  const baseUtilRatio = weeklyCap > 0 ? activeHours / weeklyCap : 1.0;
  const overduePenalty = overdueCount * 0.05;
  const rawCongestion = baseUtilRatio * 0.75 + overduePenalty;
  const burnoutRiskScore = Math.min(1.0, Math.max(0.05, Math.round(rawCongestion * 100) / 100));

  return {
    employeeId: empId,
    weeklyCapacityHours: weeklyCap,
    activeAssignedHours: activeHours,
    remainingCapacityHours: remainingHours,
    utilizationPercentage: utilPct,
    activeTaskCount: empTasks.length,
    overdueTaskCount: overdueCount,
    capacityBand,
    burnoutRiskScore,
  };
}

/**
 * Computes aggregate organization-level workload telemetry.
 */
export function calculateOrganizationWorkloadMetrics(
  employees: Employee[],
  tasks: Task[]
): OrganizationWorkloadSummary {
  const metricsList = employees.map((e) => calculateEmployeeWorkload(e, tasks));

  const totalCap = metricsList.reduce((sum, m) => sum + m.weeklyCapacityHours, 0);
  const totalActive = metricsList.reduce((sum, m) => sum + m.activeAssignedHours, 0);
  const avgUtil = totalCap > 0 ? Math.round((totalActive / totalCap) * 100) : 0;

  const overallocatedCount = metricsList.filter((m) => m.capacityBand === 'overallocated').length;
  const nearLimitCount = metricsList.filter((m) => m.capacityBand === 'near_limit').length;
  const optimalCount = metricsList.filter((m) => m.capacityBand === 'optimal').length;
  const underutilizedCount = metricsList.filter((m) => m.capacityBand === 'underutilized').length;

  const totalOverdue = tasks.filter(isTaskOverdue).length;
  const unassigned = tasks.filter((t) => !t.assignedTo && isTaskActive(t)).length;
  const totalActiveTasks = tasks.filter(isTaskActive).length;

  return {
    totalCapacityHours: totalCap,
    totalActiveHours: totalActive,
    averageUtilizationPercentage: avgUtil,
    overallocatedCount,
    nearLimitCount,
    optimalCount,
    underutilizedCount,
    totalOverdueTasksCount: totalOverdue,
    unassignedTasksCount: unassigned,
    totalEmployeesCount: employees.length,
    totalActiveTasksCount: totalActiveTasks,
  };
}

/**
 * Generates verified, deterministic workload redistribution proposals.
 * Guarantees:
 * - Source employee is strictly overallocated (>100% capacity).
 * - Target employee has proven available bandwidth to accept task without exceeding 100% capacity.
 * - Tasks hours reconcile exactly between source deduction and target absorption.
 * - Prioritizes members already allocated to the task's project.
 */
export function computeDeterministicRedistributionProposals(
  employees: Employee[],
  tasks: Task[],
  projects: Project[] = []
): WorkloadRedistributionProposal[] {
  const proposals: WorkloadRedistributionProposal[] = [];

  // 1. Compute current workload metrics per employee
  const currentMetrics = new Map<string, EmployeeWorkloadMetrics>();
  employees.forEach((emp) => {
    currentMetrics.set(emp.id, calculateEmployeeWorkload(emp, tasks));
  });

  // Track projected load dynamically to prevent chaining overload onto same target
  const simulatedLoads = new Map<string, number>();
  employees.forEach((emp) => {
    const m = currentMetrics.get(emp.id);
    simulatedLoads.set(emp.id, m ? m.activeAssignedHours : 0);
  });

  // Find overloaded employees sorted by highest overload
  const overloaded = employees
    .filter((emp) => {
      const m = currentMetrics.get(emp.id);
      return m && m.capacityBand === 'overallocated';
    })
    .sort((a, b) => {
      const mA = currentMetrics.get(a.id)!;
      const mB = currentMetrics.get(b.id)!;
      return mB.utilizationPercentage - mA.utilizationPercentage;
    });

  for (const srcEmp of overloaded) {
    const srcMetric = currentMetrics.get(srcEmp.id)!;
    const srcTasks = tasks.filter((t) => t.assignedTo === srcEmp.id && isTaskActive(t));

    for (const task of srcTasks) {
      const taskHours = Number(task.estimatedHours) || 0;
      if (taskHours <= 0) continue;

      const srcSimLoad = simulatedLoads.get(srcEmp.id) || 0;
      // If source is already rebalanced to <= 100%, break to next overloaded employee
      if (srcSimLoad <= srcMetric.weeklyCapacityHours) break;

      // Find project allocation if available
      const proj = projects.find((p) => p.id === task.projectId);
      const projectMemberIds = proj?.memberIds || [];

      // Find candidates with enough simulated bandwidth
      const eligibleTargets = employees
        .filter((target) => {
          if (target.id === srcEmp.id) return false;
          const targetCap = Math.max(1, Number(target.weeklyCapacityHours) || 40);
          const currentTargetLoad = simulatedLoads.get(target.id) || 0;
          return currentTargetLoad + taskHours <= targetCap * 0.95; // Must not exceed 95% capacity
        })
        .sort((a, b) => {
          // Priority 1: Belonging to the project
          const aInProj = projectMemberIds.includes(a.id) ? 1 : 0;
          const bInProj = projectMemberIds.includes(b.id) ? 1 : 0;
          if (aInProj !== bInProj) return bInProj - aInProj;

          // Priority 2: Lowest simulated utilization
          const capA = Math.max(1, Number(a.weeklyCapacityHours) || 40);
          const capB = Math.max(1, Number(b.weeklyCapacityHours) || 40);
          const utilA = (simulatedLoads.get(a.id) || 0) / capA;
          const utilB = (simulatedLoads.get(b.id) || 0) / capB;
          return utilA - utilB;
        });

      if (eligibleTargets.length > 0) {
        const targetEmp = eligibleTargets[0];
        const targetCap = Math.max(1, Number(targetEmp.weeklyCapacityHours) || 40);
        const targetOldLoad = simulatedLoads.get(targetEmp.id) || 0;
        const targetNewLoad = targetOldLoad + taskHours;
        const srcOldLoad = simulatedLoads.get(srcEmp.id) || 0;
        const srcNewLoad = Math.max(0, srcOldLoad - taskHours);

        // Update simulated loads
        simulatedLoads.set(srcEmp.id, srcNewLoad);
        simulatedLoads.set(targetEmp.id, targetNewLoad);

        const srcOldUtil = Math.round((srcOldLoad / srcMetric.weeklyCapacityHours) * 100);
        const srcNewUtil = Math.round((srcNewLoad / srcMetric.weeklyCapacityHours) * 100);
        const targetNewUtil = Math.round((targetNewLoad / targetCap) * 100);

        proposals.push({
          id: `prop-${srcEmp.id}-${task.id}`,
          taskId: task.id,
          taskTitle: task.title,
          taskHours: taskHours,
          sourceEmployeeId: srcEmp.id,
          sourceEmployeeName: srcEmp.fullName,
          sourceCurrentLoad: srcOldLoad,
          sourceProjectedLoad: srcNewLoad,
          targetEmployeeId: targetEmp.id,
          targetEmployeeName: targetEmp.fullName,
          targetCurrentLoad: targetOldLoad,
          targetProjectedLoad: targetNewLoad,
          rationale: `Reallocating "${task.title}" (${taskHours}h) relieves ${srcEmp.fullName} from ${srcOldUtil}% overload down to ${srcNewUtil}%, safely absorbed by ${targetEmp.fullName} up to ${targetNewUtil}% capacity.`,
        });
      }
    }
  }

  return proposals;
}

/**
 * Computes deterministic candidate matching score and explainability breakdown.
 */
export function computeDeterministicMatchScores(
  task: Task,
  candidates: Employee[],
  allTasks: Task[],
  projectMemberIds: string[] = []
): AIRecommendation[] {
  const taskHours = Number(task.estimatedHours) || 0;
  const requiredSkills = task.requiredSkills || [];

  return candidates.map((candidate) => {
    const workload = calculateEmployeeWorkload(candidate, allTasks);
    const cap = workload.weeklyCapacityHours;
    const curLoad = workload.activeAssignedHours;
    const projLoad = curLoad + taskHours;
    const projUtil = cap > 0 ? Math.round((projLoad / cap) * 100) : 999;

    // 1. Capacity Score (0-100)
    let capScore = 0;
    if (cap > 0) {
      if (projUtil <= 80) {
        capScore = 100 - Math.round(projUtil * 0.25); // optimal range
      } else if (projUtil <= 100) {
        capScore = Math.max(50, 100 - (projUtil - 80) * 2.5); // near limit
      } else {
        capScore = Math.max(0, 50 - (projUtil - 100) * 2); // overallocated
      }
    }

    // 2. Skill & Department Compatibility Score (0-100)
    const matchedSkills: { skill: string; requiredLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'; candidateLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' }[] = [];
    const missingSkills: string[] = [];

    if (requiredSkills.length > 0) {
      requiredSkills.forEach((req) => {
        const deptMatch = candidate.department && req.skillName.toLowerCase().includes(candidate.department.toLowerCase());
        const titleMatch = candidate.jobTitle && req.skillName.toLowerCase().includes(candidate.jobTitle.toLowerCase());
        const explicitSkill = (candidate as any).skills?.some((s: any) =>
          s.skillName?.toLowerCase() === req.skillName.toLowerCase()
        );

        if (deptMatch || titleMatch || explicitSkill) {
          matchedSkills.push({
            skill: req.skillName,
            requiredLevel: req.minProficiency,
            candidateLevel: req.minProficiency,
          });
        } else {
          missingSkills.push(req.skillName);
        }
      });
    }

    const skillScore = requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : 85;

    // 3. Project Membership Affinity (0-100)
    const inProject = projectMemberIds.includes(candidate.id);
    const projectAffinityScore = inProject ? 100 : 50;

    // Weighted Overall Score: 45% Capacity + 40% Skills + 15% Project Affinity
    const weightedScore = Math.round(capScore * 0.45 + skillScore * 0.40 + projectAffinityScore * 0.15);
    const finalScore = Math.min(99, Math.max(10, weightedScore));

    const isCurrentAssignee = task.assignedTo === candidate.id;
    const riskFactors: string[] = [];
    if (cap === 0) {
      riskFactors.push('Member has 0h weekly capacity configured');
    } else if (projUtil > 100) {
      riskFactors.push(`Projected workload (${projLoad}h) exceeds weekly capacity (${cap}h) by ${projLoad - cap}h`);
    }
    if (!inProject && projectMemberIds.length > 0) {
      riskFactors.push('Candidate is not currently allocated to this project team');
    }
    if (missingSkills.length > 0) {
      riskFactors.push(`Missing prerequisites: ${missingSkills.join(', ')}`);
    }

    let rationale = '';
    if (isCurrentAssignee) {
      rationale = `Currently assigned. Active load: ${curLoad}h (${cap > 0 ? Math.round((curLoad / cap) * 100) : 0}% capacity).`;
    } else {
      const avail = Math.max(0, cap - curLoad);
      const skillText = requiredSkills.length > 0
        ? `Satisfies ${matchedSkills.length}/${requiredSkills.length} prerequisite skills.`
        : 'Meets general project requirements.';
      const projText = inProject ? 'Allocated project team member.' : 'External to project team.';
      rationale = `${avail}h available bandwidth. ${skillText} ${projText} Projected load: ${projUtil}%.`;
    }

    return {
      id: `rec-${task.id}-${candidate.id}`,
      taskId: task.id,
      taskTitle: task.title,
      candidateId: candidate.id,
      candidateName: candidate.fullName,
      candidateTitle: candidate.jobTitle,
      candidateDepartment: candidate.department || 'Engineering',
      matchScore: finalScore,
      skillMatchBreakdown: {
        matchedSkills,
        missingSkills,
        skillScore,
      },
      workloadImpact: {
        currentLoadHours: curLoad,
        taskEstimatedHours: taskHours,
        projectedLoadHours: projLoad,
        weeklyCapacityHours: cap,
        projectedUtilizationPct: projUtil,
      },
      rationale,
      riskFactors,
      status: (isCurrentAssignee ? 'accepted' : 'pending') as RecommendationStatus,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

