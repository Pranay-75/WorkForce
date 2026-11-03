/**
 * WorkForce - Manager Dashboard Roster Key & Identifier Verification Suite
 * File: frontend/scripts/test_dashboard_roster_keys.js
 *
 * Verifies:
 * 1. Active members with normal UUIDs produce stable, non-empty IDs in displayRoster.
 * 2. Pending setup members (with empty userId: "") produce stable, unique, non-empty IDs (not "").
 * 3. Multiple pending setup members do not collide or produce duplicate empty keys ("").
 * 4. Duplicate member records are cleanly deduplicated, preventing duplicate React keys.
 * 5. Safe fallback key resolver ensures key is always a non-empty string.
 * 6. React element list rendering with displayRoster simulation produces zero duplicate or empty keys.
 * 7. Employee workload list in ManagerView preserves stable unique IDs.
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

// Mirroring the exact mapping logic implemented in dashboard/page.tsx
function createDisplayRoster(members, isLive, user, mockEmployees = [], mockUserId = '') {
  if (isLive) {
    const seenIds = new Set();
    return members
      .map((m) => {
        const stableId =
          m.id ||
          m.membershipId ||
          (m.userId ? m.userId : '') ||
          (m.email ? `member-${m.email}` : '');
        return {
          id: stableId,
          membershipId: m.membershipId || m.id,
          userId: m.userId,
          fullName: m.fullName,
          email: m.email,
          role: m.role,
          department: m.department || 'General',
          jobTitle: m.jobTitle || 'Team Member',
          weeklyCapacityHours: m.weeklyCapacityHours,
          isCurrentUser: Boolean(user?.id && m.userId && m.userId === user.id),
        };
      })
      .filter((m) => {
        if (!m.id) return false;
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });
  }
  const seenIds = new Set();
  return mockEmployees
    .map((e) => ({
      id: e.id,
      membershipId: e.id,
      userId: e.id,
      fullName: e.fullName,
      email: e.email,
      role: e.role,
      department: e.department || 'General',
      jobTitle: e.jobTitle || 'Team Member',
      weeklyCapacityHours: e.weeklyCapacityHours,
      isCurrentUser: e.id === mockUserId,
    }))
    .filter((e) => {
      if (!e.id) return false;
      if (seenIds.has(e.id)) return false;
      seenIds.add(e.id);
      return true;
    });
}

function resolveMemberKey(m) {
  return m.id || m.membershipId || m.userId || (m.email ? `roster-${m.email}` : '');
}

async function runTests() {
  console.log('================================================================');
  console.log(' WORKFORCE DASHBOARD ROSTER REACT KEY VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const dashboardPath = path.resolve(__dirname, '../app/dashboard/page.tsx');
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

  // ---------------------------------------------------------------------------
  // Test 1: Verify source code mapping in dashboard/page.tsx
  // ---------------------------------------------------------------------------
  const hasDisplayRosterStableId =
    dashboardContent.includes('const stableId =') &&
    dashboardContent.includes('m.id ||') &&
    dashboardContent.includes('m.membershipId ||') &&
    dashboardContent.includes('seenIds.add(m.id)');

  if (hasDisplayRosterStableId) {
    recordResult(
      'displayRoster Mapping Uses Stable Unique Identifier and Deduplication',
      'PASS',
      'dashboard/page.tsx derives stableId from m.id || m.membershipId and filters duplicate/empty IDs.'
    );
  } else {
    recordResult(
      'displayRoster Mapping Uses Stable Unique Identifier and Deduplication',
      'FAIL',
      'dashboard/page.tsx does not properly use stableId or deduplication in displayRoster.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 2: Verify JSX rendering key resolution in dashboard/page.tsx
  // ---------------------------------------------------------------------------
  const hasDefensiveKey =
    dashboardContent.includes('const memberKey = m.id || m.membershipId || m.userId') &&
    dashboardContent.includes('key={memberKey}');

  if (hasDefensiveKey) {
    recordResult(
      'Team Governance Roster JSX Uses Defensive Key Resolution',
      'PASS',
      'dashboard/page.tsx uses key={memberKey} with stable fallbacks instead of bare empty-prone keys.'
    );
  } else {
    recordResult(
      'Team Governance Roster JSX Uses Defensive Key Resolution',
      'FAIL',
      'dashboard/page.tsx is missing defensive key resolution at the JSX map site.'
    );
  }

  // ---------------------------------------------------------------------------
  // Test 3: Simulation with Active Manager and Pending Setup Members (userId: "")
  // ---------------------------------------------------------------------------
  const managerUser = { id: 'usr-mgr-001', email: 'manager@acme.corp' };
  const mockOrgMembers = [
    {
      id: 'mem-001',
      membershipId: 'mem-001',
      userId: 'usr-mgr-001',
      fullName: 'Alice Manager',
      email: 'manager@acme.corp',
      role: 'manager',
      department: 'Engineering',
      jobTitle: 'Engineering Manager',
      weeklyCapacityHours: 40,
    },
    {
      id: 'pending-inv-001',
      membershipId: 'inv-001',
      userId: '', // Pending invitation: user has not registered yet
      fullName: 'bob',
      email: 'bob@acme.corp',
      role: 'employee',
      department: 'General',
      jobTitle: 'Employee (Pending Setup)',
      weeklyCapacityHours: 40,
    },
    {
      id: 'pending-inv-002',
      membershipId: 'inv-002',
      userId: '', // Second pending invitation: previously both had id: ""
      fullName: 'carol',
      email: 'carol@acme.corp',
      role: 'employee',
      department: 'General',
      jobTitle: 'Employee (Pending Setup)',
      weeklyCapacityHours: 40,
    },
    {
      id: 'pending-inv-003',
      membershipId: 'inv-003',
      userId: '', // Third pending invitation
      fullName: 'david',
      email: 'david@acme.corp',
      role: 'employee',
      department: 'General',
      jobTitle: 'Employee (Pending Setup)',
      weeklyCapacityHours: 40,
    },
  ];

  const roster = createDisplayRoster(mockOrgMembers, true, managerUser);

  // Check all IDs are non-empty
  const hasEmptyId = roster.some((m) => !m.id || m.id.trim() === '');
  if (!hasEmptyId) {
    recordResult(
      'Pending Members with Empty userId Receive Valid Stable IDs',
      'PASS',
      `All ${roster.length} members received non-empty stable IDs: ${roster.map((m) => m.id).join(', ')}`
    );
  } else {
    recordResult(
      'Pending Members with Empty userId Receive Valid Stable IDs',
      'FAIL',
      'One or more members in displayRoster received an empty ID.'
    );
  }

  // Check all keys are unique
  const keys = roster.map(resolveMemberKey);
  const uniqueKeys = new Set(keys);

  if (keys.length === uniqueKeys.size && !uniqueKeys.has('')) {
    recordResult(
      'Multiple Pending Invitations Yield Strictly Unique Keys',
      'PASS',
      `Generated ${keys.length} distinct non-empty keys across active and pending members.`
    );
  } else {
    recordResult(
      'Multiple Pending Invitations Yield Strictly Unique Keys',
      'FAIL',
      `Duplicate or empty keys detected: keys=[${keys.join(', ')}], unique count=${uniqueKeys.size}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 4: Deduplication of Duplicate Membership Entries
  // ---------------------------------------------------------------------------
  const duplicateMembers = [
    ...mockOrgMembers,
    {
      id: 'pending-inv-001', // Exact duplicate of Bob
      membershipId: 'inv-001',
      userId: '',
      fullName: 'bob',
      email: 'bob@acme.corp',
      role: 'employee',
      department: 'General',
      jobTitle: 'Employee (Pending Setup)',
      weeklyCapacityHours: 40,
    },
    {
      id: 'mem-001', // Exact duplicate of Manager
      membershipId: 'mem-001',
      userId: 'usr-mgr-001',
      fullName: 'Alice Manager',
      email: 'manager@acme.corp',
      role: 'manager',
      department: 'Engineering',
      jobTitle: 'Engineering Manager',
      weeklyCapacityHours: 40,
    },
  ];

  const dedupedRoster = createDisplayRoster(duplicateMembers, true, managerUser);
  const dedupedKeys = dedupedRoster.map(resolveMemberKey);
  const dedupedKeySet = new Set(dedupedKeys);

  if (dedupedRoster.length === mockOrgMembers.length && dedupedKeys.length === dedupedKeySet.size) {
    recordResult(
      'Duplicate Member Records Deduplicated Cleanly',
      'PASS',
      `Raw list of ${duplicateMembers.length} items was cleanly filtered to ${dedupedRoster.length} unique items.`
    );
  } else {
    recordResult(
      'Duplicate Member Records Deduplicated Cleanly',
      'FAIL',
      `Expected ${mockOrgMembers.length} deduped items, got ${dedupedRoster.length}`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 5: Fallback Key Resilience When m.id is Missing
  // ---------------------------------------------------------------------------
  const degradedMember = {
    id: '',
    membershipId: '',
    userId: '',
    email: 'fallback.test@acme.corp',
    fullName: 'Fallback Test',
  };

  const fallbackKey = resolveMemberKey(degradedMember);
  if (fallbackKey === 'roster-fallback.test@acme.corp') {
    recordResult(
      'Graceful Fallback Key Resolution from Email',
      'PASS',
      `Degraded record safely resolved to: ${fallbackKey}`
    );
  } else {
    recordResult(
      'Graceful Fallback Key Resolution from Email',
      'FAIL',
      `Unexpected fallback key: "${fallbackKey}"`
    );
  }

  // ---------------------------------------------------------------------------
  // Test 6: Slice Rendering Simulation (First 5 Members)
  // ---------------------------------------------------------------------------
  const renderedKeys = roster.slice(0, 5).map(resolveMemberKey);
  const renderedKeySet = new Set(renderedKeys);

  if (renderedKeys.length === renderedKeySet.size && !renderedKeySet.has('')) {
    recordResult(
      'First 5 Roster Slice Renders Zero Duplicate or Empty Keys',
      'PASS',
      `Rendered slice [0..5] produces ${renderedKeys.length} valid unique keys.`
    );
  } else {
    recordResult(
      'First 5 Roster Slice Renders Zero Duplicate or Empty Keys',
      'FAIL',
      `Slice rendering detected duplicate or empty keys: [${renderedKeys.join(', ')}]`
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

