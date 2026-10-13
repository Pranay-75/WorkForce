-- =============================================================================
-- WorkForce Database Migration: Initial Auth & Organization Foundation
-- File: supabase/migrations/20261010000001_initial_auth_schema.sql
-- =============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE membership_status AS ENUM ('active', 'invited', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 2. TABLE: organizations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(name) >= 2),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- -----------------------------------------------------------------------------
-- 3. TABLE: user_profiles
-- Connected to Supabase auth.users via foreign key
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    department TEXT NOT NULL DEFAULT 'Engineering',
    job_title TEXT NOT NULL DEFAULT 'Software Engineer',
    weekly_capacity_hours NUMERIC(5,2) NOT NULL DEFAULT 40.00 CHECK (weekly_capacity_hours > 0 AND weekly_capacity_hours <= 168),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- -----------------------------------------------------------------------------
-- 4. TABLE: organization_memberships
-- Source of truth for tenant isolation and role permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'employee',
    status membership_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role ON organization_memberships(role);

-- -----------------------------------------------------------------------------
-- 5. HELPER FUNCTIONS (Security Definer with safe search_path to prevent recursion)
-- -----------------------------------------------------------------------------

-- Check if current authenticated user belongs to an organization as an active member
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND status = 'active'
    );
$$;

-- Check if current authenticated user is an active Admin of an organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
    );
$$;

-- Check if current authenticated user is an active Manager or Admin of an organization
CREATE OR REPLACE FUNCTION is_org_manager_or_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND role IN ('admin', 'manager')
          AND status = 'active'
    );
$$;

-- Get the role of the current authenticated user in a given organization
CREATE OR REPLACE FUNCTION get_user_org_role(org_id UUID)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT role
    FROM public.organization_memberships
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 6. FIRST-ADMIN BOOTSTRAP TRANSACTION FUNCTION
-- Atomic creation of organization + first admin membership (eliminates race conditions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_organization_with_admin(
    p_name TEXT,
    p_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to create an organization.';
    END IF;

    IF length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Organization name must be at least 2 characters.';
    END IF;

    IF p_slug !~ '^[a-z0-9-]+$' THEN
        RAISE EXCEPTION 'Invalid slug format. Use lowercase alphanumeric characters and hyphens.';
    END IF;

    -- 1. Create Organization
    INSERT INTO public.organizations (name, slug)
    VALUES (trim(p_name), trim(p_slug))
    RETURNING id INTO v_org_id;

    -- 2. Atomically insert calling user as the initial Admin
    INSERT INTO public.organization_memberships (
        organization_id,
        user_id,
        role,
        status
    )
    VALUES (
        v_org_id,
        auth.uid(),
        'admin',
        'active'
    );

    RETURN v_org_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. AUTOMATIC PROFILE CREATION TRIGGER
-- Whenever a new user signs up in auth.users, create their user_profiles entry
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        avatar_url
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
        updated_at = timezone('utc'::text, now());
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation, zero self-elevation of privileges
-- -----------------------------------------------------------------------------

-- Enable RLS on all 3 tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- 8.1 organizations policies
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
CREATE POLICY "Users can view organizations they belong to"
    ON organizations FOR SELECT
    TO authenticated
    USING (is_org_member(id));

DROP POLICY IF EXISTS "Authenticated users can create a new organization" ON organizations;
CREATE POLICY "Authenticated users can create a new organization"
    ON organizations FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Only organization admins can update organization details" ON organizations;
CREATE POLICY "Only organization admins can update organization details"
    ON organizations FOR UPDATE
    TO authenticated
    USING (is_org_admin(id))
    WITH CHECK (is_org_admin(id));

-- 8.2 user_profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can view profiles of members in the same organization" ON user_profiles;
CREATE POLICY "Users can view profiles of members in the same organization"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT om.user_id
            FROM public.organization_memberships om
            WHERE om.organization_id IN (
                SELECT my_om.organization_id
                FROM public.organization_memberships my_om
                WHERE my_om.user_id = auth.uid()
                  AND my_om.status = 'active'
            )
            AND om.status = 'active'
        )
    );

DROP POLICY IF EXISTS "Users can update only their own profile details" ON user_profiles;
CREATE POLICY "Users can update only their own profile details"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 8.3 organization_memberships policies
DROP POLICY IF EXISTS "Users can view memberships in their organizations" ON organization_memberships;
CREATE POLICY "Users can view memberships in their organizations"
    ON organization_memberships FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR is_org_member(organization_id)
    );

DROP POLICY IF EXISTS "Only organization admins can add new members" ON organization_memberships;
CREATE POLICY "Only organization admins can add new members"
    ON organization_memberships FOR INSERT
    TO authenticated
    WITH CHECK (
        is_org_admin(organization_id)
    );

DROP POLICY IF EXISTS "Only organization admins can update memberships" ON organization_memberships;
CREATE POLICY "Only organization admins can update memberships"
    ON organization_memberships FOR UPDATE
    TO authenticated
    USING (is_org_admin(organization_id))
    WITH CHECK (
        is_org_admin(organization_id)
    );

DROP POLICY IF EXISTS "Only organization admins can delete memberships" ON organization_memberships;
CREATE POLICY "Only organization admins can delete memberships"
    ON organization_memberships FOR DELETE
    TO authenticated
    USING (is_org_admin(organization_id));
