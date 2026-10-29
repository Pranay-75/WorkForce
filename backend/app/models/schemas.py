from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

class UserRoleEnum(str, Enum):
    ORGANIZER = "organizer"
    ADMIN = "admin"
    MANAGER = "manager"
    HR = "hr"
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

# -----------------------------------------------------------------------------
# AI Engine Schemas (Gemini-powered Telemetry & Explanations)
# -----------------------------------------------------------------------------

class AIWorkloadInsightsRequest(BaseModel):
    total_capacity_hours: float = Field(..., ge=0)
    total_active_hours: float = Field(..., ge=0)
    average_utilization_pct: int = Field(..., ge=0)
    overallocated_count: int = Field(..., ge=0)
    near_limit_count: int = Field(default=0, ge=0)
    optimal_count: int = Field(default=0, ge=0)
    underutilized_count: int = Field(default=0, ge=0)
    overdue_tasks_count: int = Field(default=0, ge=0)
    unassigned_tasks_count: int = Field(default=0, ge=0)
    overallocated_members: List[Dict[str, Any]] = Field(default_factory=list)

class AIWorkloadInsightsResponse(BaseModel):
    executive_summary: str
    identified_risks: List[str]
    actionable_recommendations: List[str]
    is_ai_generated: bool = True
    model_used: Optional[str] = "gemini-3.8-flash"
    ai_error: Optional[str] = None

class AIMatchingExplanationRequest(BaseModel):
    task_title: str
    task_description: Optional[str] = ""
    estimated_hours: float = Field(..., ge=0)
    candidate_name: str
    candidate_job_title: Optional[str] = ""
    candidate_department: Optional[str] = ""
    current_load_hours: float = Field(..., ge=0)
    weekly_capacity_hours: float = Field(..., ge=0)
    projected_utilization_pct: int = Field(..., ge=0)
    match_score: int = Field(..., ge=0, le=100)
    is_allocated_to_project: bool = True
    satisfied_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)

class AIMatchingExplanationResponse(BaseModel):
    candidate_name: str
    task_title: str
    ai_rationale: str
    capacity_assessment: str
    trade_offs: List[str]
    is_ai_generated: bool = True
    model_used: Optional[str] = "gemini-3.8-flash"
    ai_error: Optional[str] = None

class AIExecutiveReportRequest(BaseModel):
    project_count: int = Field(..., ge=0)
    active_tasks_count: int = Field(..., ge=0)
    completed_tasks_count: int = Field(..., ge=0)
    completion_rate_pct: int = Field(..., ge=0)
    department_metrics: List[Dict[str, Any]] = Field(default_factory=list)
    recent_audit_count: int = Field(default=0, ge=0)

class AIExecutiveReportResponse(BaseModel):
    executive_briefing: str
    velocity_analysis: str
    strategic_priorities: List[str]
    is_ai_generated: bool = True
    model_used: Optional[str] = "gemini-3.8-flash"
    ai_error: Optional[str] = None
