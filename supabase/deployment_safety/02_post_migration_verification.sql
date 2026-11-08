-- =============================================================================
-- WORKFORCE POST-MIGRATION VERIFICATION SUITE (02_post_migration_verification.sql)
-- Complete Diagnostic & Security Assertion Script
-- Run immediately after applying migration 20261105000001
-- =============================================================================

DO $$
DECLARE
    v_failures text[] := ARRAY[]::text[];
    v_rec record;
    v_found_count int;
    v_has_public boolean;
    v_has_anon boolean;
    v_has_auth boolean;
    v_unexpected_roles text[];
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' WORKFORCE POST-MIGRATION SECURITY & INTEGRITY VERIFICATION    ';
    RAISE NOTICE '================================================================';

    -- -------------------------------------------------------------------------
    -- 1. Verify Function Identity, Return Type, Security Context & Search Path
    -- Restricted strictly to schema 'public'
    -- -------------------------------------------------------------------------
    FOR v_rec IN
        SELECT 
            expected.proname,
            expected.expected_args,
            expected.expected_result,
            expected.expected_secdef,
            expected.search_path_pattern,
            p.oid AS func_oid,
            p.prosecdef AS actual_secdef,
            p.proowner AS actual_proowner,
            p.proacl AS actual_proacl,
            r.rolname AS actual_owner,
            pg_get_function_identity_arguments(p.oid) AS actual_args,
            pg_get_function_result(p.oid) AS actual_result,
            array_to_string(p.proconfig, ', ') AS actual_proconfig
        FROM (
            VALUES 
                ('is_org_organizer', 'org_id uuid', 'boolean', true, 'search_path=""'),
                ('is_org_admin', 'org_id uuid', 'boolean', true, 'search_path=""'),
                ('is_org_manager_or_admin', 'org_id uuid', 'boolean', true, 'search_path=""'),
                ('enforce_project_manager_eligibility', '', 'trigger', true, 'search_path=pg_catalog, public, pg_temp'),
                ('cleanup_membership_references', '', 'trigger', true, 'search_path=pg_catalog, public, pg_temp')
        ) AS expected(proname, expected_args, expected_result, expected_secdef, search_path_pattern)
        LEFT JOIN (
            SELECT p.* 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public'
        ) p ON p.proname = expected.proname
        LEFT JOIN pg_roles r ON p.proowner = r.oid
    LOOP
        -- Check 1: Existence & uniqueness in public schema
        SELECT count(*) INTO v_found_count
        FROM pg_proc p2
        JOIN pg_namespace n2 ON p2.pronamespace = n2.oid
        WHERE n2.nspname = 'public' AND p2.proname = v_rec.proname;

        IF v_found_count = 0 THEN
            v_failures := array_append(v_failures, format('FATAL: Function public.%s is missing.', v_rec.proname));
            CONTINUE;
        ELSIF v_found_count > 1 THEN
            v_failures := array_append(v_failures, format('FATAL: Ambiguous/duplicate overloads (%s found) for public.%s.', v_found_count, v_rec.proname));
        END IF;

        -- Check 2: Exact identity arguments
        IF v_rec.actual_args IS DISTINCT FROM v_rec.expected_args THEN
            v_failures := array_append(v_failures, format('Function public.%s arguments mismatch: expected "%s", found "%s".', 
                v_rec.proname, v_rec.expected_args, v_rec.actual_args));
        END IF;

        -- Check 3: Exact return type
        IF v_rec.actual_result IS DISTINCT FROM v_rec.expected_result THEN
            v_failures := array_append(v_failures, format('Function public.%s return type mismatch: expected "%s", found "%s".', 
                v_rec.proname, v_rec.expected_result, v_rec.actual_result));
        END IF;

        -- Check 4: SECURITY DEFINER setting
        IF NOT v_rec.actual_secdef THEN
            v_failures := array_append(v_failures, format('Function public.%s is NOT SECURITY DEFINER.', v_rec.proname));
        END IF;

        -- Check 5: Function owner
        IF v_rec.actual_owner <> 'postgres' THEN
            v_failures := array_append(v_failures, format('Function public.%s owner is "%s" (expected "postgres").', 
                v_rec.proname, v_rec.actual_owner));
        END IF;

        -- Check 6: Normalized search path setting
        -- For helpers: 'search_path=""' or 'search_path=' represents empty search path
        IF v_rec.search_path_pattern = 'search_path=""' THEN
            IF v_rec.actual_proconfig NOT IN ('search_path=""', 'search_path=') THEN
                v_failures := array_append(v_failures, format('Function public.%s search_path mismatch: expected empty (""), found "%s".', 
                    v_rec.proname, v_rec.actual_proconfig));
            END IF;
        ELSE
            IF v_rec.actual_proconfig IS DISTINCT FROM v_rec.search_path_pattern THEN
                v_failures := array_append(v_failures, format('Function public.%s search_path mismatch: expected "%s", found "%s".', 
                    v_rec.proname, v_rec.search_path_pattern, v_rec.actual_proconfig));
            END IF;
        END IF;

        -- Check 7: Catalog-level ACL Verification via aclexplode
        -- Inspects pg_proc.proacl directly, accounting for default privileges via acldefault('f', proowner)
        -- In PostgreSQL, PUBLIC is a pseudo-role represented in ACLs by grantee = 0
        SELECT 
            bool_or(e.grantee = 0 AND e.privilege_type = 'EXECUTE'),
            bool_or(r.rolname = 'anon' AND e.privilege_type = 'EXECUTE'),
            bool_or(r.rolname = 'authenticated' AND e.privilege_type = 'EXECUTE'),
            array_agg(DISTINCT r.rolname) FILTER (WHERE e.grantee != 0 AND r.rolname NOT IN ('postgres', 'authenticated', 'service_role', 'supabase_admin', 'dashboard_user'))
        INTO v_has_public, v_has_anon, v_has_auth, v_unexpected_roles
        FROM aclexplode(COALESCE(v_rec.actual_proacl, acldefault('f', v_rec.actual_proowner))) e
        LEFT JOIN pg_roles r ON e.grantee = r.oid;

        -- 7a. Ensure PUBLIC pseudo-role (grantee=0) has NO execute privileges
        IF COALESCE(v_has_public, false) THEN
            v_failures := array_append(v_failures, format('Function public.%s has unexpected PUBLIC EXECUTE privilege in ACL (grantee=0).', v_rec.proname));
        END IF;

        -- 7b. Ensure anon role has NO execute privileges
        IF COALESCE(v_has_anon, false) THEN
            v_failures := array_append(v_failures, format('Function public.%s has unexpected anon EXECUTE privilege in ACL.', v_rec.proname));
        END IF;

        -- 7c. Check authenticated role permissions
        IF v_rec.expected_result = 'boolean' THEN
            -- Helper functions require authenticated EXECUTE
            IF NOT COALESCE(v_has_auth, false) THEN
                v_failures := array_append(v_failures, format('Helper public.%s is missing authenticated EXECUTE privilege in ACL.', v_rec.proname));
            END IF;
        ELSE
            -- Trigger functions must NEVER be directly executable by authenticated
            IF COALESCE(v_has_auth, false) THEN
                v_failures := array_append(v_failures, format('Trigger function public.%s has unexpected authenticated EXECUTE privilege in ACL.', v_rec.proname));
            END IF;
        END IF;

        -- 7d. Check for unintended roles
        IF v_unexpected_roles IS NOT NULL AND array_length(v_unexpected_roles, 1) > 0 THEN
            v_failures := array_append(v_failures, format('Function public.%s has unexpected ACL grants to roles: %s.', 
                v_rec.proname, array_to_string(v_unexpected_roles, ', ')));
        END IF;

        -- 7e. Dual-check effective runtime privileges via has_function_privilege
        IF v_rec.expected_result = 'boolean' THEN
            IF NOT has_function_privilege('authenticated', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Helper public.%s: authenticated role lacks effective EXECUTE privilege.', v_rec.proname));
            END IF;
            IF has_function_privilege('anon', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Helper public.%s: anon role unexpectedly has effective EXECUTE privilege.', v_rec.proname));
            END IF;
            IF has_function_privilege('public', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Helper public.%s: public role unexpectedly has effective EXECUTE privilege.', v_rec.proname));
            END IF;
        ELSE
            IF has_function_privilege('authenticated', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Trigger function public.%s: authenticated unexpectedly has effective EXECUTE privilege.', v_rec.proname));
            END IF;
            IF has_function_privilege('anon', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Trigger function public.%s: anon unexpectedly has effective EXECUTE privilege.', v_rec.proname));
            END IF;
            IF has_function_privilege('public', v_rec.func_oid, 'EXECUTE') THEN
                v_failures := array_append(v_failures, format('Trigger function public.%s: public unexpectedly has effective EXECUTE privilege.', v_rec.proname));
            END IF;
        END IF;

        RAISE NOTICE '%', format('✅ [PASS] Function public.%s(%s) -> %s (secdef=%s, owner=%s, %s)', 
            v_rec.proname, v_rec.expected_args, v_rec.expected_result, v_rec.actual_secdef, v_rec.actual_owner, v_rec.actual_proconfig);
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 2. Verify Expected Trigger Attachments, Enabled States, and Function Bindings
    -- Missing triggers cause a fatal failure
    -- -------------------------------------------------------------------------
    FOR v_rec IN
        SELECT 
            expected.tgname,
            expected.expected_table,
            expected.expected_func,
            t.oid IS NOT NULL AS exists,
            c.relname AS actual_table,
            p.proname AS actual_func,
            t.tgenabled AS actual_state
        FROM (
            VALUES 
                ('trg_enforce_project_manager_insert', 'projects', 'enforce_project_manager_eligibility'),
                ('trg_enforce_project_manager_update', 'projects', 'enforce_project_manager_eligibility'),
                ('trg_cleanup_membership_references', 'organization_memberships', 'cleanup_membership_references')
        ) AS expected(tgname, expected_table, expected_func)
        LEFT JOIN (
            SELECT t.*, c.relname, p.proname 
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_namespace nc ON c.relnamespace = nc.oid
            JOIN pg_proc p ON t.tgfoid = p.oid
            JOIN pg_namespace np ON p.pronamespace = np.oid
            WHERE nc.nspname = 'public' AND np.nspname = 'public'
        ) t ON t.tgname = expected.tgname
        LEFT JOIN pg_class c ON t.tgrelid = c.oid
        LEFT JOIN pg_proc p ON t.tgfoid = p.oid
    LOOP
        -- Check 1: Existence of trigger
        IF NOT v_rec.exists THEN
            v_failures := array_append(v_failures, format('FATAL: Trigger public.%s is missing from database.', v_rec.tgname));
            CONTINUE;
        END IF;

        -- Check 2: Attached table
        IF v_rec.actual_table IS DISTINCT FROM v_rec.expected_table THEN
            v_failures := array_append(v_failures, format('Trigger public.%s attached to unexpected table "%s" (expected "%s").', 
                v_rec.tgname, v_rec.actual_table, v_rec.expected_table));
        END IF;

        -- Check 3: Bound function
        IF v_rec.actual_func IS DISTINCT FROM v_rec.expected_func THEN
            v_failures := array_append(v_failures, format('Trigger public.%s bound to unexpected function "%s" (expected "%s").', 
                v_rec.tgname, v_rec.actual_func, v_rec.expected_func));
        END IF;

        -- Check 4: Trigger enabled state (must be 'O' for origin or 'A' for always)
        -- 'D' (disabled), 'R' (replica-only), and other states fail
        IF v_rec.actual_state NOT IN ('O', 'A') THEN
            v_failures := array_append(v_failures, format('FATAL: Trigger public.%s state is "%s" (must be "O" [Origin] or "A" [Always]).', 
                v_rec.tgname, v_rec.actual_state));
        ELSE
            RAISE NOTICE '%', format('✅ [PASS] Trigger public.%s on public.%s -> %s() [State: %s]', 
                v_rec.tgname, v_rec.actual_table, v_rec.actual_func, 
                CASE v_rec.actual_state WHEN 'O' THEN 'O (Origin/Enabled)' WHEN 'A' THEN 'A (Always)' END);
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- Final Verdict
    -- -------------------------------------------------------------------------
    IF array_length(v_failures, 1) > 0 THEN
        RAISE NOTICE '================================================================';
        RAISE NOTICE '❌ POST-MIGRATION VERIFICATION FAILED (% issues detected)', array_length(v_failures, 1);
        RAISE NOTICE '================================================================';
        FOR i IN 1..array_length(v_failures, 1) LOOP
            RAISE NOTICE '  [%] %', i, v_failures[i];
        END LOOP;
        RAISE EXCEPTION 'POST-MIGRATION VERIFICATION FAILED: % security/integrity assertions failed.', array_length(v_failures, 1);
    ELSE
        RAISE NOTICE '================================================================';
        RAISE NOTICE '✅ [SUCCESS] ALL POST-MIGRATION CHECKS PASSED (100%% VERIFIED)    ';
        RAISE NOTICE '================================================================';
    END IF;
END $$;
