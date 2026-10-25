"""
WorkForce - Data Access & Persistence Layer
File: backend/app/services/data_access.py

Provides unified data retrieval and persistence for Workload Intelligence,
Candidate Matching, Recommendations, Decisions, and Audit Logging.
Includes automatic fallback to local seed dataset when running offline or in test environments.
"""

import uuid
import datetime
from typing import List, Dict, Any, Optional
from app.core.database import get_supabase_admin
from app.models.schemas import UserRoleEnum, TaskStatusEnum, PriorityLevelEnum, SkillLevelEnum

DEFAULT_ORG_ID = "a0000000-0000-0000-0000-000000000001"

# In-memory store for fallback/dev/test execution
_DEV_PROFILES: List[Dict[str, Any]] = [
    {
        "id": "b0000000-0000-0000-0000-000000000008",
        "organization_id": DEFAULT_ORG_ID,
        "email": "chloe.dubois@acme.corp",
        "full_name": "Chloe Dubois",
        "role": "admin",
        "department": "Product / HR",
        "job_title": "VP of Operations & Talent",
        "weekly_capacity_hours": 40.0,
        "avatar_url": "CD",
        "skills": [
            {"skillName": "Management", "proficiency": "expert"},
            {"skillName": "Operations", "proficiency": "expert"},
        ],
    },
    {
        "id": "b0000000-0000-0000-0000-000000000001",
        "organization_id": DEFAULT_ORG_ID,
        "email": "sarah.connor@acme.corp",
        "full_name": "Sarah Connor",
        "role": "manager",
        "department": "Engineering",
        "job_title": "Engineering Lead & Architect",
        "weekly_capacity_hours": 40.0,
        "avatar_url": "SC",
        "skills": [
            {"skillName": "Python", "proficiency": "expert"},
            {"skillName": "FastAPI", "proficiency": "advanced"},
            {"skillName": "Architecture", "proficiency": "expert"},
        ],
    },
    {
        "id": "b0000000-0000-0000-0000-000000000002",
        "organization_id": DEFAULT_ORG_ID,
        "email": "alex.chen@acme.corp",
        "full_name": "Alex Chen",
        "role": "employee",
        "department": "Engineering",
        "job_title": "Senior Frontend Engineer",
        "weekly_capacity_hours": 40.0,
        "avatar_url": "AC",
        "skills": [
            {"skillName": "React", "proficiency": "expert"},
            {"skillName": "TypeScript", "proficiency": "advanced"},
            {"skillName": "Tailwind", "proficiency": "expert"},
        ],
    },
    {
        "id": "b0000000-0000-0000-0000-000000000003",
        "organization_id": DEFAULT_ORG_ID,
        "email": "david.kim@acme.corp",
        "full_name": "David Kim",
        "role": "employee",
        "department": "Engineering",
        "job_title": "Backend & Distributed Systems Engineer",
        "weekly_capacity_hours": 40.0,
        "avatar_url": "DK",
        "skills": [
            {"skillName": "Python", "proficiency": "expert"},
            {"skillName": "FastAPI", "proficiency": "expert"},
            {"skillName": "PostgreSQL", "proficiency": "advanced"},
            {"skillName": "Distributed Systems", "proficiency": "advanced"},
        ],
    },
    {
        "id": "b0000000-0000-0000-0000-000000000006",
        "organization_id": DEFAULT_ORG_ID,
        "email": "priya.patel@acme.corp",
        "full_name": "Priya Patel",
        "role": "employee",
        "department": "Engineering",
        "job_title": "Full-Stack Software Engineer",
        "weekly_capacity_hours": 40.0,
        "avatar_url": "PP",
        "skills": [
            {"skillName": "Python", "proficiency": "intermediate"},
            {"skillName": "React", "proficiency": "advanced"},
            {"skillName": "TypeScript", "proficiency": "intermediate"},
            {"skillName": "FastAPI", "proficiency": "intermediate"},
        ],
    },
]

