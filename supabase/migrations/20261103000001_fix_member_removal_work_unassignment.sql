-- =============================================================================
-- Migration: 20261103000001_fix_member_removal_work_unassignment.sql
-- Description: Ensures clean unassignment of active tasks, projects, and project
--              memberships upon active member removal without deleting task/project
--              history, and grants Organizer task modification parity in triggers.
-- =============================================================================

-- 1. Update enforce_task_update_permissions trigger function
-- Grant 'organizer' role authority alongside 'admin' and 'manager'
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

    -- Organizers, Admins, and Managers have full metadata modification authority
    IF v_role IN ('organizer', 'admin', 'manager') THEN
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

-- 2. Update remove_organization_member RPC
-- Explicitly unassigns active tasks and managed projects, and removes project memberships,
-- while preserving all task history, project records, and immutable audit logs.
CREATE OR REPLACE FUNCTION public.remove_organization_member(
    p_organization_id UUID,
    p_member_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_is_organizer BOOLEAN;
    v_is_admin BOOLEAN;
    v_target_role public.user_role;
    v_membership_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_is_organizer := public.is_org_organizer(p_organization_id);
    v_is_admin := public.is_org_admin(p_organization_id);

    IF NOT (v_is_organizer OR v_is_admin) THEN
        RAISE EXCEPTION 'Only organization administrators or organizers can remove members.' USING ERRCODE = '42501';
    END IF;

    SELECT id, role INTO v_membership_id, v_target_role
    FROM public.organization_memberships
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id
      AND status = 'active'::public.membership_status;

    IF v_membership_id IS NULL THEN
        RAISE EXCEPTION 'Active member not found in this organization.' USING ERRCODE = '42501';
    END IF;

    IF v_target_role = 'organizer'::public.user_role THEN
        RAISE EXCEPTION 'Cannot remove the organization organizer. Ownership must be transferred.' USING ERRCODE = '42501';
    END IF;

    -- Only Organizer can remove an Admin
    IF v_target_role = 'admin'::public.user_role AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only the organization organizer can remove an administrator.' USING ERRCODE = '42501';
    END IF;

    -- Explicitly unassign active work before deleting membership to ensure deterministic cleanup
    UPDATE public.tasks
    SET assigned_to = NULL
    WHERE organization_id = p_organization_id
      AND assigned_to = p_member_user_id;

    UPDATE public.projects
    SET manager_id = NULL
    WHERE organization_id = p_organization_id
      AND manager_id = p_member_user_id;

    DELETE FROM public.project_members
    WHERE organization_id = p_organization_id
      AND user_id = p_member_user_id;

    DELETE FROM public.organization_memberships WHERE id = v_membership_id;

    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    ) VALUES (
        p_organization_id,
        v_caller_id,
        p_member_user_id,
        'member.removed',
        pg_catalog.jsonb_build_object(
            'removed_user_id', p_member_user_id,
            'role', v_target_role,
            'membership_id', v_membership_id
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'status', 'member_removed',
        'membership_id', v_membership_id,
        'user_id', p_member_user_id,
        'role', v_target_role
    );
END;
$$;

ALTER FUNCTION public.remove_organization_member(UUID, UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(UUID, UUID) TO authenticated;

