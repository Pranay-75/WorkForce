import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import AuthenticatedUser, UserRoleEnum, UserProfileSchema
from app.api.deps import get_current_user

client = TestClient(app)

def create_mock_user(role: UserRoleEnum) -> AuthenticatedUser:
    return AuthenticatedUser(
        user_id="test-user-id",
        email=f"test.{role.value}@acme.corp",
        organization_id="a0000000-0000-0000-0000-000000000001",
        organization_name="Acme Systems Engineering",
        role=role,
        profile=UserProfileSchema(
            id="test-user-id",
            email=f"test.{role.value}@acme.corp",
            full_name=f"Test {role.value.capitalize()}",
            department="Engineering",
            job_title="Software Engineer",
            weekly_capacity_hours=40.0,
        ),
    )


# -----------------------------------------------------------------------------
# 1. Unauthenticated / Role Authorization Tests
# -----------------------------------------------------------------------------

def test_workload_insights_unauthenticated():
    """Unauthenticated call to /api/v1/ai/workload-insights must return 401."""
    app.dependency_overrides.clear()
    res = client.post("/api/v1/ai/workload-insights", json={
        "total_capacity_hours": 160.0,
        "total_active_hours": 120.0,
        "average_utilization_pct": 75,
        "overallocated_count": 0,
    })
    assert res.status_code == 401


def test_workload_insights_employee_forbidden():
    """Employees must be rejected with 403 Forbidden on management AI endpoints."""
    app.dependency_overrides[get_current_user] = lambda: create_mock_user(UserRoleEnum.EMPLOYEE)
    try:
        res = client.post("/api/v1/ai/workload-insights", json={
            "total_capacity_hours": 160.0,
            "total_active_hours": 120.0,
            "average_utilization_pct": 75,
            "overallocated_count": 0,
        })
        assert res.status_code == 403
        assert "Access denied" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_matching_explanation_employee_forbidden():
    """Employees must be rejected with 403 Forbidden on matching explanation."""
    app.dependency_overrides[get_current_user] = lambda: create_mock_user(UserRoleEnum.EMPLOYEE)
    try:
        res = client.post("/api/v1/ai/explain-matching", json={
            "task_title": "Database Optimization",
            "estimated_hours": 12.0,
            "candidate_name": "David Kim",
            "current_load_hours": 20.0,
            "weekly_capacity_hours": 40.0,
            "projected_utilization_pct": 80,
            "match_score": 88,
        })
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 2. Manager Authorized Tests & Response Schema Validation (Deterministic & Mocked)
# -----------------------------------------------------------------------------

@patch("app.api.v1.ai.get_gemini_client")
def test_workload_insights_manager_deterministic_fallback(mock_get_client):
    """Manager can successfully request workload insights and receive valid deterministic telemetry."""
    mock_get_client.return_value = None  # Force deterministic engine
    app.dependency_overrides[get_current_user] = lambda: create_mock_user(UserRoleEnum.MANAGER)
    try:
        payload = {
            "total_capacity_hours": 200.0,
            "total_active_hours": 160.0,
            "average_utilization_pct": 80,
            "overallocated_count": 1,
            "near_limit_count": 2,
            "optimal_count": 2,
            "underutilized_count": 0,
            "overdue_tasks_count": 1,
            "unassigned_tasks_count": 2,
            "overallocated_members": [
                {"name": "Sarah Connor", "hours": 48.0, "capacity": 40.0, "utilization": 120}
            ],
        }
        res = client.post("/api/v1/ai/workload-insights", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "executive_summary" in data
        assert isinstance(data["identified_risks"], list)
        assert len(data["identified_risks"]) > 0
        assert isinstance(data["actionable_recommendations"], list)
        assert len(data["actionable_recommendations"]) > 0
        assert data["is_ai_generated"] is False
    finally:
        app.dependency_overrides.clear()


@patch("app.api.v1.ai.get_gemini_client")
def test_explain_matching_manager_mocked_gemini(mock_get_client):
    """Manager can successfully receive Gemini model synthesis when client is active."""
    mock_client = MagicMock()
    mock_res = MagicMock()
    mock_res.text = '''{
        "ai_rationale": "Alex Chen demonstrates high affinity for real-time telemetry pipelines.",
        "capacity_assessment": "Operating safely at 75% projected capacity.",
        "trade_offs": ["Minor context switching from existing tasks."]
    }'''
    mock_client.models.generate_content.return_value = mock_res
    mock_get_client.return_value = mock_client

    app.dependency_overrides[get_current_user] = lambda: create_mock_user(UserRoleEnum.MANAGER)
    try:
        payload = {
            "task_title": "Real-time Telemetry Ingestion",
            "task_description": "Build asynchronous Kafka worker with backpressure handling",
            "estimated_hours": 16.0,
            "candidate_name": "Alex Chen",
            "candidate_job_title": "Senior Engineer",
            "candidate_department": "Engineering",
            "current_load_hours": 14.0,
            "weekly_capacity_hours": 40.0,
            "projected_utilization_pct": 75,
            "match_score": 92,
            "is_allocated_to_project": True,
            "satisfied_skills": ["Kafka", "Python", "FastAPI"],
            "missing_skills": [],
        }
        res = client.post("/api/v1/ai/explain-matching", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["candidate_name"] == "Alex Chen"
        assert data["task_title"] == "Real-time Telemetry Ingestion"
        assert "Alex Chen" in data["ai_rationale"]
        assert "75%" in data["capacity_assessment"]
        assert isinstance(data["trade_offs"], list)
        assert data["is_ai_generated"] is True
        assert data["model_used"] == "gemini-3.8-flash"
    finally:
        app.dependency_overrides.clear()


@patch("app.api.v1.ai.get_gemini_client")
def test_executive_report_admin_deterministic_fallback(mock_get_client):
    """Admin can generate executive analytics report using deterministic engine."""
    mock_get_client.return_value = None  # Force deterministic engine
    app.dependency_overrides[get_current_user] = lambda: create_mock_user(UserRoleEnum.ADMIN)
    try:
        payload = {
            "project_count": 4,
            "active_tasks_count": 18,
            "completed_tasks_count": 22,
            "completion_rate_pct": 55,
            "department_metrics": [
                {"department": "Engineering", "active_hours": 120, "capacity": 160},
                {"department": "Design", "active_hours": 30, "capacity": 40},
            ],
            "recent_audit_count": 14,
        }
        res = client.post("/api/v1/ai/executive-report", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "executive_briefing" in data
        assert "velocity_analysis" in data
        assert isinstance(data["strategic_priorities"], list)
        assert len(data["strategic_priorities"]) > 0
        assert data["is_ai_generated"] is False
    finally:
        app.dependency_overrides.clear()