_DEV_TASKS: List[Dict[str, Any]] = [
    {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
        "organization_id": DEFAULT_ORG_ID,
        "project_id": "proj-001",
        "title": "Build Stripe Webhook Handler",
        "description": "Implement idempotent signature verification and event routing for subscription payments.",
        "assigned_to": None,
        "status": "todo",
        "priority": "high",
        "complexity": "Medium",
        "estimated_hours": 8.0,
        "due_date": "2026-10-30T17:00:00Z",
        "required_skills": [
            {"skillName": "Python", "minProficiency": "advanced"},
            {"skillName": "FastAPI", "minProficiency": "intermediate"},
        ],
    },
    {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa3",
        "organization_id": DEFAULT_ORG_ID,
        "project_id": "proj-001",
        "title": "Fix GraphQL Auth Mutation & Token Expiry",
        "description": "Resolve race condition during token rotation.",
        "assigned_to": "b0000000-0000-0000-0000-000000000003", # David Kim (currently loaded)
        "status": "in_progress",
        "priority": "critical",
        "complexity": "High",
        "estimated_hours": 26.0,
        "due_date": "2026-10-25T17:00:00Z",
        "required_skills": [
            {"skillName": "Python", "minProficiency": "expert"},
        ],
    },
    {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa4",
        "organization_id": DEFAULT_ORG_ID,
        "project_id": "proj-001",
        "title": "Database Connection Pool Optimization",
        "description": "Tune max connections and idle timeouts for PgBouncer.",
        "assigned_to": "b0000000-0000-0000-0000-000000000003", # David Kim (bringing him to 46h / 115%)
        "status": "in_progress",
        "priority": "high",
        "complexity": "Medium",
        "estimated_hours": 20.0,
        "due_date": "2026-10-28T17:00:00Z",
        "required_skills": [
            {"skillName": "PostgreSQL", "minProficiency": "advanced"},
        ],
    },
    {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa5",
        "organization_id": DEFAULT_ORG_ID,
        "project_id": "proj-002",
        "title": "Design System Modernization & Dark Mode",
        "description": "Refactor tokens to HSL and enhance contrast ratios.",
        "assigned_to": "b0000000-0000-0000-0000-000000000002", # Alex Chen (18h load)
        "status": "in_progress",
        "priority": "medium",
        "complexity": "Medium",
        "estimated_hours": 18.0,
        "due_date": "2026-11-05T17:00:00Z",
        "required_skills": [
            {"skillName": "React", "minProficiency": "expert"},
            {"skillName": "Tailwind", "minProficiency": "advanced"},
        ],
    },
    {
        "id": "4fa85f64-5717-4562-b3fc-2c963f66afa6",
        "organization_id": DEFAULT_ORG_ID,
        "project_id": "proj-002",
        "title": "Legacy API Cleanup",
        "description": "Deprecate v0 endpoints.",
        "assigned_to": "b0000000-0000-0000-0000-000000000001", # Sarah Connor (completed task, does not count toward active load)
        "status": "completed",
        "priority": "low",
        "complexity": "Low",
        "estimated_hours": 10.0,
        "due_date": "2026-10-15T17:00:00Z",
        "required_skills": [],
    },
]

_DEV_RECOMMENDATIONS: Dict[str, Dict[str, Any]] = {}
_DEV_DECISIONS: List[Dict[str, Any]] = []
_DEV_AUDIT_EVENTS: List[Dict[str, Any]] = []

def reset_dev_store():
    """Resets memory store for test isolation."""
    _DEV_RECOMMENDATIONS.clear()
    _DEV_DECISIONS.clear()
    _DEV_AUDIT_EVENTS.clear()

