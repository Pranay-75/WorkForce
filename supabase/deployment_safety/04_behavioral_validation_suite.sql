-- =============================================================================
-- WORKFORCE BEHAVIORAL VALIDATION SUITE (04_behavioral_validation_suite.sql)
-- Ephemeral, Non-Destructive In-Database Behavioral Test Suite
-- Wrapped in BEGIN ... ROLLBACK to guarantee ZERO persistent test data
-- =============================================================================

BEGIN;

DO $$
DECLARE
    -- Dynamically generated unique IDs to prevent any collision with existing data
    v_org_a UUID := gen_random_uuid();
    v_org_b UUID := gen_random_uuid();
    v_org_suspended UUID := gen_random_uuid();
    
    v_organizer_id UUID := gen_random_uuid();
    v_admin_id     UUID := gen_random_uuid();
    v_manager_id   UUID := gen_random_uuid();
    v_employee_id  UUID := gen_random_uuid();
    v_hr_id        UUID := gen_random_uuid();
    v_suspended_id UUID := gen_random_uuid();
    v_cross_org_id UUID := gen_random_uuid();
    v_non_member_id UUID := gen_random_uuid();
    
    v_run_id text := substr(gen_random_uuid()::text, 1, 8);
    v_proj_id UUID;
    v_passed int := 0;
    v_failed int := 0;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE ' WORKFORCE POST-MIGRATION BEHAVIORAL VALIDATION SUITE          ';
    RAISE NOTICE '================================================================';

    -- -------------------------------------------------------------------------
    -- 1. Setup Ephemeral Synthetic Users in auth.users
    -- Trigger on_auth_user_created automatically populates public.user_profiles
    -- -------------------------------------------------------------------------
    INSERT INTO auth.users (id, email)
    VALUES 
        (v_organizer_id, format('organizer-%s@test.corp', v_run_id)),
        (v_admin_id,     format('admin-%s@test.corp', v_run_id)),
        (v_manager_id,   format('manager-%s@test.corp', v_run_id)),
        (v_employee_id,  format('employee-%s@test.corp', v_run_id)),
        (v_hr_id,        format('hr-%s@test.corp', v_run_id)),
        (v_suspended_id, format('suspended-%s@test.corp', v_run_id)),
        (v_cross_org_id, format('cross-%s@test.corp', v_run_id));

    UPDATE public.user_profiles
    SET full_name = 'Synthetic User ' || substr(id::text, 1, 6)
    WHERE id IN (v_organizer_id, v_admin_id, v_manager_id, v_employee_id, v_hr_id, v_suspended_id, v_cross_org_id);

    -- -------------------------------------------------------------------------
    -- 2. Setup Ephemeral Synthetic Organizations & Memberships
    -- Enforcing trigger trg_enforce_membership_role_invariants:
    --   - v_org_a: created_by = v_organizer_id
    --   - v_org_b: created_by = v_cross_org_id
    --   - v_org_suspended: created_by = v_suspended_id (to test suspended creator)
    -- -------------------------------------------------------------------------
    INSERT INTO public.organizations (id, name, slug, created_by)
    VALUES 
        (v_org_a, format('Staging Test Org Alpha %s', v_run_id), format('staging-alpha-%s', v_run_id), v_organizer_id),
        (v_org_b, format('Staging Test Org Beta %s', v_run_id),  format('staging-beta-%s', v_run_id),  v_cross_org_id),
        (v_org_suspended, format('Staging Suspended Org %s', v_run_id), format('staging-susp-%s', v_run_id), v_suspended_id);

    INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
    VALUES 
        (v_org_a, v_organizer_id, 'organizer'::public.user_role, 'active'::public.membership_status),
        (v_org_a, v_admin_id,     'admin'::public.user_role,     'active'::public.membership_status),
        (v_org_a, v_manager_id,   'manager'::public.user_role,   'active'::public.membership_status),
        (v_org_a, v_employee_id,  'employee'::public.user_role,  'active'::public.membership_status),
        (v_org_a, v_hr_id,        'hr'::public.user_role,        'active'::public.membership_status),
        (v_org_b, v_cross_org_id, 'organizer'::public.user_role, 'active'::public.membership_status),
        (v_org_suspended, v_suspended_id, 'organizer'::public.user_role, 'suspended'::public.membership_status);

    -- -------------------------------------------------------------------------
    -- Scenario 1: Active Organizer (full authority across helpers)
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_organizer_id::text, true);
    IF public.is_org_organizer(v_org_a) AND public.is_org_admin(v_org_a) AND public.is_org_manager_or_admin(v_org_a) THEN
        RAISE NOTICE '✅ [PASS] Scenario 1: Active Organizer has organizer, admin, and manager powers.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] Scenario 1: Active Organizer missing expected helper permissions.';
        v_failed := v_failed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- Scenario 2: Active Admin (admin + manager powers, denied organizer-only)
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    IF NOT public.is_org_organizer(v_org_a) AND public.is_org_admin(v_org_a) AND public.is_org_manager_or_admin(v_org_a) THEN
        RAISE NOTICE '✅ [PASS] Scenario 2: Active Admin has admin and manager powers, denied organizer-only.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] Scenario 2: Active Admin permissions mismatch.';
        v_failed := v_failed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- Scenario 3: Active Manager (manager powers, denied admin and organizer)
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::text, true);
    IF NOT public.is_org_organizer(v_org_a) AND NOT public.is_org_admin(v_org_a) AND public.is_org_manager_or_admin(v_org_a) THEN
        RAISE NOTICE '✅ [PASS] Scenario 3: Active Manager has manager powers, denied admin and organizer.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] Scenario 3: Active Manager permissions mismatch.';
        v_failed := v_failed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- Scenario 4: Suspended Organizer (matching organizations.created_by)
    -- Must return FALSE across all helpers (proves created_by bypass is eliminated)
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_suspended_id::text, true);
    IF NOT public.is_org_organizer(v_org_suspended) 
       AND NOT public.is_org_admin(v_org_suspended) 
       AND NOT public.is_org_manager_or_admin(v_org_suspended) THEN
        RAISE NOTICE '✅ [PASS] Scenario 4: Suspended Organizer denied all powers (created_by bypass eliminated).';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] Scenario 4: Suspended Organizer unexpectedly bypassed membership check via created_by.';
        v_failed := v_failed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- Scenario 5: Cross-Organization Tenant Isolation
    -- -------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_cross_org_id::text, true);
    IF NOT public.is_org_organizer(v_org_a) AND NOT public.is_org_admin(v_org_a) AND NOT public.is_org_manager_or_admin(v_org_a) THEN
        RAISE NOTICE '✅ [PASS] Scenario 5: Cross-organization user denied all access in Org A.';
        v_passed := v_passed + 1;
    ELSE
        RAISE NOTICE '❌ [FAIL] Scenario 5: Cross-tenant isolation leak detected.';
        v_failed := v_failed + 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- Scenario 6: Project Manager Eligibility Trigger (enforce_project_manager_eligibility)
    -- -------------------------------------------------------------------------
    -- 6a. Designating Organizer as Project Manager -> MUST SUCCEED
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Alpha', v_organizer_id, 'planning')
        RETURNING id INTO v_proj_id;
        RAISE NOTICE '✅ [PASS] Scenario 6a: Organizer successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6a: Organizer designation as Project Manager failed: %', SQLERRM;
        v_failed := v_failed + 1;
    END;

    -- 6b. Designating Admin as Project Manager -> MUST SUCCEED
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Beta', v_admin_id, 'planning')
        RETURNING id INTO v_proj_id;
        RAISE NOTICE '✅ [PASS] Scenario 6b: Admin successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6b: Admin designation as Project Manager failed: %', SQLERRM;
        v_failed := v_failed + 1;
    END;

    -- 6c. Designating Manager as Project Manager -> MUST SUCCEED
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Gamma', v_manager_id, 'planning')
        RETURNING id INTO v_proj_id;
        RAISE NOTICE '✅ [PASS] Scenario 6c: Manager successfully designated as Project Manager.';
        v_passed := v_passed + 1;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6c: Manager designation as Project Manager failed: %', SQLERRM;
        v_failed := v_failed + 1;
    END;

    -- 6d. Designating Employee as Project Manager -> MUST FAIL WITH 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Delta', v_employee_id, 'planning');
        RAISE NOTICE '❌ [FAIL] Scenario 6d: Employee unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] Scenario 6d: Employee rejected with expected 42501 permission error.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6d: Unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
        v_failed := v_failed + 1;
    END;

    -- 6e. Designating HR as Project Manager -> MUST FAIL WITH 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Epsilon', v_hr_id, 'planning');
        RAISE NOTICE '❌ [FAIL] Scenario 6e: HR unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] Scenario 6e: HR rejected with expected 42501 permission error.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6e: Unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
        v_failed := v_failed + 1;
    END;

    -- 6f. Designating Suspended Organizer as Project Manager -> MUST FAIL WITH 42501
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_suspended, 'Project Zeta', v_suspended_id, 'planning');
        RAISE NOTICE '❌ [FAIL] Scenario 6f: Suspended Organizer unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '42501' THEN
        RAISE NOTICE '✅ [PASS] Scenario 6f: Suspended Organizer rejected with expected 42501 permission error.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6f: Unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
        v_failed := v_failed + 1;
    END;

    -- 6g. Designating Non-Member as Project Manager -> MUST FAIL WITH 23503
    BEGIN
        INSERT INTO public.projects (id, organization_id, name, manager_id, status)
        VALUES (gen_random_uuid(), v_org_a, 'Project Eta', v_non_member_id, 'planning');
        RAISE NOTICE '❌ [FAIL] Scenario 6g: Non-member unexpectedly allowed as Project Manager.';
        v_failed := v_failed + 1;
    EXCEPTION WHEN SQLSTATE '23503' THEN
        RAISE NOTICE '✅ [PASS] Scenario 6g: Non-member rejected with expected 23503 membership error.';
        v_passed := v_passed + 1;
    WHEN OTHERS THEN
        RAISE NOTICE '❌ [FAIL] Scenario 6g: Unexpected error: % (SQLSTATE %)', SQLERRM, SQLSTATE;
        v_failed := v_failed + 1;
    END;

    RAISE NOTICE '================================================================';
    RAISE NOTICE '%', format('BEHAVIORAL SUITE RESULTS: %s passed, %s failed', v_passed, v_failed);
    RAISE NOTICE '================================================================';

    IF v_failed > 0 THEN
        RAISE EXCEPTION 'BEHAVIORAL VALIDATION FAILED: % test scenarios failed.', v_failed;
    END IF;
END $$;

-- Guarantee 100% ephemeral isolation: roll back all synthetic test rows
ROLLBACK;
