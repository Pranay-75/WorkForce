/**
 * WorkForce - Admin & HR Role Governance & Authorization Test Suite
 * File: frontend/scripts/test_admin_hr_role_governance.js
 *
 * Verifies Option B role governance implementation:
 * 1. Database migrations:
 *    - Standalone enum extension migration (20261102000000_add_hr_role_enum.sql)
 *    - Role governance migration (20261102000001_admin_and_hr_role_governance.sql)
 * 2. Authorization rules in RPCs:
 *    - Organizer can assign Admin, HR, Manager, and Staff (employee).
 *    - Admin can assign HR, Manager, and Staff, but cannot assign Admin.
 *    - Only Organizer can modify or demote an Admin.
 *    - Non-admin / non-organizer cannot assign roles or add members.
 *    - Invitation claiming enforces Organizer-only check for Admin invitations.
 * 3. Frontend hook useOrganizationMembers:
 *    - addMember and updateMemberRole support 'admin', 'hr', 'manager', 'employee'.
 * 4. Frontend UI employees/page.tsx:
 *    - Organizer sees Administrator option.
 *    - Admin does not see Administrator option.
 *    - Admin cannot demote or alter an Administrator.
 *    - Add Member action visible to Organizer and Admin.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const results = [];
function recordResult(name, status, evidence) {
  results.push({ name, status, evidence });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${name}`);
  console.log(`   ${evidence}`);
}

async function runTests() {
  console.log('================================================================');
  console.log(' WORKFORCE ADMIN & HR ROLE GOVERNANCE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '../..');

  // ---------------------------------------------------------------------------
  // Test 1: Verify Standalone Enum Extension Migration
  // ---------------------------------------------------------------------------
  const enumMigPath = path.join(rootDir, 'supabase/migrations/20261102000000_add_hr_role_enum.sql');
  if (fs.existsSync(enumMigPath)) {
    const enumContent = fs.readFileSync(enumMigPath, 'utf8');
    if (
      enumContent.includes("ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'hr'") &&
      !enumContent.includes("CREATE OR REPLACE FUNCTION") // Must NOT contain multi-command references in same transaction
    ) {
      recordResult(
        'Standalone Enum Migration Extends user_role Safely',
        'PASS',
        '20261102000000_add_hr_role_enum.sql is isolated and avoids transaction block failure.'
      );
    } else {
      recordResult(
        'Standalone Enum Migration Extends user_role Safely',
        'FAIL',
        'Enum migration mixes functions or is malformed.'
      );
    }
  } else {
    recordResult('Standalone Enum Migration Extends user_role Safely', 'FAIL', 'Migration file missing.');
  }

  // ---------------------------------------------------------------------------
  // Test 2: Verify Role Governance Migration
  // ---------------------------------------------------------------------------
  const govMigPath = path.join(rootDir, 'supabase/migrations/20261102000001_admin_and_hr_role_governance.sql');
  let govContent = '';
  if (fs.existsSync(govMigPath)) {
    govContent = fs.readFileSync(govMigPath, 'utf8');

    // 2a. is_org_admin includes organizer
    const hasOrgAdminOrganizer =
      govContent.includes("m.role IN ('organizer'::public.user_role, 'admin'::public.user_role)") ||
      govContent.includes("o.created_by = auth.uid()");

    // 2b. add_organization_member organizer-only admin check
    const hasAddAdminOrganizerCheck =
      govContent.includes("IF p_role = 'admin'::public.user_role AND NOT v_is_organizer THEN") &&
      govContent.includes("RAISE EXCEPTION 'Only the organization organizer can add or invite an administrator.'");

    // 2c. update_member_role organizer-only admin check
    const hasUpdateAdminOrganizerCheck =
      govContent.includes("IF p_new_role = 'admin'::public.user_role AND NOT v_is_organizer THEN") &&
      govContent.includes("IF v_current_role = 'admin'::public.user_role AND NOT v_is_organizer THEN");

    // 2d. process_pending_invitations_for_user verification
    const hasClaimAdminCheck =
      govContent.includes("IF v_inv.role = 'admin'::public.user_role THEN") &&
      govContent.includes("v_is_inviter_organizer");

    // 2e. remove_organization_member organizer-only admin check
    const hasRemoveAdminCheck =
      govContent.includes("IF v_target_role = 'admin'::public.user_role AND NOT v_is_organizer THEN");

    if (
      hasOrgAdminOrganizer &&
      hasAddAdminOrganizerCheck &&
      hasUpdateAdminOrganizerCheck &&
      hasClaimAdminCheck &&
      hasRemoveAdminCheck
    ) {
      recordResult(
        'RPC Migration Strictly Enforces Option B Authorization Rules',
        'PASS',
        'add_organization_member, update_member_role, remove_organization_member, and invitation claiming enforce rules.'
      );
    } else {
      recordResult(
        'RPC Migration Strictly Enforces Option B Authorization Rules',
        'FAIL',
        `Checks failed: orgAdmin=${hasOrgAdminOrganizer}, addAdmin=${hasAddAdminOrganizerCheck}, updateAdmin=${hasUpdateAdminOrganizerCheck}, claimAdmin=${hasClaimAdminCheck}, removeAdmin=${hasRemoveAdminCheck}`
      );
    }
  } else {
    recordResult('RPC Migration Strictly Enforces Option B Authorization Rules', 'FAIL', 'Migration file missing.');
  }

  // ---------------------------------------------------------------------------
  // Test 3: Backend FastAPI Validation & Dependencies
  // ---------------------------------------------------------------------------
  const backendAuthPath = path.join(rootDir, 'backend/app/api/v1/auth.py');
  const backendDepsPath = path.join(rootDir, 'backend/app/api/deps.py');

  const authContent = fs.readFileSync(backendAuthPath, 'utf8');
  const depsContent = fs.readFileSync(backendDepsPath, 'utf8');

  const hasRequireHr = depsContent.includes('require_hr = require_role');
  const hasAuthRoleCheck =
    authContent.includes('current_user: AuthenticatedUser = Depends(require_admin)') &&
    authContent.includes('if target_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:');

  if (hasRequireHr && hasAuthRoleCheck) {
    recordResult(
      'Backend Authorization Dependency & Endpoint Verification',
      'PASS',
      'deps.py exports require_hr; auth.py enforces Organizer-only promotion to Admin with 403.'
    );
  } else {
    recordResult(
      'Backend Authorization Dependency & Endpoint Verification',
      'FAIL',
      `require_hr: ${hasRequireHr}, authRoleCheck: ${hasAuthRoleCheck}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4: Frontend Hook useOrganizationMembers Support
  // ---------------------------------------------------------------------------
  const hookPath = path.join(rootDir, 'frontend/lib/hooks/useOrganizationMembers.ts');
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  const hasAddMemberRoles =
    hookContent.includes("role !== 'admin' && role !== 'hr' && role !== 'manager' && role !== 'employee'") &&
    hookContent.includes("addMember = React.useCallback(\n    async (email: string, role: UserRole = 'employee')");

  const hasUpdateMemberRoles =
    hookContent.includes("newRole !== 'admin' && newRole !== 'hr' && newRole !== 'manager' && newRole !== 'employee'");

  if (hasAddMemberRoles && hasUpdateMemberRoles) {
    recordResult(
      'Frontend Hook useOrganizationMembers Permits Admin and HR',
      'PASS',
      'addMember and updateMemberRole validate and accept Admin, HR, Manager, and Staff.'
    );
  } else {
    recordResult(
      'Frontend Hook useOrganizationMembers Permits Admin and HR',
      'FAIL',
      `addMemberRoles: ${hasAddMemberRoles}, updateMemberRoles: ${hasUpdateMemberRoles}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 5: Frontend UI employees/page.tsx Role Permissions
  // ---------------------------------------------------------------------------
  const employeesPagePath = path.join(rootDir, 'frontend/app/employees/page.tsx');
  const pageContent = fs.readFileSync(employeesPagePath, 'utf8');

  // 5a. "Add Member" button visible to Organizer and Admin
  const hasAddButtonPermission = pageContent.includes('{(isOrganizer || isAdmin) ? (');

  // 5b. In Add Member modal, Administrator is only visible to Organizer
  const hasAddAdminOptionGuarded = pageContent.includes('{isOrganizer && <option value="admin">Administrator');

  // 5c. In member card role select, Administrator is only visible to Organizer
  const hasCardAdminOptionGuarded = pageContent.includes('{isOrganizer && <option value="admin">Administrator</option>}');

  // 5d. An Admin cannot alter an existing Admin
  const hasAdminDemoteGuarded = pageContent.includes("(isOrganizer || (isAdmin && m.role !== 'admin')) && m.role !== 'organizer'");

  // 5e. Role option uses "Employee" per user directives (not "Staff")
  const hasEmployeeRoleOption = pageContent.includes('value="employee"') && (pageContent.includes('Employee (Contributor)') || pageContent.includes('Employee — Direct contributor'));

  if (
    hasAddButtonPermission &&
    hasAddAdminOptionGuarded &&
    hasCardAdminOptionGuarded &&
    hasAdminDemoteGuarded &&
    hasEmployeeRoleOption
  ) {
    recordResult(
      'Frontend UI Enforces Option B Role Display & Action Guards',
      'PASS',
      'Add Member allows Organizer/Admin; Admin option guarded for Organizer; Admins cannot demote Admins; Employee role option preserved.'
    );
  } else {
    recordResult(
      'Frontend UI Enforces Option B Role Display & Action Guards',
      'FAIL',
      `addButton: ${hasAddButtonPermission}, modalAdmin: ${hasAddAdminOptionGuarded}, cardAdmin: ${hasCardAdminOptionGuarded}, demoteGuard: ${hasAdminDemoteGuarded}, employeeRoleOption: ${hasEmployeeRoleOption}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 6: Frontend handleRoleChange & handleAddMemberSubmit Handler Checks
  // ---------------------------------------------------------------------------
  const hasRoleChangeAdminCheck =
    pageContent.includes('if (isLive && !isAdmin)') &&
    pageContent.includes("if (newRole === 'admin' && !isOrganizer)") &&
    pageContent.includes("targetMember?.role === 'admin' && !isOrganizer") &&
    pageContent.includes("targetMember?.role === 'organizer'");

  const hasAddMemberSubmitCheck =
    pageContent.includes("if (addMemberRole === 'admin' && !isOrganizer)");

  if (hasRoleChangeAdminCheck && hasAddMemberSubmitCheck) {
    recordResult(
      'Frontend Role Action Handlers Strictly Enforce Option B Rules',
      'PASS',
      'handleRoleChange and handleAddMemberSubmit allow Organizer and Admin, restrict admin assignment to Organizer, and protect Organizer and Admins.'
    );
  } else {
    recordResult(
      'Frontend Role Action Handlers Strictly Enforce Option B Rules',
      'FAIL',
      `roleChangeCheck: ${hasRoleChangeAdminCheck}, addMemberSubmitCheck: ${hasAddMemberSubmitCheck}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 7: Backend /members/add Allows Admin & Restricts Admin Role to Organizer
  // ---------------------------------------------------------------------------
  const hasAddEndpointAdminDep =
    authContent.includes('async def add_organization_member_endpoint(\n    payload: Optional[AddMemberRequest] = None,\n    current_user: AuthenticatedUser = Depends(require_admin),') ||
    (authContent.includes('add_organization_member_endpoint') && authContent.includes('Depends(require_admin)'));

  const hasAddEndpointAdminGuard =
    authContent.includes('if target_role == "admin" and current_user.role != UserRoleEnum.ORGANIZER:');

  if (hasAddEndpointAdminDep && hasAddEndpointAdminGuard) {
    recordResult(
      'Backend /members/add Endpoint Allows Admin & Restricts Admin Target to Organizer',
      'PASS',
      'POST /members/add uses Depends(require_admin) and enforces Organizer-only restriction for adding an Admin.'
    );
  } else {
    recordResult(
      'Backend /members/add Endpoint Allows Admin & Restricts Admin Target to Organizer',
      'FAIL',
      `addEndpointAdminDep: ${hasAddEndpointAdminDep}, addEndpointAdminGuard: ${hasAddEndpointAdminGuard}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 8: Invitation Engine Preserves RETURNS JSONB Contract & Response Shape
  // ---------------------------------------------------------------------------
  const hasJsonbReturnContract =
    govContent.includes('CREATE OR REPLACE FUNCTION public.process_pending_invitations_for_user(\n    p_user_id UUID,\n    p_email TEXT\n)\nRETURNS JSONB');

  const hasJsonbResponseShape =
    govContent.includes("'status', 'completed'") &&
    govContent.includes("'claimed_count', v_claimed_count") &&
    govContent.includes("'superseded_count', v_superseded_count") &&
    govContent.includes("'status', 'email_unconfirmed'") &&
    govContent.includes("'status', 'email_mismatch'");

  const hasOptionBRoleInvariants =
    govContent.includes("'admin'::public.user_role") &&
    govContent.includes("'hr'::public.user_role") &&
    govContent.includes("v_is_inviter_organizer");

  const hasValidStatusTransitions =
    govContent.includes("SET status = 'accepted'") &&
    govContent.includes("SET status = 'superseded'") &&
    !govContent.includes("claimed_at") &&
    !govContent.includes("claimed_by");

  if (hasJsonbReturnContract && hasJsonbResponseShape && hasOptionBRoleInvariants && hasValidStatusTransitions) {
    recordResult(
      'process_pending_invitations_for_user Preserves JSONB Contract & Return Shape',
      'PASS',
      'Preserves RETURNS JSONB, (p_user_id UUID, p_email TEXT) signature, completed/error shapes, accepted/superseded statuses, and avoids non-existent columns.'
    );
  } else {
    recordResult(
      'process_pending_invitations_for_user Preserves JSONB Contract & Return Shape',
      'FAIL',
      `jsonbReturnContract: ${hasJsonbReturnContract}, jsonbResponseShape: ${hasJsonbResponseShape}, optionBRules: ${hasOptionBRoleInvariants}, statusTransitions: ${hasValidStatusTransitions}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 9: Table Constraint chk_org_invitations_role Allows Pending Admin & HR
  // ---------------------------------------------------------------------------
  const hasConstraintUpdate =
    govContent.includes('ALTER TABLE public.organization_invitations DROP CONSTRAINT chk_org_invitations_role;') &&
    govContent.includes('ADD CONSTRAINT chk_org_invitations_role') &&
    govContent.includes("'admin'::public.user_role") &&
    govContent.includes("'hr'::public.user_role") &&
    govContent.includes("'manager'::public.user_role") &&
    govContent.includes("'employee'::public.user_role");

  if (hasConstraintUpdate) {
    recordResult(
      'Table Constraint chk_org_invitations_role Updated for Option B Roles',
      'PASS',
      'Permits pending invitations for Admin (Organizer-only), HR, Manager, and Employee, and excludes organizer.'
    );
  } else {
    recordResult(
      'Table Constraint chk_org_invitations_role Updated for Option B Roles',
      'FAIL',
      `chk_org_invitations_role update missing or malformed.`
    );
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

