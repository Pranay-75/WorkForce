-- =============================================================================
-- Migration: 20261108000002_organizer_projects_rls_authorization.sql
-- Description:
--   Explicitly authorize Organizers on public.projects and public.project_members
--   Row-Level Security (RLS) policies.
--   1. Recreates is_org_organizer helper to canonical active organizer validation
--      (checking both role = 'organizer' and organization creator created_by).
--   2. Updates is_org_manager_or_admin to defensively check role = 'organizer',
--      'admin', 'manager' and organization ownership (created_by).
--   3. Recreates projects_insert_policy with explicit is_org_organizer check
--      alongside is_org_manager_or_admin, ensuring Organizers can create projects.
--   4. Recreates projects_update_policy and projects_delete_policy to include
--      is_org_organizer.
--   5. Recreates project_members insert/update/delete policies to include
--      is_org_organizer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper Function: is_org_organizer
-- Derives authority strictly from active membership in org_id with role 'organizer'
-- or designated organization creator (created_by).
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
        LEFT JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id
          AND m.user_id = auth.uid()
          AND (
              m.role = 'organizer'::public.user_role
              OR o.created_by = auth.uid()
          )
          AND m.status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_organizer(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_organizer(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Helper Function: is_org_manager_or_admin
-- Returns TRUE if caller is an active Organizer, Admin, or Manager in the org.
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
        FROM public.organization_memberships m
        LEFT JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.organization_id = org_id
          AND m.user_id = auth.uid()
          AND (
              m.role IN (
                  'organizer'::public.user_role,
                  'admin'::public.user_role,
                  'manager'::public.user_role
              )
              OR o.created_by = auth.uid()
          )
          AND m.status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_manager_or_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_manager_or_admin(UUID) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Projects RLS Policies: Explicitly Authorize Organizers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_insert_policy ON public.projects;
CREATE POLICY projects_insert_policy ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);

DROP POLICY IF EXISTS projects_update_policy ON public.projects;
CREATE POLICY projects_update_policy ON public.projects
FOR UPDATE TO authenticated
USING (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
)
WITH CHECK (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);

DROP POLICY IF EXISTS projects_delete_policy ON public.projects;
CREATE POLICY projects_delete_policy ON public.projects
FOR DELETE TO authenticated
USING (
    public.is_org_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);

-- -----------------------------------------------------------------------------
-- 4. Project Members RLS Policies: Explicitly Authorize Organizers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS project_members_insert_policy ON public.project_members;
CREATE POLICY project_members_insert_policy ON public.project_members
FOR INSERT TO authenticated
WITH CHECK (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);

DROP POLICY IF EXISTS project_members_update_policy ON public.project_members;
CREATE POLICY project_members_update_policy ON public.project_members
FOR UPDATE TO authenticated
USING (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
)
WITH CHECK (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);

DROP POLICY IF EXISTS project_members_delete_policy ON public.project_members;
CREATE POLICY project_members_delete_policy ON public.project_members
FOR DELETE TO authenticated
USING (
    public.is_org_manager_or_admin(organization_id)
    OR public.is_org_organizer(organization_id)
);
