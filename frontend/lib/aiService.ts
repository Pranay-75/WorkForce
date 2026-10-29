/**
 * WorkForce Frontend AI Client Service
 *
 * Calls the authenticated FastAPI backend AI endpoints to obtain Gemini-powered
 * executive insights, matching explanations, and strategic briefings.
 *
 * Security & Zero-Trust Constraints:
 * - Never calls Gemini or holds API keys in the browser.
 * - Authenticates using verified Supabase session Bearer tokens.
 * - Always scopes requests with the authenticated organization ID.
 * - Gracefully falls back to deterministic heuristics when offline.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface WorkloadInsightsPayload {
  total_capacity_hours: number;
  total_active_hours: number;
  average_utilization_pct: number;
  overallocated_count: number;
  near_limit_count?: number;
  optimal_count?: number;
  underutilized_count?: number;
  overdue_tasks_count?: number;
  unassigned_tasks_count?: number;
  overallocated_members?: Array<{ name: string; hours: number; capacity: number; utilization: number }>;
}

export interface WorkloadInsightsResult {
  executive_summary: string;
  identified_risks: string[];
  actionable_recommendations: string[];
  is_ai_generated: boolean;
  model_used?: string | null;
  ai_error?: string | null;
}

export interface MatchingExplanationPayload {
  task_title: string;
  task_description?: string;
  estimated_hours: number;
  candidate_name: string;
  candidate_job_title?: string;
  candidate_department?: string;
  current_load_hours: number;
  weekly_capacity_hours: number;
  projected_utilization_pct: number;
  match_score: number;
  is_allocated_to_project: boolean;
  satisfied_skills?: string[];
  missing_skills?: string[];
}

export interface MatchingExplanationResult {
  candidate_name: string;
  task_title: string;
  ai_rationale: string;
  capacity_assessment: string;
  trade_offs: string[];
  is_ai_generated: boolean;
  model_used?: string | null;
  ai_error?: string | null;
}

export interface ExecutiveReportPayload {
  project_count: number;
  active_tasks_count: number;
  completed_tasks_count: number;
  completion_rate_pct: number;
  department_metrics?: Array<{ department: string; active_hours: number; capacity: number }>;
  recent_audit_count?: number;
}

export interface ExecutiveReportResult {
  executive_briefing: string;
  velocity_analysis: string;
  strategic_priorities: string[];
  is_ai_generated: boolean;
  model_used?: string | null;
  ai_error?: string | null;
}

/**
 * Requests AI-powered organizational workload insights.
 */
export async function getAIWorkloadInsights(
  payload: WorkloadInsightsPayload,
  accessToken?: string | null,
  organizationId?: string | null
): Promise<WorkloadInsightsResult> {
  if (!accessToken || !organizationId) {
    return generateDeterministicWorkloadInsights(payload);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/api/v1/ai/workload-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Organization-Id': organizationId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`Backend AI endpoint returned ${res.status}. Using deterministic fallback.`);
      return generateDeterministicWorkloadInsights(payload);
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('Backend AI insights unreachable, returning deterministic fallback:', err?.message);
    return generateDeterministicWorkloadInsights(payload);
  }
}

/**
 * Requests AI-powered candidate match explanation.
 */
