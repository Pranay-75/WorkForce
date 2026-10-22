"""
WorkForce - Manager Recommendations & Governance Router
File: backend/app/api/v1/recommendations.py
"""

import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import (
    AuthenticatedUser,
    RecommendationStatusEnum,
    ManagerDecisionRequest,
    ManagerDecisionResponse,
)
from app.api.deps import require_manager
from app.services.data_access import (
    get_recommendation_by_id,
    record_manager_decision,
    assign_task_in_db,
    record_audit_event,
    get_organization_profiles,
)

router = APIRouter(prefix="/recommendations", tags=["Recommendation Governance"])

@router.post("/{id}/decision", response_model=ManagerDecisionResponse)
async def process_manager_decision(
    id: str,
    req: ManagerDecisionRequest,
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Records a manager's review decision (accepted, rejected, overridden).
    - If accepted: assigns task and records immutable audit log.
    - If rejected: does NOT assign task; records feedback reason and audit log.
    - If overridden: assigns task to explicit override assignee.
    - Enforces state transition integrity: prevents duplicate or stale decisions.
    """
    org_id = current_user.organization_id
    rec = get_recommendation_by_id(id, org_id)
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recommendation '{id}' not found in active organization context.",
        )

    current_status = rec.get("status", "pending")
    if current_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Recommendation '{id}' has already been decided with status '{current_status}'. Duplicate decisions are prohibited.",
        )

    task_id = rec.get("task_id")
    candidate_id = rec.get("candidate_id")
    assigned_target = None

    if req.decision == RecommendationStatusEnum.ACCEPTED:
        assigned_target = candidate_id
        # Assign task in database
        assign_task_in_db(task_id, assigned_target, org_id)
        action_name = "Approved AI Recommendation"
        audit_details = f"Manager approved recommendation. Assigned task '{task_id}' to candidate '{candidate_id}'."

    elif req.decision == RecommendationStatusEnum.OVERRIDDEN:
        if not req.override_profile_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Manual override decision requires 'override_profile_id'.",
            )
        # Verify override profile belongs to organization
        org_profiles = get_organization_profiles(org_id)
        if not any(str(p["id"]) == str(req.override_profile_id) for p in org_profiles):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Override candidate '{req.override_profile_id}' is not an active member of this organization.",
            )
        assigned_target = req.override_profile_id
        assign_task_in_db(task_id, assigned_target, org_id)
        action_name = "Overrode AI Recommendation"
        audit_details = f"Manager overrode AI candidate. Manually assigned task '{task_id}' to '{assigned_target}'."

    elif req.decision == RecommendationStatusEnum.REJECTED:
        assigned_target = None
        action_name = "Rejected AI Recommendation"
        audit_details = f"Manager rejected recommendation for candidate '{candidate_id}'. Reason: '{req.feedback_reason or 'No reason specified'}'."

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision '{req.decision}'.",
        )

    # Persist decision record
    decision_rec = record_manager_decision(
        recommendation_id=id,
        manager_id=current_user.user_id,
        decision=req.decision.value,
        feedback_reason=req.feedback_reason,
        override_profile_id=req.override_profile_id,
        org_id=org_id,
    )

    # Persist audit log
    audit_id = record_audit_event(
        org_id=org_id,
        actor_id=current_user.user_id,
        action=action_name,
        entity_type="Recommendation",
        entity_id=id,
        metadata={
            "task_id": task_id,
            "decision": req.decision.value,
            "assigned_to": assigned_target,
            "feedback_reason": req.feedback_reason,
            "actor_email": current_user.email,
        },
    )

    return ManagerDecisionResponse(
        recommendation_id=id,
        task_id=task_id,
        status=req.decision,
        assigned_to=assigned_target,
        feedback_reason=req.feedback_reason,
        decided_at=decision_rec.get("decided_at", datetime.datetime.now(datetime.timezone.utc).isoformat()),
        audit_event_id=audit_id,
    )
