# WorkForce - Product Specification (MVP)

## 1. Product Overview & Vision
**WorkForce** is an AI-augmented workforce management platform designed for modern engineering and operations teams. It eliminates guessing games in task delegation by combining deterministic capacity tracking with explainable, human-in-the-loop AI matching powered by Google Gemini.

### Core Value Propositions
1. **Explainable AI Matching**: Replaces arbitrary task assignment with data-backed, multi-factor scoring (skill fit, current workload, deadline risk).
2. **Deterministic Constraint Enforcement**: Hard constraints (skill requirements, maximum weekly capacity, availability) are strictly validated by backend logic.
3. **Human-in-the-Loop Control**: AI produces advisory recommendations. Managers retain 100% final approval authority.
4. **Transparent Risk Framing**: Heuristic workload warnings and deadline tightness indicators are framed as operational capacity metrics—never as psychological or clinical predictions.
5. **Turnkey Demonstration**: Instant one-click generation of rich, realistic synthetic data for live local and cloud demonstrations.

---

## 2. User Roles & Personas

### 2.1 Admin / HR Manager
- **Primary Goals**: Maintain the organizational structure, define the standard skill taxonomy, monitor overall company capacity, review audit compliance, and configure organizational settings.
- **Key Permissions**:
  - Full CRUD on organizations, employees, departments, and skills.
  - Global view of capacity heatmaps and company-wide audit trails.
  - Trigger synthetic data seeding/resetting for demonstration environments.

### 2.2 Project Manager / Team Lead
- **Primary Goals**: Deliver projects on time by assembling project teams, defining tasks with skill requirements, reviewing AI candidate recommendations, approving task assignments, and rebalancing overloaded team members.
- **Key Permissions**:
  - Manage projects and tasks within their scope.
  - Request AI matching for unassigned tasks.
  - Accept, reject, or override AI recommendations with recorded rationale.
  - Run workload redistribution simulations and execute rebalancing.
  - View employee performance trends and operational risk indicators.

### 2.3 Employee / Contributor
- **Primary Goals**: View assigned tasks, track personal workload and deadlines, log task progress, and view their verified skill profile.
- **Key Permissions**:
  - View their assigned projects and tasks.
  - Update task progress statuses (`todo` -> `in_progress` -> `in_review` -> `completed`).
  - View personal capacity utilization and profile.
  - Cannot access administrative audit logs, executive reports, or other team members' private metrics.

---

## 3. Core MVP User Journeys

### Journey 1: Onboarding & Skill Taxonomy Setup (Admin/HR)
1. Admin registers the organization and logs into WorkForce.
2. Admin navigates to **Skills** and establishes core technical and domain skills categorized by domain (e.g., Frontend, Backend, UI/UX, Cloud, Data).
3. Admin adds/invites team members or populates the workspace via the **One-Click Synthetic Seeder**.
4. Admin assigns skill proficiency levels (`beginner`, `intermediate`, `advanced`, `expert`) to employees.

### Journey 2: Project & Task Creation with Requirements (Manager)
1. Manager creates a new project (e.g., "Customer Portal Redesign") with start and target completion dates.
2. Manager creates tasks specifying:
   - Estimated effort (hours).
   - Priority (`low`, `medium`, `high`, `critical`).
   - Hard deadline.
   - Required skills with minimum proficiency levels.

### Journey 3: Explainable AI Matching & Manager Approval (Manager)
1. Manager opens an unassigned task and clicks **Find Best Match**.
2. FastAPI backend deterministically filters available employees, computes base overlap and capacity delta, and invokes Gemini for contextual reasoning.
3. Manager sees a ranked list of candidate cards showing:
   - **Composite Match Score** (0–100%).
   - **Skill Fit Breakdown** (matched vs. missing skills).
   - **Workload Impact** (current load + task hours vs. weekly capacity).
   - **AI Explainability Rationale** (why this candidate fits and potential scheduling caveats).
4. Manager clicks **Approve & Assign** (or **Reject with Reason**).
5. The task status updates, the employee's active load increases, an audit event is logged, and a notification is dispatched to the assignee.

### Journey 4: Task Execution & Progress Tracking (Employee)
1. Employee logs in and arrives at their personal **Employee Dashboard**.
2. Employee reviews assigned tasks prioritized by deadline and urgency.
3. Employee updates task status to `in_progress`, then `completed`.
4. As tasks complete, the employee's active workload hours automatically decrease, freeing up weekly capacity.

### Journey 5: Workload Monitoring & Proactive Redistribution (Manager)
1. Manager visits the **Workload Capacity Monitor** and spots an employee flagged as **Over-Allocated** (>100% capacity).
2. Manager enters the **Workload Redistribution Sandbox**.
3. The system proposes moving non-critical tasks to under-utilized team members with matching skills.
4. Manager inspects the before-and-after capacity comparison diff and clicks **Apply Redistribution**.
5. Tasks are atomically reassigned and logged in the immutable audit history.

---

## 4. MVP Functional Scope Boundaries

| Feature Module | In MVP Scope | Deferred to Post-MVP |
|---|---|---|
| **Authentication & Tenancy** | Email/Password, Demo switch, Multi-Tenant RLS | SAML SSO, Google Workspace Auth, SCIM |
| **Skill Management** | Admin/Manager defined skill matrix with 4 levels | Peer endorsements, automated GitHub/Jira skill parsing |
| **Task Management** | Kanban board, priority, due dates, hours estimate | Recurring recurring tasks, Gantt dependencies, sub-tasks |
| **Capacity Tracking** | Weekly hours vs. allocated active tasks | Official PTO/Holiday calendar integrations |
| **AI Matching** | Gemini structured ranking + deterministic scoring | Fully autonomous auto-assignment without human review |
| **Redistribution** | Multi-candidate visual sandbox with before/after diff | Multi-project integer programming global optimization |
| **Reporting & Audit** | In-app audit log, capacity summary, CSV export | Scheduled automated email digests, PDF executive briefs |
| **Notifications** | In-app notification bell & toast alerts | Slack / Microsoft Teams webhook integrations |

---

## 5. Unresolved Decisions & Open Product Questions

1. **Capacity Reset Cadence**: Currently, capacity is calculated dynamically based on all active (non-completed) task hours scheduled within the current work week. *Decision needed for v1.1*: Support rolling sprint cycles (e.g. 2-week sprints) vs. weekly calendar resets.
2. **Skill Verification Workflow**: In MVP, Managers and Admins can assign and verify skills directly. *Decision needed for v1.1*: Allow employees to self-request skill updates subject to manager approval.
