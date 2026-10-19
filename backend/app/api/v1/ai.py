"""
WorkForce - AI Task Matching & Redistribution Router
File: backend/app/api/v1/ai.py
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import (
    AuthenticatedUser,
    TaskMatchRequest,
    TaskMatchResponse,
    WorkloadRedistributionRequest,
    WorkloadRedistributionResponse,
)
from app.api.deps import require_manager
from app.services.data_access import (
    get_organization_profiles,
    get_organization_tasks,
    get_task_by_id,
    save_recommendation,
)
from app.services.matching_engine import match_candidates_for_task
from app.services.workload_engine import simulate_workload_redistribution
from app.services.gemini_service import enhance_recommendation_with_gemini

router = APIRouter(prefix="/ai", tags=["AI Advisory & Matching"])

@router.post("/match-task", response_model=TaskMatchResponse)
async def match_task_candidates(
    req: TaskMatchRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Evaluates candidate employees for an unassigned task.
    Combines deterministic pre-filtering (skills & capacity headroom)
    with advisory natural-language explainability and operational risk analysis.
    """
    org_id = current_user.organization_id
    task = get_task_by_id(req.task_id, org_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task '{req.task_id}' not found in active organization context.",
        )

    candidates = get_organization_profiles(org_id)
    all_tasks = get_organization_tasks(org_id)

    match_result = match_candidates_for_task(
        task=task,
        candidates=candidates,
        all_tasks=all_tasks,
        max_candidates=req.max_candidates,
    )

    # Enhance top candidate with Gemini advisory explainability if configured
    if match_result.recommendations:
        top_rec = match_result.recommendations[0]
        enhanced = await enhance_recommendation_with_gemini(
            task=task,
            candidate_name=top_rec.candidate_name,
            matched_skills=[m.skill for m in top_rec.skill_match_breakdown.matched_skills],
            missing_skills=top_rec.skill_match_breakdown.missing_skills,
            current_load_hours=top_rec.workload_impact.current_load_hours,
            task_estimated_hours=top_rec.workload_impact.task_estimated_hours,
            projected_load_hours=top_rec.workload_impact.projected_load_hours,
            weekly_capacity_hours=top_rec.workload_impact.weekly_capacity_hours,
            fallback_rationale=top_rec.rationale,
            fallback_risk_factors=top_rec.risk_factors,
        )
        top_rec.rationale = enhanced["rationale"]
        if enhanced.get("risk_factors"):
            top_rec.risk_factors = enhanced["risk_factors"]

        # Persist recommendation for manager review/governance
        save_recommendation({
            "id": f"rec-{task['id']}-{top_rec.candidate_id}",
            "organization_id": org_id,
            "task_id": task["id"],
            "candidate_id": top_rec.candidate_id,
            "match_score": top_rec.match_score,
            "skill_match_breakdown": top_rec.skill_match_breakdown.model_dump(),
            "workload_impact": top_rec.workload_impact.model_dump(),
            "rationale": top_rec.rationale,
            "risk_factors": top_rec.risk_factors,
            "status": "pending",
        })

    return match_result

@router.post("/redistribute-workload", response_model=WorkloadRedistributionResponse)
async def redistribute_workload(
    req: WorkloadRedistributionRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Simulates workload redistribution to resolve bottlenecks.
    Proposes task transfers from over-capacity employees (>100%) to matching teammates.
    """
    org_id = current_user.organization_id
    employees = get_organization_profiles(org_id)
    tasks = get_organization_tasks(org_id)

    response = simulate_workload_redistribution(
        employees=employees,
        tasks=tasks,
        department=req.department,
        target_max_utilization_pct=req.target_max_utilization_pct,
    )
    return response
