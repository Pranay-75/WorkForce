-- =============================================================================
-- WorkForce Database Migration: Hardened Organization Creation, Membership RLS,
-- Least-Privilege Grants, Concurrency-Safe Admin Protection & Immutable Audit Logging
-- File: supabase/migrations/20261011000001_restrict_organization_creation.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. HARDEN EXISTING HELPER FUNCTIONS (LEAST PRIVILEGE & EMPTY SEARCH_PATH)
-- =============================================================================

-- 1.1 is_org_member: Check active membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
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
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_member(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

-- 1.2 is_org_admin: Check active admin role
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
          AND role = 'admin'::public.user_role
          AND status = 'active'::public.membership_status
    );
$$;

ALTER FUNCTION public.is_org_admin(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;

-- 1.3 is_org_manager_or_admin: Check active manager or admin role
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

-- 1.4 get_user_org_role: Retrieve role of active user in organization
CREATE OR REPLACE FUNCTION public.get_user_org_role(org_id UUID)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
    SELECT role
    FROM public.organization_memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'::public.membership_status
    LIMIT 1;
$$;

ALTER FUNCTION public.get_user_org_role(UUID) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.get_user_org_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_org_role(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_org_role(UUID) TO authenticated;

-- =============================================================================
-- 2. ATOMIC WORKSPACE & FIRST-ADMIN BOOTSTRAP FUNCTION
-- =============================================================================
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
    -- 1. Derive creator exclusively from auth.uid()
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create an organization.';
    END IF;

    -- 2. Reject null inputs and trim whitespace
    IF p_name IS NULL OR p_slug IS NULL THEN
        RAISE EXCEPTION 'Organization name and slug must not be null.';
    END IF;

    v_name := pg_catalog.btrim(p_name);
    v_slug := pg_catalog.btrim(p_slug);

    -- 3. Enforce sensible length boundaries
    IF pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name) > 100 THEN
        RAISE EXCEPTION 'Organization name must be between 2 and 100 characters.';
    END IF;

    IF pg_catalog.length(v_slug) < 2 OR pg_catalog.length(v_slug) > 50 THEN
        RAISE EXCEPTION 'Organization slug must be between 2 and 50 characters.';
    END IF;

    -- 4. Validate slug format: lowercase alphanumeric at both ends, single hyphens only between them
    IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
        RAISE EXCEPTION 'Invalid slug format. Must be lowercase alphanumeric characters with single hyphens between words.';
    END IF;

    -- 5. Atomically insert Organization
    INSERT INTO public.organizations (name, slug)
    VALUES (v_name, v_slug)
    RETURNING id INTO v_org_id;

    -- 6. Atomically insert creator as the initial active Admin
    INSERT INTO public.organization_memberships (
        organization_id,
        user_id,
        role,
        status
    )
    VALUES (
        v_org_id,
        v_user_id,
        'admin'::public.user_role,
        'active'::public.membership_status
    );

    RETURN v_org_id;
END;
$$;

ALTER FUNCTION public.create_organization_with_admin(TEXT, TEXT) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_admin(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 3. LEAST-PRIVILEGE TABLE GRANTS (STRIP UNNECESSARY ANON & DANGEROUS PRIVILEGES)
-- =============================================================================

-- 3.1 organizations table grants
REVOKE ALL ON TABLE public.organizations FROM PUBLIC;
REVOKE ALL ON TABLE public.organizations FROM anon;
GRANT SELECT, UPDATE ON TABLE public.organizations TO authenticated;

-- 3.2 organization_memberships table grants
REVOKE ALL ON TABLE public.organization_memberships FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_memberships FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.organization_memberships TO authenticated;

-- 3.3 user_profiles table grants
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.user_profiles FROM anon;
GRANT SELECT, UPDATE ON TABLE public.user_profiles TO authenticated;

-- =============================================================================
-- 4. DATA VALIDATION CONSTRAINTS & INDEX CLEANUP
-- =============================================================================
DO $$
BEGIN
    -- 4.1 organizations name-length check constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'organizations' AND c.conname = 'chk_organizations_name_length'
    ) THEN
        ALTER TABLE public.organizations ADD CONSTRAINT chk_organizations_name_length CHECK (length(trim(name)) >= 2);
    END IF;

    -- 4.2 organizations slug format check constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'organizations' AND c.conname = 'chk_organizations_slug_format'
    ) THEN
        ALTER TABLE public.organizations ADD CONSTRAINT chk_organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
    END IF;

    -- 4.3 user_profiles weekly capacity upper & lower bounds check
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'user_profiles' AND c.conname = 'chk_user_profiles_weekly_capacity'
    ) THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_weekly_capacity_hours_check;
        ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_weekly_capacity CHECK (weekly_capacity_hours > 0 AND weekly_capacity_hours <= 168);
    END IF;
