# WorkForce - Backend API Specification (FastAPI)

This document defines the REST API endpoints, Pydantic schemas, authentication requirements, authorization rules, and error envelopes implemented by the Python FastAPI backend.

---

## 1. Authentication, Headers & Standard Response Envelope

### Authentication Scheme
- **Standard**: Bearer JWT token issued by Supabase Auth (`Authorization: Bearer <supabase_jwt>`).
- **Validation**: FastAPI middleware decodes the JWT using Supabase JWT Secret / JWKS, resolves the `user_id`, and validates organizational tenancy and role permissions (`admin`, `manager`, `employee`).

### Standard Error Response Format
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Only managers or admins can trigger workload rebalancing.",
    "details": {}
  }
}
```

---

## 2. API Endpoint Inventory

### 2.1 Context & Profile Endpoints

#### `GET /api/v1/auth/me`
- **Role**: All (`admin`, `manager`, `employee`)
- **Description**: Returns the authenticated user's profile, role, organization details, and active workload summary.
- **Response `200 OK`**:
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "organization_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
  "email": "sarah.lead@acme.corp",
  "full_name": "Sarah Connor",
  "role": "manager",
  "department": "Engineering",
  "weekly_capacity_hours": 40.0,
  "current_load_hours": 28.5,
  "burnout_risk_score": 0.32
}
```

---

### 2.2 Explainable AI Matching & Approval Endpoints

#### `POST /api/v1/ai/match-task`
- **Role**: `admin`, `manager`
- **Description**: Evaluates candidates for an unassigned task. Combines deterministic pre-filtering (skill matching & capacity delta) with Google Gemini AI structured generation for explainability and risk analysis.
- **Request Body**:
```json
{
  "task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "max_candidates": 5
}
```
- **Response `200 OK`**:
```json
{
  "task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "recommendations": [
    {
      "candidate_id": "1fa85f64-5717-4562-b3fc-2c963f66afa9",
      "candidate_name": "Alex Chen",
      "candidate_avatar": "https://avatars.example.com/alex.png",
      "candidate_title": "Senior Frontend Engineer",
      "match_score": 92.5,
      "skill_match_breakdown": {
        "matched_skills": [
          {"skill": "React", "required_level": "advanced", "candidate_level": "expert"},
          {"skill": "TypeScript", "required_level": "intermediate", "candidate_level": "advanced"}
        ],
        "missing_skills": [],
        "skill_score": 100.0
      },
      "workload_impact": {
        "current_load_hours": 24.0,
        "task_estimated_hours": 8.0,
        "projected_load_hours": 32.0,
        "weekly_capacity_hours": 40.0,
        "projected_utilization_pct": 80.0
      },
      "rationale": "Alex possesses expert-level mastery in React and TypeScript. Assigning this 8-hour task will bring Alex's weekly utilization to an optimal 80%, with no schedule clashes before the Friday deadline.",
      "risk_factors": [
        "Alex has 1 other high-priority task due the day before this deadline."
      ]
    }
  ]
}
```

#### `POST /api/v1/recommendations/{id}/decision`
- **Role**: `admin`, `manager`
- **Description**: Records a manager's review decision (`accepted`, `rejected`, or `overridden`). If accepted, assigns the task and creates audit and notification records.
- **Request Body**:
```json
{
  "decision": "accepted",
  "feedback_reason": "Ideal skill match and balanced capacity.",
  "override_profile_id": null
}
```
- **Response `200 OK`**:
```json
{
  "recommendation_id": "7fa85f64-5717-4562-b3fc-2c963f66afa3",
  "status": "accepted",
  "task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
  "assigned_to": "1fa85f64-5717-4562-b3fc-2c963f66afa9",
  "audit_event_id": "9fa85f64-5717-4562-b3fc-2c963f66afa4"
}
```

---

### 2.3 Workload & Balancing Endpoints

#### `GET /api/v1/workload/overview`
- **Role**: `admin`, `manager`
- **Query Params**: `department` (optional), `timeframe` (e.g. `current_week`)
- **Description**: Returns aggregated capacity and individual utilization bands across the organization.
- **Response `200 OK`**:
```json
{
  "total_employees": 24,
  "total_capacity_hours": 960.0,
  "total_allocated_hours": 745.0,
  "average_utilization_pct": 77.6,
  "overloaded_count": 3,
  "underutilized_count": 4,
  "department_breakdown": [
    {
      "department": "Engineering",
      "capacity_hours": 480.0,
      "allocated_hours": 410.0,
      "utilization_pct": 85.4
    }
  ]
}
```

#### `POST /api/v1/ai/redistribute-workload`
- **Role**: `admin`, `manager`
- **Description**: Simulates workload redistribution to resolve bottlenecks. Proposes task transfers from over-capacity employees (>100%) to matching under-utilized staff.
- **Request Body**:
```json
{
  "department": "Engineering",
  "target_max_utilization_pct": 90.0
}
```
- **Response `200 OK`**:
```json
{
  "proposals": [
    {
      "task_id": "4fa85f64-5717-4562-b3fc-2c963f66afa2",
      "task_title": "Fix GraphQL Auth Mutation",
      "task_hours": 6.0,
      "source_employee": {
        "id": "2fa85f64-5717-4562-b3fc-2c963f66afa8",
        "name": "David Kim",
        "current_load": 46.0,
        "projected_load": 40.0
      },
      "target_employee": {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa7",
        "name": "Elena Rostova",
        "current_load": 22.0,
        "projected_load": 28.0
      },
      "rationale": "Transferring this task reduces David Kim's overload from 115% to 100% while increasing Elena's utilization to a healthy 70%."
    }
  ],
  "net_capacity_impact": {
    "overloaded_reduced_count": 1,
    "std_deviation_delta": -4.2
  }
}
```

---

### 2.4 Insights, Audit & Synthetic Seeder

#### `GET /api/v1/insights/burnout-risk`
- **Role**: `admin`, `manager`
- **Description**: Returns operational capacity risk metrics with documented heuristic formulas.
- **Response `200 OK`**:
```json
{
  "disclaimer": "Operational risk metrics are derived strictly from scheduling capacity and deadline tightness. They do not constitute clinical or psychological assessments.",
  "high_risk_employees": [
    {
      "profile_id": "2fa85f64-5717-4562-b3fc-2c963f66afa8",
      "full_name": "David Kim",
      "department": "Engineering",
      "consecutive_overload_weeks": 3,
      "current_utilization_pct": 115.0,
      "tight_deadlines_count": 4,
      "operational_risk_index": 0.88
    }
  ]
}
```

#### `POST /api/v1/seed/synthetic-data`
- **Role**: `admin`
- **Description**: Seeds the organization with a realistic synthetic demonstration dataset (20 profiles, 50 skills, 8 projects, 40+ tasks).
- **Response `201 Created`**:
```json
{
  "message": "Synthetic dataset created successfully.",
  "counts": {
    "profiles": 20,
    "skills": 50,
    "projects": 8,
    "tasks": 42
  }
}
```
