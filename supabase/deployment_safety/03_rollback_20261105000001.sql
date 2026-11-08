-- =============================================================================
-- WORKFORCE DEDICATED ROLLBACK SCRIPT (03_rollback_20261105000001.sql)
-- Restores all five functions to their exact definitions prior to 20261105000001
-- Verified against historical migrations:
--   1. is_org_organizer: from 20261030000001 (lines 489-514)
--   2. is_org_admin: from 20261102000001 (lines 18-43)
--   3. is_org_manager_or_admin: from 20261011000001 (lines 59-80)
--   4. enforce_project_manager_eligibility: from 20261014000001 (lines 319-353, 658)
--   5. cleanup_membership_references: from 20261014000001 (lines 610-647, 662)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Restore is_org_organizer (with created_by fallback from 20261030000001)
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
        FROM public.organization_memberships m
        INNER JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'::public.membership_status
          AND (
              m.role = 'organizer'::public.user_role
              OR o.created_by = auth.uid()
          )
    );
$$;

ALTER FUNCTION public.is_org_organizer(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_organizer(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 2. Restore is_org_admin (with created_by fallback from 20261102000001)
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
        FROM public.organization_memberships m
        INNER JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id
          AND m.user_id = auth.uid()
          AND m.status = 'active'::public.membership_status
          AND (
              m.role IN ('organizer'::public.user_role, 'admin'::public.user_role)
              OR o.created_by = auth.uid()
          )
    );
$$;

ALTER FUNCTION public.is_org_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 3. Restore is_org_manager_or_admin (manager + admin only from 20261011000001)
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
          AND role IN ('admin'::public.user_role, 'manager'::public.user_role)
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_manager_or_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Restore enforce_project_manager_eligibility (manager + admin only from 20261014000001)
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

        IF v_role NOT IN ('admin', 'manager') THEN
            RAISE EXCEPTION 'Project manager must have an admin or manager role.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_project_manager_eligibility() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_project_manager_eligibility() FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Restore cleanup_membership_references (manager + admin only from 20261014000001)
-- -----------------------------------------------------------------------------
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
REVOKE ALL ON FUNCTION public.cleanup_membership_references() FROM PUBLIC, anon, authenticated;

COMMIT;