END $$;

-- 4.4 Drop redundant non-unique index on organizations(slug) if present (unique constraint handles indexing)
DROP INDEX IF EXISTS public.idx_organizations_slug;

-- =============================================================================
-- 5. IMMUTABLE AUDIT LOGGING FOUNDATION (NON-CASCADING RETENTION)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    actor_user_id UUID,
    target_user_id UUID,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Reconcile foreign keys to ON DELETE SET NULL safely across all existing constraints
DO $$
DECLARE
    r RECORD;
    v_has_org_fk BOOLEAN := FALSE;
    v_has_actor_fk BOOLEAN := FALSE;
    v_has_target_fk BOOLEAN := FALSE;
BEGIN
    -- Pass 1: Strict Validation Check (Fail fast on composite or unexpected FKs before making DDL changes)
    FOR r IN (
        SELECT 
            c.conname AS constraint_name,
            c.conkey AS local_col_nums,
            c.confkey AS foreign_col_nums,
            ref_n.nspname AS foreign_schema_name,
            ref_c.relname AS foreign_table_name,
            c.confdeltype AS delete_rule
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_catalog.pg_class ref_c ON ref_c.oid = c.confrelid
        JOIN pg_catalog.pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'organization_audit_logs'
          AND c.contype = 'f'
    ) LOOP
        -- Reject composite foreign keys
        IF pg_catalog.cardinality(r.local_col_nums) > 1 OR pg_catalog.cardinality(r.foreign_col_nums) > 1 THEN
            RAISE EXCEPTION 'Composite foreign key constraint "%" detected on public.organization_audit_logs. Manual schema inspection required.',
                r.constraint_name;
        END IF;

        -- Reject foreign keys referencing unexpected non-public schemas
        IF r.foreign_schema_name != 'public' THEN
            RAISE EXCEPTION 'Foreign key constraint "%" on public.organization_audit_logs references unexpected schema "%". Manual schema inspection required.',
                r.constraint_name, r.foreign_schema_name;
        END IF;
    END LOOP;

    -- Pass 2: Reconcile each individual foreign key
    FOR r IN (
        SELECT 
            c.conname AS constraint_name,
            a.attname AS column_name,
            ref_n.nspname AS foreign_schema_name,
            ref_c.relname AS foreign_table_name,
            ref_a.attname AS foreign_column_name,
            c.confdeltype AS delete_rule
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        JOIN pg_catalog.pg_class ref_c ON ref_c.oid = c.confrelid
        JOIN pg_catalog.pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
        JOIN pg_catalog.pg_attribute ref_a ON ref_a.attrelid = ref_c.oid AND ref_a.attnum = ANY(c.confkey)
        WHERE n.nspname = 'public'
          AND t.relname = 'organization_audit_logs'
          AND c.contype = 'f'
    ) LOOP
        IF r.column_name = 'organization_id' THEN
            IF r.foreign_schema_name != 'public' OR r.foreign_table_name != 'organizations' OR r.foreign_column_name != 'id' THEN
                RAISE EXCEPTION 'Ambiguous foreign key constraint "%" on organization_id: references %.%(%) instead of public.organizations(id)',
                    r.constraint_name, r.foreign_schema_name, r.foreign_table_name, r.foreign_column_name;
            END IF;
            -- 'n' represents ON DELETE SET NULL in pg_constraint.confdeltype
            IF r.delete_rule = 'n' AND r.constraint_name = 'organization_audit_logs_organization_id_fkey' THEN
                v_has_org_fk := TRUE;
            ELSE
                EXECUTE pg_catalog.format('ALTER TABLE public.organization_audit_logs DROP CONSTRAINT %I', r.constraint_name);
            END IF;
        ELSIF r.column_name = 'actor_user_id' THEN
            IF r.foreign_schema_name != 'public' OR r.foreign_table_name != 'user_profiles' OR r.foreign_column_name != 'id' THEN
                RAISE EXCEPTION 'Ambiguous foreign key constraint "%" on actor_user_id: references %.%(%) instead of public.user_profiles(id)',
                    r.constraint_name, r.foreign_schema_name, r.foreign_table_name, r.foreign_column_name;
            END IF;
            IF r.delete_rule = 'n' AND r.constraint_name = 'organization_audit_logs_actor_user_id_fkey' THEN
                v_has_actor_fk := TRUE;
            ELSE
                EXECUTE pg_catalog.format('ALTER TABLE public.organization_audit_logs DROP CONSTRAINT %I', r.constraint_name);
            END IF;
        ELSIF r.column_name = 'target_user_id' THEN
            IF r.foreign_schema_name != 'public' OR r.foreign_table_name != 'user_profiles' OR r.foreign_column_name != 'id' THEN
                RAISE EXCEPTION 'Ambiguous foreign key constraint "%" on target_user_id: references %.%(%) instead of public.user_profiles(id)',
                    r.constraint_name, r.foreign_schema_name, r.foreign_table_name, r.foreign_column_name;
            END IF;
            IF r.delete_rule = 'n' AND r.constraint_name = 'organization_audit_logs_target_user_id_fkey' THEN
                v_has_target_fk := TRUE;
            ELSE
                EXECUTE pg_catalog.format('ALTER TABLE public.organization_audit_logs DROP CONSTRAINT %I', r.constraint_name);
            END IF;
        ELSE
            RAISE EXCEPTION 'Unexpected foreign key constraint "%" on column "%" in public.organization_audit_logs. Manual reconciliation required.',
                r.constraint_name, r.column_name;
        END IF;
    END LOOP;

    -- Add canonical ON DELETE SET NULL foreign keys if not already present
    IF NOT v_has_org_fk THEN
        ALTER TABLE public.organization_audit_logs
            ADD CONSTRAINT organization_audit_logs_organization_id_fkey
            FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;

    IF NOT v_has_actor_fk THEN
        ALTER TABLE public.organization_audit_logs
            ADD CONSTRAINT organization_audit_logs_actor_user_id_fkey
            FOREIGN KEY (actor_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT v_has_target_fk THEN
        ALTER TABLE public.organization_audit_logs
            ADD CONSTRAINT organization_audit_logs_target_user_id_fkey
            FOREIGN KEY (target_user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_org ON public.organization_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_created ON public.organization_audit_logs(created_at);

ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;

-- Explicitly strip all write permissions from client roles
REVOKE ALL ON TABLE public.organization_audit_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_audit_logs FROM anon;
REVOKE ALL ON TABLE public.organization_audit_logs FROM authenticated;

-- Grant back only SELECT to authenticated users, gated strictly by RLS for organization admins
GRANT SELECT ON TABLE public.organization_audit_logs TO authenticated;

DROP POLICY IF EXISTS "Only organization admins can view audit logs" ON public.organization_audit_logs;
CREATE POLICY "Only organization admins can view audit logs"
    ON public.organization_audit_logs FOR SELECT
    TO authenticated
    USING (
        organization_id IS NOT NULL 
        AND public.is_org_admin(organization_id)
    );

-- =============================================================================
-- 6. CONCURRENCY-SAFE LAST-ADMIN PROTECTION & REASSIGNMENT BLOCK TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_active_admin_count INTEGER;
BEGIN
    -- 1. Prevent membership reassignment across organizations or users at database level
    IF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Operation rejected: Reassigning membership across organizations is prohibited.';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Operation rejected: Reassigning membership user is prohibited.';
    END IF;

    -- 2. Evaluate when an active admin row is deleted, demoted, or suspended
    IF (TG_OP = 'DELETE' AND OLD.role = 'admin'::public.user_role AND OLD.status = 'active'::public.membership_status)
       OR (TG_OP = 'UPDATE' AND OLD.role = 'admin'::public.user_role AND OLD.status = 'active'::public.membership_status
           AND (NEW.role != 'admin'::public.user_role OR NEW.status != 'active'::public.membership_status)) THEN
        
        -- If the parent organization record is no longer present, allow cascade deletion
        IF NOT EXISTS (
            SELECT 1 
            FROM public.organizations 
            WHERE id = OLD.organization_id
        ) THEN
            RETURN OLD;
        END IF;

        -- Concurrency Safety: Serialize admin evaluations for this organization via row lock
        PERFORM 1 
        FROM public.organizations 
        WHERE id = OLD.organization_id 
        FOR UPDATE;

        -- Count remaining active admins excluding this record
        SELECT pg_catalog.count(*)
        INTO v_active_admin_count
        FROM public.organization_memberships
        WHERE organization_id = OLD.organization_id
          AND role = 'admin'::public.user_role
          AND status = 'active'::public.membership_status
          AND id != OLD.id;

        IF v_active_admin_count < 1 THEN
            RAISE EXCEPTION 'Operation rejected: Cannot remove, demote, or suspend the last active administrator of an organization.';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

ALTER FUNCTION public.protect_last_active_admin() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_protect_last_active_admin ON public.organization_memberships;
CREATE TRIGGER trg_protect_last_active_admin
    BEFORE UPDATE OR DELETE ON public.organization_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_last_active_admin();

-- =============================================================================
-- 7. DEDICATED AUDITED ADMIN PROMOTION RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.promote_member_to_admin(
    p_organization_id UUID,
    p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id UUID;
    v_org_name TEXT;
    v_target_current_role public.user_role;
    v_target_status public.membership_status;
    v_target_email TEXT;
    v_actor_email TEXT;
BEGIN
    -- 1. Derive and verify actor identity
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    -- 2. Caller must be an active admin of the target organization
    IF NOT public.is_org_admin(p_organization_id) THEN
        RAISE EXCEPTION 'Only active organization administrators can promote members.';
    END IF;

    -- 3. Acquire organization-level row lock for serialization consistency & capture name
    SELECT name INTO v_org_name
    FROM public.organizations 
    WHERE id = p_organization_id 
    FOR UPDATE;

    -- 4. Verify target user is an active member in the target organization
    SELECT om.role, om.status, up.email
    INTO v_target_current_role, v_target_status, v_target_email
    FROM public.organization_memberships om
    LEFT JOIN public.user_profiles up ON up.id = om.user_id
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id;

    IF v_target_current_role IS NULL THEN
        RAISE EXCEPTION 'Target user is not a member of this organization.';
    END IF;

    IF v_target_status != 'active'::public.membership_status THEN
        RAISE EXCEPTION 'Only active members can be promoted to administrator.';
    END IF;

    IF v_target_current_role = 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Target user is already an administrator.';
    END IF;

    -- Capture actor email for audit traceability
    SELECT email INTO v_actor_email FROM public.user_profiles WHERE id = v_actor_id;

    -- 5. Perform role elevation
    UPDATE public.organization_memberships
    SET role = 'admin'::public.user_role,
        updated_at = pg_catalog.now()
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id;

    -- 6. Record immutable audit entry with complete forensic snapshot
    INSERT INTO public.organization_audit_logs (
        organization_id,
        actor_user_id,
        target_user_id,
        action,
        details
    )
    VALUES (
        p_organization_id,
        v_actor_id,
        p_user_id,
        'PROMOTE_TO_ADMIN',
        pg_catalog.jsonb_build_object(
            'organization_name', v_org_name,
            'actor_email', v_actor_email,
            'target_email', v_target_email,
            'previous_role', v_target_current_role::text,
            'new_role', 'admin',
            'promoted_at', pg_catalog.now()
        )
    );
END;
$$;

ALTER FUNCTION public.promote_member_to_admin(UUID, UUID) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.promote_member_to_admin(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_member_to_admin(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_member_to_admin(UUID, UUID) TO authenticated;

-- =============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES RECONCILIATION
-- =============================================================================

-- 8.1 organizations: Remove permissive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create a new organization" ON public.organizations;

-- 8.2 organization_memberships: Remove malformed tautological INSERT policy
DROP POLICY IF EXISTS "Users can insert initial membership when creating an organization" ON public.organization_memberships;

-- 8.3 organization_memberships: Hardened INSERT policy for admins (manager/employee only)
DROP POLICY IF EXISTS "Only organization admins can add new members" ON public.organization_memberships;
CREATE POLICY "Only organization admins can add new members"
    ON public.organization_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_org_admin(organization_id)
        AND role IN ('manager'::public.user_role, 'employee'::public.user_role)
        AND status IN ('active'::public.membership_status, 'invited'::public.membership_status)
    );

-- 8.4 organization_memberships: Hardened UPDATE policy
-- Direct client UPDATE cannot promote to admin; promotions must route through promote_member_to_admin()
DROP POLICY IF EXISTS "Only organization admins can update memberships" ON public.organization_memberships;
CREATE POLICY "Only organization admins can update memberships"
    ON public.organization_memberships FOR UPDATE
    TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (
        public.is_org_admin(organization_id)
        AND role IN ('manager'::public.user_role, 'employee'::public.user_role)
    );

-- 8.5 organization_memberships: Hardened DELETE policy (protected by protect_last_active_admin trigger)
DROP POLICY IF EXISTS "Only organization admins can delete memberships" ON public.organization_memberships;
CREATE POLICY "Only organization admins can delete memberships"
    ON public.organization_memberships FOR DELETE
    TO authenticated
    USING (public.is_org_admin(organization_id));

COMMIT;
