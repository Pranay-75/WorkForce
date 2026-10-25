"""
WorkForce - Operational Burnout Risk & Insights Router
File: backend/app/api/v1/insights.py
"""

from fastapi import APIRouter, Depends
from app.models.schemas import (
    AuthenticatedUser,
    OperationalBurnoutRiskResponse,
)
from app.api.deps import require_manager
from app.services.data_access import (
    get_organization_profiles,
    get_organization_tasks,
)
from app.services.workload_engine import compute_operational_burnout_insights

router = APIRouter(prefix="/insights", tags=["Operational Insights & Risk"])

@router.get("/burnout-risk", response_model=OperationalBurnoutRiskResponse)
async def get_burnout_risk_insights(
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Returns operational workload pressure indicators and capacity risk alerts.
    Includes mandatory ethical framing disclaimer that metrics reflect scheduling data,
    not clinical or psychological evaluations.
    """
    org_id = current_user.organization_id
    employees = get_organization_profiles(org_id)
    tasks = get_organization_tasks(org_id)

    response = compute_operational_burnout_insights(employees, tasks)
    return response
