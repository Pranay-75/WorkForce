# WorkForce - Database Data Model (Supabase PostgreSQL)

This document specifies the relational database schema, entity definitions, constraints, indexes, and PostgreSQL Row-Level Security (RLS) policies for the WorkForce platform.

---

## 1. Entity-Relationship Overview

```
 organizations (id PK)
       │
       ├──< profiles (id PK, org_id FK, auth_user_id FK)
       │         │
       │         ├──< employee_skills (profile_id FK, skill_id FK)
       │         ├──< task_assignments (task_id FK, profile_id FK)
       │         ├──< workload_snapshots (profile_id FK)
       │         └──< notifications (profile_id FK)
       │
       ├──< skills (id PK, org_id FK)
       │         │
       │         └──< task_skills (task_id FK, skill_id FK)
       │
       ├──< projects (id PK, org_id FK, manager_id FK)
       │         │
       │         ├──< project_members (project_id FK, profile_id FK)
       │         └──< tasks (id PK, org_id FK, project_id FK)
       │                   │
       │                   ├──< task_skills
       │                   ├──< task_assignments
       │                   ├──< task_status_history (task_id FK)
       │                   └──< ai_recommendations (task_id FK, candidate_id FK)
       │                             │
       │                             └──< manager_decisions (recommendation_id FK)
       │
       └──< audit_events (id PK, org_id FK, actor_id FK)
```

---

## 2. Table Specifications & DDL

### 2.1 `organizations`
Multi-tenant isolation root.
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_organizations_slug ON organizations(slug);
```

### 2.2 `profiles`
User profile extending `auth.users` with workforce capacity attributes.
```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'employee',
    department TEXT NOT NULL DEFAULT 'Engineering',
    job_title TEXT NOT NULL DEFAULT 'Software Engineer',
    weekly_capacity_hours NUMERIC(5,2) NOT NULL DEFAULT 40.00 CHECK (weekly_capacity_hours > 0),
    current_load_hours NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (current_load_hours >= 0),
    burnout_risk_score NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (burnout_risk_score BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_profiles_org ON profiles(organization_id);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### 2.3 `skills` & `employee_skills`
Skill taxonomy and employee proficiency mapping.
```sql
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, name)
);
CREATE INDEX idx_skills_org ON skills(organization_id);

CREATE TABLE employee_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency skill_level NOT NULL DEFAULT 'intermediate',
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(profile_id, skill_id)
);
CREATE INDEX idx_employee_skills_profile ON employee_skills(profile_id);
CREATE INDEX idx_employee_skills_skill ON employee_skills(skill_id);
```

### 2.4 `projects` & `project_members`
Project portfolios and team allocation.
```sql
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'on_hold', 'completed');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'planning',
    priority priority_level NOT NULL DEFAULT 'medium',
    start_date DATE NOT NULL,
    target_end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_projects_org ON projects(organization_id);

CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_in_project TEXT DEFAULT 'Contributor',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(project_id, profile_id)
);
```

### 2.5 `tasks`, `task_skills` & `task_assignments`
Task items, skill prerequisites, and assignee relations.
```sql
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'in_review', 'completed', 'blocked');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority priority_level NOT NULL DEFAULT 'medium',
    estimated_hours NUMERIC(5,2) NOT NULL DEFAULT 4.00 CHECK (estimated_hours > 0),
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_tasks_org_project ON tasks(organization_id, project_id);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE TABLE task_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    min_proficiency skill_level NOT NULL DEFAULT 'intermediate',
    UNIQUE(task_id, skill_id)
);

CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    allocated_hours NUMERIC(5,2) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(task_id, profile_id)
);
CREATE INDEX idx_task_assignments_profile ON task_assignments(profile_id);
```

### 2.6 `task_status_history`
Audit log for task state changes.
```sql
CREATE TABLE task_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    previous_status task_status,
    new_status task_status NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_task_status_history ON task_status_history(task_id, changed_at);
```

### 2.7 `ai_recommendations` & `manager_decisions`
Explainable AI match records and manager approval audit log.
```sql
CREATE TYPE recommendation_status AS ENUM ('pending', 'accepted', 'rejected', 'overridden');

CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    match_score NUMERIC(5,2) NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    skill_match_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    workload_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
    rationale TEXT NOT NULL,
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status recommendation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_ai_recs_task ON ai_recommendations(task_id);

CREATE TABLE manager_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES ai_recommendations(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    decision recommendation_status NOT NULL,
    feedback_reason TEXT,
    override_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 2.8 `workload_snapshots`
Time-series capacity snapshots for trend and burnout analysis.
```sql
CREATE TABLE workload_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    allocated_hours NUMERIC(5,2) NOT NULL,
    capacity_hours NUMERIC(5,2) NOT NULL,
    utilization_rate NUMERIC(5,2) NOT NULL,
    active_task_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(profile_id, snapshot_date)
);
CREATE INDEX idx_workload_snapshots ON workload_snapshots(profile_id, snapshot_date);
```

### 2.9 `audit_events` & `notifications`
Governance compliance history and in-app alerts.
```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_audit_events_org ON audit_events(organization_id, occurred_at DESC);

CREATE TYPE notification_type AS ENUM ('task_assigned', 'recommendation_ready', 'capacity_alert', 'deadline_warning');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'task_assigned',
    link_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX idx_notifications_profile ON notifications(profile_id, is_read);
```

---

## 3. Row-Level Security (RLS) Policies

All tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

```sql
-- Helper function to extract user organization from JWT / profiles table
CREATE OR REPLACE FUNCTION current_user_org_id() 
RETURNS UUID AS $$
    SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Organizations Policy
CREATE POLICY org_isolation ON organizations
    FOR ALL USING (id = current_user_org_id());

-- 2. Profiles Policy
CREATE POLICY profile_org_isolation ON profiles
    FOR SELECT USING (organization_id = current_user_org_id());

CREATE POLICY profile_admin_update ON profiles
    FOR UPDATE USING (
        organization_id = current_user_org_id() 
        AND (auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
    );

-- 3. Projects & Tasks Policy
CREATE POLICY projects_org_isolation ON projects
    FOR ALL USING (organization_id = current_user_org_id());

CREATE POLICY tasks_org_isolation ON tasks
    FOR ALL USING (organization_id = current_user_org_id());

-- 4. Recommendations & Decisions Policy
CREATE POLICY recs_org_isolation ON ai_recommendations
    FOR ALL USING (organization_id = current_user_org_id());

-- 5. Notifications Policy
CREATE POLICY notifs_user_isolation ON notifications
    FOR ALL USING (profile_id = auth.uid());

-- 6. Audit Events Policy (Admins only for read, system for insert)
CREATE POLICY audit_admin_read ON audit_events
    FOR SELECT USING (
        organization_id = current_user_org_id() 
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    );
```
