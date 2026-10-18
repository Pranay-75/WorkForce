-- =============================================================================
-- WorkForce Database Migration: Projects, Project Members & Tasks
-- File: supabase/migrations/20261014000001_projects_and_tasks_schema.sql
-- Phase 2.2A: Database-backed Projects & Tasks with Strict Tenant Isolation,
-- Composite Foreign Keys, Row-Level Security & Concurrency Synchronization
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. TRANSACTIONAL PREFLIGHT CHECKS
-- =============================================================================
DO $$
DECLARE
    v_conflicts text[];
BEGIN
    -- Check for conflicting tables
    SELECT array_agg(c.relname) INTO v_conflicts
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('projects', 'project_members', 'tasks');

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Preflight abort: Tables already exist: %', array_to_string(v_conflicts, ', ');
    END IF;

    -- Check for conflicting enum types
    SELECT array_agg(t.typname) INTO v_conflicts
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname IN ('project_status', 'priority_level', 'task_status');

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Preflight abort: Types already exist: %', array_to_string(v_conflicts, ', ');
    END IF;

    -- Check for conflicting functions
    SELECT array_agg(p.proname) INTO v_conflicts
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
        'validate_task_required_skills',
        'enforce_project_manager_eligibility',
        'enforce_project_member_eligibility',
        'enforce_task_assignee_eligibility',
        'enforce_task_update_permissions',
        'assign_task',
        'cleanup_membership_references'
    );

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'Preflight abort: Functions already exist: %', array_to_string(v_conflicts, ', ');
    END IF;
END $$;

-- =============================================================================
-- 2. ENUM TYPES RECONCILED WITH FRONTEND DOMAIN
-- =============================================================================

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
);

CREATE TYPE public.priority_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE public.task_status AS ENUM (
    'todo',
    'in_progress',
    'in_review',
    'completed',
    'blocked'
);

-- =============================================================================
-- 3. STRICT JSONB SKILL PREREQUISITE VALIDATOR
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_task_required_skills(p_skills jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_item jsonb;
    v_skill_id text;
    v_skill_name text;
    v_min_prof text;
BEGIN
    IF p_skills IS NULL OR jsonb_typeof(p_skills) <> 'array' THEN
        RETURN FALSE;
    END IF;

    IF jsonb_array_length(p_skills) = 0 THEN
        RETURN TRUE;
    END IF;

    FOR v_item IN SELECT jsonb_array_elements(p_skills)
    LOOP
        IF jsonb_typeof(v_item) <> 'object' THEN
            RETURN FALSE;
        END IF;

        IF NOT (v_item ? 'skillId' AND v_item ? 'skillName' AND v_item ? 'minProficiency') THEN
            RETURN FALSE;
        END IF;

        IF jsonb_typeof(v_item->'skillId') <> 'string' OR
           jsonb_typeof(v_item->'skillName') <> 'string' OR
           jsonb_typeof(v_item->'minProficiency') <> 'string' THEN
            RETURN FALSE;
        END IF;

        v_skill_id := trim(both ' ' FROM (v_item->>'skillId'));
        v_skill_name := trim(both ' ' FROM (v_item->>'skillName'));
        v_min_prof := trim(both ' ' FROM (v_item->>'minProficiency'));

        IF v_skill_id = '' OR v_skill_name = '' THEN
            RETURN FALSE;
        END IF;

        IF v_min_prof NOT IN ('beginner', 'intermediate', 'advanced', 'expert') THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

ALTER FUNCTION public.validate_task_required_skills(jsonb) OWNER TO postgres;

-- =============================================================================
-- 4. TABLE DEFINITIONS WITH COMPOSITE TENANT INTEGRITY
-- =============================================================================

-- 4.1 Projects
CREATE TABLE public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status public.project_status NOT NULL DEFAULT 'planning',
    priority public.priority_level NOT NULL DEFAULT 'medium',
    manager_id uuid,
    start_date date,
    target_end_date date,
    total_hours numeric(8, 2) NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
    completed_hours numeric(8, 2) NOT NULL DEFAULT 0 CHECK (completed_hours >= 0),
    created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT uq_projects_id_org UNIQUE (id, organization_id),
    CONSTRAINT fk_projects_org_manager FOREIGN KEY (organization_id, manager_id)
        REFERENCES public.organization_memberships(organization_id, user_id)
        ON DELETE SET NULL (manager_id),
    CONSTRAINT chk_projects_dates CHECK (target_end_date IS NULL OR start_date IS NULL OR target_end_date >= start_date)
);

-- 4.2 Project Members
CREATE TABLE public.project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    PRIMARY KEY (project_id, user_id),
    CONSTRAINT fk_project_members_org_project FOREIGN KEY (project_id, organization_id)
        REFERENCES public.projects(id, organization_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project_members_org_user FOREIGN KEY (organization_id, user_id)
        REFERENCES public.organization_memberships(organization_id, user_id)
        ON DELETE CASCADE
);

