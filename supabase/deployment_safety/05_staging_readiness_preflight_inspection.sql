-- =============================================================================
-- WORKFORCE STAGING READINESS PREFLIGHT INSPECTION (ROUND 3 AUDITED)
-- File: supabase/deployment_safety/05_staging_readiness_preflight_inspection.sql
--
-- STRICTLY READ-ONLY DIAGNOSTIC SCRIPT
-- Target:   Staging database (biejxkrhypkkcvpbzjhh.supabase.co)
-- Purpose:  Comprehensive preflight schema readiness inspection before staging
--           user registration, login, and tenant bootstrap testing.
-- Safety:   Zero DDL/DML. Contains NO CREATE, ALTER, DROP, TRUNCATE, INSERT,
--           UPDATE, DELETE, GRANT, or REVOKE statements. Safe for SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1A: MIGRATION TRACKING TABLE EXISTENCE VERIFICATION (CATALOG CHECK)
-- Safely detects whether supabase_migrations.schema_migrations exists in catalog.
-- Note: Verifies tracking table presence only. Applied migration versions are
--       retrieved separately in Section 1B below when this table is present.
-- -----------------------------------------------------------------------------
SELECT 
    '01A_MIGRATION_TABLE_PRESENCE' AS check_category,
    'supabase_migrations.schema_migrations' AS target_relation,
    CASE 
        WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL THEN 'NOT VERIFIED / TABLE MISSING'
        ELSE 'TABLE PRESENT'
    END AS status,
    CASE 
        WHEN to_regclass('supabase_migrations.schema_migrations') IS NULL 
            THEN 'Relation supabase_migrations.schema_migrations does not exist in catalog. Applied migration history cannot be verified.'
        ELSE 'Migration tracking table exists in catalog. Execute Section 1B below to retrieve applied migration versions.'
    END AS details;

-- -----------------------------------------------------------------------------
-- SECTION 1B: APPLIED MIGRATION VERSIONS (EXECUTE IF SECTION 1A PASSES)
-- Note: This query directly reads from supabase_migrations.schema_migrations.
-- Execute this statement in Supabase SQL editor only when Section 1A confirms
-- that the tracking table is present. Section 1A verifies table existence only.
-- -----------------------------------------------------------------------------
SELECT 
    '01B_APPLIED_MIGRATIONS' AS check_category,
    version,
    inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- -----------------------------------------------------------------------------
