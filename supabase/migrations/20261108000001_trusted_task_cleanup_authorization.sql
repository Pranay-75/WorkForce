-- =============================================================================
-- Migration: 20261108000001_trusted_task_cleanup_authorization.sql
-- Description: Implement trusted invariant task cleanup in enforce_task_update_permissions.
--              Elevates inactive-assignee unassignment to the beginning of the
--              trigger so automated cascades (cleanup_membership_references) and
--              engine actions can safely unassign orphan tasks without requiring
--              client task-editing privileges, while strictly preserving task metadata
--              immutability and existing role-based authorization.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.enforce_task_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'pg_temp'
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text;
BEGIN
    -- =========================================================================
    -- INVARIANT CLEANUP: Unassigning Inactive / Orphaned Assignees
    -- Evaluated first regardless of session auth context (FK actions & triggers)
    -- =========================================================================
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

    -- =========================================================================
    -- CONTEXT 1: Engine FK Action during parent deletion (auth.uid() IS NULL)
    -- =========================================================================
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- =========================================================================
    -- CONTEXT 2: Authenticated Client Request
    -- =========================================================================
    v_role := public.get_user_org_role(NEW.organization_id)::text;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Not an active member of this organization.' USING ERRCODE = '42501';
    END IF;

    -- Organizers, Admins, and Managers have full metadata modification authority
    IF v_role IN ('organizer', 'admin', 'manager') THEN
        NEW.updated_at := pg_catalog.now();
        RETURN NEW;
    END IF;

    -- =========================================================================
    -- CONTEXT 3: Employee Self-Service Status-Only Update (NULL-Safe Immutability)
    -- =========================================================================
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
REVOKE ALL ON FUNCTION public.enforce_task_update_permissions() FROM PUBLIC, anon, authenticated;

