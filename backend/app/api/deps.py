from typing import Optional, List
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.core.security import verify_and_decode_token
from app.core.database import get_supabase_admin
from app.models.schemas import AuthenticatedUser, UserRoleEnum, UserProfileSchema

security_scheme = HTTPBearer(auto_error=False)

# Seed / Mock fallback identity registry for development when running offline
DEV_ROLE_MAPPING = {
    "b0000000-0000-0000-0000-000000000008": {
        "email": "chloe.dubois@acme.corp",
        "full_name": "Chloe Dubois",
        "role": UserRoleEnum.ADMIN,
        "department": "Product / HR",
        "job_title": "VP of Operations & Talent",
    },
    "b0000000-0000-0000-0000-000000000001": {
        "email": "sarah.connor@acme.corp",
        "full_name": "Sarah Connor",
        "role": UserRoleEnum.MANAGER,
        "department": "Engineering",
        "job_title": "Engineering Lead & Architect",
    },
    "b0000000-0000-0000-0000-000000000002": {
        "email": "alex.chen@acme.corp",
        "full_name": "Alex Chen",
        "role": UserRoleEnum.EMPLOYEE,
        "department": "Engineering",
        "job_title": "Senior Frontend Engineer",
    },
    "b0000000-0000-0000-0000-000000000003": {
        "email": "david.kim@acme.corp",
        "full_name": "David Kim",
        "role": UserRoleEnum.EMPLOYEE,
        "department": "Engineering",
        "job_title": "Backend & Distributed Systems Engineer",
    },
    "b0000000-0000-0000-0000-000000000006": {
        "email": "priya.patel@acme.corp",
        "full_name": "Priya Patel",
        "role": UserRoleEnum.EMPLOYEE,
        "department": "Engineering",
        "job_title": "Full-Stack Software Engineer",
    },
}

DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001"
DEFAULT_ORG_NAME = "Acme Systems Engineering"

async def get_current_user(
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
) -> AuthenticatedUser:
    """
    Authenticates the user from Supabase Bearer token or development mock identity.
    Derives user ID directly from the validated token and queries trusted
    database membership records to establish deterministic organization context and role.
    """
    # 1. Standard Production / Supabase Auth Path
    if auth_credentials and auth_credentials.credentials:
        token = auth_credentials.credentials
        payload = verify_and_decode_token(token)
        user_id = payload.get("sub")
        email = payload.get("email", "")

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject identifier (sub)",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Query trusted database for user profile and active organization memberships
        try:
            admin_client = get_supabase_admin()
            # Fetch all active memberships for this user
            res = (
                admin_client.table("organization_memberships")
                .select("role, organization_id, organizations(id, name, slug)")
                .eq("user_id", user_id)
                .eq("status", "active")
                .execute()
            )
        except Exception as e:
            # Database or network failure: fail closed, never guess or assign default role
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service unavailable. Failed to verify organization membership.",
            )

        active_memberships = res.data or []

        if not active_memberships:
            # Verified token but no active organization membership in the database
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active organization membership found. Please join or create an organization.",
            )

        # Deterministic Organization Selection
        selected_membership = None

        if x_organization_id:
            # Validate client-supplied organization ID against user's verified active memberships
            matching = [
                m for m in active_memberships
                if str(m.get("organization_id")) == str(x_organization_id)
                or (isinstance(m.get("organizations"), dict) and str(m.get("organizations", {}).get("id")) == str(x_organization_id))
            ]
            if not matching:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: User is not an active member of requested organization '{x_organization_id}'.",
                )
            selected_membership = matching[0]
        else:
            if len(active_memberships) == 1:
                selected_membership = active_memberships[0]
            else:
                # Multiple active memberships exist, client must explicitly specify X-Organization-Id
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Multiple active organization memberships found. Specify the target organization via the 'X-Organization-Id' header.",
                )

        row = selected_membership
        role_raw = row.get("role", "employee")
        try:
            role = UserRoleEnum(role_raw)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid membership role '{role_raw}' in database record.",
            )

        org_info = row.get("organizations") or {}
        org_id = org_info.get("id") or row.get("organization_id")
        org_name = org_info.get("name") or "Organization"

        # Fetch profile details
        prof = {}
        try:
            prof_res = (
                admin_client.table("user_profiles")
                .select("*")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if prof_res.data and len(prof_res.data) > 0:
                prof = prof_res.data[0]
        except Exception:
            # Non-fatal metadata fetch failure; core role and membership already verified
            pass

        return AuthenticatedUser(
            user_id=user_id,
            email=email or prof.get("email", ""),
            organization_id=org_id,
            organization_name=org_name,
            role=role,
            profile=UserProfileSchema(
                id=user_id,
                email=email or prof.get("email", ""),
                full_name=prof.get("full_name", email.split("@")[0] if email else "User"),
                avatar_url=prof.get("avatar_url"),
                department=prof.get("department", "Engineering"),
                job_title=prof.get("job_title", "Software Engineer"),
                weekly_capacity_hours=float(prof.get("weekly_capacity_hours", 40.0)),
            ),
        )

    # 2. Local Development Mock Identity (Explicit opt-in required; strictly forbidden in production)
    if (
        settings.ENVIRONMENT != "production"
        and getattr(settings, "ENABLE_DEMO_AUTH_HEADER", False)
        and x_demo_user_id
    ):
        if x_demo_user_id in DEV_ROLE_MAPPING:
            m = DEV_ROLE_MAPPING[x_demo_user_id]
            return AuthenticatedUser(
                user_id=x_demo_user_id,
                email=m["email"],
                organization_id=DEFAULT_ORG_ID,
                organization_name=DEFAULT_ORG_NAME,
                role=m["role"],
                profile=UserProfileSchema(
                    id=x_demo_user_id,
                    email=m["email"],
                    full_name=m["full_name"],
                    department=m["department"],
                    job_title=m["job_title"],
                    weekly_capacity_hours=40.0,
                ),
            )

    # 3. Missing or unauthorized credentials -> Reject by default
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication credentials. Provide a valid Bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_resource_organization_access(resource_org_id: str, current_user: AuthenticatedUser) -> None:
    """
    Enforces cross-tenant isolation by verifying that the target resource's organization
    strictly matches the authenticated user's active organization context.
    """
    if str(resource_org_id) != str(current_user.organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Target resource belongs to organization '{resource_org_id}', but active context is '{current_user.organization_id}'.",
        )


def require_role(allowed_roles: List[UserRoleEnum]):
    """
    Factory for role-based authorization dependencies.
    Rejects users whose verified database role is not in the allowed list.
    """
    async def role_checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of {[r.value for r in allowed_roles]}, but user has role '{current_user.role.value}'.",
            )
        return current_user

    return role_checker


# Reusable Role Dependencies
require_employee = require_role([
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.EMPLOYEE,
])

require_manager = require_role([
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
])

require_admin = require_role([
    UserRoleEnum.ADMIN,
])