-- 4.3 Tasks
CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    assigned_to uuid,
    status public.task_status NOT NULL DEFAULT 'todo',
    priority public.priority_level NOT NULL DEFAULT 'medium',
    complexity text NOT NULL DEFAULT 'Medium' CHECK (complexity IN ('Low', 'Medium', 'High')),
    due_date timestamptz,
    estimated_hours numeric(6, 2) NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
    actual_hours numeric(6, 2) CHECK (actual_hours IS NULL OR actual_hours >= 0),
    required_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT fk_tasks_org_project FOREIGN KEY (project_id, organization_id)
        REFERENCES public.projects(id, organization_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tasks_org_assignee FOREIGN KEY (organization_id, assigned_to)
        REFERENCES public.organization_memberships(organization_id, user_id)
        ON DELETE SET NULL (assigned_to),
    CONSTRAINT chk_tasks_skills CHECK (public.validate_task_required_skills(required_skills))
);

-- Indexes for performance
CREATE INDEX idx_projects_org ON public.projects(organization_id);
CREATE INDEX idx_projects_manager ON public.projects(organization_id, manager_id);
CREATE INDEX idx_project_members_user ON public.project_members(organization_id, user_id);
CREATE INDEX idx_tasks_org_proj ON public.tasks(organization_id, project_id);
CREATE INDEX idx_tasks_org_assignee ON public.tasks(organization_id, assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(organization_id, status);

-- =============================================================================
-- 5. LEAST-PRIVILEGE GRANTS & SUPABASE DEFAULT ACL STRIPPING
-- =============================================================================

-- Explicitly revoke default ACL grants from anon, authenticated, and public
REVOKE ALL ON public.projects, public.project_members, public.tasks FROM PUBLIC, anon, authenticated;

-- Projects: Full CRUD for authenticated users (guarded by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;

-- Project Members: Full CRUD for authenticated users (guarded by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;

-- Tasks: Selective Column Privileges (omitting assigned_to from UPDATE)
GRANT SELECT, DELETE ON public.tasks TO authenticated;

GRANT INSERT (
    id, organization_id, project_id, title, description,
    assigned_to, status, priority, complexity, due_date, estimated_hours,
    actual_hours, required_skills, created_at, updated_at
) ON public.tasks TO authenticated;

GRANT UPDATE (
    title, description, status, priority, complexity, due_date,
    estimated_hours, actual_hours, required_skills, updated_at
) ON public.tasks TO authenticated;

-- =============================================================================
-- 6. ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 6.1 Projects Policies
CREATE POLICY projects_select_policy ON public.projects
FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY projects_insert_policy ON public.projects
FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_admin(organization_id));

CREATE POLICY projects_update_policy ON public.projects
FOR UPDATE TO authenticated
USING (public.is_org_manager_or_admin(organization_id))
WITH CHECK (public.is_org_manager_or_admin(organization_id));

CREATE POLICY projects_delete_policy ON public.projects
FOR DELETE TO authenticated
USING (public.is_org_admin(organization_id));

-- 6.2 Project Members Policies
CREATE POLICY project_members_select_policy ON public.project_members
FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY project_members_insert_policy ON public.project_members
FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_admin(organization_id));

CREATE POLICY project_members_update_policy ON public.project_members
FOR UPDATE TO authenticated
USING (public.is_org_manager_or_admin(organization_id))
WITH CHECK (public.is_org_manager_or_admin(organization_id));

CREATE POLICY project_members_delete_policy ON public.project_members
FOR DELETE TO authenticated
USING (public.is_org_manager_or_admin(organization_id));

-- 6.3 Tasks Policies
CREATE POLICY tasks_select_policy ON public.tasks
FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY tasks_insert_policy ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.is_org_manager_or_admin(organization_id));

CREATE POLICY tasks_update_policy ON public.tasks
FOR UPDATE TO authenticated
USING (
    public.is_org_manager_or_admin(organization_id)
    OR (
        public.is_org_member(organization_id)
        AND assigned_to = auth.uid()
    )
)
WITH CHECK (
    public.is_org_manager_or_admin(organization_id)
    OR (
        public.is_org_member(organization_id)
        AND assigned_to = auth.uid()
    )
);

CREATE POLICY tasks_delete_policy ON public.tasks
FOR DELETE TO authenticated
USING (public.is_org_manager_or_admin(organization_id));

-- =============================================================================
-- 7. PROCEDURAL INTEGRITY TRIGGERS & RPC FUNCTIONS
-- =============================================================================

-- 7.1 Project Manager Eligibility Trigger
CREATE OR REPLACE FUNCTION public.enforce_project_manager_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_status text;
    v_role text;
