-- =============================================================================
-- WorkForce Database Seed: Development & Demo Dataset
-- File: supabase/seed.sql
-- =============================================================================

-- Ensure pgcrypto is available in extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. Create Demo Auth Users in auth.users (Satisfies user_profiles foreign key)
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
)
VALUES
    -- Admin / VP of Operations: Chloe Dubois
    (
        'b0000000-0000-0000-0000-000000000008',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'chloe.dubois@acme.corp',
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        timezone('utc'::text, now()),
        '', '', '', '', '', '', '', '',
        FALSE,
        FALSE,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Chloe Dubois","avatar_url":"CD"}'::jsonb,
        FALSE
    ),
    -- Manager / Engineering Lead: Sarah Connor
    (
        'b0000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'sarah.connor@acme.corp',
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        timezone('utc'::text, now()),
        '', '', '', '', '', '', '', '',
        FALSE,
        FALSE,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Sarah Connor","avatar_url":"SC"}'::jsonb,
        FALSE
    ),
    -- Employee / Senior Frontend Engineer: Alex Chen
    (
        'b0000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'alex.chen@acme.corp',
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        timezone('utc'::text, now()),
        '', '', '', '', '', '', '', '',
        FALSE,
        FALSE,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Alex Chen","avatar_url":"AC"}'::jsonb,
        FALSE
    ),
    -- Employee / Backend & AI Engineer: David Kim
    (
        'b0000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'david.kim@acme.corp',
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        timezone('utc'::text, now()),
        '', '', '', '', '', '', '', '',
        FALSE,
        FALSE,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"David Kim","avatar_url":"DK"}'::jsonb,
        FALSE
    ),
    -- Employee / Full-Stack Engineer: Priya Patel
    (
        'b0000000-0000-0000-0000-000000000006',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'priya.patel@acme.corp',
        extensions.crypt('Password123!', extensions.gen_salt('bf')),
        timezone('utc'::text, now()),
        '', '', '', '', '', '', '', '',
        FALSE,
        FALSE,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Priya Patel","avatar_url":"PP"}'::jsonb,
        FALSE
    )
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    confirmation_token = EXCLUDED.confirmation_token,
    recovery_token = EXCLUDED.recovery_token,
    email_change_token_new = EXCLUDED.email_change_token_new,
    email_change = EXCLUDED.email_change,
    phone_change = EXCLUDED.phone_change,
    phone_change_token = EXCLUDED.phone_change_token,
    email_change_token_current = EXCLUDED.email_change_token_current,
    reauthentication_token = EXCLUDED.reauthentication_token,
    updated_at = timezone('utc'::text, now());

-- -----------------------------------------------------------------------------
-- 1.1 Create Auth Identities for GoTrue Email Login
-- -----------------------------------------------------------------------------
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
VALUES
    (
        'b0000000-0000-0000-0000-000000000008',
        'b0000000-0000-0000-0000-000000000008',
        '{"sub":"b0000000-0000-0000-0000-000000000008","email":"chloe.dubois@acme.corp"}'::jsonb,
        'email',
        'b0000000-0000-0000-0000-000000000008',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        '{"sub":"b0000000-0000-0000-0000-000000000001","email":"sarah.connor@acme.corp"}'::jsonb,
        'email',
        'b0000000-0000-0000-0000-000000000001',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002',
        '{"sub":"b0000000-0000-0000-0000-000000000002","email":"alex.chen@acme.corp"}'::jsonb,
        'email',
        'b0000000-0000-0000-0000-000000000002',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'b0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000003',
        '{"sub":"b0000000-0000-0000-0000-000000000003","email":"david.kim@acme.corp"}'::jsonb,
        'email',
        'b0000000-0000-0000-0000-000000000003',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ),
    (
        'b0000000-0000-0000-0000-000000000006',
        'b0000000-0000-0000-0000-000000000006',
        '{"sub":"b0000000-0000-0000-0000-000000000006","email":"priya.patel@acme.corp"}'::jsonb,
        'email',
        'b0000000-0000-0000-0000-000000000006',
        timezone('utc'::text, now()),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
ON CONFLICT (provider, provider_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Create Demo Organization
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    DELETE FROM public.organizations WHERE slug = 'acme-systems' AND id != 'a0000000-0000-0000-0000-000000000001';

    INSERT INTO public.organizations (id, name, slug)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'Acme Systems Engineering', 'acme-systems')
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        updated_at = timezone('utc'::text, now());
END $$;

-- -----------------------------------------------------------------------------
-- 3. Upsert User Profiles (Department, Job Title, Capacity)
-- -----------------------------------------------------------------------------
INSERT INTO public.user_profiles (id, email, full_name, avatar_url, department, job_title, weekly_capacity_hours)
VALUES
    ('b0000000-0000-0000-0000-000000000008', 'chloe.dubois@acme.corp', 'Chloe Dubois', 'CD', 'Product / HR', 'VP of Operations & Talent', 40.00),
    ('b0000000-0000-0000-0000-000000000001', 'sarah.connor@acme.corp', 'Sarah Connor', 'SC', 'Engineering', 'Engineering Lead & Architect', 40.00),
    ('b0000000-0000-0000-0000-000000000002', 'alex.chen@acme.corp', 'Alex Chen', 'AC', 'Engineering', 'Senior Frontend Engineer', 40.00),
    ('b0000000-0000-0000-0000-000000000003', 'david.kim@acme.corp', 'David Kim', 'DK', 'Engineering', 'Backend & Distributed Systems Engineer', 40.00),
    ('b0000000-0000-0000-0000-000000000006', 'priya.patel@acme.corp', 'Priya Patel', 'PP', 'Engineering', 'Full-Stack Software Engineer', 40.00)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    department = EXCLUDED.department,
    job_title = EXCLUDED.job_title,
    weekly_capacity_hours = EXCLUDED.weekly_capacity_hours,
    updated_at = timezone('utc'::text, now());

-- -----------------------------------------------------------------------------
-- 4. Assign Organization Memberships & Roles
-- -----------------------------------------------------------------------------
INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
VALUES
    -- Chloe Dubois -> Admin
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000008', 'admin'::public.user_role, 'active'::public.membership_status),
    -- Sarah Connor -> Manager
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'manager'::public.user_role, 'active'::public.membership_status),
    -- Alex Chen -> Employee
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'employee'::public.user_role, 'active'::public.membership_status),
    -- David Kim -> Employee
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'employee'::public.user_role, 'active'::public.membership_status),
    -- Priya Patel -> Employee
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'employee'::public.user_role, 'active'::public.membership_status)
ON CONFLICT (organization_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    updated_at = timezone('utc'::text, now());