-- SECTION 2: ENUM DEFINITIONS, EXACT ARRAY MATCH & DETERMINISTIC SUMMARY
-- Verifies exact enum definitions in public schema:
--   1. user_role: exactly {organizer,admin,manager,hr,employee}
--   2. membership_status: exactly {active,invited,suspended}
-- Produces exactly ONE authoritative summary row per required enum.
-- Precedence:
--   1. FAIL (ENUM TYPE MISSING)
--   2. FAIL (LABEL COUNT MISMATCH)
--   3. FAIL (LABEL MISSING)
--   4. FAIL (UNEXPECTED LABEL)
--   5. FAIL (ENUM ORDER MISMATCH)
--   6. PASS (only when actual_labels = expected_labels)
-- Source migrations:
--   20261010000001_initial_auth_schema.sql:10-23 (base enums)
--   20261030000000_phase1_add_organizer_enum.sql:6 (organizer BEFORE admin)
--   20261102000000_add_hr_role_enum.sql:6 (hr BEFORE employee)
-- -----------------------------------------------------------------------------
WITH expected_enums AS (
    SELECT 
        'user_role' AS enum_name,
        ARRAY['organizer', 'admin', 'manager', 'hr', 'employee']::text[] AS expected_labels
    UNION ALL
    SELECT 
        'membership_status',
        ARRAY['active', 'invited', 'suspended']::text[]
),
actual_enums AS (
    SELECT 
        t.typname AS enum_name,
        COUNT(e.enumlabel)::int AS actual_count,
        COALESCE(
            array_agg(e.enumlabel ORDER BY e.enumsortorder) FILTER (WHERE e.enumlabel IS NOT NULL),
            ARRAY[]::text[]
        ) AS actual_labels
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    LEFT JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public' 
      AND t.typname IN ('user_role', 'membership_status')
    GROUP BY t.typname
),
enum_comparisons AS (
    SELECT 
        ee.enum_name,
        (ae.enum_name IS NOT NULL) AS type_exists,
        cardinality(ee.expected_labels)::int AS expected_count,
        COALESCE(ae.actual_count, 0) AS actual_count,
        ee.expected_labels,
        COALESCE(ae.actual_labels, ARRAY[]::text[]) AS actual_labels,
        ARRAY(
            SELECT exp_lbl 
            FROM unnest(ee.expected_labels) AS exp_lbl
            WHERE NOT (exp_lbl = ANY(COALESCE(ae.actual_labels, ARRAY[]::text[])))
        ) AS missing_labels,
        ARRAY(
            SELECT act_lbl 
            FROM unnest(COALESCE(ae.actual_labels, ARRAY[]::text[])) AS act_lbl
            WHERE NOT (act_lbl = ANY(ee.expected_labels))
        ) AS unexpected_labels
    FROM expected_enums ee
    LEFT JOIN actual_enums ae ON ee.enum_name = ae.enum_name
)
SELECT 
    '02_ENUM_CHECKS' AS check_category,
    'public.' || ec.enum_name AS target_enum,
    ec.type_exists,
    ec.expected_count,
    ec.actual_count,
    ec.expected_labels,
    ec.actual_labels,
    CASE 
        WHEN NOT ec.type_exists 
            THEN 'FAIL (ENUM TYPE MISSING)'
        WHEN ec.actual_count <> ec.expected_count 
            THEN 'FAIL (LABEL COUNT MISMATCH: expected ' || ec.expected_count || ', got ' || ec.actual_count || ')'
        WHEN cardinality(ec.missing_labels) > 0 
            THEN 'FAIL (LABEL MISSING: ' || array_to_string(ec.missing_labels, ', ') || ')'
        WHEN cardinality(ec.unexpected_labels) > 0 
            THEN 'FAIL (UNEXPECTED LABEL: ' || array_to_string(ec.unexpected_labels, ', ') || ')'
        WHEN ec.actual_labels <> ec.expected_labels 
            THEN 'FAIL (ENUM ORDER MISMATCH)'
        WHEN ec.actual_labels = ec.expected_labels 
            THEN 'PASS'
        ELSE 'FAIL (DEFINITION MISMATCH)'
    END AS status,
    CASE 
        WHEN NOT ec.type_exists 
            THEN 'Enum type public.' || ec.enum_name || ' does not exist in database catalog.'
        WHEN ec.actual_labels = ec.expected_labels 
            THEN 'All ' || ec.expected_count || ' labels present in exact required order.'
        ELSE 
            'Expected: ' || array_to_string(ec.expected_labels, ', ') || 
            ' | Actual: ' || array_to_string(ec.actual_labels, ', ') ||
            CASE WHEN cardinality(ec.missing_labels) > 0 THEN ' | Missing: ' || array_to_string(ec.missing_labels, ', ') ELSE '' END ||
            CASE WHEN cardinality(ec.unexpected_labels) > 0 THEN ' | Unexpected: ' || array_to_string(ec.unexpected_labels, ', ') ELSE '' END
    END AS diagnostic_details
FROM enum_comparisons ec
ORDER BY ec.enum_name;

