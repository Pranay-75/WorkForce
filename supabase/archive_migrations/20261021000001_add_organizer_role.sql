-- =============================================================================
-- WorkForce Proposed Migration: Organizer Super Admin Role Specification & Governance
-- File: supabase/migrations/20261021000001_add_organizer_role.sql
--
-- STATUS: PROPOSED / NON-EXECUTED.
-- Per project safety instructions, this file is provided for review only.
-- Do NOT execute against hosted production/staging databases without explicit approval.
-- =============================================================================

BEGIN;

-- 1. Extend user_role enum to include 'organizer'
-- Note: In PostgreSQL 12+ (Supabase default), ALTER TYPE ... ADD VALUE is supported.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_enum e
        JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'organizer'
    ) THEN
        ALTER TYPE public.user_role ADD VALUE 'organizer' BEFORE 'admin';
    END IF;
END $$;

-- 2. Add created_by column to organizations table for authoritative database ownership
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);

-- 3. Backfill created_by for existing organizations using earliest active founding member
UPDATE public.organizations o
SET created_by = sub.user_id
FROM (
    SELECT DISTINCT ON (organization_id) organization_id, user_id
    FROM public.organization_memberships
    WHERE status = 'active'
    ORDER BY organization_id, created_at ASC
) sub
WHERE o.id = sub.organization_id AND o.created_by IS NULL;

-- 4. Update is_org_admin to include 'organizer'
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

-- 5. Update is_org_manager_or_admin to include 'organizer'
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
          AND role IN ('organizer'::public.user_role, 'admin'::public.user_role, 'manager'::public.user_role)
          AND status = 'active'::public.membership_status
    );
$$;

-- 6. Dedicated is_org_organizer helper for ownership-restricted operations
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
    ) OR EXISTS (
        SELECT 1
        FROM public.organizations
        WHERE id = org_id
          AND created_by = auth.uid()
    );
$$;

ALTER FUNCTION public.is_org_organizer(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_organizer(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_organizer(UUID) TO authenticated;

-- 7. Update create_organization_with_admin to assign 'organizer' role and set created_by
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(
    p_name TEXT,
    p_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID;
    v_name TEXT;
    v_slug TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create an organization.';
    END IF;

    IF p_name IS NULL OR p_slug IS NULL THEN
        RAISE EXCEPTION 'Organization name and slug must not be null.';
    END IF;

    v_name := pg_catalog.btrim(p_name);
    v_slug := pg_catalog.btrim(p_slug);

    IF pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name) > 100 THEN
        RAISE EXCEPTION 'Organization name must be between 2 and 100 characters.';
    END IF;

    IF pg_catalog.length(v_slug) < 2 OR pg_catalog.length(v_slug) > 50 THEN
        RAISE EXCEPTION 'Organization slug must be between 2 and 50 characters.';
    END IF;

    IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'Invalid slug format. Must be lowercase alphanumeric characters with single hyphens between words.';
    END IF;

    -- Atomically insert organization with explicit created_by
    INSERT INTO public.organizations (name, slug, created_by)
    VALUES (v_name, v_slug, v_user_id)
    RETURNING id INTO v_org_id;

    -- Atomically insert creator as the initial Organizer
    INSERT INTO public.organization_memberships (
        organization_id,
        user_id,
        role,
        status
    )
    VALUES (
        v_org_id,
        v_user_id,
        'organizer'::public.user_role,
        'active'::public.membership_status
    );

    -- Log organization creation in immutable audit logs
    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    ) VALUES (
        v_org_id,
        v_user_id,
        v_user_id,
        'organization.created',
        pg_catalog.jsonb_build_object(
            'organization_name', v_name,
            'slug', v_slug,
            'creator_role', 'organizer'
        )
    );

    RETURN v_org_id;
END;
$$;

-- 8. Table check constraints for invitations and role assignments
DO $$
BEGIN
    -- Update chk_org_invitations_role if present
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'chk_org_invitations_role'
    ) THEN
        ALTER TABLE public.organization_invitations DROP CONSTRAINT chk_org_invitations_role;
        -- Invitations allow manager, employee, hr, or admin (only Organizer can invite Admin)
        ALTER TABLE public.organization_invitations
        ADD CONSTRAINT chk_org_invitations_role
        CHECK (role IN ('manager', 'employee', 'hr', 'admin'));
    END IF;
END $$;

COMMIT;