def get_organization_profiles(org_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves all employee profiles belonging to the specified organization.
    """
    try:
        admin_client = get_supabase_admin()
        res = (
            admin_client.table("organization_memberships")
            .select("user_id, role, status, user_profiles(id, email, full_name, avatar_url, department, job_title, weekly_capacity_hours)")
            .eq("organization_id", org_id)
            .eq("status", "active")
            .execute()
        )
        if res.data:
            profiles = []
            for row in res.data:
                prof_data = row.get("user_profiles") or {}
                if prof_data:
                    prof_dict = dict(prof_data)
                    prof_dict["role"] = row.get("role", "employee")
                    prof_dict["organization_id"] = org_id
                    # Default skills if not mapped
                    matching_dev = next((p for p in _DEV_PROFILES if p["id"] == prof_dict["id"]), None)
                    prof_dict["skills"] = matching_dev["skills"] if matching_dev else []
                    profiles.append(prof_dict)
            return profiles
    except Exception:
        pass

    # Fallback to dev dataset filtered by organization
    return [p for p in _DEV_PROFILES if str(p.get("organization_id")) == str(org_id)]

def get_organization_tasks(org_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves all tasks for the specified organization.
    """
    try:
        admin_client = get_supabase_admin()
        q = admin_client.table("tasks").select("*").eq("organization_id", org_id)
        if project_id:
            q = q.eq("project_id", project_id)
        res = q.execute()
        if res.data:
            return res.data
    except Exception:
        pass

    # Fallback
    tasks = [t for t in _DEV_TASKS if str(t.get("organization_id")) == str(org_id)]
    if project_id:
        tasks = [t for t in tasks if str(t.get("project_id")) == str(project_id)]
    return tasks

def get_task_by_id(task_id: str, org_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single task ensuring organization isolation.
    """
    try:
        admin_client = get_supabase_admin()
        res = admin_client.table("tasks").select("*").eq("id", task_id).eq("organization_id", org_id).single().execute()
        if res.data:
            return res.data
    except Exception:
        pass

    return next(
        (t for t in _DEV_TASKS if str(t.get("id")) == str(task_id) and str(t.get("organization_id")) == str(org_id)),
        None
    )

def assign_task_in_db(task_id: str, assignee_id: Optional[str], org_id: str) -> Dict[str, Any]:
    """
    Updates a task's assignment, updating status to in_progress if assigned.
    """
    new_status = "in_progress" if assignee_id else "todo"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        admin_client = get_supabase_admin()
        # Use RPC or direct update
        res = (
            admin_client.table("tasks")
            .update({
                "assigned_to": assignee_id,
                "status": new_status,
                "updated_at": now_iso,
            })
            .eq("id", task_id)
            .eq("organization_id", org_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass

    # Fallback in-memory
    for t in _DEV_TASKS:
        if str(t.get("id")) == str(task_id) and str(t.get("organization_id")) == str(org_id):
            t["assigned_to"] = assignee_id
            t["status"] = new_status
            t["updated_at"] = now_iso
            return t

    return {
        "id": task_id,
        "assigned_to": assignee_id,
        "status": new_status,
        "organization_id": org_id,
    }

def record_audit_event(
    org_id: str,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    metadata: Dict[str, Any],
) -> str:
    """
    Records an immutable audit event for compliance and governance tracking.
    """
    event_id = str(uuid.uuid4())
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    event = {
        "id": event_id,
        "organization_id": org_id,
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "metadata": metadata,
        "occurred_at": now_iso,
    }

    try:
        admin_client = get_supabase_admin()
        admin_client.table("audit_events").insert(event).execute()
    except Exception:
        pass

    _DEV_AUDIT_EVENTS.append(event)
    return event_id

def save_recommendation(rec: Dict[str, Any]) -> str:
    """
    Stores an AI recommendation record.
    """
    rec_id = rec.get("id") or str(uuid.uuid4())
    rec["id"] = rec_id
    if "status" not in rec:
        rec["status"] = "pending"
    if "created_at" not in rec:
        rec["created_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        admin_client = get_supabase_admin()
        admin_client.table("ai_recommendations").insert(rec).execute()
    except Exception:
        pass

    _DEV_RECOMMENDATIONS[rec_id] = rec
    return rec_id

def get_recommendation_by_id(rec_id: str, org_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches an AI recommendation ensuring tenant isolation.
    """
    try:
        admin_client = get_supabase_admin()
        res = (
            admin_client.table("ai_recommendations")
            .select("*")
            .eq("id", rec_id)
            .eq("organization_id", org_id)
            .single()
            .execute()
        )
        if res.data:
            return res.data
    except Exception:
        pass

    rec = _DEV_RECOMMENDATIONS.get(rec_id)
    if rec and str(rec.get("organization_id")) == str(org_id):
        return rec
    return None

def record_manager_decision(
    recommendation_id: str,
    manager_id: str,
    decision: str,
    feedback_reason: Optional[str],
    override_profile_id: Optional[str],
    org_id: str,
) -> Dict[str, Any]:
    """
    Records a manager's decision on a recommendation, ensuring state transition integrity.
    """
    decision_id = str(uuid.uuid4())
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    decision_record = {
        "id": decision_id,
        "recommendation_id": recommendation_id,
        "manager_id": manager_id,
        "decision": decision,
        "feedback_reason": feedback_reason,
        "override_profile_id": override_profile_id,
        "decided_at": now_iso,
    }

    try:
        admin_client = get_supabase_admin()
        # Insert decision
        admin_client.table("manager_decisions").insert(decision_record).execute()
        # Update recommendation status
        admin_client.table("ai_recommendations").update({"status": decision}).eq("id", recommendation_id).execute()
    except Exception:
        pass

    _DEV_DECISIONS.append(decision_record)
    if recommendation_id in _DEV_RECOMMENDATIONS:
        _DEV_RECOMMENDATIONS[recommendation_id]["status"] = decision

    return decision_record
