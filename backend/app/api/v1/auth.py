from fastapi import APIRouter, Depends
from app.models.schemas import AuthenticatedUser, OrganizationSchema
from app.api.deps import (
    get_current_user,
    require_employee,
    require_manager,
    require_admin,
    require_organizer,
)

router = APIRouter(prefix="/auth", tags=["Authentication & Access Control"])

@router.get("/me", response_model=AuthenticatedUser)
async def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Returns the authenticated user's profile, active organization,
    and verified role derived from trusted database records.
    """
    return current_user

@router.get("/organization", response_model=OrganizationSchema)
async def get_my_organization(
    current_user: AuthenticatedUser = Depends(require_employee),
):
    """
    Returns the organization details for the authenticated user's active membership.
    """
    return OrganizationSchema(
        id=current_user.organization_id,
        name=current_user.organization_name,
        slug=current_user.organization_name.lower().replace(" ", "-"),
    )

@router.get("/manager-area")
async def manager_only_endpoint(
    current_user: AuthenticatedUser = Depends(require_manager),
):
    """
    Protected endpoint accessible strictly to Managers and Organization Admins.
    """
    return {
        "message": "Welcome to the Manager Operations Center.",
        "manager": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
    }

@router.get("/admin-area")
async def admin_only_endpoint(
    current_user: AuthenticatedUser = Depends(require_admin),
):
    """
    Protected endpoint accessible strictly to Organization Admins.
    """
    return {
        "message": "Welcome to Organization Administration & Compliance.",
        "admin": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
    }

@router.get("/organizer-area")
async def organizer_only_endpoint(
    current_user: AuthenticatedUser = Depends(require_organizer),
):
    """
    Protected endpoint accessible strictly to Workspace Organizers (ownership tier).
    Ordinary Organization Admins are strictly forbidden.
    """
    return {
        "message": "Welcome to Workspace Ownership & Primary Governance.",
        "organizer": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
    }
