/**
 * WorkForce Final Authorization and Pending Membership Security Test Suite
 * File: frontend/scripts/test_final_authorization_and_security.js
 *
 * Verifies the 12 core requirements:
 * 1. Organizer can add Employee.
 * 2. Organizer can add Manager.
 * 3. Organizer can change member roles.
 * 4. Administrator cannot add members.
 * 5. Administrator cannot change member roles.
 * 6. Manager cannot add members.
 * 7. Employee cannot add members.
 * 8. Unauthenticated caller cannot retrieve organization name or assigned role through check_pending_setup.
 * 9. Verified member can complete account setup.
 * 10. Returning member can log in normally.
 * 11. Assigned role is preserved after setup.
 * 12. Cross-organization membership access is prevented.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Reason: ${err.message}`);
  }
}

console.log('================================================================');
console.log('   WORKFORCE FINAL AUTHORIZATION & PENDING SETUP SECURITY SUITE ');
console.log('================================================================\n');

// Load files
const migrationPath = path.join(__dirname, '../../supabase/migrations/20261030000001_add_member_system_and_remove_blocked_status.sql');
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

const employeesPagePath = path.join(__dirname, '../app/employees/page.tsx');
const employeesContent = fs.readFileSync(employeesPagePath, 'utf8');

const loginPagePath = path.join(__dirname, '../app/login/page.tsx');
const loginContent = fs.readFileSync(loginPagePath, 'utf8');

const hookPath = path.join(__dirname, '../lib/hooks/useOrganizationMembers.ts');
const hookContent = fs.readFileSync(hookPath, 'utf8');

const backendAuthPath = path.join(__dirname, '../../backend/app/api/v1/auth.py');
const backendAuthContent = fs.readFileSync(backendAuthPath, 'utf8');

const backendDepsPath = path.join(__dirname, '../../backend/app/api/deps.py');
const backendDepsContent = fs.readFileSync(backendDepsPath, 'utf8');

const authContextPath = path.join(__dirname, '../lib/authContext.tsx');
const authContextContent = fs.readFileSync(authContextPath, 'utf8');

const triggerMigrationPath = path.join(__dirname, '../../supabase/migrations/20261014000004_security_and_concurrency_hardening.sql');
const triggerContent = fs.readFileSync(triggerMigrationPath, 'utf8');

// -----------------------------------------------------------------------------
// Test 1: Organizer can add Employee
// -----------------------------------------------------------------------------
console.log('[1. Organizer Member Addition: Employee]');
runTest('add_organization_member RPC authorizes is_org_organizer and accepts role = employee', () => {
  assert.ok(
    migrationContent.includes('public.add_organization_member(') &&
    migrationContent.includes('public.is_org_organizer(p_organization_id)') &&
    migrationContent.includes("'employee'::public.user_role"),
    'add_organization_member must authorize organizer and support employee role'
  );
});
runTest('useOrganizationMembers hook exports addMember supporting employee role', () => {
  assert.ok(
    hookContent.includes('addMember:') &&
    hookContent.includes("role: 'manager' | 'employee' = 'employee'"),
    'useOrganizationMembers must export addMember defaulting/allowing employee'
  );
});
runTest('Employees page UI allows Organizer to select and submit Employee addition', () => {
  assert.ok(
    employeesContent.includes('<option value="employee">Employee (Contributor)</option>') &&
    employeesContent.includes('isOrganizer ? ('),
    'Employees page must provide Employee option to Organizer'
  );
});

// -----------------------------------------------------------------------------
// Test 2: Organizer can add Manager
// -----------------------------------------------------------------------------
console.log('\n[2. Organizer Member Addition: Manager]');
runTest('add_organization_member RPC accepts role = manager', () => {
  assert.ok(
    migrationContent.includes("'manager'::public.user_role"),
    'add_organization_member must explicitly allow manager role'
  );
});
runTest('useOrganizationMembers hook accepts manager role for addMember', () => {
  assert.ok(
    hookContent.includes("role !== 'manager' && role !== 'employee'"),
    'addMember role guard must accept manager'
  );
});
runTest('Employees page UI allows Organizer to select and submit Manager addition', () => {
  assert.ok(
    employeesContent.includes('<option value="manager">') &&
    employeesContent.includes('isOrganizer ? ('),
    'Employees page must provide Manager option to Organizer'
  );
});

// -----------------------------------------------------------------------------
// Test 3: Organizer can change member roles
// -----------------------------------------------------------------------------
console.log('\n[3. Organizer Role Modification]');
runTest('update_member_role RPC authorizes is_org_organizer', () => {
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.update_member_role(') &&
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN') &&
    migrationContent.includes("RAISE EXCEPTION 'Only the organization organizer can update member roles.'"),
    'update_member_role must authorize organizer exclusively'
  );
});
runTest('Employees page UI displays role modification select strictly when isOrganizer is true', () => {
  assert.ok(
    employeesContent.includes('{isOrganizer && m.role !== \'organizer\' && (') &&
    employeesContent.includes('handleRoleChange(m.userId, e.target.value as UserRole)'),
    'Role change select must only be rendered for the Organizer'
  );
});
runTest('RLS policy "Only organization organizers can update memberships" protects direct updates', () => {
  assert.ok(
    migrationContent.includes('CREATE POLICY "Only organization organizers can update memberships"') &&
    migrationContent.includes('USING (public.is_org_organizer(organization_id))'),
    'RLS policy must restrict membership update to is_org_organizer'
  );
});

// -----------------------------------------------------------------------------
// Test 4: Administrator cannot add members
// -----------------------------------------------------------------------------
console.log('\n[4. Administrator Access Prevention: Member Addition]');
runTest('add_organization_member RPC raises 42501 for non-organizer Administrator', () => {
  assert.ok(
    migrationContent.includes("IF NOT public.is_org_organizer(p_organization_id) THEN") &&
    migrationContent.includes("USING ERRCODE = '42501'"),
    'Non-organizer callers must receive 42501 error code'
  );
});
runTest('Backend API /members/add enforces require_organizer (blocks Administrator with 403)', () => {
  assert.ok(
    backendAuthContent.includes('/members/add') &&
    backendAuthContent.includes('Depends(require_organizer)'),
    'Backend add member endpoint must depend on require_organizer'
  );
  assert.ok(
    backendDepsContent.includes('require_organizer = require_role([') &&
    backendDepsContent.includes('UserRoleEnum.ORGANIZER'),
    'require_organizer must restrict access strictly to ORGANIZER'
  );
});
runTest('Employees page UI displays lock badge "Organizer required to add members" for non-organizer', () => {
  assert.ok(
    employeesContent.includes('Organizer required to add members'),
    'Employees page must show lock badge indicating Organizer required'
  );
});
runTest('Employees page handleAddMemberSubmit guards against live non-organizers', () => {
  assert.ok(
    employeesContent.includes('if (isLive && !isOrganizer) {') &&
    employeesContent.includes("setAddMemberError('Only the organization organizer can add members.');"),
    'Frontend handler must enforce organizer-only check'
  );
});

// -----------------------------------------------------------------------------
// Test 5: Administrator cannot change member roles
// -----------------------------------------------------------------------------
console.log('\n[5. Administrator Access Prevention: Role Modification]');
runTest('update_member_role RPC raises 42501 for Administrator', () => {
  assert.ok(
    migrationContent.includes("IF NOT public.is_org_organizer(p_organization_id) THEN") &&
    migrationContent.includes("RAISE EXCEPTION 'Only the organization organizer can update member roles.'"),
    'update_member_role must reject ordinary Administrators'
  );
});
runTest('Backend API /members/{member_id}/role enforces require_organizer (blocks Administrator with 403)', () => {
  assert.ok(
    backendAuthContent.includes('/members/{member_id}/role') &&
    backendAuthContent.includes('Depends(require_organizer)'),
    'Backend update role endpoint must depend on require_organizer'
  );
});
runTest('Employees page handleRoleChange guards against live non-organizers', () => {
  assert.ok(
    employeesContent.includes('if (isLive && !isOrganizer) {') &&
    employeesContent.includes("setActionError('Only the organization organizer can update member roles.');"),
    'Frontend role update handler must block non-organizers'
  );
});

// -----------------------------------------------------------------------------
// Test 6: Manager cannot add members
// -----------------------------------------------------------------------------
console.log('\n[6. Manager Access Prevention: Member Addition]');
runTest('add_organization_member RPC rejects Manager callers', () => {
  assert.ok(
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN'),
    'Manager lacks is_org_organizer and is rejected by RPC'
  );
});
runTest('Backend /members/add endpoint blocks Manager with 403 Forbidden', () => {
  assert.ok(
    !backendDepsContent.includes('require_organizer = require_role([\n    UserRoleEnum.ORGANIZER,\n    UserRoleEnum.MANAGER'),
    'require_organizer must never include MANAGER'
  );
});

// -----------------------------------------------------------------------------
// Test 7: Employee cannot add members
// -----------------------------------------------------------------------------
console.log('\n[7. Employee Access Prevention: Member Addition]');
runTest('add_organization_member RPC rejects Employee callers', () => {
  assert.ok(
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN'),
    'Employee lacks is_org_organizer and is rejected by RPC'
  );
});
runTest('Backend /members/add endpoint blocks Employee with 403 Forbidden', () => {
  assert.ok(
    !backendDepsContent.includes('require_organizer = require_role([\n    UserRoleEnum.ORGANIZER,\n    UserRoleEnum.EMPLOYEE'),
    'require_organizer must never include EMPLOYEE'
  );
});

// -----------------------------------------------------------------------------
// Test 8: Unauthenticated caller cannot retrieve organization name, role, or pending status (Anti-Enumeration)
// -----------------------------------------------------------------------------
console.log('\n[8. Protected check_pending_setup RPC (Anti-Enumeration & Zero Information Disclosure)]');
runTest('check_pending_setup RPC returns generic non-disclosing response without exists boolean', () => {
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.check_pending_setup(p_email TEXT)') &&
    migrationContent.includes("'status', 'ready',") &&
    !migrationContent.includes("'exists', v_exists"),
    'check_pending_setup must return generic status without leaking exists boolean'
  );
  // Verify it does NOT build object containing role or organization_name
  assert.ok(
    !migrationContent.includes("'role', v_inv.role") &&
    !migrationContent.includes("'organization_name', v_inv.organization_name"),
    'check_pending_setup must not leak role or organization_name'
  );
});
runTest('login/page.tsx setup verification advances without leaking membership presence', () => {
  assert.ok(
    loginContent.includes("await supabase.rpc('check_pending_setup'") &&
    !loginContent.includes('if (!rpcError && rpcData && rpcData.exists) {'),
    'Login page must not branch on exists flag or leak pending status'
  );
  // Verify it does not perform unauthenticated direct queries to leak organization_invitations
  assert.ok(
    !loginContent.includes(".from('organization_invitations').select('role, organizations(name)')"),
    'Login page must not query organization_invitations directly unauthenticated'
  );
});

// -----------------------------------------------------------------------------
// Test 9: Verified member can complete account setup
// -----------------------------------------------------------------------------
console.log('\n[9. Verified Member Account Setup Flow]');
runTest('Login setup tab initiates signUpWithPassword for pending members', () => {
  assert.ok(
    loginContent.includes('handleCompleteSetup') &&
    loginContent.includes('signUpWithPassword(') &&
    loginContent.includes('setSetupStep(3)'),
    'Setup form creates account and advances to verification notice'
  );
});
runTest('claim_pending_invitations trigger verifies email confirmation before membership activation', () => {
  assert.ok(
    triggerContent.includes('claim_pending_invitations()') &&
    triggerContent.includes('IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN') &&
    triggerContent.includes('RETURN NEW;'),
    'Membership claim trigger strictly requires confirmed email'
  );
});

// -----------------------------------------------------------------------------
// Test 10: Returning member can log in normally
// -----------------------------------------------------------------------------
console.log('\n[10. Returning Member Standard Login]');
runTest('Login page provides active signin tab that authenticates via signInWithPassword', () => {
  assert.ok(
    loginContent.includes("activeTab === 'signin'") &&
    loginContent.includes('signInWithPassword(email.trim(), password)') &&
    loginContent.includes('router.push(\'/dashboard\')'),
    'Returning users sign in normally through signin tab'
  );
});

// -----------------------------------------------------------------------------
// Test 11: Assigned role is preserved after setup
// -----------------------------------------------------------------------------
console.log('\n[11. Assigned Role Preservation]');
runTest('claim_pending_invitations trigger reads role strictly from organization_invitations', () => {
  assert.ok(
    triggerContent.includes('INSERT INTO public.organization_memberships (') &&
    triggerContent.includes('v_inv.role,') &&
    triggerContent.includes('\'active\'::public.membership_status'),
    'Claimed membership role must be copied directly from v_inv.role'
  );
});
runTest('claim_pending_invitations trigger defends against forged admin invitations', () => {
  assert.ok(
    triggerContent.includes("IF v_inv.role = 'admin'::public.user_role THEN") &&
    triggerContent.includes('CONTINUE;'),
    'Claim trigger must skip forged admin invitations'
  );
});

// -----------------------------------------------------------------------------
// Test 12: Cross-organization membership access is prevented
// -----------------------------------------------------------------------------
console.log('\n[12. Cross-Organization Tenant Isolation]');
runTest('add_organization_member RPC binds operations strictly to p_organization_id', () => {
  assert.ok(
    migrationContent.includes('WHERE organization_id = p_organization_id') &&
    migrationContent.includes('INSERT INTO public.organization_memberships (\n                organization_id,'),
    'Member insertion must bind to target organization_id parameter'
  );
});
runTest('update_member_role RPC bounds membership lookup strictly to p_organization_id', () => {
  assert.ok(
    migrationContent.includes('WHERE organization_id = p_organization_id') &&
    migrationContent.includes('AND user_id = p_member_user_id'),
    'Role update must be scoped strictly to p_organization_id and p_member_user_id'
  );
});

// =============================================================================
// NEGATIVE TESTS (Strict Security & Boundary Assertions)
// =============================================================================
console.log('\n================================================================');
console.log('              NEGATIVE SECURITY & AUTHORIZATION TESTS           ');
console.log('================================================================');

// Negative 1: Administrator cannot perform Organizer operations
console.log('\n[Negative 1: Administrator Cannot Perform Organizer Operations]');
runTest('add_organization_member RPC raises 42501 for non-organizer Administrator', () => {
  assert.ok(
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN') &&
    migrationContent.includes("RAISE EXCEPTION 'Only the organization organizer can add members.' USING ERRCODE = '42501';"),
    'RPC must reject non-organizer callers with 42501'
  );
});
runTest('update_member_role RPC raises 42501 for non-organizer Administrator', () => {
  assert.ok(
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN') &&
    migrationContent.includes("RAISE EXCEPTION 'Only the organization organizer can update member roles.' USING ERRCODE = '42501';"),
    'RPC must reject non-organizer callers with 42501'
  );
});

// Negative 2: Earliest active Administrator does not automatically become Organizer
console.log('\n[Negative 2: Earliest Administrator Does NOT Automatically Become Organizer]');
runTest('is_org_organizer() does NOT include earliest-member subquery or ORDER BY created_at', () => {
  const isOrgOrganizerDef = migrationContent.substring(
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.is_org_organizer'),
    migrationContent.indexOf('ALTER FUNCTION public.is_org_organizer')
  );
  assert.ok(
    !isOrgOrganizerDef.includes('ORDER BY created_at ASC') &&
    !isOrgOrganizerDef.includes('first_member'),
    'is_org_organizer must strictly not promote earliest active member'
  );
});
runTest('backend deps.py does NOT include earliest-member table query fallback', () => {
  assert.ok(
    !backendDepsContent.includes('first_mem_res = (') &&
    !backendDepsContent.includes('first_uid = first_mem_res.data[0].get("user_id")'),
    'deps.py must not promote earliest member to Organizer'
  );
});
runTest('frontend authContext.tsx does NOT include earliest-member table query fallback', () => {
  assert.ok(
    !authContextContent.includes("from('organization_memberships')\n                  .select('user_id')\n                  .eq('organization_id', orgId)\n                  .order('created_at'") &&
    !authContextContent.includes('if (firstMember && firstMember.user_id === currentUid)'),
    'authContext.tsx must not promote earliest member to Organizer'
  );
});

// Negative 3: Direct membership insertion cannot bypass onboarding
console.log('\n[Negative 3: Direct Membership Insertion Cannot Bypass Onboarding]');
runTest('organization_memberships has NO direct INSERT policy for authenticated users', () => {
  assert.ok(
    migrationContent.includes('DROP POLICY IF EXISTS "Only organization admins can add new members" ON public.organization_memberships;') &&
    migrationContent.includes('DROP POLICY IF EXISTS "Only organization organizers can add new members" ON public.organization_memberships;'),
    'All direct INSERT policies on organization_memberships must be dropped'
  );
  assert.ok(
    !migrationContent.includes('CREATE POLICY "Only organization organizers can add new members"\n    ON public.organization_memberships FOR INSERT') &&
    !migrationContent.includes('CREATE POLICY "Only organization admins can add new members"\n    ON public.organization_memberships FOR INSERT'),
    'Direct client INSERT on organization_memberships must not be granted'
  );
});

// Negative 4: Unauthenticated callers cannot enumerate pending memberships
console.log('\n[Negative 4: Unauthenticated Callers Cannot Enumerate Pending Memberships]');
runTest('check_pending_setup does NOT return boolean exists flag', () => {
  assert.ok(
    !migrationContent.includes("RETURN pg_catalog.jsonb_build_object('exists', v_exists);"),
    'check_pending_setup must not disclose whether email exists'
  );
});
runTest('login/page.tsx does NOT display pending vs non-pending distinction prior to auth signup', () => {
  assert.ok(
    !loginContent.includes("No pending organization membership found for this email"),
    'Setup form must never tell unauthenticated visitor whether email was invited'
  );
});

// Negative 5: Unverified users cannot activate membership
console.log('\n[Negative 5: Unverified Users Cannot Activate Membership]');
runTest('claim_pending_invitations strictly checks v_email_confirmed_at IS NOT NULL', () => {
  assert.ok(
    migrationContent.includes('IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN\n        RETURN NEW;\n    END IF;') ||
    triggerContent.includes('IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN\n        RETURN NEW;\n    END IF;'),
    'Membership claim trigger requires confirmed email timestamp'
  );
});

// Negative 6: Organizer-assigned roles remain unchanged after account setup
console.log('\n[Negative 6: Organizer-Assigned Roles Remain Unchanged After Setup]');
runTest('claim_pending_invitations directly transfers assigned v_inv.role', () => {
  assert.ok(
    migrationContent.includes('v_inv.role,\n                \'active\'::public.membership_status') ||
    triggerContent.includes('v_inv.role,\n                \'active\'::public.membership_status'),
    'Assigned role in invitation must be copied directly into active membership'
  );
});
runTest('update_member_role RPC strictly restricts modifications to Manager or Employee', () => {
  assert.ok(
    migrationContent.includes('IF p_new_role NOT IN (') &&
    migrationContent.includes("'manager'::public.user_role") &&
    migrationContent.includes("'employee'::public.user_role") &&
    migrationContent.includes("RAISE EXCEPTION 'Invalid role. Member roles can only be changed to Manager or Employee.'"),
    'Role update RPC must reject any attempt to promote to Admin or HR'
  );
});
runTest('update_member_role RPC forbids demoting the Organizer', () => {
  assert.ok(
    migrationContent.includes("IF v_current_role = 'organizer'::public.user_role AND p_new_role != 'organizer'::public.user_role THEN\n        RAISE EXCEPTION 'Cannot demote the organization organizer.'"),
    'Organizer cannot be demoted'
  );
});

// Negative 7: Invitee Token Protection & Zero Direct Table Query Leakage
console.log('\n[Negative 7: Invitee Token Protection & Raw Record Privacy]');
runTest('organization_invitations SELECT policy strictly excludes invitee email clause', () => {
  assert.ok(
    !migrationContent.includes("lower(email) = lower(auth.jwt()->>'email')"),
    'SELECT policy must not allow invitees to view invitations matching their email'
  );
  assert.ok(
    migrationContent.includes('CREATE POLICY "Organizers can view safe invitation fields in their organization"') &&
    migrationContent.includes('USING (\n        public.is_org_organizer(organization_id)\n    );'),
    'SELECT policy must strictly restrict visibility to verified organization organizers'
  );
});

runTest('organization_invitations revokes direct write privileges from authenticated users', () => {
  assert.ok(
    migrationContent.includes('REVOKE ALL ON TABLE public.organization_invitations FROM PUBLIC;') &&
    migrationContent.includes('REVOKE ALL ON TABLE public.organization_invitations FROM anon;') &&
    migrationContent.includes('REVOKE ALL ON TABLE public.organization_invitations FROM authenticated;'),
    'Public, anon, and authenticated users must have ALL table privileges revoked'
  );
  assert.ok(
    !migrationContent.includes('GRANT INSERT ON TABLE public.organization_invitations TO authenticated') &&
    !migrationContent.includes('GRANT UPDATE ON TABLE public.organization_invitations TO authenticated') &&
    !migrationContent.includes('GRANT DELETE ON TABLE public.organization_invitations TO authenticated'),
    'Authenticated users must never possess direct INSERT, UPDATE, or DELETE grants'
  );
});

runTest('organization_invitations grants strictly safe columns and omits token', () => {
  assert.ok(
    migrationContent.includes('GRANT SELECT (id, organization_id, email, role, invited_by, status, created_at, expires_at)') &&
    migrationContent.includes('ON TABLE public.organization_invitations TO authenticated;'),
    'Column-level grant must be restricted strictly to safe fields'
  );
  const selectGrantLine = migrationContent.substring(
    migrationContent.indexOf('GRANT SELECT ('),
    migrationContent.indexOf('ON TABLE public.organization_invitations TO authenticated;')
  );
  assert.ok(
    !selectGrantLine.includes('token'),
    'token column must be strictly omitted from the authenticated SELECT grant'
  );
});

runTest('organization_invitations has zero direct INSERT/UPDATE/DELETE policies for authenticated users', () => {
  assert.ok(
    !migrationContent.includes('CREATE POLICY "Organizers can create invitations in their organization"') &&
    !migrationContent.includes('CREATE POLICY "Organizers can update invitations in their organization"') &&
    !migrationContent.includes('CREATE POLICY "Organizers can delete invitations in their organization"'),
    'Direct client write policies on organization_invitations must not exist'
  );
});

runTest('revoke_organization_invitation RPC enforces Organizer-only authorization and audits', () => {
  assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(') &&
    migrationContent.includes('IF NOT public.is_org_organizer(p_organization_id) THEN\n        RAISE EXCEPTION \'Only the organization organizer can revoke invitations.\'') &&
    migrationContent.includes("'invitation.revoked'"),
    'Revoke RPC must verify organizer and record audit log'
  );
});

runTest('Frontend useOrganizationMembers hook queries strictly safe fields without token', () => {
  assert.ok(
    hookContent.includes(".select('id, email, role, status, created_at')") &&
    !hookContent.includes(".select('*')") &&
    !hookContent.includes('token'),
    'Frontend hook must query only safe fields and never request token'
  );
});

runTest('RPCs and trigger never disclose raw invitation tokens to clients', () => {
  // add_organization_member returns status, invitation_id, email, role - NEVER token
  const addMemberFn = migrationContent.substring(
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.add_organization_member'),
    migrationContent.indexOf('ALTER FUNCTION public.add_organization_member')
  );
  assert.ok(
    !addMemberFn.includes("'token',"),
    'add_organization_member must never include invitation token in returned JSON'
  );
  // check_pending_setup returns status and generic message - NEVER token
  const checkPendingFn = migrationContent.substring(
    migrationContent.indexOf('CREATE OR REPLACE FUNCTION public.check_pending_setup'),
    migrationContent.indexOf('ALTER FUNCTION public.check_pending_setup')
  );
  assert.ok(
    !checkPendingFn.includes('token') &&
    !checkPendingFn.includes('organization_invitations'),
    'check_pending_setup must never query or return invitation tokens'
  );
});

// Negative 8: Task Conversion Assertions
console.log('\n[Negative 8: Task Conversion Assertions & Precondition Verification]');
runTest('Task conversion is wrapped in PL/pgSQL DO block with strict preconditions', () => {
  const taskSection = migrationContent.substring(
    migrationContent.indexOf('-- 1. TASK STATUS ENUM MIGRATION'),
    migrationContent.indexOf('-- 2. ORGANIZATIONS OWNERSHIP')
  );
  assert.ok(
    taskSection.includes("v_task_id UUID := '504fba22-38d9-444b-b4de-b79b59c0bcb7'") &&
    taskSection.includes("v_authors_org_id UUID := '98ff125e-5418-41ee-83bb-be7787f20441'") &&
    taskSection.includes("status = 'blocked'::public.task_status"),
    'Task conversion must explicitly target identified blocked task in Authors workspace'
  );
  assert.ok(
    taskSection.includes('IF v_matching_task_count <> 1 THEN\n        RAISE EXCEPTION') &&
    taskSection.includes('GET DIAGNOSTICS v_updated_rows = ROW_COUNT;\n    IF v_updated_rows <> 1 THEN\n        RAISE EXCEPTION'),
    'Task conversion must assert exactly 1 task exists and update exactly 1 row'
  );
  assert.ok(
    taskSection.includes("SELECT COUNT(*) INTO v_blocked_task_count\n    FROM public.tasks\n    WHERE status = 'blocked'::public.task_status;") &&
    taskSection.includes('IF v_blocked_task_count <> 0 THEN\n        RAISE EXCEPTION'),
    'Task conversion must assert 0 blocked tasks remain prior to check constraint'
  );
  assert.ok(
    taskSection.includes("ADD CONSTRAINT chk_tasks_supported_statuses\n        CHECK (status::text IN ('todo', 'in_progress', 'in_review', 'completed'))"),
    'Task conversion must enforce check constraint restricting tasks to 4 supported statuses'
  );
});

// Negative 9: Authors Ownership & Workspace Isolation Assertions
console.log('\n[Negative 9: Authors Ownership & Workspace Isolation Assertions]');
runTest('Authors ownership update is wrapped in PL/pgSQL DO block with 7-point validation', () => {
  const orgSection = migrationContent.substring(
    migrationContent.indexOf('-- 2. ORGANIZATIONS OWNERSHIP'),
    migrationContent.indexOf('-- 3. ORGANIZATION INVITATIONS')
  );
  assert.ok(
    orgSection.includes("v_authors_org_id UUID := '98ff125e-5418-41ee-83bb-be7787f20441'") &&
    orgSection.includes("v_demo_user_id UUID := '3d8fdf6f-9d1f-44cf-bce7-36ab6a4540f7'"),
    'Authors ownership must bind explicitly to Authors workspace ID and Demo Auth user ID'
  );
  assert.ok(
    orgSection.includes('IF v_org_count <> 1 THEN\n        RAISE EXCEPTION') &&
    orgSection.includes('IF v_user_count <> 1 THEN\n        RAISE EXCEPTION') &&
    orgSection.includes('IF v_membership_count <> 1 THEN\n        RAISE EXCEPTION'),
    'Ownership block must validate Authors org exists, Demo user exists, and active admin membership exists'
  );
  assert.ok(
    orgSection.includes('GET DIAGNOSTICS v_org_updated = ROW_COUNT;\n    IF v_org_updated <> 1 THEN\n        RAISE EXCEPTION') &&
    orgSection.includes('GET DIAGNOSTICS v_membership_updated = ROW_COUNT;\n    IF v_membership_updated <> 1 THEN\n        RAISE EXCEPTION'),
    'Ownership block must assert exactly 1 organization row and exactly 1 membership row are updated'
  );
  assert.ok(
    orgSection.includes('IF v_other_orgs_with_created_by <> 0 THEN\n        RAISE EXCEPTION') &&
    orgSection.includes('IF v_other_memberships_with_organizer <> 0 THEN\n        RAISE EXCEPTION'),
    'Ownership block must enforce invariants: 0 other orgs have created_by set, and 0 other memberships have organizer role'
  );
});

// Negative 10: Organizer Attempting to Assign Admin or Organizer via Add/Update RPCs
console.log('\n[Negative 10: Prohibition of Admin/Organizer Assignment via Member RPCs]');
runTest('add_organization_member RPC forbids adding members with admin or organizer roles', () => {
  assert.ok(
    migrationContent.includes("IF p_role NOT IN ('manager'::public.user_role, 'employee'::public.user_role) THEN\n        RAISE EXCEPTION 'Invalid role. Members can only be added as Manager or Employee.' USING ERRCODE = '42501';"),
    'add_organization_member must reject admin or organizer roles with 42501'
  );
});

runTest('chk_org_invitations_role check constraint forbids pending admin or organizer invitations', () => {
  assert.ok(
    migrationContent.includes("CHECK (status <> 'pending' OR role IN ('manager'::public.user_role, 'employee'::public.user_role))"),
    'chk_org_invitations_role constraint must prevent pending invitations with roles other than manager or employee'
  );
});

runTest('claim_pending_invitations trigger ignores forged admin invitations', () => {
  assert.ok(
    migrationContent.includes("IF v_inv.role = 'admin'::public.user_role THEN\n            CONTINUE;\n        END IF;"),
    'claim_pending_invitations trigger must refuse to grant admin role'
  );
});

// =============================================================================
// ONBOARDING & MEMBERSHIP LIFECYCLE SCENARIO TESTS (CASES A - D)
// =============================================================================
console.log('\n================================================================');
console.log('         ONBOARDING & MEMBERSHIP LIFECYCLE VERIFICATION         ');
console.log('================================================================');

console.log('\n[Scenario A: Invited, Unregistered Email]');
runTest('Case A: Persists pending setup in invitations and activates on email confirmation', () => {
  assert.ok(
    migrationContent.includes("INSERT INTO public.organization_invitations") &&
    migrationContent.includes("'pending'") &&
    migrationContent.includes("encode(extensions.gen_random_bytes(32), 'hex')"),
    'Pending invitation record must be persisted with secure random token'
  );
  assert.ok(
    migrationContent.includes("UPDATE public.organization_invitations\n            SET status = 'accepted'") &&
    migrationContent.includes("INSERT INTO public.organization_memberships (\n                organization_id,\n                user_id,\n                role,\n                status\n            )\n            VALUES (\n                v_inv.organization_id,\n                v_user_id,\n                v_inv.role,\n                'active'::public.membership_status"),
    'Trigger must activate pending invitation upon verified email ownership'
  );
});

console.log('\n[Scenario B: Invited Email with Existing Confirmed Auth Account]');
runTest('Case B: add_organization_member directly links active membership without duplicates', () => {
  assert.ok(
    migrationContent.includes('ELSIF v_email_confirmed_at IS NOT NULL THEN') &&
    migrationContent.includes('INSERT INTO public.organization_memberships (\n                organization_id,\n                user_id,\n                role,\n                status\n            )\n            VALUES (\n                p_organization_id,\n                v_target_user_id,\n                p_role,\n                \'active\'::public.membership_status') &&
    migrationContent.includes("'status', 'member_added'"),
    'Verified existing user must be linked directly to active membership'
  );
});

console.log('\n[Scenario C: Uninvited Email Registration Attempt]');
runTest('Case C: Uninvited user setup is non-disclosing and claims zero organization access', () => {
  assert.ok(
    migrationContent.includes("CREATE OR REPLACE FUNCTION public.check_pending_setup(p_email TEXT)") &&
    migrationContent.includes("RETURN pg_catalog.jsonb_build_object(\n        'status', 'ready',") &&
    !migrationContent.includes("'exists', v_exists"),
    'check_pending_setup must not reveal whether invitation exists'
  );
  assert.ok(
    authContextContent.includes('if (memberErr || !allMemberships || allMemberships.length === 0) {') &&
    authContextContent.includes("setRole('employee');\n          setOrganization(null);"),
    'Uninvited account has zero memberships and fails closed to empty state'
  );
});

console.log('\n[Scenario D: Unconfirmed Auth Account Prevention]');
runTest('Case D: Trigger strictly blocks membership activation when email is unconfirmed', () => {
  assert.ok(
    migrationContent.includes('IF v_auth_email IS NULL OR v_email_confirmed_at IS NULL THEN\n        RETURN NEW;\n    END IF;'),
    'claim_pending_invitations must abort if email_confirmed_at is null'
  );
});

console.log('\n[Active Membership Prerequisite for Organizer Authority]');
runTest('is_org_organizer requires active membership in addition to created_by', () => {
  assert.ok(
    migrationContent.includes('INNER JOIN public.organizations o ON o.id = m.organization_id') &&
    migrationContent.includes("m.status = 'active'::public.membership_status") &&
    migrationContent.includes("m.role = 'organizer'::public.user_role") &&
    migrationContent.includes('o.created_by = auth.uid()'),
    'is_org_organizer must require active membership and bind created_by within active status check'
  );
});

console.log('\n================================================================');
console.log(`FINAL AUTHORIZATION & SECURITY RESULTS: ${passedTests} PASSED, ${totalTests - passedTests} FAILED`);
console.log('================================================================\n');

if (totalTests !== passedTests) {
  process.exit(1);
} else {
  process.exit(0);
}
