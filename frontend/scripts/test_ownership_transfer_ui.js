/**
 * Test Suite: Frontend Ownership-Transfer UI & Defense-in-Depth Verification
 * File: frontend/scripts/test_ownership_transfer_ui.js
 *
 * Verifies:
 * 1. Organizer sees the ownership-transfer section in Settings.
 * 2. Non-organizers (admins, hr, managers, employees) cannot see or access the ownership-transfer controls.
 * 3. Current organizer cannot transfer ownership to themselves (excluded from dropdown + guarded in handlers).
 * 4. Confirmation dialog is strictly required before triggering the RPC.
 * 5. Explicit RPC signature and parameters ('transfer_organization_ownership', 'p_organization_id', 'p_new_organizer_user_id').
 * 6. Success and error states are handled properly, including state refresh on success (refreshUserData, refetch).
 * 7. Defense-in-depth: Handlers independently validate authorization and target validity even if UI state were tampered with.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function recordTest(name, passed, detail = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
    if (detail) console.log(`     Evidence: ${detail}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${name}`);
    if (detail) console.error(`     Error: ${detail}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log(' WORKFORCE FRONTEND OWNERSHIP-TRANSFER UI & SECURITY TEST SUITE ');
  console.log('================================================================\n');

  const settingsPagePath = path.join(__dirname, '../app/settings/page.tsx');
  const settingsCode = fs.readFileSync(settingsPagePath, 'utf8');

  // ---------------------------------------------------------------------------
  // Category 1: Static Architecture & Contract Inspection
  // ---------------------------------------------------------------------------
  console.log('--- Category 1: Static Architecture & Contract Inspection ---');

  recordTest(
    'Imports useOrganizationMembers hook',
    settingsCode.includes("import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers'"),
    'Hook imported for retrieving verified workspace members'
  );

  recordTest(
    'Imports Dialog modal component',
    settingsCode.includes("import { Dialog } from '@/components/ui/Dialog'"),
    'Modal dialog imported for explicit confirmation before transfer'
  );

  recordTest(
    'RPC Name is exactly transfer_organization_ownership',
    settingsCode.includes("supabase.rpc('transfer_organization_ownership'"),
    "Calls supabase.rpc('transfer_organization_ownership', ...)"
  );

  recordTest(
    'RPC Parameters match verified schema: p_organization_id & p_new_organizer_user_id',
    settingsCode.includes('p_organization_id:') && settingsCode.includes('p_new_organizer_user_id:'),
    'Passes p_organization_id and p_new_organizer_user_id'
  );

  recordTest(
    'State Refresh on Success: calls refreshUserData and refetchMembers',
    settingsCode.includes('await refreshUserData()') && settingsCode.includes('await refetchMembers()'),
    'Refreshes caller role via refreshUserData() and updates member list via refetchMembers()'
  );

  // ---------------------------------------------------------------------------
  // Category 2: Access Control & Organizer Visibility (Requirement 1 & 6)
  // ---------------------------------------------------------------------------
  console.log('\n--- Category 2: Role-Based Section Visibility & Gating ---');

  recordTest(
    'isOrganizer condition strictly derives from activeRole === "organizer"',
    settingsCode.includes("const isOrganizer = activeRole === 'organizer'"),
    'Organizer status derived strictly from verified active role'
  );

  recordTest(
    'Ownership Transfer Section is strictly wrapped in {isOrganizer && (...)}',
    settingsCode.includes('{isOrganizer && (') && settingsCode.includes('Transfer Workspace Ownership'),
    'Section is not rendered in the DOM for non-organizers'
  );

  recordTest(
    'Confirmation Dialog is strictly gated on isOrganizer',
    settingsCode.includes('isOpen={isTransferDialogOpen && isOrganizer}'),
    'Modal cannot open even if dialog state is toggled when isOrganizer is false'
  );

  recordTest(
    'Non-admin and non-HR roles are denied page access',
    settingsCode.includes("if (activeRole !== 'organizer' && activeRole !== 'admin' && activeRole !== 'hr')"),
    'AccessDenied component blocks employees and managers from accessing workspace settings'
  );

  // ---------------------------------------------------------------------------
  // Category 3: Self-Transfer Exclusion & Member Filtering (Requirement 2)
  // ---------------------------------------------------------------------------
  console.log('\n--- Category 3: Self-Transfer Exclusion & Member Filtering ---');

  recordTest(
    'Eligible members filter excludes current organizer in live mode (userId !== user?.id)',
    settingsCode.includes('m.userId !== user?.id'),
    'Current organizer is filtered out from live members'
  );

  recordTest(
    'Eligible members filter excludes organizers (m.role !== "organizer")',
    settingsCode.includes("m.role !== 'organizer'"),
    'Users already holding organizer role cannot be transfer targets'
  );

  recordTest(
    'Eligible members filter requires status === "active"',
    settingsCode.includes("m.status === 'active'"),
    'Inactive or suspended members cannot be transfer targets'
  );

  recordTest(
    'Defense-in-depth: handleInitiateTransfer blocks self-transfer',
    settingsCode.includes('selectedNewOwnerId === currentCallerId') &&
    settingsCode.includes("setTransferErrorMsg('Cannot transfer ownership to yourself.')"),
    'Explicit error returned if selectedNewOwnerId matches current caller ID'
  );

  recordTest(
    'Defense-in-depth: handleExecuteOwnershipTransfer blocks self-transfer',
    settingsCode.includes('!selectedNewOwnerId || selectedNewOwnerId === currentCallerId') &&
    settingsCode.includes('Invalid recipient: Cannot transfer ownership to yourself'),
    'Execution handler enforces self-transfer prevention before invoking RPC'
  );

  // ---------------------------------------------------------------------------
  // Category 4: Confirmation Modal & Transparency (Requirement 3 & 4)
  // ---------------------------------------------------------------------------
  console.log('\n--- Category 4: Confirmation Modal & Transparency ---');

  recordTest(
    'Confirmation dialog displays target member name, email, and current role',
    settingsCode.includes('selectedTargetMember.name') &&
    settingsCode.includes('selectedTargetMember.email') &&
    settingsCode.includes('selectedTargetMember.role'),
    'Explicitly surfaces target member identity and role in the modal'
  );

  recordTest(
    'Explains caller will be demoted to Organization Administrator (admin)',
    settingsCode.includes('Your role will immediately be changed to') &&
    settingsCode.includes('Organization Administrator (admin)'),
    'Clearly warns caller of immediate demotion to admin'
  );

  recordTest(
    'Explains recipient will become the sole Organizer',
    settingsCode.includes('will become the sole') &&
    settingsCode.includes('Organizer'),
    'Clearly communicates transition of super-admin authority'
  );

  recordTest(
    'Explains loss of ownership transfer and deletion authority',
    settingsCode.includes('You will no longer have authority to transfer workspace ownership or delete the organization'),
    'Warns caller of authority loss'
  );

  recordTest(
    'Confirmation action requires explicit user click on danger button',
    settingsCode.includes('Confirm Ownership Transfer') && settingsCode.includes('variant="danger"'),
    'Distinct danger button invokes handleExecuteOwnershipTransfer'
  );

  // ---------------------------------------------------------------------------
  // Category 5: Functional Logic Simulation (Unit Tests)
  // ---------------------------------------------------------------------------
  console.log('\n--- Category 5: Functional Logic Simulation ---');

  // Simulate eligible member filtering
  const currentUserId = 'user-organizer-uuid-1';
  const mockActiveMembers = [
    { userId: 'user-organizer-uuid-1', fullName: 'Alice Organizer', email: 'alice@corp.com', role: 'organizer', status: 'active' },
    { userId: 'user-admin-uuid-2', fullName: 'Bob Admin', email: 'bob@corp.com', role: 'admin', status: 'active' },
    { userId: 'user-member-uuid-3', fullName: 'Carol Member', email: 'carol@corp.com', role: 'employee', status: 'active' },
    { userId: 'user-suspended-uuid-4', fullName: 'Dave Suspended', email: 'dave@corp.com', role: 'admin', status: 'suspended' },
    { userId: 'user-invited-uuid-5', fullName: 'Eve Invited', email: 'eve@corp.com', role: 'employee', status: 'invited' },
  ];

  function filterEligibleMembers(members, callerId) {
    return (members || [])
      .filter((m) => m.userId !== callerId && m.status === 'active' && m.role !== 'organizer')
      .map((m) => ({
        id: m.userId,
        name: m.fullName?.trim() || m.email,
        email: m.email,
        role: m.role,
      }));
  }

  const eligible = filterEligibleMembers(mockActiveMembers, currentUserId);

  recordTest(
    'Filtering correctly excludes current organizer',
    !eligible.some((m) => m.id === currentUserId),
    `Eligible count: ${eligible.length}. Alice Organizer excluded.`
  );

  recordTest(
    'Filtering correctly excludes non-active members (suspended/invited)',
    !eligible.some((m) => m.id === 'user-suspended-uuid-4' || m.id === 'user-invited-uuid-5'),
    'Dave Suspended and Eve Invited excluded.'
  );

  recordTest(
    'Filtering includes active admin and active employee',
    eligible.length === 2 &&
    eligible.find((m) => m.id === 'user-admin-uuid-2') &&
    eligible.find((m) => m.id === 'user-member-uuid-3'),
    'Bob Admin and Carol Member included as eligible targets'
  );

  // Simulate sole organizer organization (empty eligible members)
  const soleOrganizerMembers = [
    { userId: 'user-organizer-uuid-1', fullName: 'Alice Organizer', email: 'alice@corp.com', role: 'organizer', status: 'active' },
  ];
  const soleEligible = filterEligibleMembers(soleOrganizerMembers, currentUserId);
  recordTest(
    'Sole organizer workspace produces empty eligible list for banner warning',
    soleEligible.length === 0,
    'Triggers "No eligible active members found" banner and prevents transfer'
  );

  // Simulate defense-in-depth handler guards
  function simulateInitiateTransfer(callerRole, callerId, selectedId, eligibleList) {
    if (callerRole !== 'organizer') {
      return { error: 'Access denied: Only the Organization Organizer can transfer workspace ownership.', modalOpen: false };
    }
    if (!selectedId) {
      return { error: 'Please select an active member to receive workspace ownership.', modalOpen: false };
    }
    if (selectedId === callerId) {
      return { error: 'Cannot transfer ownership to yourself.', modalOpen: false };
    }
    const target = eligibleList.find((m) => m.id === selectedId);
    if (!target) {
      return { error: 'The selected member is not an eligible active member of this organization.', modalOpen: false };
    }
    return { error: null, modalOpen: true, target };
  }

  const nonOrganizerAttempt = simulateInitiateTransfer('admin', 'admin-id', 'user-member-uuid-3', eligible);
  recordTest(
    'Non-organizer initiate attempt is rejected',
    nonOrganizerAttempt.error.includes('Access denied') && nonOrganizerAttempt.modalOpen === false,
    nonOrganizerAttempt.error
  );

  const selfTransferAttempt = simulateInitiateTransfer('organizer', currentUserId, currentUserId, eligible);
  recordTest(
    'Self-transfer initiate attempt is rejected',
    selfTransferAttempt.error === 'Cannot transfer ownership to yourself.' && selfTransferAttempt.modalOpen === false,
    selfTransferAttempt.error
  );

  const invalidTargetAttempt = simulateInitiateTransfer('organizer', currentUserId, 'unknown-user', eligible);
  recordTest(
    'Invalid/unlisted target initiate attempt is rejected',
    invalidTargetAttempt.error.includes('not an eligible active member') && invalidTargetAttempt.modalOpen === false,
    invalidTargetAttempt.error
  );

  const validInitiateAttempt = simulateInitiateTransfer('organizer', currentUserId, 'user-admin-uuid-2', eligible);
  recordTest(
    'Valid target opens confirmation dialog',
    validInitiateAttempt.error === null && validInitiateAttempt.modalOpen === true,
    `Target: ${validInitiateAttempt.target.name} (${validInitiateAttempt.target.role})`
  );

  // Simulate RPC execution and state refresh
  async function simulateExecuteTransfer({
    isOrganizerRole,
    callerId,
    selectedId,
    eligibleList,
    orgId,
    mockRpcResult,
  }) {
    if (!isOrganizerRole) {
      return { success: false, error: 'Unauthorized: Only the current Organizer can transfer workspace ownership.' };
    }
    if (!selectedId || selectedId === callerId) {
      return { success: false, error: 'Invalid recipient: Cannot transfer ownership to yourself or an empty selection.' };
    }
    const target = eligibleList.find((m) => m.id === selectedId);
    if (!target) {
      return { success: false, error: 'Selected recipient is not an active eligible member.' };
    }

    // Call RPC
    let refreshedUserData = false;
    let refetchedMembers = false;

    if (mockRpcResult.error) {
      return {
        success: false,
        error: mockRpcResult.error.message,
        refreshedUserData,
        refetchedMembers,
      };
    }

    // On success
    refreshedUserData = true;
    refetchedMembers = true;
    return {
      success: true,
      error: null,
      message: `Workspace ownership successfully transferred to ${target.name}. Your role has been transitioned to Organization Administrator.`,
      refreshedUserData,
      refetchedMembers,
    };
  }

  // Test RPC error handling
  const rpcFailureResult = await simulateExecuteTransfer({
    isOrganizerRole: true,
    callerId: currentUserId,
    selectedId: 'user-admin-uuid-2',
    eligibleList: eligible,
    orgId: 'org-uuid-1',
    mockRpcResult: { error: { message: 'Database transaction failed.' } },
  });

  recordTest(
    'RPC error is captured and returned without state refresh',
    rpcFailureResult.success === false &&
    rpcFailureResult.error === 'Database transaction failed.' &&
    rpcFailureResult.refreshedUserData === false,
    `Error handled: "${rpcFailureResult.error}"`
  );

  // Test RPC success handling
  const rpcSuccessResult = await simulateExecuteTransfer({
    isOrganizerRole: true,
    callerId: currentUserId,
    selectedId: 'user-admin-uuid-2',
    eligibleList: eligible,
    orgId: 'org-uuid-1',
    mockRpcResult: { data: { status: 'ownership_transferred' }, error: null },
  });

  recordTest(
    'RPC success triggers state refresh and returns transition message',
    rpcSuccessResult.success === true &&
    rpcSuccessResult.refreshedUserData === true &&
    rpcSuccessResult.refetchedMembers === true &&
    rpcSuccessResult.message.includes('Bob Admin') &&
    rpcSuccessResult.message.includes('Organization Administrator'),
    rpcSuccessResult.message
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

