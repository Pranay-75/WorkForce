-- =============================================================================
-- Migration: 20261105000001_organizer_full_control_and_membership_boundary.sql
-- Description:
--   1. Ensures Organizer has full administrative control within their organization
--      (projects, tasks, assignments, members, roles, settings).
--   2. Enforces that Organizer authority is strictly derived from an active
--      membership with role 'organizer' in the relevant organization.
--   3. Removes blanket 'created_by' bypasses from helper functions to ensure
--      strict multi-tenant isolation and membership-bound authority.
--   4. Updates project manager eligibility trigger to include 'organizer'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper: is_org_organizer
-- Authority strictly derived from active membership with role 'organizer'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_organizer(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role = 'organizer'::public.user_role
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_organizer(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_organizer(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. Helper: is_org_admin
-- Returns TRUE if caller is an active Organizer or Admin in the organization.
-- Authority strictly derived from active membership.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role IN ('organizer'::public.user_role, 'admin'::public.user_role)
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. Helper: is_org_manager_or_admin
-- Returns TRUE if caller is an active Organizer, Admin, or Manager in the org.
-- Fixes project insertion, project editing, task creation, and task assignment
-- for Organizers.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_manager_or_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role IN (
              'organizer'::public.user_role,
              'admin'::public.user_role,
              'manager'::public.user_role
          )
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_manager_or_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Trigger Function: enforce_project_manager_eligibility
-- Permits active Organizers, Admins, and Managers to be designated project managers.
-- -----------------------------------------------------------------------------
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

        IF v_role NOT IN ('organizer', 'admin', 'manager') THEN
            RAISE EXCEPTION 'Project manager must have an organizer, admin, or manager role.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_project_manager_eligibility() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_project_manager_eligibility() FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Trigger Function: cleanup_membership_references
-- Updates role de-escalation trigger to recognize 'organizer' alongside 'admin'
-- and 'manager'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_membership_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        -- If active membership becomes inactive/suspended, clean up active assignments
        IF OLD.status = 'active'::public.membership_status AND NEW.status <> 'active'::public.membership_status THEN
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

        -- If role is demoted away from organizer/admin/manager to employee or HR,
        -- unassign from managed projects
        IF OLD.role IN ('organizer'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role)
           AND NEW.role NOT IN ('organizer'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role) THEN
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
REVOKE ALL ON FUNCTION public.cleanup_membership_references() FROM PUBLIC, anon, authenticated;

