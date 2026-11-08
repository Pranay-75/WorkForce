-- =============================================================================
-- WORKFORCE PREFLIGHT COMPATIBILITY AUDIT (01_preflight_compatibility_check.sql)
-- Safe, Read-Only Diagnostic Script
-- Run against target database before applying migration 20261105000001
-- =============================================================================

DO $$
DECLARE
    v_errors text[] := ARRAY[]::text[];
    v_warnings text[] := ARRAY[]::text[];
    v_checks_performed int := 0;
    v_checks_passed int := 0;
    v_item record;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' WORKFORCE DATABASE PREFLIGHT DEPENDENCY AUDIT                 ';
    RAISE NOTICE '================================================================';

    -- -------------------------------------------------------------------------
    -- 1. Schema & Extension Prerequisites
    -- -------------------------------------------------------------------------
    v_checks_performed := v_checks_performed + 1;
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'public') THEN
        v_errors := array_append(v_errors, 'Schema public does not exist.');
    ELSE
        v_checks_passed := v_checks_passed + 1;
    END IF;

    v_checks_performed := v_checks_performed + 1;
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        v_errors := array_append(v_errors, 'Function auth.uid() is missing (Supabase Auth prerequisite).');
    ELSE
        v_checks_passed := v_checks_passed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Core Tables Existence (Exact Schema-Qualified Checks)
    -- -------------------------------------------------------------------------
    FOR v_item IN
        SELECT table_name
        FROM (VALUES 
            ('organizations'),
            ('organization_memberships'),
            ('projects'),
            ('tasks'),
            ('project_members')
        ) AS t(table_name)
    LOOP
        v_checks_performed := v_checks_performed + 1;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = v_item.table_name
        ) THEN
            v_errors := array_append(v_errors, format('Table public.%s is missing.', v_item.table_name));
        ELSE
            v_checks_passed := v_checks_passed + 1;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 3. Core Columns Existence & Data Type Checks
    -- -------------------------------------------------------------------------
    FOR v_item IN
        SELECT table_name, column_name, expected_type
        FROM (VALUES 
            ('organizations', 'id', 'uuid'),
            ('organizations', 'created_by', 'uuid'),
            ('organization_memberships', 'organization_id', 'uuid'),
            ('organization_memberships', 'user_id', 'uuid'),
            ('organization_memberships', 'role', 'USER-DEFINED'),
            ('organization_memberships', 'status', 'USER-DEFINED'),
            ('projects', 'id', 'uuid'),
            ('projects', 'organization_id', 'uuid'),
            ('projects', 'manager_id', 'uuid'),
            ('projects', 'name', 'text'),
            ('projects', 'status', 'USER-DEFINED'),
            ('tasks', 'id', 'uuid'),
            ('tasks', 'organization_id', 'uuid'),
            ('tasks', 'assigned_to', 'uuid'),
            ('project_members', 'project_id', 'uuid'),
            ('project_members', 'organization_id', 'uuid'),
            ('project_members', 'user_id', 'uuid')
        ) AS c(table_name, column_name, expected_type)
    LOOP
        v_checks_performed := v_checks_performed + 1;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = v_item.table_name 
              AND column_name = v_item.column_name
        ) THEN
            v_errors := array_append(v_errors, format('Column public.%s.%s is missing.', v_item.table_name, v_item.column_name));
        ELSIF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = v_item.table_name 
              AND column_name = v_item.column_name
              AND data_type = v_item.expected_type
        ) THEN
            v_warnings := array_append(v_warnings, format('Column public.%s.%s has unexpected data type (expected %s).', 
                v_item.table_name, v_item.column_name, v_item.expected_type));
            v_checks_passed := v_checks_passed + 1;
        ELSE
            v_checks_passed := v_checks_passed + 1;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 4. Custom Enum Types & Values
    -- -------------------------------------------------------------------------
    -- Enum: user_role
    v_checks_performed := v_checks_performed + 1;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON t.typnamespace = n.oid 
        WHERE n.nspname = 'public' AND t.typname = 'user_role'
    ) THEN
        v_errors := array_append(v_errors, 'Enum public.user_role is missing.');
    ELSE
        v_checks_passed := v_checks_passed + 1;
        FOR v_item IN SELECT unnest(ARRAY['organizer', 'admin', 'manager', 'hr', 'employee']) AS label LOOP
            v_checks_performed := v_checks_performed + 1;
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e 
                JOIN pg_type t ON e.enumtypid = t.oid 
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = v_item.label
            ) THEN
                v_errors := array_append(v_errors, format('Enum public.user_role missing required label ''%s''.', v_item.label));
            ELSE
                v_checks_passed := v_checks_passed + 1;
            END IF;
        END LOOP;
    END IF;

    -- Enum: membership_status
    v_checks_performed := v_checks_performed + 1;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON t.typnamespace = n.oid 
        WHERE n.nspname = 'public' AND t.typname = 'membership_status'
    ) THEN
        v_errors := array_append(v_errors, 'Enum public.membership_status is missing.');
    ELSE
        v_checks_passed := v_checks_passed + 1;
        FOR v_item IN SELECT unnest(ARRAY['active', 'invited', 'suspended']) AS label LOOP
            v_checks_performed := v_checks_performed + 1;
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e 
                JOIN pg_type t ON e.enumtypid = t.oid 
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE n.nspname = 'public' AND t.typname = 'membership_status' AND e.enumlabel = v_item.label
            ) THEN
                v_errors := array_append(v_errors, format('Enum public.membership_status missing required label ''%s''.', v_item.label));
            ELSE
                v_checks_passed := v_checks_passed + 1;
            END IF;
        END LOOP;
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Trigger Attachments and Target Tables Prerequisites
    -- -------------------------------------------------------------------------
    FOR v_item IN
        SELECT tgname, relname
        FROM (VALUES 
            ('trg_enforce_project_manager_insert', 'projects'),
            ('trg_enforce_project_manager_update', 'projects'),
            ('trg_cleanup_membership_references', 'organization_memberships')
        ) AS t(tgname, relname)
    LOOP
        v_checks_performed := v_checks_performed + 1;
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace nc ON c.relnamespace = nc.oid
            WHERE nc.nspname = 'public' 
              AND c.relname = v_item.relname 
              AND t.tgname = v_item.tgname
        ) THEN
            v_warnings := array_append(v_warnings, format('Trigger public.%s on public.%s is not yet attached.', v_item.tgname, v_item.relname));
        ELSE
            v_checks_passed := v_checks_passed + 1;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 6. Role & Permission Environment
    -- -------------------------------------------------------------------------
    FOR v_item IN SELECT unnest(ARRAY['postgres', 'authenticated', 'anon']) AS role_name LOOP
        v_checks_performed := v_checks_performed + 1;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_item.role_name) THEN
            v_errors := array_append(v_errors, format('Required database role "%s" does not exist.', v_item.role_name));
        ELSE
            v_checks_passed := v_checks_passed + 1;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- Report Verdict & Dynamic Counter
    -- -------------------------------------------------------------------------
    IF array_length(v_warnings, 1) > 0 THEN
        RAISE NOTICE '--- WARNINGS (% found) ---', array_length(v_warnings, 1);
        FOR i IN 1..array_length(v_warnings, 1) LOOP
            RAISE NOTICE '%', format('  ⚠️  [WARN] %s', v_warnings[i]);
        END LOOP;
    END IF;

    IF array_length(v_errors, 1) > 0 THEN
        RAISE NOTICE '--- FATAL ERRORS (% found) ---', array_length(v_errors, 1);
        FOR i IN 1..array_length(v_errors, 1) LOOP
            RAISE NOTICE '%', format('  ❌ [ERROR] %s', v_errors[i]);
        END LOOP;
        RAISE EXCEPTION 'PREFLIGHT AUDIT FAILED: % fatal dependency issues detected out of % checks performed.', 
            array_length(v_errors, 1), v_checks_performed;
    ELSE
        RAISE NOTICE '================================================================';
        RAISE NOTICE '%', format('✅ [SUCCESS] PREFLIGHT AUDIT PASSED: %s of %s dependency checks verified.', 
            v_checks_passed, v_checks_performed);
        RAISE NOTICE '================================================================';
    END IF;
END $$;
