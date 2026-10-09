# WorkForce - Acceptance Tests, Seed Requirements & Deployment Checklist

This document details the observable end-to-end verification suite, synthetic seed data parameters, deployment checklists, and testing protocols for WorkForce.

---

## 1. Observable End-to-End Acceptance Tests

These scenarios test the complete lifecycle of workforce management from organization setup to audit verification.

### Scenario 1: Organization & Employee Setup
- **Given**: An authenticated Admin on the `/settings` or `/employees` screen.
- **When**: The Admin creates an employee named *"Jordan Lee"* with Title *"Senior Backend Engineer"*, Department *"Engineering"*, and `weekly_capacity_hours` set to `40.0`.
- **Then**: 
  - The employee profile is created under the organization.
  - The new employee appears immediately in the `/employees` directory with an initial load badge (`0h / 40h`).

### Scenario 2: Skill Assignment & Proficiency Tagging
- **Given**: The created employee *"Jordan Lee"*.
- **When**: The Admin navigates to `/employees/[id]` and assigns skills: `Python` (expert), `FastAPI` (advanced), `PostgreSQL` (advanced).
- **Then**: 
  - `employee_skills` records 3 entries with corresponding proficiency levels.
  - The employee's skill matrix refreshes with verified badges.

### Scenario 3: Project & Task Creation with Skill Constraints
- **Given**: An authenticated Manager on `/projects`.
- **When**: The Manager creates a project *"Payment Gateway v2"* and creates a task:
  - Title: *"Build Stripe Webhook Handler"*
  - Estimated Effort: `10.0 hours`
  - Due Date: `Friday at 17:00 UTC`
  - Priority: `High`
  - Required Skills: `Python` (advanced), `FastAPI` (intermediate)
- **Then**: 
  - Task is stored in `tasks` with status `todo` and `task_skills` linked.
  - Task card appears in the project's Kanban `Todo` column marked as *Unassigned*.

### Scenario 4: AI-Powered Candidate Matching
- **Given**: The unassigned task *"Build Stripe Webhook Handler"*.
- **When**: The Manager clicks **Find Match with AI** (invoking `/matching`).
- **Then**: 
  - Backend deterministically computes skill overlap and capacity delta.
  - Gemini API generates a human-readable explanation and risk analysis.
  - The UI displays candidate cards with top candidates ranked by composite score (>90%), highlighting matching skills and projected load.

### Scenario 5: Manager Review & Approval
- **Given**: The ranked recommendation card for Priya Patel / Jordan Lee.
- **When**: The Manager clicks **Approve & Assign**.
- **Then**: 
  - `ai_recommendations` status is updated to `accepted`.
  - Task is assigned and moves to `in_progress`.
  - The employee's `current_load_hours` automatically increases proportionally.
  - An entry is added to `audit_events` recording the manager's approval.
  - An in-app notification is dispatched.

### Scenario 6: Employee Progress & Status Lifecycle
- **Given**: Employee logged into `/dashboard`.
- **When**: Employee advances the task from `Todo` to `In Progress`, `In Review`, and `Completed`.
- **Then**: 
  - Status updates in the Kanban board.
  - Upon moving to `Completed`, active workload is freed.
  - Project completion progress bar advances proportionally.

### Scenario 7: Workload Redistribution Preview & Execution
- **Given**: An employee with >100% capacity (David Kim at 46h/40h) and an available teammate (Sarah Connor / Priya Patel).
- **When**: The Manager opens `/workload` and clicks **Apply Redistribution**.
- **Then**: 
  - Selected task is transferred.
  - Before/After capacity bars reflect the balanced state.
  - An immutable audit event is recorded.

### Scenario 8: Audit Trail & Compliance Verification
- **Given**: An authenticated Admin on `/audit`.
- **When**: Filtering audit events.
- **Then**: 
  - Displays chronological records for: Task Created, AI Match Approved, Status Changed, and Redistribution Executed.

---

## 2. Phase 1 UI Acceptance Verification Results

| Verification Area | Requirement | Status | Verification Notes |
|---|---|:---:|---|
| **Role Navigation: Admin/HR** | Full administrative and governance routes | **Passed** | Verified: Access to Dashboard, Employees, Projects, Tasks, Reports, Audit Logs, Settings. |
| **Role Navigation: Manager** | Team capacity and matching workflows | **Passed** | Verified: Access to Dashboard, Employees, Projects, Tasks, AI Recommendations, Workload, Insights, Reports, Notifications. |
| **Role Navigation: Employee** | Personal load and assigned deliverables | **Passed** | Verified: Access to Personal Dashboard (load meter + my active tasks), Projects, Tasks, Notifications. |
| **Demo Role Switcher** | Quick identity toggle with clear labeling | **Passed** | Interactive dropdown in header (`Sarah Connor [Mgr]`, `Chloe Dubois [Admin]`, `Alex Chen [Emp]`). Labeled as simulated demo. |
| **Search, Filters & Sorting** | Instant reactive table & directory filters | **Passed** | Verified on `/employees`, `/tasks`, `/projects`, `/audit`. |
| **Interactive Modals** | Accessible dialogs with Escape listener | **Passed** | Add Employee modal, Create Task modal, Reject Reason modal, and Reset Data confirmation modal all verified. |
| **Layout Usability** | Mobile drawer + Desktop expanded shell | **Passed** | Responsive layout verified across all 15 routes. |
| **Production Build Check** | Zero build or TypeScript errors | **Passed** | `npm run build` compiled 15/15 routes in 3.7s with zero errors. |

---

## 3. Pre-Deployment Verification Checklist (Phase 2 Target)

- [x] **Frontend Polish & Shell**:
  - Next.js production build (`npm run build`) compiles cleanly with zero TypeScript errors.
  - Loading skeletons, empty states, and error alerts present on all routes.
- [ ] **Environment Security**:
  - `.env.example` created in `frontend/` and `backend/` with all non-secret keys documented.
  - Zero hardcoded secrets, JWT keys, or API tokens committed in source control.
- [ ] **Database & RLS Integrity**:
  - All migrations applied cleanly in Supabase.
  - RLS enabled on all 11 tables.
  - Verified cross-organization data isolation.
- [ ] **Backend Test Suite**:
  - Deterministic capacity calculation unit tests pass.
  - FastAPI mock tests for Gemini prompt parsing pass with structured JSON validation.
  - Supabase JWT authentication middleware verified.
- [ ] **Cloud Deployment**:
  - Frontend deployed to Vercel with production environment variables set.
  - Backend deployed to Render / Railway with CORS configured for the Vercel domain.
