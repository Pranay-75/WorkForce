from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.models.schemas import AuthenticatedUser, OrganizationSchema, UserRoleEnum
import app.api.deps as deps
from app.api.deps import (
    get_current_user,
    require_employee,
    require_manager,
    require_admin,
    require_organizer,
    DEV_ROLE_MAPPING,
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
    user_id: Optional[str] = None
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
    - Persists genuine membership or invitation records directly to the database.
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

    target_email = payload.email.strip().lower() if (payload and payload.email and payload.email.strip()) else None
    target_user_id = payload.user_id.strip() if (payload and payload.user_id and payload.user_id.strip()) else None

    # SEC-03: Reject empty or incomplete member-add requests
    if not target_email and not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required member identifier. Either 'email' or 'user_id' must be provided.",
        )

    # Real Database Persistence (executed for authenticated database users)
    if not current_user.is_demo_user:
        admin_client = deps.get_supabase_admin()

        # 1. Resolve target user profile if email or user_id provided
        if target_user_id:
            try:
                prof_res = (
                    admin_client.table("user_profiles")
                    .select("id, email")
                    .eq("id", target_user_id)
                    .execute()
                )
                if not prof_res.data:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"User profile '{target_user_id}' not found.",
                    )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database verification failed: {str(e)}",
                )
        elif target_email:
            try:
                prof_res = (
                    admin_client.table("user_profiles")
                    .select("id, email")
                    .eq("email", target_email)
                    .execute()
                )
                if prof_res.data and len(prof_res.data) > 0:
                    target_user_id = prof_res.data[0]["id"]
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database lookup failed for profile email: {str(e)}",
                )

        # 2. Persist membership or invitation
        if target_user_id:
            try:
                existing_res = (
                    admin_client.table("organization_memberships")
                    .select("id, role, status")
                    .eq("organization_id", current_user.organization_id)
                    .eq("user_id", target_user_id)
                    .execute()
                )
                existing_rows = existing_res.data or []
                if existing_rows:
                    active_match = next((r for r in existing_rows if (r.get("status") or "").lower() == "active"), None)
                    if active_match:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"User is already an active member of this organization with role '{active_match.get('role')}'.",
                        )
                    # Reactivate existing suspended/inactive membership
                    first_match = existing_rows[0]
                    admin_client.table("organization_memberships").update({
                        "role": target_role,
                        "status": "active",
                    }).eq("id", first_match["id"]).execute()
                else:
                    # Insert new active membership
                    admin_client.table("organization_memberships").insert({
                        "organization_id": current_user.organization_id,
                        "user_id": target_user_id,
                        "role": target_role,
                        "status": "active",
                    }).execute()
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to persist organization membership: {str(e)}",
                )
        elif target_email:
            # Profile not yet registered: record in organization_invitations
            try:
                admin_client.table("organization_invitations").insert({
                    "organization_id": current_user.organization_id,
                    "email": target_email,
                    "role": target_role,
                    "invited_by": current_user.user_id,
                    "status": "pending",
                }).execute()
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to record organization invitation: {str(e)}",
                )

    return {
        "status": "member_added",
        "actor": current_user.email,
        "organizer": current_user.email if current_user.role == UserRoleEnum.ORGANIZER else None,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
        "assigned_role": target_role,
        "email": payload.email if payload and payload.email else None,
        "member_id": target_user_id,
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
    - Target's current role is verified authoritatively from database records;
      client-supplied role claims are strictly untrusted and discarded.
    """
    target_role = (payload.new_role if payload and payload.new_role else "employee").lower()
    if target_role not in ALLOWED_TARGET_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Allowed roles are: {', '.join(ALLOWED_TARGET_ROLES)}.",
        )

    target_current_role: Optional[str] = None
    target_status: Optional[str] = None
    target_found = False

    # 1. Authoritative Database Lookup (strictly enforced for all token-based/authenticated users)
    if not current_user.is_demo_user:
        try:
            admin_client = deps.get_supabase_admin()
            res = (
                admin_client.table("organization_memberships")
                .select("role, organization_id, status, user_id")
                .eq("user_id", member_id)
                .execute()
            )
            rows = res.data or []
            if rows:
                target_found = True
                # Find membership record in caller's organization
                matching_org_rows = [
                    r for r in rows
                    if str(r.get("organization_id")) == str(current_user.organization_id)
                ]
                if matching_org_rows:
                    target_row = matching_org_rows[0]
                    target_current_role = (target_row.get("role") or "").lower()
                    target_status = (target_row.get("status") or "active").lower()
                else:
                    # Target exists in database but strictly under a different organization
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Access denied: Target member '{member_id}' belongs to another organization.",
                    )
        except HTTPException:
            raise
        except Exception:
            # Database failure, timeout, or network error: fail closed immediately across all environments.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database authorization verification unavailable.",
            )
    else:
        # 2. Offline Development Mock Fallback (strictly reachable ONLY in offline demo auth mode)
        if (
            getattr(deps.settings, "ENVIRONMENT", "") != "production"
            and getattr(deps.settings, "ENABLE_DEMO_AUTH_HEADER", False)
            and member_id in DEV_ROLE_MAPPING
        ):
            dev_entry = DEV_ROLE_MAPPING[member_id]
            dev_role = dev_entry["role"]
            target_current_role = (dev_role.value if hasattr(dev_role, "value") else str(dev_role)).lower()
            target_status = "active"
            target_found = True

    # 3. Reject missing target membership
    if not target_found or not target_current_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target member '{member_id}' not found in organization '{current_user.organization_id}'.",
        )

    # 4. Reject inactive or suspended target membership
    if target_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Target member '{member_id}' has non-active status '{target_status}'. Only active members can be modified.",
        )

    # 5. Organizer role immutability: organizer cannot be altered via this endpoint
    if target_current_role == "organizer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The organizer role cannot be reassigned via this endpoint. Use transfer ownership.",
        )

    # 6. Privilege escalation guard: Only Organizer can assign or promote anyone to Admin
    if target_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization organizer can assign or promote anyone to the administrator role.",
        )

    # 7. Demotion & governance guard: Admin cannot demote or change an existing Admin
    if target_current_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the organization organizer can manage or demote an administrator.",
        )

    # 8. Persist Updated Role to Database
    if not current_user.is_demo_user:
        try:
            admin_client = deps.get_supabase_admin()
            admin_client.table("organization_memberships").update({
                "role": target_role
            }).eq("organization_id", current_user.organization_id).eq("user_id", member_id).execute()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to persist updated member role in database: {str(e)}",
            )
    else:
        # Dev offline mock mode
        if member_id in DEV_ROLE_MAPPING:
            DEV_ROLE_MAPPING[member_id]["role"] = UserRoleEnum(target_role)

    return {
        "status": "role_updated",
        "member_id": member_id,
        "actor": current_user.email,
        "role": current_user.role,
        "organization_id": current_user.organization_id,
        "new_role": target_role,
    }
