-- =============================================================================
-- WorkForce Phase 1 Migration: Standalone Enum Extension
-- File: supabase/migrations/20261030000000_phase1_add_organizer_enum.sql
--
-- STATUS: PROPOSED / NON-EXECUTED.
-- Per project safety instructions, this file is provided for documentation and review.
-- Do NOT execute against hosted production/staging databases without explicit approval.
-- =============================================================================
-- CRITICAL POSTGRESQL TRANSACTION CONSTRAINT:
-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be executed inside a transaction
-- if the new enum value is used or cast in that same transaction.
-- This statement MUST be executed and committed as Phase 1 before running Phase 2.
-- =============================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'organizer' BEFORE 'admin';

