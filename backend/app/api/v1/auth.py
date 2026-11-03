from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.models.schemas import AuthenticatedUser, OrganizationSchema, UserRoleEnum
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


ALLOWED_TARGET_ROLES = ["admin", "hr", "manager", "employee"]


class AddMemberRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = "employee"


@router.post("/members/add")
async def add_organization_member_endpoint(
    payload: Optional[AddMemberRequest] = None,
    current_user: AuthenticatedUser = Depends(require_admin),
):
    """
    Protected endpoint to add organization members.
    Allowed actors: Organizer and Admin.
    - Organizer can add Admin, HR, Manager, and Staff (employee).
    - Admin can add HR, Manager, and Staff (employee), but cannot add Admin.
    - Only an Organizer can add or invite an Administrator.
    """
    target_role = (payload.role or "employee").lower() if payload and payload.role else "employee"
    if target_role not in ALLOWED_TARGET_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles are: {', '.join(ALLOWED_TARGET_ROLES)}.",
        )

    # Privilege escalation guard: Only Organizer can add or invite an Administrator
    if target_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization organizer can add or invite an administrator.",
        )

    return {
        "status": "member_added",
        "actor": current_user.email,
        "organizer": current_user.email if current_user.role == UserRoleEnum.ORGANIZER else None,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
        "assigned_role": target_role,
        "email": payload.email if payload and payload.email else None,
    }


class UpdateMemberRoleRequest(BaseModel):
    new_role: str


@router.put("/members/{member_id}/role")
async def update_member_role_endpoint(
    member_id: str,
    payload: Optional[UpdateMemberRoleRequest] = None,
    current_user: AuthenticatedUser = Depends(require_admin),
):
    """
    Protected endpoint to change member roles.
    Allowed actors: Organizer and Admin.
    - Organizer can assign Admin, HR, Manager, and Staff (employee).
    - Admin can assign HR, Manager, and Staff (employee).
    - Only an Organizer can assign or promote anyone to Admin.
    - Admin cannot promote or demote an Admin.
    """
    target_role = payload.new_role if payload else "employee"
    if target_role not in ALLOWED_TARGET_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles are: {', '.join(ALLOWED_TARGET_ROLES)}.",
        )

    # Privilege escalation guard: Only Organizer can assign or promote anyone to Admin
    if target_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization organizer can assign or promote anyone to the administrator role.",
        )

    return {
        "status": "role_updated",
        "member_id": member_id,
        "actor": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
        "new_role": target_role,
    }
