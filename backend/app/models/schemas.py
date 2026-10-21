from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

class UserRoleEnum(str, Enum):
    ORGANIZER = "organizer"
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class MembershipStatusEnum(str, Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"

class UserProfileSchema(BaseModel):
    id: str
    email: str
    full_name: str
    avatar_url: Optional[str] = None
    department: str = "Engineering"
    job_title: str = "Software Engineer"
    weekly_capacity_hours: float = 40.0

class OrganizationSchema(BaseModel):
    id: str
    name: str
    slug: str

class AuthenticatedUser(BaseModel):
    user_id: str
    email: str
    organization_id: str
    organization_name: str
    role: UserRoleEnum
    profile: Optional[UserProfileSchema] = None

class TokenPayload(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "0.2.0"
    environment: str