BEGIN
    IF NEW.manager_id IS NOT NULL THEN
        SELECT status::text, role::text INTO v_status, v_role
        FROM public.organization_memberships
        WHERE organization_id = NEW.organization_id
          AND user_id = NEW.manager_id
        FOR SHARE;

        IF v_status IS NULL THEN
            RAISE EXCEPTION 'Project manager must be a member of the organization.' USING ERRCODE = '23503';
        END IF;

        IF v_status <> 'active' THEN
            RAISE EXCEPTION 'Project manager must be an active member of the organization.' USING ERRCODE = '42501';
        END IF;

        IF v_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Project manager must have an admin or manager role.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_project_manager_eligibility() OWNER TO postgres;

CREATE TRIGGER trg_enforce_project_manager_insert
BEFORE INSERT ON public.projects
FOR EACH ROW
WHEN (NEW.manager_id IS NOT NULL)
EXECUTE FUNCTION public.enforce_project_manager_eligibility();

CREATE TRIGGER trg_enforce_project_manager_update
BEFORE UPDATE OF manager_id, organization_id ON public.projects
FOR EACH ROW
WHEN (
    (NEW.manager_id IS DISTINCT FROM OLD.manager_id AND NEW.manager_id IS NOT NULL)
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
)
EXECUTE FUNCTION public.enforce_project_manager_eligibility();

-- 7.2 Project Member Eligibility Trigger
CREATE OR REPLACE FUNCTION public.enforce_project_member_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_status text;
BEGIN
    SELECT status::text INTO v_status
    FROM public.organization_memberships
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.user_id
    FOR SHARE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Project member must belong to the organization.' USING ERRCODE = '23503';
    END IF;

    IF v_status <> 'active' THEN
        RAISE EXCEPTION 'Project member must be an active member.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_project_member_eligibility() OWNER TO postgres;

CREATE TRIGGER trg_enforce_project_member_insert
BEFORE INSERT ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_member_eligibility();

CREATE TRIGGER trg_enforce_project_member_update
BEFORE UPDATE OF user_id, organization_id ON public.project_members
FOR EACH ROW
WHEN (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
)
EXECUTE FUNCTION public.enforce_project_member_eligibility();

-- 7.3 Task Assignee Eligibility Trigger (Level 1 Lock Acquisition)
CREATE OR REPLACE FUNCTION public.enforce_task_assignee_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_status text;
BEGIN
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT status::text INTO v_status
        FROM public.organization_memberships
        WHERE organization_id = NEW.organization_id
          AND user_id = NEW.assigned_to
        FOR SHARE;

        IF v_status IS NULL THEN
            RAISE EXCEPTION 'Assignee must be a member of the organization.' USING ERRCODE = '23503';
        END IF;

        IF v_status <> 'active' THEN
            RAISE EXCEPTION 'Assignee must be an active member of the organization.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_task_assignee_eligibility() OWNER TO postgres;

CREATE TRIGGER trg_enforce_task_assignee_insert
BEFORE INSERT ON public.tasks
FOR EACH ROW
WHEN (NEW.assigned_to IS NOT NULL)
EXECUTE FUNCTION public.enforce_task_assignee_eligibility();

CREATE TRIGGER trg_enforce_task_assignee_update
BEFORE UPDATE OF assigned_to, organization_id ON public.tasks
FOR EACH ROW
WHEN (
    (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL)
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
)
EXECUTE FUNCTION public.enforce_task_assignee_eligibility();

