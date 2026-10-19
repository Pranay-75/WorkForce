from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class MembershipStatusEnum(str, Enum):
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"

class PriorityLevelEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskStatusEnum(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"

class SkillLevelEnum(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

class RecommendationStatusEnum(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    OVERRIDDEN = "overridden"

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

# =============================================================================
# WORKLOAD INTELLIGENCE SCHEMAS
# =============================================================================

class TaskSkillPrerequisiteSchema(BaseModel):
    skillId: str
    skillName: str
    minProficiency: SkillLevelEnum = SkillLevelEnum.INTERMEDIATE

class TaskSchema(BaseModel):
    id: str
    organization_id: str
    project_id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: TaskStatusEnum = TaskStatusEnum.TODO
    priority: PriorityLevelEnum = PriorityLevelEnum.MEDIUM
    complexity: str = "Medium"
    estimated_hours: float = 0.0
    actual_hours: Optional[float] = None
    due_date: Optional[str] = None
    required_skills: List[TaskSkillPrerequisiteSchema] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class EmployeeWorkloadStats(BaseModel):
    employee_id: str
    full_name: str
    email: str
    department: str
    job_title: str
    avatar_url: Optional[str] = None
    weekly_capacity_hours: float
    current_load_hours: float
    utilization_pct: float
    remaining_capacity_hours: float
    is_overloaded: bool
    active_task_count: int
    operational_risk_score: float
    load_band: str # "optimal", "near_limit", "overloaded"

class DepartmentWorkloadBreakdown(BaseModel):
    department: str
    capacity_hours: float
    allocated_hours: float
    utilization_pct: float
    employee_count: int

class OrganizationWorkloadOverview(BaseModel):
    total_employees: int
    total_capacity_hours: float
    total_allocated_hours: float
    average_utilization_pct: float
    overloaded_count: int
    underutilized_count: int
    department_breakdown: List[DepartmentWorkloadBreakdown]
    employee_workloads: List[EmployeeWorkloadStats]

class OperationalBurnoutRiskItem(BaseModel):
    profile_id: str
    full_name: str
    department: str
    consecutive_overload_weeks: int = 1
    current_utilization_pct: float
    tight_deadlines_count: int
    high_priority_task_count: int
    operational_risk_index: float
    risk_level: str # "low", "moderate", "elevated", "high"

class OperationalBurnoutRiskResponse(BaseModel):
    disclaimer: str = (
        "Operational risk metrics are derived strictly from scheduling capacity, workload allocation, "
        "and deadline tightness. They represent operational workload indicators and do not constitute clinical or psychological assessments."
    )
    high_risk_employees: List[OperationalBurnoutRiskItem]

# =============================================================================
# MATCHING & RECOMMENDATION SCHEMAS
# =============================================================================

class MatchedSkillDetail(BaseModel):
    skill: str
    required_level: SkillLevelEnum
    candidate_level: SkillLevelEnum
    meets_requirement: bool

class SkillMatchBreakdown(BaseModel):
    matched_skills: List[MatchedSkillDetail]
    missing_skills: List[str]
    skill_score: float

class WorkloadImpactSchema(BaseModel):
    current_load_hours: float
    task_estimated_hours: float
    projected_load_hours: float
    weekly_capacity_hours: float
    projected_utilization_pct: float
    is_projected_overloaded: bool

class CandidateRecommendation(BaseModel):
    candidate_id: str
    candidate_name: str
    candidate_title: str
    candidate_department: str
    candidate_avatar: Optional[str] = None
    match_score: float # 0 - 100
    is_eligible: bool
    skill_match_breakdown: SkillMatchBreakdown
    workload_impact: WorkloadImpactSchema
    rationale: str
    risk_factors: List[str] = Field(default_factory=list)

class TaskMatchRequest(BaseModel):
    task_id: str
    max_candidates: int = Field(default=5, ge=1, le=20)

class TaskMatchResponse(BaseModel):
    task_id: str
    task_title: str
    recommendations: List[CandidateRecommendation]
    total_candidates_evaluated: int
    eligible_candidate_count: int
    no_match_reason: Optional[str] = None

class ManagerDecisionRequest(BaseModel):
    decision: RecommendationStatusEnum # ACCEPTED, REJECTED, OVERRIDDEN
    feedback_reason: Optional[str] = None
    override_profile_id: Optional[str] = None

class ManagerDecisionResponse(BaseModel):
    recommendation_id: str
    task_id: str
    status: RecommendationStatusEnum
    assigned_to: Optional[str] = None
    feedback_reason: Optional[str] = None
    decided_at: str
    audit_event_id: Optional[str] = None

# =============================================================================
# WORKLOAD REDISTRIBUTION PROPOSALS
# =============================================================================

class RedistributionEmployeeInfo(BaseModel):
    id: str
    name: str
    current_load: float
    projected_load: float
    weekly_capacity: float
    projected_utilization_pct: float

class WorkloadRedistributionProposalSchema(BaseModel):
    id: str
    task_id: str
    task_title: str
    task_hours: float
    source_employee: RedistributionEmployeeInfo
    target_employee: RedistributionEmployeeInfo
    rationale: str

class NetCapacityImpactSchema(BaseModel):
    overloaded_reduced_count: int
    average_utilization_delta: float

class WorkloadRedistributionRequest(BaseModel):
    department: Optional[str] = None
    target_max_utilization_pct: float = Field(default=90.0, ge=50.0, le=100.0)

class WorkloadRedistributionResponse(BaseModel):
    proposals: List[WorkloadRedistributionProposalSchema]
    net_capacity_impact: NetCapacityImpactSchema
