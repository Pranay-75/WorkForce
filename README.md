# WorkForce: AI-Powered Workforce Capacity SaaS

WorkForce is an intelligent workforce capacity, explainable task matching, and workload balancing SaaS platform built with Next.js 15, Python FastAPI, Supabase PostgreSQL & Auth, and Google Gemini.

---

## 🚀 Architecture & Phases

* **Phase 1 (Complete)**: Next.js App Router design system, 19 responsive routes, role-adaptive dashboards for Admin, Manager, and Employee, and deterministic capacity engine.
* **Phase 2 (Active)**: Supabase PostgreSQL database schema with strict Row-Level Security (RLS), Supabase Auth server session integration, and Python FastAPI backend with zero-trust token verification and Role-Based Access Control (RBAC).

---

## 🛠️ Quick Start & Local Setup

### Prerequisites
* **Node.js**: `20.x` or higher (`npm 10.x+`)
* **Python**: `3.11` to `3.14` (`pip`)
* **Supabase**: Active Supabase project (e.g. `wxkjygctdonpeypgrcnf`)

---

### 1. Database Setup (Supabase)

The migration and seed files are located in `supabase/`:
* [20261010000001_initial_auth_schema.sql](file:///d:/WorkForce/supabase/migrations/20261010000001_initial_auth_schema.sql): Creates `organizations`, `user_profiles`, `organization_memberships`, ENUMs, security definer functions, auto-profile trigger, and strict multi-tenant RLS policies.
* [seed.sql](file:///d:/WorkForce/supabase/seed.sql): Creates demo organization and seed profiles for Admin, Manager, and Employee roles.

**Apply via Supabase Dashboard**:
1. Open your Supabase Dashboard SQL Editor: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Run the SQL from `supabase/migrations/20261010000001_initial_auth_schema.sql`.
3. Run the SQL from `supabase/seed.sql`.

---

### 2. Frontend Setup (Next.js)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Environment variables (.env.local)
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Start the frontend server (runs on http://localhost:3000)
npm run dev
```

Visit [http://localhost:3000/login](http://localhost:3000/login) to sign in or use the quick-fill demo buttons.

---

### 3. Backend Setup (FastAPI)

```bash
# Navigate to backend
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Run automated tests
python -m pytest -v

# Start FastAPI backend server (runs on http://localhost:8000)
python run.py
```

API documentation is accessible at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 📂 Project Structure

```
WorkForce/
├── frontend/                       # Next.js 15 App Router, React 19, Tailwind CSS
│   ├── app/                        # 19 Static & Dynamic routes (/dashboard, /tasks, /login, etc.)
│   ├── components/
│   │   ├── layout/                 # AppSidebar, AppHeader, AppShell
│   │   └── ui/                     # Design system component library
│   ├── lib/
│   │   ├── authContext.tsx         # Supabase Auth session provider
│   │   ├── supabase/               # SSR client, browser client, middleware
│   │   ├── mockStore.tsx           # Reactive deterministic workload store
│   │   └── types.ts                # TypeScript domain models
│   └── middleware.ts               # Next.js session refresh & route protection
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                    # V1 routers (auth, health) & dependencies (deps.py)
│   │   ├── core/                   # config.py, database.py, security.py (JWT verification)
│   │   ├── models/                 # Pydantic schemas (users, orgs, profiles)
│   │   └── main.py                 # FastAPI application factory
│   ├── tests/
│   │   └── test_auth.py            # Automated token & RBAC tests (9/9 passed)
│   └── requirements.txt
├── supabase/                       # Supabase Database Migrations & Seeds
│   ├── migrations/
│   │   └── 20261010000001_initial_auth_schema.sql
│   └── seed.sql
├── docs/                           # Architecture Specifications & Acceptance Criteria
├── AGENTS.md                       # Core project guidelines & agent directives
└── README.md
```