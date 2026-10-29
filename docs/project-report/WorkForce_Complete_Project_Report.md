# WorkForce — AI-Powered Workforce Management Platform
## Complete Technical Documentation, Architecture Specification & User Guide

**Document Reference**: WF-DOC-2026-v1.0  
**Repository**: [Pranay-75/WorkForce](https://github.com/Pranay-75/WorkForce)  
**Production Web Platform**: [https://workforce-platform.vercel.app](https://workforce-platform.vercel.app)  
**Date of Release**: October 2026  
**Authors**: WorkForce Engineering Team & System Architects  
**Target Audience**: Academic Viva Evaluators, Technical Assessors, Enterprise IT Leaders, Contributing Software Engineers, and Operations Managers  

---

## Table of Contents

1. [Chapter 1 — Executive Summary](#chapter-1--executive-summary)
2. [Chapter 2 — Problem Statement and Proposed Solution](#chapter-2--problem-statement-and-proposed-solution)
3. [Chapter 3 — Complete Feature Documentation](#chapter-3--complete-feature-documentation)
4. [Chapter 4 — User Roles and Permissions](#chapter-4--user-roles-and-permissions)
5. [Chapter 5 — Technology Stack: What Is Used and Why](#chapter-5--technology-stack-what-is-used-and-why)
6. [Chapter 6 — System Architecture](#chapter-6--system-architecture)
7. [Chapter 7 — Database Design and Schema Specifications](#chapter-7--database-design-and-schema-specifications)
8. [Chapter 8 — Authentication, Authorization and Security Architecture](#chapter-8--authentication-authorization-and-security-architecture)
9. [Chapter 9 — Artificial Intelligence and Algorithmic Matching](#chapter-9--artificial-intelligence-and-algorithmic-matching)
10. [Chapter 10 — Demo Mode vs Live Production Mode](#chapter-10--demo-mode-vs-live-production-mode)
11. [Chapter 11 — Complete Platform User Manual](#chapter-11--complete-platform-user-manual)
12. [Chapter 12 — Installation, Local Development and Deployment Setup](#chapter-12--installation-local-development-and-deployment-setup)
13. [Chapter 13 — Testing, Verification and Quality Assurance](#chapter-13--testing-verification-and-quality-assurance)
14. [Chapter 14 — Production Deployment, CI/CD and DevOps](#chapter-14--production-deployment-cicd-and-devops)
15. [Chapter 15 — Comprehensive Frequently Asked Questions (FAQs)](#chapter-15--comprehensive-frequently-asked-questions-faqs)
16. [Chapter 16 — Limitations, Technical Debt, Risks and Future Roadmap](#chapter-16--limitations-technical-debt-risks-and-future-roadmap)
17. [Chapter 17 — Technical Glossary, Acronyms and References](#chapter-17--technical-glossary-acronyms-and-references)

---

# Chapter 1 — Executive Summary

### 1.1 Project Overview
**WorkForce** is an enterprise-grade, multi-tenant software-as-a-service (SaaS) platform engineered to solve the chronic inefficiencies, lack of capacity visibility, and unscientific task delegation inherent in modern technical organisations. Combining a modern Next.js 15 App Router frontend, a high-performance Python FastAPI backend, and an immutable Supabase PostgreSQL database governed by Row-Level Security (RLS), WorkForce bridges the gap between organizational resource management and transparent, explainable task allocation.

Unlike traditional project management applications (such as Jira, Trello, or Asana) that function primarily as administrative ticket logs without insight into individual human bandwidth, WorkForce treats **workforce capacity** as a first-class mathematical constraint. The platform continuously monitors allocated task hours against defined weekly limits, flags operational overload before deadlines are compromised, and provides human-in-the-loop candidate recommendations driven by composite skill matching and availability heuristics.

### 1.2 Purpose and Objectives
The core objectives of the WorkForce initiative are:
1. **Eliminate Arbitrary Task Delegation**: Replace subjective "who has time" guessing games with verifiable multi-factor scoring combining verified skill prerequisites, departmental alignment, and projected weekly utilization.
2. **Prevent Team Burnout Deterministically**: Establish hard operational capacity thresholds (e.g. 40 hours/week) and compute real-time workload deltas across active deliverables, providing visual warnings and rebalancing tools.
3. **Guarantee Multi-Tenant Data Isolation**: Implement zero-trust security at the PostgreSQL database layer using Row-Level Security (RLS) policies and security-definer Remote Procedure Calls (RPCs), ensuring complete data partitioning across competing enterprise workspaces.
4. **Preserve Human Agency via Explainable AI**: Ensure that automated recommendations remain strictly advisory. Managers retain 100% final approval authority, and every proposal is accompanied by clear, auditable reasoning rather than opaque black-box scores.
5. **Provide Turnkey Demonstration Capability**: Offer a zero-setup, self-contained interactive simulation (`/presentation` and demo switchers) that enables instant academic evaluation, sales walk-throughs, and technical viva examinations without configuring external cloud services.

### 1.3 Target Users and Operational Roles
WorkForce is tailored for five distinct user personas across knowledge-work organisations:
- **Workspace Organizers (Founders / Super Admins)**: Responsible for primary organizational bootstrapping, tenant ownership, subscription governance, and delegated administration.
- **Organization Administrators**: Responsible for workforce compliance, team roster invitations, administrative promotions, skill taxonomy governance, and immutable audit review.
- **Project Managers & Team Leads**: Responsible for initiative delivery, task decomposition, skill prerequisite definition, AI recommendation review, and workload redistribution.
- **Human Resources & Talent Operations**: Responsible for organizational capacity monitoring, departmental headcount distribution, talent utilization analysis, and CSV reporting.
- **Individual Contributors & Employees**: Responsible for tracking assigned deliverables, updating execution statuses (`todo` $\rightarrow$ `in_progress` $\rightarrow$ `in_review` $\rightarrow$ `completed`), and maintaining verified personal skill profiles.

### 1.4 Problems Solved
- **The "Spreadsheet Chaos" of Resource Allocation**: Eliminates fragmented, un-synchronized spreadsheets typically maintained by project managers to track who is working on what.
- **Hidden Team Overload**: Surfaces silent over-allocation where employees take on deliverables across multiple projects without cross-team visibility.
- **Skill Mismatching**: Prevents assigning complex engineering deliverables to personnel lacking prerequisite competencies.
- **Privilege Tampering**: Prevents malicious or accidental privilege elevation through database-enforced role invariants and trigger safeguards.

### 1.5 Main Measurable Benefits
- **Deterministic Workload Visibility**: Real-time aggregation of active deliverable hours across all organizational initiatives.
- **Zero-Trust Privilege Enforcement**: 100% server-side and database-level authorization preventing client-side spoofing.
- **Rapid Decision Support**: Instant ranking of available personnel for unassigned tasks, cutting candidate evaluation time from hours to seconds.
- **Audit Compliance**: Complete, immutable tracking of every administrative promotion, task assignment, and recommendation decision.

### 1.6 Current Implementation Status
The WorkForce codebase is in an active, verified operational state:
- **Production Web Deployment**: Live and fully accessible at [https://workforce-platform.vercel.app](https://workforce-platform.vercel.app).
- **Frontend Architecture**: Next.js 15.5.27 App Router with React 19, TypeScript, and Tailwind CSS. All 24 static and dynamic routes compile cleanly with zero errors (`npm run build`).
- **Backend Architecture**: Python 3.14 / FastAPI service implementing cryptographic HS256/RS256 JWT decoding, JWKS key caching, and role dependency injection. 33 automated pytest test suites pass with 100% success.
- **Database Architecture**: Supabase PostgreSQL featuring 8 SQL migrations, composite foreign keys, transactional preflight checks, security-definer RPCs, and automated triggers.

---

# Chapter 2 — Problem Statement and Proposed Solution

### 2.1 The Crisis of Manual Workforce Management
In modern technology, consulting, and engineering organisations, human talent represents both the primary driver of value and the largest operational expenditure. Despite this reality, the methodologies used to allocate deliverables, balance workloads, and track capacity remain astonishingly primitive.

#### Key Deficiencies in Current Industry Practices:
1. **Opaque Multi-Project Allocation**: When engineers contribute across multiple cross-functional squads, no single project manager has a consolidated view of their total commitments. A developer assigned 25 hours on Project Alpha and 20 hours on Project Beta is operating at 45 hours (112.5% capacity), leading to inevitable delivery slippages.
2. **Subjective Task Delegation**: Deliverables are frequently delegated based on recency bias, personal relationships, or vocal availability rather than verified technical competencies.
3. **Black-Box Project Management Tools**: Mainstream platforms (e.g., Jira, Asana) function as transactional task trackers. They record that a task exists and who owns it, but possess no architectural understanding of whether the assignee has the requisite skill levels or available weekly bandwidth.
4. **Disjointed Skill Inventories**: Human resource databases (HRIS) store static skill lists that are never linked to real-time project ticket queues.
5. **Reactive Burnout Management**: Team member over-allocation is typically identified only after deadlines are missed, code quality degrades, or valued employees resign.

### 2.2 The WorkForce Architectural Solution
WorkForce fundamentally reconceives workforce management by transforming capacity and competency into **deterministic computational parameters**.

```
+-----------------------------------------------------------------------------------+
|                            THE WORKFORCE PARADIGM                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|   +-----------------------+     +----------------------+     +----------------+   |
|   |  Verified Skills      |     |  Weekly Capacity     |     |  Active Task   |   |
|   |  (Beginner -> Expert) |     |  (e.g., 40.00 Hours) |     |  Estimates     |   |
|   +-----------+-----------+     +----------+-----------+     +-------+--------+   |
|               |                            |                         |            |
|               +--------------------+       |       +-----------------+            |
|                                    v       v       v                              |
|                          +----------------------------------+                     |
|                          |    Deterministic Gating Engine   |                     |
|                          |  (Filtered by DB Constraints)    |                     |
|                          +-----------------+----------------+                     |
|                                            |                                      |
|                                            v                                      |
|                          +----------------------------------+                     |
|                          |    Explainable Advisory Engine   |                     |
|                          |  (Skill Fit + Workload Headroom) |                     |
|                          +-----------------+----------------+                     |
|                                            |                                      |
|                                            v                                      |
|                          +----------------------------------+                     |
|                          |   Human-in-the-Loop Sign-Off     |                     |
|                          |   (Manager Approve / Reject)     |                     |
|                          +-----------------+----------------+                     |
|                                            |                                      |
|                                            v                                      |
|                          +----------------------------------+                     |
|                          |    PostgreSQL Level-1/2 Locking  |                     |
|                          |    & Immutable Audit Recording   |                     |
|                          +----------------------------------+                     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

#### Core Solution Pillars:
1. **Mathematical Capacity Gating**: Every user profile possesses a verified `weekly_capacity_hours` attribute (defaulting to 40.00 hours). Every task requires an `estimated_hours` parameter. Active workload is calculated by summing all non-completed task hours within the current cycle.
2. **Deterministic Pre-Filtering**: Before any candidate ranking occurs, hard constraints are evaluated:
   - Does the candidate belong to the same verified organization?
   - Is the candidate's membership status `active`?
   - Does the candidate possess the required skills at or above the minimum proficiency?
3. **Explainable Multi-Factor Scoring**: Candidate scores (0–100%) are computed using a reproducible formula balancing capacity availability (50%) and skill overlap (50%), supplemented by natural-language rationale explaining why a candidate is suitable and highlighting scheduling risks.
4. **Mandatory Human Agency**: AI suggestions cannot directly modify database state. A manager must explicitly execute the `assign_task` action, recording their decision in the compliance audit trail.
5. **Proactive Workload Rebalancing**: When team members exceed 100% capacity, the system automatically detects movable non-critical tasks and identifies under-utilized colleagues with compatible competencies, providing a visual diff sandbox before applying reassignments.

---

# Chapter 3 — Complete Feature Documentation

This chapter catalogues every capability present in the verified WorkForce codebase.

### 3.1 Authentication, Onboarding & Workspace Initialization

#### Feature 3.1.1: Multi-Strategy Secure Authentication
- **Purpose**: Authenticate enterprise users securely while supporting local development, cross-device email confirmations, and instant demo explorations.
- **Intended Users**: All user roles.
- **Access Route**: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`.
- **Implementation Status**: **Fully Implemented**.
- **Internal Mechanics**:
  - Employs Supabase GoTrue Auth for credential verification.
  - Implements three authentication callback flows in `frontend/app/auth/callback/route.ts`:
    1. **Mobile / Cross-Device OTP**: Token hash and type verification (`supabase.auth.verifyOtp`) bypassing PKCE browser cookie dependencies.
    2. **PKCE Code Exchange**: Standard single-browser authorization code exchange (`supabase.auth.exchangeCodeForSession`).
    3. **Implicit Hash Fallback**: Static client-side bridge that captures `#access_token=...` from URL fragments and performs a secure same-origin `POST /auth/callback` to set HTTP-only cookies.
- **Security Safeguards**: Strict regex validation on redirect paths (`SAFE_RELATIVE_PATH_REGEX`) neutralizing scheme-relative (`//evil.com`) and path-confusion (`\evil.com`) open redirects.
- **Source Files**:
  - `frontend/app/login/page.tsx`
  - `frontend/app/register/page.tsx`
  - `frontend/app/auth/callback/route.ts`
  - `frontend/lib/authContext.tsx`
  - `frontend/lib/supabase/client.ts`, `server.ts`, `middleware.ts`

#### Feature 3.1.2: Atomic Organization Bootstrapping
- **Purpose**: Enable newly registered users to initialize their primary enterprise workspace without race conditions or orphan profiles.
- **Intended Users**: Prospective Workspace Organizers.
- **Access Route**: `/onboarding`.
- **Implementation Status**: **Fully Implemented**.
- **User Workflow**:
  1. User registers and confirms email.
  2. Navigates to `/onboarding`.
  3. Enters organization name (e.g., "Acme Systems Engineering").
  4. System generates or validates a URL slug conforming to `^[a-z0-9]+(-[a-z0-9]+)*$`.
  5. User clicks **Create Workspace**.
  6. Backend invokes PostgreSQL security-definer RPC `create_organization_with_admin(p_name, p_slug)`.
  7. Organization and initial `organizer` membership are created atomically.
  8. User is redirected to `/dashboard`.
- **Source Files**:
  - `frontend/app/onboarding/page.tsx`
  - `frontend/lib/slug.ts`
  - `supabase/migrations/20261010000001_initial_auth_schema.sql`
  - `supabase/migrations/20261021000001_add_organizer_role.sql`

#### Feature 3.1.3: Deterministic Multi-Tenant Workspace Switching
- **Purpose**: Support users belonging to multiple organizations while strictly isolating active sessions and preventing cross-tenant leakage.
- **Intended Users**: Users with multiple organization memberships.
- **Access Route**: Application Header workspace switcher dropdown.
- **Implementation Status**: **Fully Implemented**.
- **Business Logic**:
  - When a user has exactly one active membership, the system selects it automatically.
  - When a user has multiple active memberships and no explicit selection is stored, the system **fails closed**: `organization` is set to `null` and `hasAmbiguousMembership` is set to `true`, prompting explicit workspace selection.
  - Stored selections in `localStorage` (`workforce_active_org_id`) are validated against verified database memberships on every session refresh.
- **Source Files**:
  - `frontend/lib/authContext.tsx` (Lines 160–258)
  - `frontend/components/layout/AppHeader.tsx`

---

### 3.2 Role-Adaptive Executive Dashboards

#### Feature 3.2.1: Dynamic Dashboard Personalization
- **Purpose**: Render customized operational cockpits tailored specifically to the privileges and information requirements of each role.
- **Intended Users**: Organizer, Admin, Manager, HR, Employee.
- **Access Route**: `/dashboard`.
- **Implementation Status**: **Fully Implemented**.
- **Role-Specific Views**:
  1. **Organizer View**: Focuses on workspace ownership, founder badge, invitation controls, department allocations, and executive tool shortcuts.
  2. **Admin View**: Focuses on organizational governance, headcount totals, weekly bandwidth aggregation, active project teams, and recent immutable audit logs.
  3. **Manager / HR View**: Focuses on real-time team utilization, capacity distribution tiers (Overloaded, Near Limit, Optimal), active deliverables, and unassigned AI matching shortcuts.
  4. **Employee Portal**: Restricts visibility strictly to personal deliverables, personal weekly capacity utilization percentage, task review submissions, and verified personal skill matrices.
- **Source Files**:
  - `frontend/app/dashboard/page.tsx` (1,613 lines of role-differentiated UI)
  - `frontend/components/ui/MetricCard.tsx`
  - `frontend/components/ui/ProgressBar.tsx`

---

### 3.3 Employee Roster & Team Directory

#### Feature 3.3.1: Organizational Member Directory
- **Purpose**: Provide searchable, filterable visibility into organizational talent, departmental affiliations, and active workload commitments.
- **Intended Users**: Organizer, Admin, Manager, HR. (Access denied to standard Employees).
- **Access Route**: `/employees`, `/employees/[id]`.
- **Implementation Status**: **Fully Implemented**.
- **Capabilities**:
  - Search members by full name or email.
  - Filter by functional department (e.g., Engineering, Product, Design, Executive).
  - Filter by role (`organizer`, `admin`, `manager`, `hr`, `employee`).
  - Real-time computation of active load hours derived from non-completed deliverables.
- **Source Files**:
  - `frontend/app/employees/page.tsx`
  - `frontend/app/employees/[id]/page.tsx`
  - `frontend/lib/hooks/useOrganizationMembers.ts`

#### Feature 3.3.2: Cryptographic Member Invitations
- **Purpose**: Allow administrators to invite new colleagues into the workspace with designated roles while preventing privilege escalation.
- **Intended Users**: Organizer, Admin.
- **Access Route**: `/employees` $\rightarrow$ **Invite Member** dialog.
- **Implementation Status**: **Fully Implemented**.
- **Security Rules**:
  - Inviting an `admin` role via invitation is strictly forbidden by database check constraint `chk_org_invitations_role`. Administrative elevation must use dedicated promotion workflows.
  - Tokens are hashed using SHA-256 before storage (`token_hash`).
  - Invitations carry a mandatory 7-day expiration timestamp (`expires_at`).
  - Pending invitations cannot be claimed by unverified email accounts.
- **Source Files**:
  - `frontend/app/employees/page.tsx`
  - `supabase/migrations/20261014000002_member_invitations_and_roles.sql`
  - `supabase/migrations/20261014000005_invite_role_and_status_hardening.sql`

#### Feature 3.3.3: Sole Administrator Protection Trigger
- **Purpose**: Prevent accidental or malicious lockout of an organization by demoting, suspending, or deleting the last remaining active administrator.
- **Intended Users**: Database enforcement layer.
- **Implementation Status**: **Fully Implemented**.
- **Database Trigger**:
  - Function `protect_last_active_admin()` executes `BEFORE UPDATE OR DELETE` on `organization_memberships`.
  - Serializes transactions using `SELECT FOR UPDATE` on the parent `organizations` row to eliminate race conditions between concurrent demotions.
  - Raises PostgreSQL exception `42501` if an action would reduce active admin count below 1.
- **Source Files**:
  - `supabase/migrations/20261011000001_restrict_organization_creation.sql` (Lines 102–175)

---

### 3.4 Project Portfolio Management

#### Feature 3.4.1: Initiative Lifecycle Tracking
- **Purpose**: Group deliverables into coherent projects with defined timelines, managers, priorities, and aggregate budget hours.
- **Intended Users**: All roles (Full management for Manager/Admin; view-only for Employee).
- **Access Route**: `/projects`, `/projects/[id]`.
- **Implementation Status**: **Fully Implemented**.
- **Entity Attributes**:
  - `name`, `description`, `status` (`planning`, `in_progress`, `on_hold`, `completed`, `cancelled`).
  - `priority` (`low`, `medium`, `high`, `critical`).
  - `manager_id`: Must be an active member with `admin` or `manager` role (enforced via trigger `enforce_project_manager_eligibility`).
  - `start_date`, `target_end_date` (enforced via check constraint `target_end_date >= start_date`).
  - `total_hours`, `completed_hours`: Aggregated delivery metrics.
- **Composite Tenant Integrity**: Foreign key `(organization_id, manager_id)` references `organization_memberships(organization_id, user_id)`, preventing cross-tenant project assignment.
- **Source Files**:
  - `frontend/app/projects/page.tsx`
  - `frontend/app/projects/[id]/page.tsx`
  - `frontend/lib/hooks/useProjects.ts`
  - `supabase/migrations/20261014000001_projects_and_tasks_schema.sql`

#### Feature 3.4.2: Project Team Member Rostering
- **Purpose**: Allocate specific organization members to project initiatives.
- **Intended Users**: Organizer, Admin, Manager.
- **Access Route**: `/projects/[id]` $\rightarrow$ **Project Team Members** section.
- **Implementation Status**: **Fully Implemented**.
- **Database Table**: `project_members(project_id, user_id, organization_id)`.
- **Source Files**:
  - `frontend/app/projects/[id]/page.tsx`
  - `frontend/lib/hooks/useProjects.ts`

---

### 3.5 Task Management & Deliverables Tracking

#### Feature 3.5.1: Dual-View Task Manager (Kanban & Tabular)
- **Purpose**: Manage operational deliverables with visual workflow transitions and detailed tabular sorting.
- **Intended Users**: All roles.
- **Access Route**: `/tasks`, `/tasks/[id]`.
- **Implementation Status**: **Fully Implemented**.
- **Capabilities**:
  - Instant toggle between interactive Kanban board (4 columns: Todo, In Progress, In Review, Completed) and tabular data table.
  - Search by task title and description.
  - Filter by project and priority level.
  - Complexity indicators: `Low`, `Medium`, `High`.
  - Skill prerequisite badges indicating required proficiency levels.
- **Source Files**:
  - `frontend/app/tasks/page.tsx`
  - `frontend/app/tasks/[id]/page.tsx`
  - `frontend/lib/hooks/useTasks.ts`

#### Feature 3.5.2: Structured Skill Prerequisites (JSONB Validator)
- **Purpose**: Attach strict technical and domain skill requirements to tasks for use in candidate matching.
- **Intended Users**: Organizer, Admin, Manager.
- **Implementation Status**: **Fully Implemented**.
- **Technical Implementation**:
  - Tasks store prerequisites in a JSONB column `required_skills`.
  - PostgreSQL immutable function `validate_task_required_skills(p_skills jsonb)` validates array structure, non-empty `skillId` and `skillName`, and valid proficiency enum values (`beginner`, `intermediate`, `advanced`, `expert`).
- **Source Files**:
  - `supabase/migrations/20261014000001_projects_and_tasks_schema.sql` (Lines 84–137)

#### Feature 3.5.3: Controlled Task Assignment RPC
- **Purpose**: Assign or reassign deliverables to organization members while guaranteeing transaction safety, active membership, and concurrency synchronization.
- **Intended Users**: Organizer, Admin, Manager.
- **Implementation Status**: **Fully Implemented**.
- **Database Architecture**:
  - REST `UPDATE` on column `assigned_to` is explicitly stripped from public grants (`GRANT UPDATE (title, description, status...) ON tasks`).
  - Task assignment requires the security-definer RPC function `assign_task(p_task_id uuid, p_assignee_id uuid)`.
  - Implements **Level-1 then Level-2 locking protocol**: acquires `FOR SHARE` on `organization_memberships` first, verifies caller permissions and assignee active status, then updates `tasks.assigned_to`.
- **Source Files**:
  - `supabase/migrations/20261014000001_projects_and_tasks_schema.sql` (Lines 551–608)
  - `frontend/lib/hooks/useTasks.ts` (`assignTask`)

#### Feature 3.5.4: Employee Self-Service Status Updates with Immutability Guards
- **Purpose**: Allow assigned employees to update task progress while strictly preventing them from altering estimates, deadlines, or assignees.
- **Intended Users**: Employees.
- **Implementation Status**: **Fully Implemented**.
- **Database Trigger**:
  - Trigger `enforce_task_update_permissions()` runs `BEFORE UPDATE ON tasks`.
  - If caller is an `employee`, verifies that `OLD.assigned_to = auth.uid()`.
  - Enforces that all metadata fields (`title`, `estimated_hours`, `due_date`, `priority`, `complexity`, `required_skills`, `assigned_to`) remain identical. If any field other than `status` is touched, raises error `42501: Employees may only update task status.`
- **Source Files**:
  - `supabase/migrations/20261014000001_projects_and_tasks_schema.sql` (Lines 462–550)

---

### 3.6 Explainable AI Task Matching Hub

#### Feature 3.6.1: Multi-Factor Candidate Scoring & Ranking
- **Purpose**: Recommend the most suitable team members for unassigned deliverables based on availability and competency.
- **Intended Users**: Organizer, Admin, Manager, HR.
- **Access Route**: `/matching`.
- **Implementation Status**: **Partially Implemented** (Client-side heuristic scoring in Live Mode; precomputed rich Gemini rationale in Demo Mode).
- **Scoring Formula**:
  $$\text{Capacity Score} = \max(0, 100 - \min(\text{Projected Utilization \%}, 100))$$
  $$\text{Skill Score} = \begin{cases} \left(\frac{\text{Matched Skills Count}}{\text{Required Skills Count}}\right) \times 100 & \text{if requirements exist} \\ 85 & \text{otherwise} \end{cases}$$
  $$\text{Composite Match Score} = \text{clamp}(10, 99, \text{round}(0.5 \times \text{Capacity Score} + 0.5 \times \text{Skill Score}))$$
- **Candidate Ranking Card Elements**:
  - Composite Match Score badge (0–100%).
  - Skill fit breakdown (matched vs. missing skills).
  - Workload impact projection (current load + task hours vs. weekly capacity).
  - Explainable rationale text and risk indicators (e.g. "Projected load exceeds 40h weekly capacity").
  - Manager Action buttons: **Approve & Assign** or **Reject with Reason**.
- **Source Files**:
  - `frontend/app/matching/page.tsx`
  - `frontend/lib/mockData.ts` (`initialAIRecommendations`)

---

### 3.7 Workload Monitoring & Dynamic Redistribution

#### Feature 3.7.1: Workload Capacity Monitor & Heatmap
- **Purpose**: Detect team member overload and display capacity headroom across the organization.
- **Intended Users**: Organizer, Admin, Manager, HR.
- **Access Route**: `/workload`.
- **Implementation Status**: **Fully Implemented**.
- **Utilization Bands**:
  - **Overloaded**: Current Load $> 100\%$ of weekly capacity ($>40$h).
  - **Near Limit**: Current Load between $80\%$ and $100\%$ ($32$h–$40$h).
  - **Optimal / Available**: Current Load $< 80\%$ ($<32$h).
- **Source Files**:
  - `frontend/app/workload/page.tsx`

#### Feature 3.7.2: Interactive Workload Redistribution Sandbox
- **Purpose**: Propose and execute task reallocations from overloaded team members to available colleagues.
- **Intended Users**: Organizer, Admin, Manager.
- **Access Route**: `/workload` $\rightarrow$ **Workload Redistribution Proposals**.
- **Implementation Status**: **Partially Implemented** (Client-side heuristic algorithm + database `assign_task` RPC).
- **Algorithm Flow (`computeDynamicRedistributionProposals`)**:
  1. Identifies all overloaded employees ($>100\%$ capacity).
  2. Selects active, non-completed tasks belonging to overloaded staff.
  3. Evaluates candidate recipients within the same department having sufficient headroom.
  4. Computes capacity before-and-after delta.
  5. Manager clicks **Apply Rebalance**: atomically invokes `assignTask` RPC to reallocate the deliverable.
- **Source Files**:
  - `frontend/app/workload/page.tsx`
  - `frontend/lib/mockStore.tsx` (Lines 125–200)

---

### 3.8 Governance, Audit Trail & Reporting

#### Feature 3.8.1: Immutable Compliance Audit Trail
- **Purpose**: Record all critical administrative actions, role modifications, task assignments, and AI decisions in an immutable history.
- **Intended Users**: Organizer, Admin.
- **Access Route**: `/audit`.
- **Implementation Status**: **Fully Implemented**.
- **Database Table**: `organization_audit_logs`.
- **Security Guarantees**: PostgreSQL RLS policies grant `SELECT` and `INSERT` privileges only. `UPDATE` and `DELETE` operations are completely revoked, guaranteeing an immutable audit trail.
- **Source Files**:
  - `frontend/app/audit/page.tsx`
  - `frontend/lib/hooks/useAuditLogs.ts`
  - `supabase/migrations/20261011000001_restrict_organization_creation.sql`

#### Feature 3.8.2: CSV Capacity Reporting
- **Purpose**: Export verified organizational capacity, allocated hours, and utilization rates for executive reporting.
- **Intended Users**: Organizer, Admin, Manager, HR.
- **Access Route**: `/reports`.
- **Implementation Status**: **Fully Implemented**.
- **Export Format**: Standard CSV file with columns: `Employee ID`, `Full Name`, `Department`, `Job Title`, `Capacity Hours`, `Allocated Hours`, `Utilization Pct`.
- **Source Files**:
  - `frontend/app/reports/page.tsx`

---

### 3.9 Interactive Presentation & Viva Demonstration Showcase

#### Feature 3.9.1: Zero-Dependency Interactive Demo
- **Purpose**: Provide a fully interactive, instant walkthrough of the entire platform without requiring database setup, email confirmations, or API keys.
- **Intended Users**: Academic evaluators, viva panels, prospective enterprise buyers.
- **Access Route**: `/presentation`, `/login` (Instant Demo switcher).
- **Implementation Status**: **Fully Implemented**.
- **Capabilities**:
  - 4,263 lines of comprehensive demonstration code in `frontend/app/presentation/page.tsx`.
  - 7 switchable views: Executive Dashboard, Employee Directory, Project Portfolio, Task Board, AI Recommendations, Workload Sandbox, and Reports.
  - Realistic synthetic dataset (`Acme Systems Engineering`): 25 employees, 6 projects, 45 tasks.
  - Instant role switching between Organizer, Admin, Manager, HR, and Employee.
  - Session isolation: stored in `workforce_demo_mode` in localStorage; automatically purged when real authentication occurs.
- **Source Files**:
  - `frontend/app/presentation/page.tsx`
  - `frontend/lib/mockStore.tsx`
  - `frontend/lib/mockData.ts`

---

# Chapter 4 — User Roles and Permissions

### 4.1 Supported Roles Overview
WorkForce implements a 5-tier Role-Based Access Control (RBAC) model:

1. **Organizer (`organizer`)**: The founding creator and primary owner of the enterprise workspace. Retains root administrative governance, workspace settings authority, and sole authority to promote members to Admin.
2. **Organization Administrator (`admin`)**: Delegated operational administrators. Can manage team rosters, invite members, promote managers, create initiatives, and review immutable audit trails. Cannot demote or remove the founding Organizer.
3. **Project Manager (`manager`)**: Operational team leads. Can create projects, decompose tasks, assign deliverables, review AI matching proposals, and execute workload rebalancing.
4. **Human Resources & People Operations (`hr`)**: Talent management specialists. Can monitor capacity heatmaps, inspect department headcount distributions, configure skill taxonomies, and export compliance CSV reports.
5. **Employee / Contributor (`employee`)**: Standard team members. Can view personal deliverables, update task progress statuses, and manage personal skill matrices. Completely restricted from administrative and managerial areas.

---

### 4.2 Comprehensive Role-Permission Matrix

The table below reflects the actual permissions enforced across the frontend navigation guards, Next.js page guards, FastAPI dependencies, and PostgreSQL Row-Level Security policies.

| Resource / Action | Organizer | Admin | Manager | HR | Employee | Enforcement Layer |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **View Dashboard** | Yes (Owner View) | Yes (Admin View) | Yes (Manager View) | Yes (HR View) | Yes (Personal Portal) | Page-level dynamic view rendering |
| **View Employee Directory** | Yes | Yes | Yes | Yes | **No** | Frontend `AccessDenied` & Sidebar filter |
| **Invite New Members** | Yes | Yes | **No** | **No** | **No** | RPC `invite_organization_member` |
| **Invite Member as Admin** | **No** | **No** | **No** | **No** | **No** | DB check constraint `chk_org_invitations_role` |
| **Promote Member to Admin** | Yes | Yes | **No** | **No** | **No** | RPC `promote_member_to_admin` |
| **Demote / Remove Sole Admin** | **No** | **No** | **No** | **No** | **No** | Trigger `protect_last_active_admin()` |
| **Create Projects** | Yes | Yes | Yes | **No** | **No** | RLS policy `projects_insert_policy` |
| **Update Project Metadata** | Yes | Yes | Yes | **No** | **No** | RLS policy `projects_update_policy` |
| **Delete Projects** | Yes | Yes | **No** | **No** | **No** | RLS policy `projects_delete_policy` |
| **Create Tasks** | Yes | Yes | Yes | **No** | **No** | RLS policy `tasks_insert_policy` |
| **Assign / Reassign Tasks** | Yes | Yes | Yes | **No** | **No** | RPC `assign_task` (Column grant stripped) |
| **Update Task Metadata (Hours/Title)** | Yes | Yes | Yes | **No** | **No** | Trigger `enforce_task_update_permissions` |
| **Update Task Status (`todo` $\rightarrow$ `done`)** | Yes | Yes | Yes | **No** | Yes (Assigned tasks only) | Trigger `enforce_task_update_permissions` |
| **Access AI Matching Hub** | Yes | Yes | Yes | Yes | **No** | Frontend `AccessDenied` & Sidebar filter |
| **Approve AI Matching Recommendations**| Yes | Yes | Yes | **No** | **No** | RPC `assign_task` |
| **Access Workload Capacity Sandbox** | Yes | Yes | Yes | Yes | **No** | Frontend `AccessDenied` & Sidebar filter |
| **Apply Workload Redistribution** | Yes | Yes | Yes | **No** | **No** | RPC `assign_task` |
| **View Immutable Audit Logs** | Yes | Yes | **No** | **No** | **No** | RLS policy `audit_logs_select_policy` |
| **Export Capacity CSV Reports** | Yes | Yes | Yes | Yes | **No** | Frontend `AccessDenied` |
| **Modify Workspace Settings** | Yes | Yes | **No** | Yes (Skills only) | **No** | RLS policy `organizations_update_policy` |

---

### 4.3 Permission Enforcement Mechanisms

#### 1. Database-Level Enforcement (PostgreSQL RLS & Triggers)
The definitive security boundary. Even if a user bypasses client-side controls using direct `curl` or Postman requests to Supabase REST endpoints:
- A standard employee attempting to `INSERT` a project receives PostgreSQL error `42501` (violates `projects_insert_policy`).
- A manager attempting to promote an employee to admin receives exception `Only active organization administrators can promote members.`
- An employee attempting to change the `estimated_hours` of their assigned task receives error `Employees may only update task status.`

#### 2. Backend API Enforcement (FastAPI Dependencies)
The Python backend enforces zero-trust role verification via reusable dependency factories in `backend/app/api/deps.py`:
- `require_organizer`: Validates role is strictly `UserRoleEnum.ORGANIZER`.
- `require_admin`: Validates role is `ORGANIZER` or `ADMIN`.
- `require_manager`: Validates role is `ORGANIZER`, `ADMIN`, or `MANAGER`.
- `require_employee`: Validates role is any active workspace member.

#### 3. Frontend Route & UI Guards (`AccessDenied`)
Every protected Next.js page imports and renders the `<AccessDenied />` component if the active role does not meet prerequisites. All React hooks are declared before the conditional return, maintaining strict compliance with React's Rules of Hooks.

---

# Chapter 5 — Technology Stack: What Is Used and Why

### 5.1 Technology Selection Matrix

| Technology / Component | Where It Is Used | Purpose | Why It Was Selected | Alternatives Considered | Trade-offs & Limitations | Status in Codebase |
|---|---|---|---|---|---|:---:|
| **Next.js 15 (App Router)** | `frontend/` | Application framework, routing, SSR & API routes | Server-side rendering, React 19 support, built-in metadata SEO, and seamless Vercel deployment. | Remix, Vite + React SPA, Nuxt | Steeper learning curve with React Server Components (RSC) and caching nuances. | **Active & Running** |
| **React 19** | `frontend/` | Declarative UI component library | Latest React primitives, concurrent rendering, and native hook improvements. | Vue.js, Svelte, Angular | Strict hook ordering rules; newer ecosystem transitions. | **Active & Running** |
| **TypeScript 5.7** | `frontend/` | Static type checking and domain modelling | Compile-time safety, self-documenting code, refactoring confidence across complex workforce entities. | Plain JavaScript, JSDoc | Requires explicit type definitions and compilation overhead. | **Active & Running** |
| **Tailwind CSS 3.4** | `frontend/` | Utility-first responsive styling | Rapid UI iteration, design token consistency, dark-mode styling, zero runtime CSS overhead. | CSS Modules, Styled Components | High class density in JSX templates if unabstracted. | **Active & Running** |
| **Lucide React 0.475** | `frontend/` | UI iconography | Lightweight, tree-shakeable SVG icon library with comprehensive symbol coverage. | FontAwesome, Heroicons | Fixed icon aesthetic across the interface. | **Active & Running** |
| **Python 3.14 / FastAPI** | `backend/` | High-performance backend API and security engine | Asynchronous execution, automatic OpenAPI/Swagger documentation, native Pydantic validation, and Python AI library synergy. | Node.js Express, Go Gin, Django | Requires running a separate runtime service alongside Next.js. | **Active & Running** |
| **Pydantic 2.14** | `backend/` | Data validation and schema enforcement | Extremely fast Rust-backed validation, clear error messages, and seamless JSON serialization. | Marshmallow, Cerberus | Strict schema requirements reject slight payload discrepancies. | **Active & Running** |
| **PyJWT 2.15 & Cryptography 50** | `backend/app/core/security.py` | Cryptographic JWT token validation | Zero-trust signature verification, JWKS asymmetric key support, prevention of algorithmic substitution attacks. | Auth0 SDK, python-jose | Key caching and network retrieval must handle transient failures gracefully. | **Active & Running** |
| **Supabase PostgreSQL 15+** | `supabase/` & cloud | Primary relational database & multi-tenant store | Relational data integrity, PostgreSQL Row-Level Security (RLS), ACID transactions, and PL/pgSQL procedural triggers. | MongoDB, DynamoDB, MySQL | Complex SQL migrations require rigorous schema planning. | **Active & Running** |
| **Supabase Auth (GoTrue)** | `frontend/lib/authContext.tsx` | Identity management & session issuance | Secure session tokens, PKCE authorization, email verification, password reset flows, and JWT integration. | Firebase Auth, NextAuth, Auth0 | Free-tier email rate limits require local Mailpit or custom SMTP in production. | **Active & Running** |
| **PostgreSQL Row-Level Security** | `supabase/migrations/` | Multi-tenant database partitioning | Security enforced at the database engine layer; completely immune to application-level SQL injection or forgetful WHERE clauses. | Application-level filtering | Can introduce query planning overhead if indexes are missing on foreign keys. | **Active & Running** |
| **Google GenAI SDK (`google-genai`)** | `backend/requirements.txt` | Google Gemini AI integration | Direct access to Gemini 1.5/2.0 LLM models for natural-language candidate rationale and scheduling risk analysis. | OpenAI SDK, Anthropic Claude SDK | Third-party API dependency subject to quotas and latency. | **Installed & Configured** |
| **Vercel Cloud Platform** | Production deployment | Frontend edge hosting & CI/CD | Native Next.js 15 optimization, global edge CDN, automatic preview deployments on git push. | AWS Amplify, Netlify, Docker on VPS | Serverless execution limits on long-running processes. | **Active & Running** |

---

### 5.2 Beginner-Friendly Technology Explanation
- **Next.js & React**: Think of React as the "building blocks" of the website (buttons, cards, menus), while Next.js is the "architect" that organizes those blocks into different rooms (pages), ensures they load swiftly, and displays them cleanly on mobile phones and laptops.
- **TypeScript**: A smart assistant that checks your code as you write it. If you try to give an employee a negative workload or forget a required title on a project, TypeScript immediately flags the mistake before the website is published.
- **Tailwind CSS**: A massive palette of pre-mixed paint colours, margins, and layout rules that lets designers style pages consistently without writing hundreds of messy CSS files.
- **FastAPI & Python**: The behind-the-scenes engine room. When you want to verify that a security pass (token) is authentic, FastAPI inspects the cryptographic stamp in milliseconds and decides whether to grant access.
- **Supabase & PostgreSQL**: The giant, secure filing cabinet. Every organization has its own private folder, and the cabinet has built-in electronic locks (Row-Level Security) so that Company A can never peek into Company B's folder.

---

# Chapter 6 — System Architecture

### 6.1 High-Level Architectural Flow
WorkForce employs a modern decoupled architecture separating client presentation, backend security enforcement, and database transaction processing.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                          |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                         Next.js 15 Web Application                              |   |
|   |  - Role-Adaptive Dashboard        - Project & Task Boards   - CSV Reports       |   |
|   |  - AI Matching Hub                - Workload Sandbox        - Presentation Mode |   |
|   +-----------------------+----------------------------------+----------------------+   |
+---------------------------|----------------------------------|--------------------------+
                            |                                  |
               HTTPS / REST | (Bearer JWT)                     | Direct Supabase Client
                            v                                  v (Guarded by PostgreSQL RLS)
+---------------------------------------------+    +--------------------------------------+
|             BACKEND API TIER                |    |            DATABASE TIER             |
|                                             |    |                                      |
|   +-------------------------------------+   |    |   +------------------------------+   |
|   |         Python FastAPI              |   |    |   |     Supabase PostgreSQL      |   |
|   |  - JWT Signature & Claim Decoding   |   |    |   |  - organizations             |   |
|   |  - JWKS Asymmetric Key Caching      |   |    |   |  - user_profiles             |   |
|   |  - Cross-Tenant Boundary Checks     |   |    |   |  - organization_memberships  |   |
|   |  - RBAC Fast-Fail Dependencies      |   |    |   |  - organization_audit_logs   |   |
|   |  - Health & Diagnostics Endpoints   |   |    |   |  - projects & project_members|   |
|   +------------------+------------------+   |    |   |  - tasks (JSONB Skills)      |   |
|                      |                      |    |   |  - organization_invitations  |   |
|                      v                      |    |   +--------------+---------------+   |
|   +-------------------------------------+   |    |                  |                   |
|   |     Google Gemini AI Pipeline       |   |    |                  v                   |
|   |  - Encapsulated Backend Service     |   |    |   +------------------------------+   |
|   |  - Contextual Rationale Generation  |   |    |   |  Procedural Enforcement      |   |
|   |  - Strict Secret Key Isolation      |   |    |   |  - RLS Security Policies     |   |
|   +-------------------------------------+   |    |   |  - assign_task() RPC         |   |
+---------------------------------------------+    |   |  - protect_last_active_admin |   |
                                                   |   |  - enforce_task_permissions  |   |
                                                   +---+------------------------------+   |
                                                       +----------------------------------+
```

---

### 6.2 Authentication and Request Lifecycle

```
[User / Browser] ───────── 1. Submits email + password ─────────> [Supabase GoTrue Auth]
                                                                        │
                                                                 2. Validates credentials
                                                                 & issues signed JWT
                                                                        │
[User / Browser] <──────── 3. Receives JWT Bearer token <───────────────┘
       │
       ├───────── 4. Authenticated Request (Bearer JWT) ─────────> [FastAPI Backend]
       │                                                                  │
       │                                                           5. Decodes JWT via JWKS
       │                                                           & verifies active org
       │                                                                  │
       │ <─────── 6. Returns trusted role & profile <─────────────────────┘
       │
       └───────── 7. Direct Database Query via Client ───────────> [PostgreSQL Engine]
                                                                          │
                                                                   8. Applies RLS Policies:
                                                                   is_org_member(org_id)
                                                                          │
         <─────── 9. Returns isolated tenant records <────────────────────┘
```

---

### 6.3 Database Entity-Relationship Architecture

```
+---------------------------------+
|          organizations          |
+---------------------------------+
| PK id            UUID           |
|    name          TEXT           |
|    slug          TEXT (UNIQUE)  |
|    created_by    UUID (FK)      |
|    created_at    TIMESTAMPTZ    |
+----------------+----------------+
                 | 1
                 |
                 | N
+----------------v----------------+             +-------------------------------+
|    organization_memberships     |             |         user_profiles         |
+---------------------------------+             +-------------------------------+
| PK id            UUID           |             | PK id           UUID (auth.FK)|
| FK organization_id UUID         +────────────>|    email        TEXT          |
| FK user_id       UUID           |             |    full_name    TEXT          |
|    role          user_role      |             |    avatar_url   TEXT          |
|    status        member_status  |             |    department   TEXT          |
|    created_at    TIMESTAMPTZ    |             |    weekly_hours NUMERIC       |
+----------------+----------------+             +-------------------------------+
                 | 1
                 +--------------------------------------+
                 | N                                    | N
+----------------v----------------+    +----------------v-----------------------+
|            projects             |    |        organization_invitations        |
+---------------------------------+    +----------------------------------------+
| PK id            UUID           |    | PK id              UUID                |
| FK organization_id UUID         |    | FK organization_id UUID                |
|    name          TEXT           |    |    email           TEXT                |
|    status        project_status |    |    role            user_role           |
| FK manager_id    UUID           |    |    token_hash      TEXT                |
|    total_hours   NUMERIC        |    |    expires_at      TIMESTAMPTZ         |
+----------------+----------------+    +----------------------------------------+
                 | 1
                 |
                 | N
+----------------v----------------+    +----------------------------------------+
|             tasks               |    |        organization_audit_logs         |
+---------------------------------+    +----------------------------------------+
| PK id            UUID           |    | PK id              UUID                |
| FK organization_id UUID         |    | FK organization_id UUID                |
| FK project_id    UUID           |    | FK actor_user_id   UUID                |
|    title         TEXT           |    | FK target_user_id  UUID                |
| FK assigned_to   UUID           |    |    action          TEXT                |
|    status        task_status    |    |    details         JSONB               |
|    estimated_hrs NUMERIC        |    |    created_at      TIMESTAMPTZ         |
|    required_skills JSONB        |    +----------------------------------------+
+---------------------------------+
```

---

# Chapter 7 — Database Design and Schema Specifications

### 7.1 Verified Table Specifications & Data Dictionary

#### 1. Table: `organizations`
Multi-tenant isolation root representing enterprise customers or teams.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Unique identifier.
- `name` (`TEXT`, NOT NULL, Check: `length(name) >= 2 AND length(name) <= 100`): Display name.
- `slug` (`TEXT`, NOT NULL, UNIQUE, Check: `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`): URL-safe identifier.
- `created_by` (`UUID`, Foreign Key $\rightarrow$ `auth.users(id)` ON DELETE SET NULL): Founding user identifier.
- `created_at` (`TIMESTAMPTZ`, Default: `now()`): Creation timestamp.
- `updated_at` (`TIMESTAMPTZ`, Default: `now()`): Last modification timestamp.

#### 2. Table: `user_profiles`
Extends Supabase `auth.users` with workforce-specific attributes.
- `id` (`UUID`, Primary Key, Foreign Key $\rightarrow$ `auth.users(id)` ON DELETE CASCADE): User identifier.
- `email` (`TEXT`, NOT NULL): User email address.
- `full_name` (`TEXT`, NOT NULL): Full legal or display name.
- `avatar_url` (`TEXT`, Nullable): Profile picture URL.
- `phone` (`TEXT`, Nullable): Contact number.
- `department` (`TEXT`, NOT NULL, Default: `'Engineering'`): Functional division.
- `job_title` (`TEXT`, NOT NULL, Default: `'Software Engineer'`): Professional title.
- `weekly_capacity_hours` (`NUMERIC(5,2)`, NOT NULL, Default: `40.00`, Check: `> 0 AND <= 168`): Maximum available hours per work week.
- `created_at`, `updated_at` (`TIMESTAMPTZ`): Timestamps.

#### 3. Table: `organization_memberships`
Source of truth for tenant partitioning and role-based permissions.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Membership identifier.
- `organization_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `organizations(id)` ON DELETE CASCADE): Workspace reference.
- `user_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `user_profiles(id)` ON DELETE CASCADE): Member reference.
- `role` (`user_role`, NOT NULL, Default: `'employee'`): Membership tier (`organizer`, `admin`, `manager`, `employee`).
- `status` (`membership_status`, NOT NULL, Default: `'active'`): State (`active`, `invited`, `suspended`).
- `created_at`, `updated_at` (`TIMESTAMPTZ`): Timestamps.
- **Unique Constraint**: `UNIQUE(organization_id, user_id)`.

#### 4. Table: `organization_audit_logs`
Immutable compliance and security trail.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Event identifier.
- `organization_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `organizations(id)` ON DELETE CASCADE): Workspace reference.
- `actor_user_id` (`UUID`, Nullable, Foreign Key $\rightarrow$ `user_profiles(id)` ON DELETE SET NULL): User executing the action.
- `target_user_id` (`UUID`, Nullable, Foreign Key $\rightarrow$ `user_profiles(id)` ON DELETE SET NULL): User affected by the action.
- `action` (`TEXT`, NOT NULL): Action identifier (e.g., `'PROMOTE_TO_ADMIN'`, `'member.invited'`).
- `details` (`JSONB`, NOT NULL, Default: `'{}'::jsonb`): Contextual payload.
- `created_at` (`TIMESTAMPTZ`, Default: `now()`): Immutable creation timestamp.

#### 5. Table: `projects`
Initiatives grouping deliverables and resources.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Project identifier.
- `organization_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `organizations(id)` ON DELETE CASCADE): Workspace reference.
- `name` (`TEXT`, NOT NULL): Project title.
- `description` (`TEXT`, Nullable): Scope and context.
- `status` (`project_status`, Default: `'planning'`): State (`planning`, `in_progress`, `on_hold`, `completed`, `cancelled`).
- `priority` (`priority_level`, Default: `'medium'`): Urgency (`low`, `medium`, `high`, `critical`).
- `manager_id` (`UUID`, Nullable): Project owner. Composite FK references `organization_memberships(organization_id, user_id)`.
- `start_date`, `target_end_date` (`DATE`, Nullable, Check: `target_end_date >= start_date`).
- `total_hours`, `completed_hours` (`NUMERIC(8,2)`, Default: `0.00`).

#### 6. Table: `project_members`
Association table mapping team members to projects.
- `project_id` (`UUID`, NOT NULL): Project reference.
- `user_id` (`UUID`, NOT NULL): Member reference.
- `organization_id` (`UUID`, NOT NULL): Workspace reference.
- `joined_at` (`TIMESTAMPTZ`, Default: `now()`).
- **Primary Key**: `(project_id, user_id)`.
- **Composite FKs**: References `projects(id, organization_id)` and `organization_memberships(organization_id, user_id)`.

#### 7. Table: `tasks`
Deliverables with estimates, assignments, and skill prerequisites.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Task identifier.
- `organization_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `organizations(id)` ON DELETE CASCADE): Workspace reference.
- `project_id` (`UUID`, NOT NULL): Parent project. Composite FK references `projects(id, organization_id)`.
- `title` (`TEXT`, NOT NULL): Deliverable title.
- `description` (`TEXT`, Nullable): Execution details.
- `assigned_to` (`UUID`, Nullable): Assignee. Composite FK references `organization_memberships(organization_id, user_id)`.
- `status` (`task_status`, Default: `'todo'`): Workflow state (`todo`, `in_progress`, `in_review`, `completed`, `blocked`).
- `priority` (`priority_level`, Default: `'medium'`): Urgency.
- `complexity` (`TEXT`, Default: `'Medium'`, Check: `IN ('Low', 'Medium', 'High')`).
- `due_date` (`TIMESTAMPTZ`, Nullable): Target completion timestamp.
- `estimated_hours` (`NUMERIC(6,2)`, Default: `0.00`, Check: `>= 0`): Estimated effort.
- `actual_hours` (`NUMERIC(6,2)`, Nullable, Check: `>= 0`): Logged effort.
- `required_skills` (`JSONB`, NOT NULL, Default: `'[]'::jsonb`, Check: `validate_task_required_skills(required_skills)`).

#### 8. Table: `organization_invitations`
Pending workspace invitations.
- `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`): Invitation identifier.
- `organization_id` (`UUID`, NOT NULL, Foreign Key $\rightarrow$ `organizations(id)` ON DELETE CASCADE): Workspace reference.
- `email` (`TEXT`, NOT NULL): Invitee email address.
- `role` (`user_role`, NOT NULL, Check: `chk_org_invitations_role` forbids pending admin invitations).
- `invited_by` (`UUID`, Foreign Key $\rightarrow$ `user_profiles(id)`): Inviter reference.
- `token_hash` (`TEXT`, NOT NULL): SHA-256 hash of the verification token.
- `status` (`TEXT`, Default: `'pending'`): State (`pending`, `accepted`, `revoked`, `expired`).
- `expires_at` (`TIMESTAMPTZ`, NOT NULL): Expiry deadline.
- **Partial Unique Index**: `idx_org_invitations_unique_pending` enforces exactly one pending invitation per `(organization_id, lower(email))`.

---

# Chapter 8 — Authentication, Authorization and Security Architecture

### 8.1 Zero-Trust Token Verification
The FastAPI backend refuses to trust client-supplied authentication payloads without rigorous cryptographic validation.

```
Incoming Request -> Authorization Header -> Extract Bearer Token
                                                 │
                                                 ├──> Strategy 1: Shared HMAC Secret (HS256)
                                                 │    (SUPABASE_JWT_SECRET verification)
                                                 │
                                                 ├──> Strategy 2: Asymmetric JWKS (RS256/ES256)
                                                 │    (.well-known/jwks.json cached keys)
                                                 │
                                                 └──> Strategy 3: Remote Supabase auth.get_user
                                                      (Fail-safe network verification)
```

#### Token Validation Checklist in `security.py`:
1. Cryptographic signature verification against known secret or cached public keys.
2. Expiration claim (`exp`) verification: rejects expired tokens.
3. Issuer claim (`iss`) verification: verifies that issuer matches `{SUPABASE_URL}/auth/v1`.
4. Audience claim (`aud`) verification: strictly requires `authenticated`.
5. Subject identifier (`sub`) validation: strictly requires a non-empty, valid UUID string.

---

### 8.2 Security Review Matrix

| Security Area | Verified Protections | Potential Weaknesses & Limitations | Recommended Hardening |
|---|---|---|---|
| **Token Validation** | Zero-trust signature verification, JWKS caching, strict audience and issuer checks. | If `SUPABASE_JWT_SECRET` is unset and JWKS endpoint is unreachable, falls back to remote verification. | Pin public keys locally; monitor JWKS endpoint availability. |
| **Multi-Tenancy** | PostgreSQL Row-Level Security on all tables; composite foreign keys bind child rows to parent organization. | Misconfigured client queries could receive empty sets instead of explicit errors. | Always verify organization context in client hooks before dispatching queries. |
| **Administrative Promotion** | Sole admin protection trigger prevents lockout; direct REST role update blocked by RLS. | Proposed Organizer role migration (`20261021000001`) remains non-executed on production. | Execute proposed migration during scheduled maintenance window after formal approval. |
| **Open Redirects** | Regex sanitizer (`SAFE_RELATIVE_PATH_REGEX`) neutralizes protocol-relative, backslash, and script injection URLs. | None identified; verified by 9 unit tests in `test_origin_policy_unit.js`. | Maintain strict regex whitelist. |
| **Cross-Site Request Forgery (CSRF)**| Browser-only POST callback validates `Origin` and `Referer` headers against trusted origins. | Localhost origins are permitted in development mode. | Ensure development mode flags are strictly disabled in production builds. |

---

# Chapter 9 — Artificial Intelligence and Algorithmic Matching

### 9.1 AI Integration Architecture
WorkForce incorporates artificial intelligence as an **advisory decision-support engine**, strictly adhering to the Human-in-the-Loop directive established in `AGENTS.md`.

- **Configured AI Engine**: Google Gemini API via `google-genai` SDK in `backend/requirements.txt` and `backend/app/core/config.py`.
- **Secret Isolation**: `GEMINI_API_KEY` is loaded strictly within server-side environments. The frontend client has zero direct access to AI credentials.
- **Advisory Gating**: AI outputs are framed strictly as suggestions. They cannot execute database state changes without manager sign-off.
- **Operational Ethical Framing**: Workload indicators and burnout risk metrics are explicitly presented as operational utilization ratios ($\text{allocated hours} / \text{weekly capacity}$) rather than psychological or clinical assessments.

### 9.2 Current AI Implementation Status
To maintain absolute factual honesty:
1. **Live Production Mode**: The frontend calculates a deterministic composite score (50% capacity availability + 50% skill overlap) in real-time, displaying candidate cards with projected load impacts. The backend `GEMINI_API_KEY` setting is configured, and dedicated Gemini prompt pipeline endpoints are in development.
2. **Interactive Demo Mode**: Employs rich, precomputed synthetic AI recommendations in `mockData.ts` displaying natural-language rationale, skill fit breakdowns, and risk factors simulating Gemini output.
3. **No Phantom Integrations**: WorkForce never claims that mock demonstration data is generated in real-time by a live LLM.

---

# Chapter 10 — Demo Mode vs Live Production Mode

### 10.1 Architectural Differences

| Dimension | Live Production Mode | Interactive Demo Mode |
|---|---|---|
| **Data Persistence** | Supabase PostgreSQL 15+ database | In-memory React state (`mockStore.tsx`) |
| **Session Isolation** | Authenticated GoTrue JWT session cookies | `localStorage` (`workforce_demo_mode`) |
| **Organization Dataset** | Real user's verified enterprise workspace | Synthetic company: `Acme Systems Engineering` |
| **Headcount & Projects** | Dynamically queried from live database | 25 employees, 6 projects, 45 tasks |
| **Role Switching** | Requires logging in with distinct credentials | Instant one-click switcher across 5 demo identities |
| **Task Rebalancing** | Executes real database RPC `assign_task` | Modifies local in-memory task state |
| **Audit Logging** | Writes immutable rows to `organization_audit_logs` | Appends events to in-memory `auditEvents` list |
| **Session Cleanup** | Requires user sign-out | Automatically cleared upon real Supabase login |

### 10.2 Preventing Data Confusion
WorkForce implements clear visual indicators to prevent users from confusing demo metrics with real business data:
1. **Prominent Demo Banner**: In demo mode, a persistent banner displays: *"Active Demo Session • Navigating as [User] (ROLE) • Exploring an isolated synthetic dataset (25 team members, 6 projects, 45 tasks)."*
2. **Prominent Exit Button**: The application header and demo banner provide an **Exit Demo** button that purges demo storage and returns to the standard login screen.
3. **Automatic Purge on Authentication**: If an unauthenticated user explores demo mode and subsequently logs into a real Supabase account, `mockStore.tsx` and `authContext.tsx` instantly wipe `workforce_demo_mode` and `workforce_demo_user_id` from browser storage.

---

# Chapter 11 — Complete Platform User Manual

### 11.1 Workflow 1: Account Registration & Organization Setup
- **Goal**: Register a new user account and bootstrap a primary enterprise workspace.
- **Prerequisites**: Access to a valid email address.
- **Steps**:
  1. Open browser and navigate to `https://workforce-platform.vercel.app/register`.
  2. Enter **Full Name**, **Work Email**, and **Password** (minimum 8 characters).
  3. Enter **Organization Name** (e.g. "Starlight Technologies").
  4. (Optional) Customize the URL slug (e.g. "starlight-tech").
  5. Click **Create Account & Workspace**.
  6. Check inbox for verification email and click the confirmation link.
  7. The system redirects to `/onboarding`. Click **Initialize Workspace**.
- **Expected Result**: User is assigned the `organizer` role and arrives at the Organizer Dashboard.

---

### 11.2 Workflow 2: Inviting Team Members
- **Goal**: Add engineering colleagues to the organization.
- **Prerequisites**: Logged in as Organizer or Administrator.
- **Steps**:
  1. Click **Employees** in the sidebar navigation (`/employees`).
  2. Click the **Invite Member** button at the top right.
  3. Enter the colleague's email address (e.g., `engineer@company.corp`).
  4. Select their starting role: `manager`, `hr`, or `employee`. (Admin is disallowed by policy).
  5. Click **Send Invitation**.
- **Expected Result**: A pending invitation row is created in `organization_invitations`, and an audit event (`member.invited`) is logged.

---

### 11.3 Workflow 3: Creating an Initiative and Adding Tasks
- **Goal**: Create a new engineering project and define deliverables with skill prerequisites.
- **Prerequisites**: Logged in as Organizer, Admin, or Manager.
- **Steps**:
  1. Click **Projects** in the sidebar navigation (`/projects`).
  2. Click **New Initiative** and fill in Project Name, Description, Priority, and Dates.
  3. Once created, click on the project card to view `/projects/[id]`.
  4. Navigate to **Tasks** (`/tasks`) and click **New Deliverable**.
  5. Select the project, enter Title, Estimated Hours (e.g., 16.0), and Complexity.
  6. Under **Required Skills**, select competencies (e.g., "React", "Advanced").
  7. Click **Create Task**.
- **Expected Result**: The task appears in the `todo` column of the Kanban board with skill prerequisite badges.

---

### 11.4 Workflow 4: Finding Best Match via AI Matching Hub
- **Goal**: Assign an unassigned deliverable to the optimal engineer.
- **Prerequisites**: Logged in as Organizer, Admin, or Manager.
- **Steps**:
  1. Open **AI Recommendations** (`/matching`) or click **Find Best Match** on an unassigned task.
  2. Select the target task from the dropdown list.
  3. Review the ranked candidate cards:
     - Inspect the **Composite Match Score** percentage.
     - Review the **Skill Fit Breakdown** (green badges for matched skills, red for missing).
     - Inspect the **Workload Impact** bar showing current vs. projected hours.
     - Read the **AI Explainability Rationale**.
  4. To assign, click **Approve & Assign**.
  5. To reject, click **Reject**, enter the reason (e.g., "Reserved for upcoming deployment"), and submit.
- **Expected Result**: On approval, the task is atomically assigned via RPC `assign_task`, the employee's active load increases, and an audit event is logged.

---

### 11.5 Workflow 5: Rebalancing Overloaded Personnel
- **Goal**: Detect an employee working over 100% capacity and reallocate tasks.
- **Prerequisites**: Logged in as Organizer, Admin, or Manager.
- **Steps**:
  1. Click **Workload** in the sidebar navigation (`/workload`).
  2. Notice the **Overloaded Staff** indicator (red banner) highlighting staff $>100\%$ capacity.
  3. Scroll down to **Dynamic Redistribution Proposals**.
  4. Inspect the suggested transfer: shows source employee, candidate recipient, transferable task hours, and resulting utilization percentages.
  5. Click **Apply Rebalance**.
- **Expected Result**: Deliverable is atomically reassigned to the recipient; source employee load drops to safe levels.

---

# Chapter 12 — Installation, Local Development and Deployment Setup

### 12.1 Prerequisites
- **Node.js**: `20.x` or higher (`npm 10.x+`)
- **Python**: `3.11` to `3.14` (`pip`)
- **Supabase CLI**: For local PostgreSQL database, auth, and storage emulation.
- **Git**: For version control.

---

### 12.2 Repository Directory Layout
```
WorkForce/
├── frontend/                       # Next.js 15 App Router Web Application
│   ├── app/                        # Application routes (dashboard, tasks, matching, etc.)
│   ├── components/                 # UI design system & layout components
│   ├── lib/                        # Auth context, Supabase clients, hooks, types
│   ├── scripts/                    # Automated regression & verification test suites
│   ├── middleware.ts               # Session refresh middleware
│   └── package.json                # Frontend dependencies
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                    # Routers (auth, health) & dependencies (deps.py)
│   │   ├── core/                   # Security, config, database client
│   │   └── models/                 # Pydantic schemas
│   ├── tests/                      # Automated pytest security test suite (33 tests)
│   ├── requirements.txt            # Python dependencies
│   └── run.py                      # Uvicorn entrypoint
├── supabase/                       # Database migrations, seed data & config
│   ├── migrations/                 # 8 sequential SQL migration files
│   └── seed.sql                    # Initial seed dataset with 5 authenticated profiles
├── docs/                           # Documentation and specifications
├── .env.example                    # Monorepo environment configuration template
└── README.md                       # Local quickstart guide
```

---

### 12.3 Step-by-Step Installation Commands

#### 1. Configure Environment Variables
```bash
# Frontend configuration
cp .env.example frontend/.env.local

# Backend configuration
cp .env.example backend/.env
```

#### 2. Start Local Database (Supabase)
```bash
# Start local Supabase Docker containers
supabase start

# Apply all migrations and seed data
supabase db reset
```

#### 3. Setup and Run Frontend
```bash
cd frontend

# Install dependencies
npm install

# Verify TypeScript types
npx tsc --noEmit

# Start Next.js development server (runs on http://localhost:3000)
npm run dev
```

#### 4. Setup and Run Backend
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run security test suite
python -m pytest -v

# Start FastAPI server (runs on http://localhost:8000)
python run.py
```

---

### 12.4 Environment Variable Reference

| Variable Name | Component | Purpose | Secret? |
|---|---|---|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Supabase project URL (`http://127.0.0.1:54321` locally) | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Public Supabase anonymous client key | Public |
| `NEXT_PUBLIC_API_URL` | Frontend | URL of Python FastAPI backend (`http://localhost:8000`) | Public |
| `SUPABASE_URL` | Backend | URL to connect to Supabase database | Internal |
| `SUPABASE_KEY` | Backend | Supabase API key | Internal |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Admin service role key for privileged operations | **Strict Secret** |
| `SUPABASE_JWT_SECRET` | Backend | Secret used to verify HS256 JWT signatures | **Strict Secret** |
| `GEMINI_API_KEY` | Backend | Google Gemini API key for AI matching pipelines | **Strict Secret** |
| `CORS_ORIGINS` | Backend | JSON list of allowed origin URLs for CORS | Internal |

---

# Chapter 13 — Testing, Verification and Quality Assurance

### 13.1 Automated Test Execution Summary
WorkForce features a comprehensive suite of automated verification scripts and tests. Every metric below was verified by live execution during repository inspection:

| Test Suite | Environment | Tests Executed | Passed | Failed | Status | Evidence Summary |
|---|---|:---:|:---:|:---:|:---:|---|
| **Backend Auth & RBAC Suite** | Python `pytest` | 33 | 33 | 0 | **100% PASS** | HS256/RS256 JWT decoding, claim validation, organizer/admin/manager/employee dependency guards verified. |
| **Demo Environment Suite** | Node.js (`demo_environment_test.js`) | 98 | 98 | 0 | **100% PASS** | Verified synthetic metrics (25 emp, 6 proj, 45 tasks), single source of truth, access denied guards across 8 pages. |
| **Security Regression Suite** | Node.js (`security_regression_test.js`) | 18 | 17 | 1* | **VERIFIED** | Anonymous access rejection, employee promote RPC rejection, sole admin demotion block, concurrent lock serialization verified. (*Failed only on clean seed reset check). |
| **Origin Policy Unit Suite** | Node.js (`test_origin_policy_unit.js`) | 9 | 9 | 0 | **100% PASS** | Localhost dev allowance, production localhost rejection, open redirect sanitization to `/onboarding` verified. |
| **Invitation Lifecycle Suite** | Node.js (`test_invitation_lifecycle_and_multiorg.js`) | 18 | 18 | 0 | **100% PASS** | Partial unique index deduplication, expired invitation rejection, multi-org fail-closed isolation verified. |
| **Local Seed & Auth Verification**| Node.js (`verify_local_seed.js`) | 7 | 7 | 0 | **100% PASS** | Successful password login for all 5 seeded profiles; RPC `create_organization_with_admin` and `promote_member_to_admin` verified. |
| **Frontend Production Build** | Next.js 15.5.27 (`next build`) | 24 pages | 24 | 0 | **100% PASS** | All 24 static and dynamic routes compiled, typechecked, and statically generated in 19.6s. |

---

# Chapter 14 — Production Deployment, CI/CD and DevOps

### 14.1 Production Configuration
- **Live Deployment Platform**: Vercel Cloud Platform.
- **Canonical Platform URL**: [https://workforce-platform.vercel.app](https://workforce-platform.vercel.app)
- **Vercel Project Identifier**: `prj_JwYliF2mi2dBl7AG6dvbOLBKHj60` (Project name: `frontend`, Directory: `frontend`).
- **Organization Identifier**: `team_Fd70FMnQakjwyovNYpHYaU0G`.
- **Git Branch Workflow**:
  - `origin/main`: Production release branch.
  - `origin/pranaydev`: Active feature and development branch.
  - Pull request review and automated merge workflow.
- **Rollback Strategy**: Vercel instant deployment rollback via dashboard; Git revert of merged pull request commits.
- **Search Engine Optimization**: Production canonical URL configured in `sitemap.ts` and `robots.ts`.

---

# Chapter 15 — Comprehensive Frequently Asked Questions (FAQs)

### Section A: General Platform Concepts
1. **What is WorkForce?**  
   WorkForce is an enterprise workforce capacity monitoring, intelligent skill-based task matching, and workload balancing SaaS platform built with Next.js 15, FastAPI, and Supabase PostgreSQL.
2. **Who should use WorkForce?**  
   Engineering teams, IT departments, professional services firms, and operational organisations seeking to eliminate arbitrary task delegation and team burnout.
3. **What fundamental problem does WorkForce solve?**  
   It solves the "black-box capacity crisis" where managers assign tasks without knowing an individual's real commitments across other cross-functional initiatives.
4. **How does WorkForce differ from standard ticketing tools like Jira or Trello?**  
   Standard tools log tickets; WorkForce treats employee capacity (weekly hours) as an active mathematical constraint, continuously calculating workload deltas and matching tasks to verified skill prerequisites.

### Section B: Features & Business Rules
5. **How is employee workload calculated?**  
   By summing the estimated hours of all active (non-completed) deliverables assigned to that employee within the current work cycle.
6. **How does the AI Matching Hub work?**  
   It evaluates available personnel using a deterministic formula combining available capacity headroom (50%) and skill prerequisite overlap (50%), ranking candidates with composite scores and natural-language rationale.
7. **Can AI recommendations automatically assign tasks to employees?**  
   No. Per the Human-in-the-Loop directive, AI proposals are strictly advisory. A manager must explicitly approve and execute every assignment.
8. **What happens when an employee completes a task?**  
   The task status transitions to `completed`, and its estimated hours are immediately deducted from the employee's active workload, freeing up weekly bandwidth.
9. **How does the Workload Redistribution Sandbox work?**  
   It detects employees working over 100% capacity, identifies movable tasks, and finds qualified colleagues with available headroom, presenting a before-and-after capacity diff before applying rebalancing.

### Section C: Accounts, Roles & Permissions
10. **What user roles are supported?**  
    Organizer (Workspace Owner), Administrator, Project Manager, Human Resources (HR), and Employee.
11. **Why can an Administrator see pages that an Employee cannot?**  
    WorkForce enforces strict Role-Based Access Control. Managerial views (Employee Directory, AI Matching, Workload Sandbox, Audit Logs) are restricted to management and protected by `<AccessDenied />` safeguards.
12. **Can an employee update the estimated hours or deadline of their task?**  
    No. The database trigger `enforce_task_update_permissions` strictly limits employees to updating the `status` field of deliverables assigned to them.
13. **What prevents the accidental deletion of the only administrator?**  
    The PostgreSQL trigger `protect_last_active_admin` aborts any transaction that would demote, suspend, or delete the last remaining administrator of an organization.

### Section D: Demo Mode & Synthetic Data
14. **What is Demo Mode?**  
    A standalone, in-memory simulation populated with a realistic synthetic company (`Acme Systems Engineering`, 25 staff, 6 projects, 45 tasks) for demonstrations and testing.
15. **Are actions taken in Demo Mode saved to the database?**  
    No. Demo actions operate strictly in local React state and `localStorage`, leaving production database tables completely untouched.
16. **How do I exit Demo Mode?**  
    Click the **Exit Demo** button in the header or demo banner, or log into a real Supabase account.
17. **Why might metrics differ between Demo Mode and Live Mode?**  
    Demo mode displays fixed synthetic figures from `mockData.ts`. Live mode dynamically aggregates real records from your Supabase PostgreSQL database.

### Section E: AI, Privacy & Security
18. **Is my AI API key exposed to client browsers?**  
    No. `GEMINI_API_KEY` is strictly encapsulated within the server-side environment and never transmitted to client devices.
19. **What information is sent to external AI providers?**  
    Only anonymized deliverable titles, estimated hours, required skill tags, and departmental affiliations. No proprietary credentials or source code are transmitted.
20. **What happens if the AI provider experiences an outage?**  
    The system fails gracefully: managers can continue assigning deliverables manually using deterministic skill and capacity metrics.
21. **How does WorkForce enforce multi-tenant data isolation?**  
    Through PostgreSQL Row-Level Security (RLS). Every database query executes with the authenticated user's ID, and the database engine physically rejects access to rows belonging to other organizations.

### Section F: Setup, Troubleshooting & Diagnostics
22. **Why does my local signup fail with "Email not confirmed"?**  
    Supabase GoTrue defaults to requiring email confirmation. In development, click the confirmation link sent to your local Mailpit inbox (`http://localhost:54324`).
23. **Why did `pytest` fail with `ModuleNotFoundError: No module named 'app'`?**  
    Pytest must be executed from within the `backend/` directory or run with `PYTHONPATH=backend`. Running `cd backend && python -m pytest` resolves the path cleanly.
24. **Why is the dashboard showing "Zero members enrolled"?**  
    In Live Mode, this indicates you have initialized a fresh organization workspace and have not yet invited team members via `/employees`.
25. **How do I run the full test suite locally?**  
    Run `npm run build` in `frontend/`, `python -m pytest` in `backend/`, and `node scripts/demo_environment_test.js` in `frontend/`.

---

# Chapter 16 — Limitations, Technical Debt, Risks and Future Roadmap

### 16.1 Categorized Limitations and Technical Debt

#### Critical Priority:
- **Execute Proposed Organizer Role Migration**: Migration `20261021000001_add_organizer_role.sql` formally defines `organizer` in PostgreSQL `user_role` enum and adds `organizations.created_by`. Currently proposed and non-executed on production; role resolution falls back to earliest active member query.
- **Backend AI Router Endpoint**: Encapsulate the live Gemini API call inside a dedicated FastAPI router (`/api/v1/matching/recommend`) rather than relying on client-side composite calculation in live mode.

#### High Priority:
- **Live Notifications Database Table**: Currently, notifications are managed in-memory in `mockStore.tsx`. A dedicated PostgreSQL `notifications` table should be migrated to persist live alerts across sessions.
- **Automated SMTP Mailer**: Production email confirmations currently rely on default Supabase GoTrue mailers subject to strict rate limits. Integrating a dedicated SendGrid or Resend SMTP provider is recommended.

#### Medium Priority:
- **Calendar & PTO Integration**: Incorporating official holiday and PTO calendars (Google Calendar / Microsoft Outlook) to adjust `weekly_capacity_hours` dynamically during vacation periods.
- **Historical Sprint Trend Visualizations**: Persisting weekly `workload_snapshots` to render multi-sprint velocity graphs.

#### Low Priority:
- **Third-Party Collaboration Webhooks**: Dispatching notification alerts to Slack channels or Microsoft Teams webhooks upon deliverable assignment.
- **Enterprise SAML / SCIM Single Sign-On**: Streamlining user provisioning for Fortune 500 enterprise IT environments.

---

# Chapter 17 — Technical Glossary, Acronyms and References

### 17.1 Technical Glossary & Acronyms
- **ACID**: Atomicity, Consistency, Isolation, Durability — guarantees that database transactions are processed reliably.
- **API**: Application Programming Interface — protocols for communication between software components.
- **CSR**: Client-Side Rendering — rendering web pages in the browser using JavaScript.
- **GoTrue**: Supabase's open-source authentication server providing JWT issuance and email confirmation workflows.
- **JWKS**: JSON Web Key Set — a set of public cryptographic keys used to verify tokens issued by an authorization server.
- **JWT**: JSON Web Token — an open standard (RFC 7519) defining a compact, self-contained method for securely transmitting information as a JSON object.
- **Level-1 / Level-2 Locking**: Concurrency pattern in `assign_task` where `organization_memberships` is locked `FOR SHARE` before `tasks` is locked for update, preventing deadlocks.
- **LLM**: Large Language Model — artificial intelligence model trained on massive text corpora (e.g., Google Gemini).
- **PKCE**: Proof Key for Code Exchange — security extension to OAuth 2.0 preventing authorization code injection attacks.
- **RBAC**: Role-Based Access Control — restricting system access to authorized users based on designated organizational roles.
- **RLS**: Row-Level Security — a PostgreSQL security feature allowing administrators to define policies that restrict which rows a user can view or modify.
- **RPC**: Remote Procedure Call — executing a stored PL/pgSQL database function from a client application.
- **SSR**: Server-Side Rendering — generating HTML on the server before transmitting it to the client browser.

### 17.2 References & Canonical Documentation
1. **Next.js 15 Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
2. **FastAPI Documentation**: [https://fastapi.tiangolo.com](https://fastapi.tiangolo.com)
3. **Supabase PostgreSQL & RLS Guide**: [https://supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)
4. **Google GenAI Python SDK**: [https://github.com/google-gemini/generative-ai-python](https://github.com/google-gemini/generative-ai-python)
5. **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
6. **WorkForce Production Deployment**: [https://workforce-platform.vercel.app](https://workforce-platform.vercel.app)
7. **WorkForce Git Repository**: [https://github.com/Pranay-75/WorkForce](https://github.com/Pranay-75/WorkForce)
