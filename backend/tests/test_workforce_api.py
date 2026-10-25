"""
Integration Tests for WorkForce Intelligence, AI Matching & Recommendation Governance APIs
File: backend/tests/test_workforce_api.py
"""

import time
import jwt
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.data_access import reset_dev_store, _DEV_RECOMMENDATIONS, _DEV_TASKS

client = TestClient(app)
TEST_SECRET = "workforce-super-secret-signing-key-for-testing-purposes-32bytes!"

def create_test_token(user_id: str, email: str) -> str:
    """Helper to generate JWT tokens valid for test execution"""
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")

# Test users from seed/dev mapping
MANAGER_ID = "b0000000-0000-0000-0000-000000000001"
MANAGER_EMAIL = "sarah.connor@acme.corp"

ADMIN_ID = "b0000000-0000-0000-0000-000000000008"
ADMIN_EMAIL = "chloe.dubois@acme.corp"

EMPLOYEE_ID = "b0000000-0000-0000-0000-000000000002"
EMPLOYEE_EMAIL = "alex.chen@acme.corp"

DEFAULT_ORG = "a0000000-0000-0000-0000-000000000001"

class MockQueryBuilder:
    def __init__(self, data=None):
        self._data = data if data is not None else []

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def single(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def execute(self):
        class Result:
            pass
        r = Result()
        r.data = self._data
        return r

class MockSupabase:
    def __init__(self, role="manager", user_id=MANAGER_ID):
        self.role = role
        self.user_id = user_id

    def table(self, table_name):
        if table_name == "organization_memberships":
            return MockQueryBuilder([{
                "role": self.role,
                "organization_id": DEFAULT_ORG,
                "organizations": {"id": DEFAULT_ORG, "name": "Acme Systems Engineering", "slug": "acme-systems"}
            }])
        return MockQueryBuilder([])

@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    reset_dev_store()

# =============================================================================
# 1. WORKLOAD OVERVIEW ENDPOINT TESTS
# =============================================================================

def test_workload_overview_manager_access(monkeypatch):
    """Verify Managers can query the workload overview and receive structured capacity metrics"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))

    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)
    res = client.get("/api/v1/workload/overview", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert data["total_employees"] >= 3
    assert data["total_capacity_hours"] > 0
    assert "department_breakdown" in data
    assert "employee_workloads" in data
    assert any(e["is_overloaded"] for e in data["employee_workloads"])

def test_workload_overview_employee_access_blocked(monkeypatch):
    """Verify Employees are blocked from accessing workload overview (403 Forbidden)"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="employee", user_id=EMPLOYEE_ID))

    token = create_test_token(EMPLOYEE_ID, EMPLOYEE_EMAIL)
    res = client.get("/api/v1/workload/overview", headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

def test_workload_overview_unauthenticated_blocked():
    """Verify unauthenticated requests are rejected with 401 Unauthorized"""
    res = client.get("/api/v1/workload/overview")
    assert res.status_code == 401

# =============================================================================
# 2. AI TASK MATCHING ENDPOINT TESTS
# =============================================================================

def test_match_task_candidates_manager_success(monkeypatch):
    """Verify Managers can request candidate recommendations for an existing task"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))

    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)
    task_id = "4fa85f64-5717-4562-b3fc-2c963f66afa2" # Stripe Webhook Handler (Python/FastAPI)

    payload = {"task_id": task_id, "max_candidates": 3}
    res = client.post("/api/v1/ai/match-task", json=payload, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 200
    data = res.json()
    assert data["task_id"] == task_id
    assert len(data["recommendations"]) > 0

    top_rec = data["recommendations"][0]
    assert "candidate_id" in top_rec
    assert "match_score" in top_rec
    assert top_rec["match_score"] > 0
    assert "skill_match_breakdown" in top_rec
    assert "workload_impact" in top_rec
    assert len(top_rec["rationale"]) > 0

def test_match_task_nonexistent_returns_404(monkeypatch):
    """Verify matching on a non-existent task returns 404 Not Found"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))

    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)
    payload = {"task_id": "00000000-0000-0000-0000-000000000000", "max_candidates": 3}
    res = client.post("/api/v1/ai/match-task", json=payload, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 404

def test_match_task_employee_blocked(monkeypatch):
    """Verify Employees cannot invoke AI candidate matching (403 Forbidden)"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="employee", user_id=EMPLOYEE_ID))

    token = create_test_token(EMPLOYEE_ID, EMPLOYEE_EMAIL)
    payload = {"task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2", "max_candidates": 3}
    res = client.post("/api/v1/ai/match-task", json=payload, headers={"Authorization": f"Bearer {token}"})

    assert res.status_code == 403

# =============================================================================
# 3. MANAGER GOVERNANCE & RECOMMENDATION DECISIONS
# =============================================================================

def test_manager_decision_approval_flow(monkeypatch):
    """Verify Manager approval assigns task, updates recommendation status, and records audit log"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    # 1. First trigger match-task to persist a pending recommendation
    task_id = "4fa85f64-5717-4562-b3fc-2c963f66afa2"
    match_res = client.post(
        "/api/v1/ai/match-task",
        json={"task_id": task_id, "max_candidates": 3},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert match_res.status_code == 200
    top_candidate_id = match_res.json()["recommendations"][0]["candidate_id"]
    rec_id = f"rec-{task_id}-{top_candidate_id}"

    # 2. Approve recommendation
    decision_payload = {
        "decision": "accepted",
        "feedback_reason": "Ideal skill match and optimal bandwidth.",
    }
    dec_res = client.post(
        f"/api/v1/recommendations/{rec_id}/decision",
        json=decision_payload,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert dec_data["recommendation_id"] == rec_id
    assert dec_data["status"] == "accepted"
    assert dec_data["assigned_to"] == top_candidate_id
    assert dec_data["audit_event_id"] is not None

    # Verify task was actually assigned in data store
    assigned_task = next(t for t in _DEV_TASKS if t["id"] == task_id)
    assert assigned_task["assigned_to"] == top_candidate_id
    assert assigned_task["status"] == "in_progress"

def test_manager_decision_duplicate_rejected(monkeypatch):
    """Verify a recommendation that was already decided cannot be decided again (409 Conflict)"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    # Setup pre-decided recommendation
    rec_id = "rec-already-accepted"
    _DEV_RECOMMENDATIONS[rec_id] = {
        "id": rec_id,
        "organization_id": DEFAULT_ORG,
        "task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
        "candidate_id": "cand-001",
        "status": "accepted",
    }

    res = client.post(
        f"/api/v1/recommendations/{rec_id}/decision",
        json={"decision": "accepted"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 409
    assert "already been decided" in res.json()["detail"]

def test_manager_decision_rejection_flow(monkeypatch):
    """Verify Manager rejection leaves task unassigned and records feedback reason"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    task_id = "4fa85f64-5717-4562-b3fc-2c963f66afa2"
    rec_id = "rec-to-reject"
    _DEV_RECOMMENDATIONS[rec_id] = {
        "id": rec_id,
        "organization_id": DEFAULT_ORG,
        "task_id": task_id,
        "candidate_id": "b0000000-0000-0000-0000-000000000003",
        "status": "pending",
    }

    res = client.post(
        f"/api/v1/recommendations/{rec_id}/decision",
        json={"decision": "rejected", "feedback_reason": "Candidate has competing deliverables."},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["assigned_to"] is None

def test_manager_decision_override_flow(monkeypatch):
    """Verify Manager can manually override AI recommendation with alternative candidate"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    task_id = "4fa85f64-5717-4562-b3fc-2c963f66afa2"
    rec_id = "rec-to-override"
    _DEV_RECOMMENDATIONS[rec_id] = {
        "id": rec_id,
        "organization_id": DEFAULT_ORG,
        "task_id": task_id,
        "candidate_id": "b0000000-0000-0000-0000-000000000003",
        "status": "pending",
    }

    override_target = "b0000000-0000-0000-0000-000000000006" # Priya Patel
    res = client.post(
        f"/api/v1/recommendations/{rec_id}/decision",
        json={
            "decision": "overridden",
            "override_profile_id": override_target,
            "feedback_reason": "Priya has specific domain context on Stripe APIs.",
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "overridden"
    assert res.json()["assigned_to"] == override_target

def test_manager_decision_override_missing_target_returns_400(monkeypatch):
    """Verify override decision without override_profile_id is rejected with 400 Bad Request"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    rec_id = "rec-override-bad"
    _DEV_RECOMMENDATIONS[rec_id] = {
        "id": rec_id,
        "organization_id": DEFAULT_ORG,
        "task_id": "t1",
        "candidate_id": "c1",
        "status": "pending",
    }

    res = client.post(
        f"/api/v1/recommendations/{rec_id}/decision",
        json={"decision": "overridden", "override_profile_id": None},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400

# =============================================================================
# 4. WORKLOAD REDISTRIBUTION & BURNOUT RISK ENDPOINTS
# =============================================================================

def test_redistribute_workload_endpoint(monkeypatch):
    """Verify redistribution proposals simulate rebalancing David Kim's overload"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    res = client.post(
        "/api/v1/ai/redistribute-workload",
        json={"target_max_utilization_pct": 90.0},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "proposals" in data
    assert len(data["proposals"]) >= 1

    prop = data["proposals"][0]
    assert prop["source_employee"]["id"] == "b0000000-0000-0000-0000-000000000003" # David Kim
    assert prop["target_employee"]["projected_utilization_pct"] <= 90.0

def test_burnout_risk_insights_endpoint(monkeypatch):
    """Verify operational burnout risk indicators return disclaimer and identified risk profiles"""
    monkeypatch.setattr("app.api.deps.get_supabase_admin", lambda: MockSupabase(role="manager"))
    token = create_test_token(MANAGER_ID, MANAGER_EMAIL)

    res = client.get("/api/v1/insights/burnout-risk", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "disclaimer" in data
    assert "operational" in data["disclaimer"].lower()
    assert "clinical" in data["disclaimer"].lower()
    assert len(data["high_risk_employees"]) >= 1

    top_risk = data["high_risk_employees"][0]
    assert top_risk["profile_id"] == "b0000000-0000-0000-0000-000000000003" # David Kim at 115%
    assert top_risk["risk_level"] in ("high", "elevated")
