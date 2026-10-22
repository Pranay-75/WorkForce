# WorkForce: AI-Powered Workforce Capacity SaaS

**Production Platform**: [workforce-platform.vercel.app](https://workforce-platform.vercel.app)

WorkForce is an enterprise-grade workforce capacity monitoring, explainable task matching, and workload balancing platform built with Next.js 15, Python FastAPI, Supabase PostgreSQL with Row-Level Security (RLS), and Google Gemini.

---

## 🚀 Architecture & Modules

* **Frontend (`frontend/`)**: Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS.
  * Role-adaptive dashboards for Admins, Managers, and Employees.
  * Interactive presentation/demo showcase at `/presentation`.
  * Deterministic workload analytics and zero-trust data hooks.
* **Backend (`backend/`)**: Python FastAPI backend enforcing server-side business rules, zero-trust token decoding, and Role-Based Access Control (RBAC).
* **Database & Auth (`supabase/`)**: PostgreSQL schema with Row-Level Security (RLS), custom RPC functions, security definer triggers, and audit logging.
* **Testing (`backend/tests/` & `frontend/scripts/`)**: End-to-end regression suites for multi-tenancy, cross-tenant isolation, role boundaries, and token validation.

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
* **Node.js**: `20.x` or higher (`npm 10.x+`)
* **Python**: `3.11` to `3.14` (`pip`)
* **Supabase**: Local Supabase CLI / Docker container or hosted Supabase project.

---

### 1. Environment Configuration

Copy the root environment template or set up individual directories:

```bash
# Frontend configuration
cp .env.example frontend/.env.local
# Edit frontend/.env.local with your Supabase URL and anon key

# Backend configuration
cp .env.example backend/.env
# Edit backend/.env with your Supabase URL, key, and secrets
```

---

### 2. Database Setup (Supabase)

The migration and seed files are located in `supabase/migrations/`:
1. `20261010000001_initial_auth_schema.sql`: Core organizations, profiles, memberships, RLS policies, and triggers.
2. `20261011000001_restrict_organization_creation.sql`: Single-organization limit and promotion RPCs.
3. `20261014000001_projects_and_tasks_schema.sql`: Projects, tasks, skills prerequisites, and assignment RPCs.
4. `20261014000002_member_invitations_and_roles.sql`: Workspace member invitations, token hashing, and claim triggers.
5. `20261014000003_member_invitations_hardening.sql`: Security hardening for invitation lifecycle.
6. `seed.sql`: Realistic seed data with Admin, Manager, and Employee profiles.

**Local Development via Supabase CLI**:
```bash
supabase start
supabase db reset
```

---

### 3. Frontend Setup (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Run TypeScript type check
npx tsc --noEmit

# Run production build
npm run build

# Start the development server (runs on http://localhost:3000)
npm run dev
```

* Visit [http://localhost:3000/login](http://localhost:3000/login) to sign in or explore demo roles.
* Visit [http://localhost:3000/presentation](http://localhost:3000/presentation) for the standalone interactive demo.

---

### 4. Backend Setup (FastAPI)

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run automated security & auth test suite (29 tests)
python -m pytest -v

# Start FastAPI development server (runs on http://localhost:8000)
python run.py
```

API documentation is accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 📂 Repository Layout

```
WorkForce/
├── frontend/                       # Next.js 15 App Router, React 19, Tailwind CSS
│   ├── app/                        # Application routes (dashboard, tasks, employees, presentation)
│   ├── components/                 # Reusable layout and design system UI components
│   ├── lib/                        # Auth context, Supabase clients, hooks, domain types
│   ├── scripts/                    # Verification and regression test scripts
│   └── middleware.ts               # Session refresh and route guard middleware
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                    # V1 routers (auth, health) and dependencies (deps.py)
│   │   ├── core/                   # Security, configuration, and database client
│   │   └── models/                 # Pydantic schemas (users, orgs, profiles)
│   └── tests/                      # Automated JWT and RBAC security test suite (29 passed)
├── supabase/                       # Supabase SQL migrations, configurations, and seeds
│   ├── migrations/                 # PostgreSQL migrations (auth, projects, tasks, invitations)
│   └── seed.sql                    # Initial seed data
├── docs/                           # Architectural specifications and data models
├── .env.example                    # Monorepo environment configuration template
├── AGENTS.md                       # Workforce architectural guidelines and agent directives
└── README.md                       # Project documentation
```

---

## 🔒 Security Directives

* **Zero-Trust Token Validation**: All authenticated API calls verify cryptographic JWT signatures against Supabase keys or JWKS endpoints.
* **Row-Level Security**: Multi-tenant data isolation is strictly enforced at the PostgreSQL database level.
* **Secret Protection**: Secrets, private keys, and hosted database dumps (`backups/`) are strictly ignored and must never be committed.