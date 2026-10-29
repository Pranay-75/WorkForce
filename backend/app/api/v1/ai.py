import logging
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.api.deps import get_current_user, require_manager
from app.models.schemas import (
    AuthenticatedUser,
    AIWorkloadInsightsRequest,
    AIWorkloadInsightsResponse,
    AIMatchingExplanationRequest,
    AIMatchingExplanationResponse,
    AIExecutiveReportRequest,
    AIExecutiveReportResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Intelligence & Insights"])

# Initialize Google GenAI client if API key is present
def get_gemini_client():
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types
        # Set a 5-second timeout so remote API latency never freezes the server
        return genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=5000))
    except Exception as e:
        logger.error(f"Failed to initialize Google GenAI Client: {e}")
        return None


@router.post(
    "/workload-insights",
    response_model=AIWorkloadInsightsResponse,
    summary="Generate AI-powered organizational workload and operational risk insights",
)
async def generate_workload_insights(
    payload: AIWorkloadInsightsRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
) -> AIWorkloadInsightsResponse:
    """
    Analyzes aggregated organizational workload telemetry using Google Gemini.
    Provides executive synthesis, identifies operational bottlenecks, and suggests staffing actions.
    Falls back gracefully to deterministic analysis if the model is unreachable.
    """
    client = get_gemini_client()

    prompt = f"""You are WorkForce AI, an executive operational advisory engine for engineering management.
Analyze the following verified organizational workload telemetry and provide strategic operational insights.

Organization Telemetry:
- Total Capacity: {payload.total_capacity_hours} hours/week
- Total Active Workload: {payload.total_active_hours} hours
- Average Utilization: {payload.average_utilization_pct}%
- Overallocated Staff: {payload.overallocated_count}
- Near Capacity Limit (80-100%): {payload.near_limit_count}
- Optimal Staff: {payload.optimal_count}
- Underutilized Staff: {payload.underutilized_count}
- Overdue Tasks: {payload.overdue_tasks_count}
- Unassigned Backlog Tasks: {payload.unassigned_tasks_count}
- Overallocated Team Members: {json.dumps(payload.overallocated_members[:5])}

Requirements:
1. Executive Summary: 2-3 sentences summarizing capacity health and delivery posture.
2. Identified Risks: 2-4 bullet points highlighting specific operational risks.
3. Actionable Recommendations: 2-4 concrete, human-in-the-loop recommendations.

Format your response strictly as valid JSON with keys:
"executive_summary" (string), "identified_risks" (array of strings), "actionable_recommendations" (array of strings).
"""

    if client:
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
            )
            raw_text = response.text.strip()
            # Clean possible markdown code fences
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            data = json.loads(raw_text.strip())
            return AIWorkloadInsightsResponse(
                executive_summary=data.get("executive_summary", "Operational capacity analysis completed."),
                identified_risks=data.get("identified_risks", []),
                actionable_recommendations=data.get("actionable_recommendations", []),
                is_ai_generated=True,
                model_used="gemini-3.8-flash",
            )
        except Exception as e:
            logger.warning(f"Gemini API call failed, falling back to deterministic insights: {e}")
            # Fall through to deterministic response

    # Deterministic Fallback
    summary = (
        f"Organization workload stands at {payload.average_utilization_pct}% aggregate utilization "
        f"across {payload.total_capacity_hours}h total weekly capacity. "
        f"{payload.overallocated_count} team members are currently above 100% capacity threshold."
    )
    risks = []
    if payload.overallocated_count > 0:
        risks.append(f"{payload.overallocated_count} employee(s) exceed safe capacity bounds (>100% utilization).")
    if payload.overdue_tasks_count > 0:
        risks.append(f"{payload.overdue_tasks_count} deliverable(s) are overdue past scheduled sprint target.")
    if payload.unassigned_tasks_count > 0:
        risks.append(f"{payload.unassigned_tasks_count} active task(s) remain unassigned in the sprint backlog.")
    if not risks:
        risks.append("All team members are operating within healthy capacity boundaries.")

    recs = []
    if payload.overallocated_count > 0:
        recs.append("Review workload balancing proposals to redistribute active tasks to team members with open bandwidth.")
    if payload.unassigned_tasks_count > 0:
        recs.append("Utilize the AI Matching Hub to assign open backlog items to optimal qualified candidates.")
    if not recs:
        recs.append("Maintain current sprint pacing and monitor upcoming milestone deadlines.")

    return AIWorkloadInsightsResponse(
        executive_summary=summary,
        identified_risks=risks,
        actionable_recommendations=recs,
        is_ai_generated=False,
        model_used=None,
        ai_error="Gemini provider offline or non-responsive. Deterministic operational telemetry returned.",
    )