-- 7.4 Task Update Permissions & Employee Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_task_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text;
BEGIN
    -- Context 1: Engine FK Action during parent deletion (auth.uid() IS NULL)
    IF v_uid IS NULL THEN
        IF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
            IF NEW.id = OLD.id
               AND NEW.organization_id = OLD.organization_id
               AND NEW.project_id = OLD.project_id
               AND NEW.title = OLD.title
               AND NEW.description IS NOT DISTINCT FROM OLD.description
               AND NEW.status = OLD.status
               AND NEW.priority = OLD.priority
               AND NEW.complexity = OLD.complexity
               AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date
               AND NEW.estimated_hours = OLD.estimated_hours
               AND NEW.actual_hours IS NOT DISTINCT FROM OLD.actual_hours
               AND NEW.required_skills = OLD.required_skills
               AND NEW.created_at = OLD.created_at THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.organization_memberships
                    WHERE organization_id = OLD.organization_id
                      AND user_id = OLD.assigned_to
                      AND status = 'active'
                ) THEN
                    NEW.updated_at := pg_catalog.now();
                    RETURN NEW;
                END IF;
            END IF;
        END IF;
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Context 2: Authenticated Client Request
    v_role := public.get_user_org_role(NEW.organization_id)::text;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Not an active member of this organization.' USING ERRCODE = '42501';
    END IF;

    -- Admins and Managers have full metadata modification authority
    IF v_role IN ('admin', 'manager') THEN
        NEW.updated_at := pg_catalog.now();
        RETURN NEW;
    END IF;

    -- Context 3: Employee Self-Service Status-Only Update (NULL-Safe Immutability)
    IF v_role = 'employee' THEN
        IF OLD.assigned_to IS DISTINCT FROM v_uid THEN
            RAISE EXCEPTION 'Employees may only update tasks assigned to them.' USING ERRCODE = '42501';
        END IF;

        IF NEW.id IS DISTINCT FROM OLD.id OR
           NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
           NEW.project_id IS DISTINCT FROM OLD.project_id OR
           NEW.title IS DISTINCT FROM OLD.title OR
           NEW.description IS DISTINCT FROM OLD.description OR
           NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR
           NEW.priority IS DISTINCT FROM OLD.priority OR
           NEW.complexity IS DISTINCT FROM OLD.complexity OR
           NEW.due_date IS DISTINCT FROM OLD.due_date OR
           NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours OR
           NEW.actual_hours IS DISTINCT FROM OLD.actual_hours OR
           NEW.required_skills IS DISTINCT FROM OLD.required_skills OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Employees may only update task status.' USING ERRCODE = '42501';
        END IF;

        NEW.updated_at := pg_catalog.now();
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Permission denied.' USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.enforce_task_update_permissions() OWNER TO postgres;

CREATE TRIGGER trg_enforce_task_update_permissions
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_update_permissions();

-- 7.5 Controlled Task Assignment RPC Function (Level 1 then Level 2 Locking)
CREATE OR REPLACE FUNCTION public.assign_task(
    p_task_id uuid,
    p_assignee_id uuid
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_task public.tasks;
    v_org_id uuid;
    v_status text;
BEGIN
    -- 1. Identify organization without row locking
    SELECT organization_id INTO v_org_id FROM public.tasks WHERE id = p_task_id;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Task % not found.', p_task_id USING ERRCODE = 'P0002';
    END IF;

    -- 2. Verify caller is an active manager or admin in the task's organization
    IF NOT public.is_org_manager_or_admin(v_org_id) THEN
        RAISE EXCEPTION 'Only managers and admins can assign or reassign tasks.' USING ERRCODE = '42501';
    END IF;

    -- 3. Lock Level 1: Acquire FOR SHARE on organization_memberships FIRST
    IF p_assignee_id IS NOT NULL THEN
        SELECT status::text INTO v_status
        FROM public.organization_memberships
        WHERE organization_id = v_org_id
          AND user_id = p_assignee_id
        FOR SHARE;

        IF v_status IS NULL THEN
            RAISE EXCEPTION 'Assignee must be a member of the organization.' USING ERRCODE = '23503';
        END IF;

        IF v_status <> 'active' THEN
            RAISE EXCEPTION 'Assignee must be an active member of the organization.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Lock Level 2: Lock and update task SECOND
    UPDATE public.tasks
    SET assigned_to = p_assignee_id,
        updated_at = pg_catalog.now()
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

ALTER FUNCTION public.assign_task(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.assign_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_task(uuid, uuid) TO authenticated;

-- 7.6 Membership State Change Cleanup Trigger (Level 1 then Level 2 Locking)
CREATE OR REPLACE FUNCTION public.cleanup_membership_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'active' AND NEW.status <> 'active' THEN
            UPDATE public.tasks
            SET assigned_to = NULL
            WHERE organization_id = NEW.organization_id
              AND assigned_to = NEW.user_id;

            UPDATE public.projects
            SET manager_id = NULL
            WHERE organization_id = NEW.organization_id
              AND manager_id = NEW.user_id;

            DELETE FROM public.project_members
            WHERE organization_id = NEW.organization_id
              AND user_id = NEW.user_id;
        END IF;

        IF OLD.role IN ('admin'::public.user_role, 'manager'::public.user_role)
           AND NEW.role NOT IN ('admin'::public.user_role, 'manager'::public.user_role) THEN
            UPDATE public.projects
            SET manager_id = NULL
            WHERE organization_id = NEW.organization_id
              AND manager_id = NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.cleanup_membership_references() OWNER TO postgres;

CREATE TRIGGER trg_cleanup_membership_references
AFTER UPDATE OF status, role ON public.organization_memberships
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_membership_references();

-- =============================================================================
-- 8. PRIVILEGE HARDENING ON INTERNAL TRIGGER FUNCTIONS
-- =============================================================================
-- Internal trigger functions must never be directly executable by client roles
REVOKE ALL ON FUNCTION public.enforce_project_manager_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_project_member_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_task_assignee_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_task_update_permissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_membership_references() FROM PUBLIC, anon, authenticated;

COMMIT;
