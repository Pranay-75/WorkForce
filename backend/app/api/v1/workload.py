"""
WorkForce - Workload Overview & Capacity Monitoring Router
File: backend/app/api/v1/workload.py
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.models.schemas import (
    AuthenticatedUser,
    OrganizationWorkloadOverview,
)
from app.api.deps import require_manager
from app.services.data_access import (
    get_organization_profiles,
    get_organization_tasks,
)
from app.services.workload_engine import compute_organization_workload_overview

router = APIRouter(prefix="/workload", tags=["Workload Intelligence & Capacity"])

@router.get("/overview", response_model=OrganizationWorkloadOverview)
async def get_workload_overview(
    department: Optional[str] = Query(None, description="Optional department filter"),
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Returns aggregated capacity and individual utilization bands across the organization.
    Protected strictly to Managers and Organization Admins.
    """
    org_id = current_user.organization_id
    employees = get_organization_profiles(org_id)
    tasks = get_organization_tasks(org_id)

    overview = compute_organization_workload_overview(
        employees=employees,
        tasks=tasks,
        department_filter=department,
    )
    return overview
