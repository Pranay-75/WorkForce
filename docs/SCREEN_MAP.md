# WorkForce - Screen & Route Map

This document inventories all screens, user interfaces, navigation paths, and access permissions across the WorkForce web application.

---

## 1. Master Route & Role Access Matrix

| Route | Page Name | Admin / HR | Manager | Employee | Primary Capabilities |
|---|---|:---:|:---:|:---:|---|
| `/auth/login` | Login | Public | Public | Public | Email/Password login, Quick-Role Demo switcher. |
| `/auth/register` | Register | Public | - | - | Create new organization & initial admin account. |
| `/dashboard` | Dashboard | Read | Read | Read | Role-adaptive dashboard (Org view vs Personal view). |
| `/employees` | Employee Directory | Read / Write | Read | Read | Filterable list of employees, status, load badges. |
| `/employees/[id]` | Employee Profile | Read / Write | Read | Self (Read) | Skill radar, capacity meter, assigned tasks, history. |
| `/skills` | Skill Taxonomy | Read / Write | Read | Read | Skill list by category, proficiency requirements. |
| `/projects` | Project Portfolio | Read / Write | Read / Write | Read | Project status, timeline progress, team overview. |
| `/projects/[id]` | Project Board | Read / Write | Read / Write | Read (Self) | Kanban board & Table views of project tasks. |
| `/tasks/[id]` | Task Details | Read / Write | Read / Write | Status Update | Task info, required skills, assignment trigger. |
| `/tasks/[id]/recommendations` | AI Matching Hub | Read / Write | Read / Write | - | Ranked candidate cards, AI rationale, Approve/Reject. |
| `/workload` | Capacity Monitor | Read | Read | - | Team & department capacity heatmaps, overload alerts. |
| `/workload/redistribution` | Balancing Sandbox | Read / Write | Read / Write | - | AI load rebalancing proposals, before/after preview. |
| `/insights` | Employee Insights | Read | Read | - | Velocity trends, operational burnout risk matrix. |
| `/reports` | Reports | Read | Read | - | Capacity utilization reports, AI acceptance rate. |
| `/audit` | Audit History | Read | - | - | Immutable compliance log of all system actions. |
| `/notifications` | Notifications | Read / Write | Read / Write | Read / Write | In-app notification center and alert triage. |
| `/settings` | Organization Settings| Read / Write | - | - | Org profile, synthetic dataset seeding/resetting. |

---

## 2. Screen Specifications & Layout Structure

### 2.1 Navigation & Shell Layout
- **Global Header**: Organization switcher, active role indicator, global search (`Cmd+K`), notification bell with unread count, user profile dropdown (with Quick Demo Role Switcher).
- **Sidebar Navigation**:
  - *Main*: Dashboard, Employees, Skills, Projects, Workload Capacity.
  - *Intelligence*: AI Matching, Workload Balancing, Insights & Risk.
  - *Governance*: Reports, Audit Log, Settings.

---

### 2.2 Detailed Screen Breakdown

#### 1. `/dashboard` - Role-Adaptive Dashboard
- **Admin/Manager View**:
  - *Metrics Row*: Total Active Projects, Org Utilization Rate (%), High-Risk Overloaded Staff count, Pending AI Approvals count.
  - *Capacity Overview Chart*: Utilization breakdown by department (Engineering, Design, QA).
  - *Action Queue*: Pending AI recommendations awaiting manager sign-off.
  - *Critical Alerts*: Overdue tasks and high-load warnings.
- **Employee View**:
  - *Personal Load Meter*: Weekly allocated hours (e.g., 32h / 40h) with visual progress ring.
  - *My Tasks*: Grouped into "Due Today", "In Progress", "Up Next".
  - *Quick Status Actions*: Move task from `todo` to `in_progress` or `completed`.

#### 2. `/employees` & `/employees/[id]` - Employee Directory & Profiles
- **Directory (`/employees`)**:
  - Filter bar: Department, Skill, Capacity Status (`Available`, `Optimal`, `Overloaded`).
  - Employee cards/table: Avatar, Full Name, Title, Primary Skills, Current Utilization % badge.
- **Profile (`/employees/[id]`)**:
  - Header: Role, Department, Contact, Weekly Capacity baseline (e.g. 40h/wk).
  - Skill Matrix: Tagged skills with proficiency badges (`beginner` to `expert`).
  - Workload History: 8-week utilization trend line chart.
  - Active Tasks: Table of all ongoing assigned tasks with remaining hours.