export async function getAIMatchingExplanation(
  payload: MatchingExplanationPayload,
  accessToken?: string | null,
  organizationId?: string | null
): Promise<MatchingExplanationResult> {
  if (!accessToken || !organizationId) {
    return generateDeterministicMatchingExplanation(payload);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/api/v1/ai/explain-matching`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Organization-Id': organizationId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return generateDeterministicMatchingExplanation(payload);
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return generateDeterministicMatchingExplanation(payload);
  }
}

/**
 * Requests AI-powered executive report summary.
 */
export async function getAIExecutiveReport(
  payload: ExecutiveReportPayload,
  accessToken?: string | null,
  organizationId?: string | null
): Promise<ExecutiveReportResult> {
  if (!accessToken || !organizationId) {
    return generateDeterministicExecutiveReport(payload);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/api/v1/ai/executive-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Organization-Id': organizationId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return generateDeterministicExecutiveReport(payload);
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
    return generateDeterministicExecutiveReport(payload);
  }
}

// -----------------------------------------------------------------------------
// Deterministic Fallback Generators (Transparent & Explainable)
// -----------------------------------------------------------------------------

function generateDeterministicWorkloadInsights(payload: WorkloadInsightsPayload): WorkloadInsightsResult {
  const summary =
    `Organization workload stands at ${payload.average_utilization_pct}% aggregate utilization across ` +
    `${payload.total_capacity_hours}h total weekly capacity. ${payload.overallocated_count} team members currently exceed target capacity.`;

  const risks: string[] = [];
  if (payload.overallocated_count > 0) {
    risks.push(`${payload.overallocated_count} team member(s) are overloaded beyond 100% weekly capacity.`);
  }
  if ((payload.overdue_tasks_count || 0) > 0) {
    risks.push(`${payload.overdue_tasks_count} deliverable(s) are past their target deadlines.`);
  }
  if ((payload.unassigned_tasks_count || 0) > 0) {
    risks.push(`${payload.unassigned_tasks_count} deliverable(s) remain unassigned in the backlog.`);
  }
  if (risks.length === 0) {
    risks.push('All active team members are operating within healthy capacity boundaries.');
  }

  const recs: string[] = [];
  if (payload.overallocated_count > 0) {
    recs.push('Apply load rebalancing to transfer tasks from overloaded engineers to available peers.');
  }
  if ((payload.unassigned_tasks_count || 0) > 0) {
    recs.push('Utilize the AI Matching Hub to assign open backlog items to qualified team members.');
  }
  if (recs.length === 0) {
    recs.push('Maintain sprint pacing and continue monitoring delivery milestones.');
  }

  return {
    executive_summary: summary,
    identified_risks: risks,
    actionable_recommendations: recs,
    is_ai_generated: false,
    model_used: null,
    ai_error: 'Deterministic operational telemetry (Backend AI offline or unauthenticated).',
  };
}

function generateDeterministicMatchingExplanation(payload: MatchingExplanationPayload): MatchingExplanationResult {
  const avail = Math.max(0, payload.weekly_capacity_hours - payload.current_load_hours);
  const rationale =
    `${payload.candidate_name} matches "${payload.task_title}" with a ${payload.match_score}% fit score. ` +
    `They have ${avail}h of open capacity to absorb this ${payload.estimated_hours}h deliverable.`;

  const capText =
    payload.projected_utilization_pct > 100
      ? `Warning: Absorbing this task places ${payload.candidate_name} at ${payload.projected_utilization_pct}% overload.`
      : `Projected capacity reaches ${payload.projected_utilization_pct}%, safely within operational guidelines.`;

  const tradeOffs: string[] = [];
  if (payload.missing_skills && payload.missing_skills.length > 0) {
    tradeOffs.push(`Candidate lacks verified prerequisites: ${payload.missing_skills.join(', ')}.`);
  }
  if (!payload.is_allocated_to_project) {
    tradeOffs.push('Candidate is external to the active project delivery team.');
  }
  if (tradeOffs.length === 0) {
    tradeOffs.push('No material operational trade-offs or skill gaps identified.');
  }

  return {
    candidate_name: payload.candidate_name,
    task_title: payload.task_title,
    ai_rationale: rationale,
    capacity_assessment: capText,
    trade_offs: tradeOffs,
    is_ai_generated: false,
    model_used: null,
    ai_error: 'Deterministic matching rationale.',
  };
}

function generateDeterministicExecutiveReport(payload: ExecutiveReportPayload): ExecutiveReportResult {
  const briefing =
    `Organization delivery pace shows a ${payload.completion_rate_pct}% completion rate across ` +
    `${payload.project_count} strategic projects, with ${payload.completed_tasks_count} completed tasks.`;

  const velocity =
    `${payload.active_tasks_count} tasks are currently active in flight under human-in-the-loop management oversight.`;

  const priorities = [
    'Rebalance overloaded engineers to preserve steady delivery cadence.',
    'Assign remaining unallocated backlog deliverables to available candidates.',
    'Review milestone target dates against current capacity limits.',
  ];

  return {
    executive_briefing: briefing,
    velocity_analysis: velocity,
    strategic_priorities: priorities,
    is_ai_generated: false,
    model_used: null,
    ai_error: 'Deterministic report summary.',
  };
}