@router.post(
    "/explain-matching",
    response_model=AIMatchingExplanationResponse,
    summary="Generate explainable AI rationale for a task candidate match",
)
async def explain_matching(
    payload: AIMatchingExplanationRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
) -> AIMatchingExplanationResponse:
    """
    Generates an executive, explainable rationale for a candidate match using Google Gemini.
    Clarifies why the candidate scored as they did, workload absorption capacity, and trade-offs.
    """
    client = get_gemini_client()

    prompt = f"""You are WorkForce AI, an explainable task matching assistant for engineering leaders.
Explain why candidate '{payload.candidate_name}' ({payload.candidate_job_title}, {payload.candidate_department}) was ranked with a {payload.match_score}% match for task '{payload.task_title}'.

Task Details:
- Title: {payload.task_title}
- Estimated Effort: {payload.estimated_hours} hours
- Description: {payload.task_description}

Candidate Profile:
- Current Load: {payload.current_load_hours}h / {payload.weekly_capacity_hours}h
- Projected Load if Assigned: {payload.projected_utilization_pct}%
- Satisfied Prerequisites: {', '.join(payload.satisfied_skills) if payload.satisfied_skills else 'General technical proficiency'}
- Missing Prerequisites: {', '.join(payload.missing_skills) if payload.missing_skills else 'None identified'}
- Allocated to Project Team: {'Yes' if payload.is_allocated_to_project else 'No (External to project)'}

Requirements:
1. AI Rationale: 2 sentences explaining the match alignment.
2. Capacity Assessment: 1 sentence detailing safe bandwidth absorption.
3. Trade-Offs: 1-2 points highlighting any skill gaps or allocation considerations.

Format your response strictly as valid JSON with keys:
"ai_rationale" (string), "capacity_assessment" (string), "trade_offs" (array of strings).
"""

    if client:
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            data = json.loads(raw_text.strip())
            return AIMatchingExplanationResponse(
                candidate_name=payload.candidate_name,
                task_title=payload.task_title,
                ai_rationale=data.get("ai_rationale", "Candidate satisfies core task requirements."),
                capacity_assessment=data.get("capacity_assessment", f"Projected utilization is {payload.projected_utilization_pct}%."),
                trade_offs=data.get("trade_offs", []),
                is_ai_generated=True,
                model_used="gemini-3.8-flash",
            )
        except Exception as e:
            logger.warning(f"Gemini API call failed for matching explanation: {e}")

    # Deterministic Fallback
    avail_hours = max(0, payload.weekly_capacity_hours - payload.current_load_hours)
    rationale = (
        f"{payload.candidate_name} exhibits strong alignment with {payload.task_title} ({payload.match_score}% fit). "
        f"They possess {avail_hours}h of open bandwidth to absorb this {payload.estimated_hours}h deliverable."
    )
    cap_text = f"Projected capacity utilization reaches {payload.projected_utilization_pct}%, safely within operational thresholds."
    if payload.projected_utilization_pct > 100:
        cap_text = f"Warning: Absorbing this task places {payload.candidate_name} at {payload.projected_utilization_pct}% load (>100% capacity limit)."

    trade_offs = []
    if payload.missing_skills:
        trade_offs.append(f"Requires onboarding for: {', '.join(payload.missing_skills)}.")
    if not payload.is_allocated_to_project:
        trade_offs.append("Candidate is external to the active project team.")
    if not trade_offs:
        trade_offs.append("No material operational constraints or skill gaps identified.")

    return AIMatchingExplanationResponse(
        candidate_name=payload.candidate_name,
        task_title=payload.task_title,
        ai_rationale=rationale,
        capacity_assessment=cap_text,
        trade_offs=trade_offs,
        is_ai_generated=False,
        model_used=None,
        ai_error="Gemini provider offline or non-responsive. Deterministic operational rationale returned.",
    )


@router.post(
    "/executive-report",
    response_model=AIExecutiveReportResponse,
    summary="Generate executive summary report for organizational analytics",
)
async def generate_executive_report(
    payload: AIExecutiveReportRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
) -> AIExecutiveReportResponse:
    """
    Synthesizes organization analytics into a high-level executive briefing using Google Gemini.
    """
    client = get_gemini_client()

    prompt = f"""You are WorkForce AI, an executive engineering intelligence engine.
Synthesize the following operational report metrics into an executive briefing for management.

Sprint Analytics:
- Active Projects: {payload.project_count}
- Active Deliverables: {payload.active_tasks_count}
- Completed Deliverables: {payload.completed_tasks_count}
- Sprint Completion Rate: {payload.completion_rate_pct}%
- Governance Audit Events: {payload.recent_audit_count}
- Department Breakdown: {json.dumps(payload.department_metrics)}

Requirements:
1. Executive Briefing: 2-3 sentences providing high-level delivery evaluation.
2. Velocity Analysis: 1-2 sentences summarizing completion pace and bottlenecks.
3. Strategic Priorities: 2-3 bullet points for next sprint planning.

Format your response strictly as valid JSON with keys:
"executive_briefing" (string), "velocity_analysis" (string), "strategic_priorities" (array of strings).
"""

    if client:
        try:
            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            data = json.loads(raw_text.strip())
            return AIExecutiveReportResponse(
                executive_briefing=data.get("executive_briefing", "Sprint report synthesized."),
                velocity_analysis=data.get("velocity_analysis", "Velocity analysis completed."),
                strategic_priorities=data.get("strategic_priorities", []),
                is_ai_generated=True,
                model_used="gemini-3.8-flash",
            )
        except Exception as e:
            logger.warning(f"Gemini API call failed for executive report: {e}")

    # Deterministic Fallback
    briefing = (
        f"Organization delivery is progressing across {payload.project_count} initiatives with a "
        f"{payload.completion_rate_pct}% overall completion rate ({payload.completed_tasks_count} completed deliverables)."
    )
    velocity = f"{payload.active_tasks_count} tasks remain active in flight under human-in-the-loop oversight."
    priorities = [
        "Reallocate overloaded team members to optimize sprint velocity.",
        "Ensure all remaining unassigned deliverables are matched with qualified engineers.",
        "Review upcoming milestone deadlines to mitigate late delivery risks.",
    ]

    return AIExecutiveReportResponse(
        executive_briefing=briefing,
        velocity_analysis=velocity,
        strategic_priorities=priorities,
        is_ai_generated=False,
        model_used=None,
        ai_error="Gemini provider offline or non-responsive. Deterministic operational briefing returned.",
    )