#### 3. `/skills` - Skill Taxonomy Management
- Categorized accordion (e.g., Frontend, Backend, Cloud, Management).
- Skill creation modal: Name, Category, Default proficiency criteria.
- Usage counter: Number of employees and tasks tagged with each skill.

#### 4. `/projects` & `/projects/[id]` - Project Portfolio & Kanban Board
- **Portfolio (`/projects`)**:
  - Project health indicators (On Track, At Risk, Delayed).
  - Progress bar based on completed vs total task hours.
- **Project Detail (`/projects/[id]`)**:
  - View switcher: **Kanban Board** (`Todo`, `In Progress`, `In Review`, `Completed`) or **Table View**.
  - Task Card: Priority badge, due date, required skill chips, assignee avatar, and estimated hours.
  - Quick action: "Find Match with AI" button on unassigned tasks.

#### 5. `/tasks/[id]/recommendations` - Explainable AI Matching Hub
- **Task Summary Header**: Title, description, priority, estimated hours, deadline, and required skills.
- **Candidate Comparison Grid**: Top 3–5 candidate cards ranked by composite score.
  - *Score Breakdown*: Skill Overlap (40%), Capacity Availability (40%), Deadline Feasibility (20%).
  - *AI Explainability Callout*: Natural-language explanation generated by Gemini outlining why this person was selected and any trade-offs.
  - *Load Impact Simulator*: Visual bar showing "Current Load: 28h" -> "After Assignment: 36h (90% capacity)".
- **Action Bar**:
  - "Approve & Assign" (Green primary button).
  - "Reject Recommendation" (Opens reason modal: "Skill mismatch", "Other priority", "Custom note").
  - "Manual Override" (Pick any other employee).

#### 6. `/workload` & `/workload/redistribution` - Capacity Monitor & Balancing
- **Capacity Monitor (`/workload`)**:
  - Team workload bar charts with color bands:
    - *Under-utilized* (<50% load, Slate/Blue).
    - *Optimal* (50%–90% load, Emerald/Green).
    - *Near Capacity* (90%–100% load, Amber/Yellow).
    - *Overloaded* (>100% load, Rose/Red).
  - Filter by department, project, and time horizon.
- **Redistribution Sandbox (`/workload/redistribution`)**:
  - Side-by-side diff view:
    - **Before**: Overloaded team members highlighted in red.
    - **Proposed Changes**: AI suggestions to transfer 2-3 specific tasks to optimal team members.
    - **After Preview**: Simulated balanced team capacity.
  - One-click "Execute Rebalance" with confirmation modal.

#### 7. `/insights` - Employee Performance & Operational Risk
- Velocity & completion rates by department.
- Operational Risk Matrix: Identifies workload congestion bottlenecks.
- Explicit ethical disclaimer badge: *"Risk scores reflect purely operational scheduling metrics and workload capacity, not clinical or psychological assessments."*

#### 8. `/audit` - Compliance & Audit History
- Filterable timeline: Date range, Actor, Action Type (`Task Assigned`, `AI Recommendation Approved`, `AI Recommendation Rejected`, `Workload Rebalanced`).
- Details drawer: JSON diff of changes and recorded manager rationale.

#### 9. `/settings` - Organization Settings & Synthetic Seeder
- Organization metadata and member management.
- **Demo Control Center**:
  - "Seed Synthetic Demo Data": Instantly creates 20 employees, 50 skills, 8 projects, 45 tasks with realistic workload distributions.
  - "Reset Demo Workspace": Cleans demo records back to baseline.

---

## 3. UI State Handling Guidelines

Every screen and data component must implement 4 discrete visual states:
1. **Loading State**: Subtle pulsating skeleton placeholders matching the exact card/table geometry.
2. **Empty State**: Purposeful illustrations with friendly explanatory text and a clear primary call-to-action (e.g., "No tasks in this project yet. Create your first task or seed sample data.").
3. **Success State**: Non-blocking toast notifications and instant optimistic UI updates with green confirmation badges.
4. **Error State**: Actionable inline alert banners with retry buttons and explicit error codes (e.g., "Unable to fetch AI recommendations. Check network or click Retry.").
