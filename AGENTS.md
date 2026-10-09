# WorkForce - Project Guidelines & Agent Directives (AGENTS.md)

This document establishes the mandatory architectural standards, development workflows, security requirements, domain business rules, and delivery expectations for the **WorkForce** project. All AI agents, contributors, and automated pipelines must strictly adhere to these instructions.

---

## 1. ARCHITECTURE

- **Frontend**: Use Next.js App Router, TypeScript, and Tailwind CSS. Avoid ad-hoc styling; use structured, maintainable design tokens and components.
- **Backend**: Use Python FastAPI for all backend APIs, complex computations, and trusted business logic.
- **Database & Authentication**: Use Supabase PostgreSQL and Supabase Auth.
- **AI Integration**: Keep all Google Gemini API calls encapsulated within the Python FastAPI backend. Never expose AI API keys or execute raw AI model calls directly from the frontend client.
- **Modularity & Structure**: Maintain a strict separation of concerns across the codebase:
  - `frontend/`: UI components, client state, pages/routes, and Supabase client-side queries.
  - `backend/`: FastAPI routers, business services, heuristic engines, AI prompt pipelines, and Pydantic schemas.
  - `supabase/`: SQL migrations, schema definitions, seed scripts, and Row-Level Security (RLS) policies.
  - `tests/`: Automated unit, integration, and end-to-end verification suites.
  - `docs/`: System documentation, architecture diagrams, and API specifications.

---

## 2. DEVELOPMENT WORKFLOW

- **Inspect First**: Always inspect existing files, dependencies, and project structures before making edits or adding dependencies.
- **Incremental & Verifiable Progress**: Implement one small, testable, and verifiable feature at a time.
- **Preserve Working Functionality**: Never replace or refactor working functionality without explicit rationale and clear explanation.
- **Honest Verification**: Never claim a feature, test, or build works without actually running it and verifying output.
- **Post-Change Validation**: Run relevant build, lint, and test checks after code changes and report the exact results transparently.
- **Code Quality & Typing**: Enforce strong static typing (TypeScript on frontend, Pydantic/type hints in Python), robust input validation, clear error boundaries, and self-documenting naming conventions.
- **Environment Variables**: Document all required environment variables in `.env.example` templates across frontend and backend. Never include live secrets or credentials in example files.

---

## 3. SECURITY & ACCESS CONTROL

- **Secret Protection**: Never commit API keys, service role keys, database passwords, or production credentials to source control.
- **Client Security**: Never expose privileged Supabase keys (`service_role`) or backend private keys to the browser.
- **Server-Side Authorization**: Enforce authorization and permissions strictly on the server and database level, never relying solely on UI element visibility.
- **Tenant & Role Verification**: Validate organization membership and role permissions (Admin, Manager, Employee) on every protected backend operation.
- **Row-Level Security (RLS)**: Enforce PostgreSQL Row-Level Security on all database tables to guarantee multi-tenant data isolation.
- **Zero-Trust Inputs**: Never trust client-supplied employee IDs, role names, organization IDs, or AI-generated suggestions without server-side validation and verification.

---

## 4. WORKFORCE BUSINESS RULES

- **Human-in-the-Loop**: AI recommendations are strictly advisory and require explicit manager/admin approval before tasks are assigned or reallocated.
- **Deterministic Constraint Enforcement**: Mandatory skill requirements, availability constraints, and capacity limits must be computed and enforced by deterministic backend logic before or alongside AI scoring.
- **Explainable & Reproducible Matching**: Match scores must be reproducible and their contributing factors (skill overlap, availability, workload delta) clearly explained to the user.
- **Transparent Calculations**: Workload calculations and risk indicators must rely on documented formulas and actual available data.
- **Ethical Risk Framing**: Never present heuristic burnout or workload risk scores as validated clinical or psychological predictions. Frame them transparently as operational workload metrics.
- **Audit Logging**: Record all critical operations—assignments, reassignments, AI recommendation approvals, and manual overrides—in an immutable audit history.
- **Realistic Synthetic Data**: Use realistic synthetic sample datasets for development, demonstrations, and test scenarios.

---

## 5. DELIVERY & USABILITY

- **Documentation**: Keep `README.md` continuously updated with accurate project descriptions, prerequisites, and instructions.
- **Operational Clarity**: Provide clear, copy-pasteable commands for local setup, running tests, database migrations, and deployment.
- **UX Polish**: Include meaningful empty states, loading skeletons, success confirmations, and actionable error states across all UI views.
- **Test Integrity**: Never skip tests, fake assertions, or suppress failures merely to report success.