-- -----------------------------------------------------------------------------
-- SECTION 3: CORE TABLES & ROW LEVEL SECURITY (RLS) STATUS
-- Resolves tables strictly using public schema join.
-- Prevents identically named tables in other schemas from generating false passes.
-- -----------------------------------------------------------------------------
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'user_profiles',
        'organizations',
        'organization_memberships',
        'organization_invitations',
        'projects',
        'tasks',
        'project_members'
    ]) AS table_name
),
actual_public_tables AS (
    SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS is_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
)
SELECT 
    '03_TABLE_RLS_CHECKS' AS check_category,
    'public.' || r.table_name AS target_table,
    CASE 
        WHEN a.table_name IS NULL THEN 'FAIL (TABLE MISSING IN public)'
        WHEN NOT a.is_rls_enabled THEN 'FAIL (RLS DISABLED)'
        ELSE 'PASS'
    END AS status,
    CASE 
        WHEN a.table_name IS NULL THEN 'Table does not exist in public schema.'
        WHEN NOT a.is_rls_enabled THEN 'Table exists in public but Row-Level Security is DISABLED.'
        ELSE 'Table exists in public and Row-Level Security is ENABLED.'
    END AS details
FROM required_tables r
LEFT JOIN actual_public_tables a ON r.table_name = a.table_name
ORDER BY r.table_name;

