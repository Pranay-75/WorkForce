-- =============================================================================
-- WorkForce Database Migration: Extend user_role Enum with 'hr'
-- File: supabase/migrations/20261102000000_add_hr_role_enum.sql
-- =============================================================================
-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed inside a
-- multi-command transaction if the new enum value is referenced in that same
-- transaction. This standalone statement must commit prior to applying
-- functions or triggers that reference 'hr'::public.user_role.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'hr' AFTER 'manager';