-- -----------------------------------------------------------------------------
-- SECTION 4: REQUIRED COLUMNS & DATA TYPES
-- Verifies parent table exists in public schema, column exists, and data type matches.
-- Source migrations:
--   20261010000001_initial_auth_schema.sql (base tables)
--   20261030000001_add_member_system_and_remove_blocked_status.sql (created_by on organizations)
-- -----------------------------------------------------------------------------
WITH required_columns AS (
    SELECT 'user_profiles' AS table_name, 'id' AS col, 'uuid' AS expected_type UNION ALL
    SELECT 'user_profiles', 'email', 'text' UNION ALL
    SELECT 'user_profiles', 'full_name', 'text' UNION ALL
    SELECT 'user_profiles', 'department', 'text' UNION ALL
    SELECT 'user_profiles', 'job_title', 'text' UNION ALL
    SELECT 'user_profiles', 'weekly_capacity_hours', 'numeric' UNION ALL
    SELECT 'organizations', 'id', 'uuid' UNION ALL
    SELECT 'organizations', 'name', 'text' UNION ALL
    SELECT 'organizations', 'slug', 'text' UNION ALL
    SELECT 'organizations', 'created_by', 'uuid' UNION ALL
    SELECT 'organization_memberships', 'id', 'uuid' UNION ALL
    SELECT 'organization_memberships', 'organization_id', 'uuid' UNION ALL
    SELECT 'organization_memberships', 'user_id', 'uuid' UNION ALL
    SELECT 'organization_memberships', 'role', 'user_role' UNION ALL
    SELECT 'organization_memberships', 'status', 'membership_status'
),
actual_public_tables AS (
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
actual_columns AS (
    SELECT 
        c.relname AS table_name,
        a.attname AS column_name,
        format_type(a.atttypid, a.atttypmod) AS formatted_type,
        t.typname AS base_type
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
)
SELECT 
    '04_COLUMN_CHECKS' AS check_category,
    'public.' || rc.table_name AS table_name,
    rc.col AS column_name,
    rc.expected_type,
    COALESCE(ac.formatted_type, 'N/A') AS actual_type,
    CASE 
        WHEN apt.table_name IS NULL THEN 'FAIL (PARENT TABLE MISSING IN public)'
        WHEN ac.column_name IS NULL THEN 'FAIL (COLUMN MISSING)'
        WHEN rc.expected_type = 'numeric' AND (ac.formatted_type LIKE 'numeric%' OR ac.base_type = 'numeric') THEN 'PASS'
        WHEN ac.formatted_type = rc.expected_type OR ac.base_type = rc.expected_type THEN 'PASS'
        ELSE 'FAIL (TYPE MISMATCH: expected ' || rc.expected_type || ', got ' || ac.formatted_type || ')'
    END AS status
FROM required_columns rc
LEFT JOIN actual_public_tables apt ON rc.table_name = apt.table_name
LEFT JOIN actual_columns ac ON rc.table_name = ac.table_name AND rc.col = ac.column_name
ORDER BY rc.table_name, rc.col;

-- -----------------------------------------------------------------------------
-- SECTION 5: PRIMARY KEYS, CONSTRAINTS & FOREIGN KEYS (STRICT 4-COLUMN CTE)
-- Validates primary keys, foreign keys, and unique constraints using strict matching.
-- Every branch in expected_constraints has exactly 4 columns.
-- No OR condition is used for constraint matching.
-- -----------------------------------------------------------------------------
WITH expected_constraints AS (
    SELECT 
        'user_profiles' AS table_name,
        'user_profiles_pkey' AS expected_constraint_name,
        'p' AS expected_constraint_type,
        'PRIMARY KEY (id)' AS expected_definition_fragment
    UNION ALL
    SELECT 'user_profiles', 'user_profiles_id_fkey', 'f', 'REFERENCES auth.users(id)'
    UNION ALL
    SELECT 'organizations', 'organizations_pkey', 'p', 'PRIMARY KEY (id)'
    UNION ALL
    SELECT 'organizations', 'organizations_slug_key', 'u', 'UNIQUE (slug)'
    UNION ALL
    SELECT 'organization_memberships', 'organization_memberships_pkey', 'p', 'PRIMARY KEY (id)'
    UNION ALL
    SELECT 'organization_memberships', 'organization_memberships_organization_id_user_id_key', 'u', 'UNIQUE (organization_id, user_id)'
    UNION ALL
    SELECT 'organization_memberships', 'organization_memberships_organization_id_fkey', 'f', 'REFERENCES organizations(id)'
    UNION ALL
    SELECT 'organization_memberships', 'organization_memberships_user_id_fkey', 'f', 'REFERENCES user_profiles(id)'
),
actual_public_tables AS (
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
),
actual_constraints AS (
    SELECT 
        cl.relname AS table_name,
        c.conname,
        c.contype,
        pg_get_constraintdef(c.oid) AS condef
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON cl.relnamespace = n.oid
    WHERE n.nspname = 'public'
)
SELECT 
    '05_CONSTRAINT_CHECKS' AS check_category,
    'public.' || ec.table_name AS table_name,
    ec.expected_constraint_name AS constraint_name,
    CASE 
        WHEN ec.expected_constraint_type = 'p' THEN 'PRIMARY KEY'
        WHEN ec.expected_constraint_type = 'f' THEN 'FOREIGN KEY'
        WHEN ec.expected_constraint_type = 'u' THEN 'UNIQUE'
        ELSE ec.expected_constraint_type
    END AS constraint_type,
    COALESCE(ac.condef, 'N/A') AS actual_definition,
    CASE 
        WHEN apt.table_name IS NULL THEN 'FAIL (PARENT TABLE MISSING IN public)'
        WHEN ac.conname IS NULL THEN 'FAIL (CONSTRAINT MISSING: ' || ec.expected_constraint_name || ')'
        WHEN ac.contype <> ec.expected_constraint_type 
            THEN 'FAIL (CONSTRAINT TYPE MISMATCH: expected ' || ec.expected_constraint_type || ', got ' || ac.contype || ')'
        WHEN ac.condef NOT ILIKE '%' || ec.expected_definition_fragment || '%' 
            THEN 'FAIL (DEFINITION MISMATCH: expected ' || ec.expected_definition_fragment || ')'
        ELSE 'PASS'
    END AS status
FROM expected_constraints ec
LEFT JOIN actual_public_tables apt ON ec.table_name = apt.table_name
LEFT JOIN actual_constraints ac 
    ON ec.table_name = ac.table_name 
   AND ec.expected_constraint_name = ac.conname
ORDER BY ec.table_name, ec.expected_constraint_name;

-- -----------------------------------------------------------------------------
-- SECTION 6: FUNCTION & RPC SPECIFICATION CHECKS (OVERLOAD & EXACT search_path AUDIT)
-- Strictly checks public schema functions against PostgreSQL catalog data.
-- Features:
--   1. Matches by exact function name AND identity argument types.
--   2. Detects missing functions vs. mismatched overload vs. ambiguous multiple overloads.
--   3. Validates exact search_path configuration (empty string vs exact expected value).
--   4. Validates argument names, return type, SECURITY DEFINER, and owner.
--
-- Migration definitions:
--   create_organization_with_admin: 20261011000001_restrict_organization_creation.sql:105
--   is_org_member:                  20261011000001_restrict_organization_creation.sql:14
--   is_org_admin:                   20261105000001_organizer_full_control_and_membership_boundary.sql:45
--   is_org_manager_or_admin:        20261105000001_organizer_full_control_and_membership_boundary.sql:74
--   is_org_organizer:               20261105000001_organizer_full_control_and_membership_boundary.sql:17
--   get_user_org_role:              20261011000001_restrict_organization_creation.sql:82
--   handle_new_user:                20261010000001_initial_auth_schema.sql:203
-- -----------------------------------------------------------------------------
WITH expected_functions AS (
    SELECT 
        'create_organization_with_admin' AS fn_name,
        2 AS expected_arg_count,
        'text, text' AS expected_arg_types,
        'p_name, p_slug' AS expected_arg_names,
        'uuid' AS expected_return,
        true AS expected_secdef,
        'postgres' AS expected_owner,
        '' AS expected_search_path
    UNION ALL
    SELECT 'is_org_member', 1, 'uuid', 'org_id', 'boolean', true, 'postgres', ''
    UNION ALL
    SELECT 'is_org_admin', 1, 'uuid', 'org_id', 'boolean', true, 'postgres', ''
    UNION ALL
    SELECT 'is_org_manager_or_admin', 1, 'uuid', 'org_id', 'boolean', true, 'postgres', ''
    UNION ALL
    SELECT 'is_org_organizer', 1, 'uuid', 'org_id', 'boolean', true, 'postgres', ''
    UNION ALL
    SELECT 'get_user_org_role', 1, 'uuid', 'org_id', 'user_role', true, 'postgres', ''
    UNION ALL
    SELECT 'handle_new_user', 0, '', '', 'trigger', true, 'postgres', 'public, auth'
),
name_summary AS (
    SELECT 
        p.proname AS fn_name,
        COUNT(*) AS total_overloads,
        string_agg(
            p.proname || '(' || COALESCE(oidvectortypes(p.proargtypes), '') || ')', 
            '; ' ORDER BY p.oid
        ) AS existing_overloads
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    GROUP BY p.proname
),
actual_public_functions AS (
    SELECT 
        p.proname AS fn_name,
        p.pronargs AS actual_arg_count,
        COALESCE(oidvectortypes(p.proargtypes), '') AS actual_arg_types,
        COALESCE(array_to_string(p.proargnames, ', '), '') AS actual_arg_names,
        format_type(p.prorettype, NULL) AS actual_return,
        p.prosecdef AS is_security_definer,
        pg_get_userbyid(p.proowner) AS function_owner,
        (
            SELECT trim(both ' "' from substring(cfg from '^search_path=(.*)$'))
            FROM unnest(p.proconfig) cfg
            WHERE cfg LIKE 'search_path=%'
            LIMIT 1
        ) AS actual_search_path
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
)
SELECT 
    '06_RPC_FUNCTION_CHECKS' AS check_category,
    'public.' || ef.fn_name AS function_name,
    ef.expected_arg_types,
    COALESCE(af_exact.actual_arg_types, 'N/A') AS actual_arg_types,
    ef.expected_arg_names,
    COALESCE(af_exact.actual_arg_names, 'N/A') AS actual_arg_names,
    ef.expected_return,
    COALESCE(af_exact.actual_return, 'N/A') AS actual_return,
    COALESCE(af_exact.is_security_definer, false) AS is_security_definer,
    COALESCE(af_exact.function_owner, 'N/A') AS function_owner,
    CASE 
        WHEN ef.expected_search_path = '' THEN '<EMPTY>'
        ELSE ef.expected_search_path
    END AS expected_search_path,
    CASE 
        WHEN af_exact.actual_search_path IS NULL THEN '<UNCONFIGURED>'
        WHEN af_exact.actual_search_path = '' THEN '<EMPTY>'
        ELSE af_exact.actual_search_path
    END AS actual_search_path,
    COALESCE(ns.total_overloads, 0) AS total_overloads_in_public,
    CASE 
        WHEN ns.fn_name IS NULL 
            THEN 'FAIL (FUNCTION MISSING IN public)'
        WHEN af_exact.fn_name IS NULL 
            THEN 'FAIL (SIGNATURE MISMATCH / WRONG OVERLOAD: expected (' || ef.expected_arg_types || '), found: ' || ns.existing_overloads || ')'
        WHEN ns.total_overloads > 1 
            THEN 'FAIL (AMBIGUOUS / UNEXPECTED OVERLOAD DETECTED: total ' || ns.total_overloads || ' overloads: ' || ns.existing_overloads || ')'
        WHEN af_exact.actual_arg_names <> ef.expected_arg_names 
            THEN 'FAIL (ARGUMENT NAMES MISMATCH: expected (' || ef.expected_arg_names || '), got (' || af_exact.actual_arg_names || '))'
        WHEN af_exact.actual_return NOT IN (ef.expected_return, 'public.' || ef.expected_return) 
            THEN 'FAIL (RETURN TYPE MISMATCH: expected ' || ef.expected_return || ', got ' || af_exact.actual_return || ')'
        WHEN NOT af_exact.is_security_definer 
            THEN 'FAIL (NOT SECURITY DEFINER)'
        WHEN af_exact.function_owner <> ef.expected_owner 
            THEN 'FAIL (OWNER MISMATCH: expected ' || ef.expected_owner || ', got ' || af_exact.function_owner || ')'
        WHEN ef.expected_search_path = '' AND (af_exact.actual_search_path IS NULL OR af_exact.actual_search_path <> '') 
            THEN CASE 
                WHEN af_exact.actual_search_path IS NULL THEN 'FAIL (SEARCH_PATH UNCONFIGURED / MISSING)'
                ELSE 'FAIL (SEARCH_PATH NOT EMPTY: got ' || af_exact.actual_search_path || ')'
            END
        WHEN ef.expected_search_path <> '' AND (af_exact.actual_search_path IS NULL OR regexp_replace(af_exact.actual_search_path, '\s*,\s*', ', ', 'g') <> ef.expected_search_path)
            THEN CASE 
                WHEN af_exact.actual_search_path IS NULL THEN 'FAIL (SEARCH_PATH UNCONFIGURED / MISSING)'
                ELSE 'FAIL (SEARCH_PATH MISMATCH: expected ' || ef.expected_search_path || ', got ' || af_exact.actual_search_path || ')'
            END
        ELSE 'PASS'
    END AS status
FROM expected_functions ef
LEFT JOIN name_summary ns ON ef.fn_name = ns.fn_name
LEFT JOIN actual_public_functions af_exact 
    ON ef.fn_name = af_exact.fn_name 
   AND ef.expected_arg_types = af_exact.actual_arg_types
ORDER BY ef.fn_name;

-- -----------------------------------------------------------------------------
-- SECTION 7: TRIGGER DEFINITION & BITMASK AUDIT (auth.users -> public.handle_new_user)
-- Explicitly checks on_auth_user_created on auth.users.
-- Validates:
--   - Timing is strictly AFTER ((t.tgtype & 66) = 0).
--   - Event is strictly INSERT ((t.tgtype & 4) <> 0).
--   - Rejects additional UPDATE, DELETE, or TRUNCATE event flags ((t.tgtype & 56) = 0).
--   - Level is strictly ROW level ((t.tgtype & 1) <> 0).
--   - Target relation is auth.users.
--   - Target function is public.handle_new_user().
--   - Enabled state is 'O' (origin/local) or 'A' (always).
-- Source migration: 20261010000001_initial_auth_schema.sql:231-235
-- -----------------------------------------------------------------------------
WITH expected_trigger AS (
    SELECT 
        'on_auth_user_created' AS expected_trigger_name,
        'auth' AS expected_schema,
        'users' AS expected_table,
        'public' AS expected_fn_schema,
        'handle_new_user' AS expected_fn_name,
        'AFTER' AS expected_timing,
        'INSERT' AS expected_event
),
actual_triggers AS (
    SELECT 
        t.tgname AS trigger_name,
        nc.nspname AS table_schema,
        c.relname AS table_name,
        np.nspname AS fn_schema,
        p.proname AS fn_name,
        CASE 
            WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE'
            WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
            ELSE 'AFTER'
        END AS actual_timing,
        (t.tgtype & 4) <> 0 AS is_insert,
        (t.tgtype & 8) <> 0 AS is_delete,
        (t.tgtype & 16) <> 0 AS is_update,
        (t.tgtype & 32) <> 0 AS is_truncate,
        (t.tgtype & 56) <> 0 AS has_extra_events,
        (t.tgtype & 1) <> 0 AS is_row_level,
        array_to_string(ARRAY[
            CASE WHEN (t.tgtype & 4) <> 0 THEN 'INSERT' END,
            CASE WHEN (t.tgtype & 8) <> 0 THEN 'DELETE' END,
            CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END,
            CASE WHEN (t.tgtype & 32) <> 0 THEN 'TRUNCATE' END
        ], ', ') AS active_events,
        t.tgenabled,
        t.tgtype
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace nc ON c.relnamespace = nc.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    JOIN pg_namespace np ON p.pronamespace = np.oid
    WHERE nc.nspname = 'auth' AND c.relname = 'users' AND t.tgname = 'on_auth_user_created'
)
SELECT 
    '07_TRIGGER_CHECKS' AS check_category,
    et.expected_trigger_name AS trigger_name,
    et.expected_schema || '.' || et.expected_table AS target_table,
    et.expected_timing AS expected_timing,
    COALESCE(at.actual_timing, 'N/A') AS actual_timing,
    et.expected_event AS expected_event,
    COALESCE(at.active_events, 'N/A') AS actual_events,
    et.expected_fn_schema || '.' || et.expected_fn_name || '()' AS expected_function,
    COALESCE(at.fn_schema || '.' || at.fn_name || '()', 'N/A') AS actual_function,
    COALESCE(at.tgenabled, 'N/A') AS enabled_state,
    CASE 
        WHEN at.trigger_name IS NULL 
            THEN 'FAIL (TRIGGER MISSING ON auth.users)'
        WHEN at.actual_timing <> et.expected_timing 
            THEN 'FAIL (TIMING MISMATCH: expected ' || et.expected_timing || ', got ' || at.actual_timing || ')'
        WHEN NOT at.is_insert 
            THEN 'FAIL (EVENT MISMATCH: INSERT event flag missing)'
        WHEN at.has_extra_events 
            THEN 'FAIL (EVENT MISMATCH: trigger handles extra events outside INSERT: ' || at.active_events || ')'
        WHEN NOT at.is_row_level 
            THEN 'FAIL (LEVEL MISMATCH: expected ROW-level trigger)'
        WHEN at.fn_schema <> et.expected_fn_schema OR at.fn_name <> et.expected_fn_name 
            THEN 'FAIL (FUNCTION MISMATCH: calls ' || at.fn_schema || '.' || at.fn_name || ')'
        WHEN at.tgenabled NOT IN ('O', 'A') 
            THEN 'FAIL (TRIGGER DISABLED: state ' || at.tgenabled || ')'
        ELSE 'PASS'
    END AS status,
    CASE 
        WHEN at.trigger_name IS NULL THEN 'Trigger on_auth_user_created does not exist on auth.users.'
        WHEN at.has_extra_events THEN 'Trigger handles extra event flags beyond pure INSERT.'
        WHEN at.tgenabled = 'O' THEN 'Trigger is ENABLED (origin/local) and correctly invokes public.handle_new_user() AFTER INSERT exclusively.'
        WHEN at.tgenabled = 'A' THEN 'Trigger is ALWAYS ENABLED and correctly invokes public.handle_new_user() AFTER INSERT exclusively.'
        ELSE 'Trigger exists but is disabled or in unexpected state.'
    END AS details
FROM expected_trigger et
LEFT JOIN actual_triggers at ON et.expected_trigger_name = at.trigger_name;

-- -----------------------------------------------------------------------------
-- SECTION 8A: REQUIRED RLS POLICIES PRESENCE CHECK (VERIFIED FROM MIGRATIONS)
-- Verifies required baseline RLS policies exist on public auth/org tables.
-- Matches exact schema, exact table, exact policy name, and exact expected command.
-- Source migrations:
--   user_profiles:            20261010000001_initial_auth_schema.sql:267-292
--   organizations:            20261010000001_initial_auth_schema.sql:247-248
--                             20261030000001_add_member_system_and_remove_blocked_status.sql:1101
--   organization_memberships: 20261010000001_initial_auth_schema.sql:299-300
--                             20261030000001_add_member_system_and_remove_blocked_status.sql:1113
--                             20261011000001_restrict_organization_creation.sql:591
-- Note: Policy presence verifies catalog existence; auditing correctness
--       requires reviewing the USING and WITH CHECK expressions in Section 8B.
-- -----------------------------------------------------------------------------
WITH required_policies AS (
    SELECT 'user_profiles' AS tablename, 'Users can view their own profile' AS expected_policy, 'SELECT' AS expected_cmd UNION ALL
    SELECT 'user_profiles', 'Users can view profiles of members in the same organization', 'SELECT' UNION ALL
    SELECT 'user_profiles', 'Users can update only their own profile details', 'UPDATE' UNION ALL
    SELECT 'organizations', 'Users can view organizations they belong to', 'SELECT' UNION ALL
    SELECT 'organizations', 'Only organization organizers can update organization details', 'UPDATE' UNION ALL
    SELECT 'organization_memberships', 'Users can view memberships in their organizations', 'SELECT' UNION ALL
    SELECT 'organization_memberships', 'Only organization organizers can update memberships', 'UPDATE' UNION ALL
    SELECT 'organization_memberships', 'Only organization admins can delete memberships', 'DELETE'
),
actual_policies AS (
    SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        permissive,
        roles
    FROM pg_policies
    WHERE schemaname = 'public'
)
SELECT 
    '08A_REQUIRED_RLS_POLICIES' AS check_category,
    'public.' || rp.tablename AS target_table,
    rp.expected_policy AS policy_name,
    rp.expected_cmd,
    COALESCE(ap.cmd, 'N/A') AS actual_cmd,
    CASE 
        WHEN ap.policyname IS NULL THEN 'FAIL (POLICY MISSING)'
        WHEN ap.cmd <> rp.expected_cmd THEN 'FAIL (COMMAND MISMATCH: expected ' || rp.expected_cmd || ', got ' || ap.cmd || ')'
        ELSE 'PASS (POLICY PRESENT IN CATALOG)'
    END AS status,
    'Catalog presence verified. Review actual policy expression in Section 8B.' AS security_note
FROM required_policies rp
LEFT JOIN actual_policies ap 
    ON rp.tablename = ap.tablename 
   AND rp.expected_policy = ap.policyname
ORDER BY rp.tablename, rp.expected_policy;

-- -----------------------------------------------------------------------------
-- SECTION 8B: ACTIVE RLS POLICIES DEFINITIONS AUDIT (READ-ONLY)
-- Lists active Row-Level Security policy definitions on public tables.
-- Displays USING (qual) and WITH CHECK expressions for semantic review.
-- -----------------------------------------------------------------------------
SELECT 
    '08B_ACTIVE_RLS_POLICY_DEFINITIONS' AS check_category,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('user_profiles', 'organizations', 'organization_memberships')
ORDER BY tablename, policyname;
