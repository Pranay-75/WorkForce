const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log(' WORKFORCE FOCUSED FIXES VERIFICATION SUITE                    ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ [FAIL] ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Sidebar Navigation Label Test
// ---------------------------------------------------------------------------
runTest('Sidebar navigation item renamed from "Employees" to "Staff"', () => {
  const sidebarPath = path.resolve(__dirname, '../components/layout/AppSidebar.tsx');
  assert(fs.existsSync(sidebarPath), 'AppSidebar.tsx does not exist');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Verify item name is 'Staff' with href '/employees'
  assert(
    content.includes("name: 'Staff'") && content.includes("href: '/employees'"),
    'Sidebar does not have name: "Staff" with href: "/employees"'
  );

  // Ensure it was not left as 'Employees'
  assert(
    !content.includes("name: 'Employees'"),
    'Sidebar still contains name: "Employees"'
  );
});

// ---------------------------------------------------------------------------
// 2. Add Organization Member Dialog Role Options Test
// ---------------------------------------------------------------------------
runTest('Add Organization Member dialog preserves "Employee" role option and label', () => {
  const pagePath = path.resolve(__dirname, '../app/employees/page.tsx');
  assert(fs.existsSync(pagePath), 'employees/page.tsx does not exist');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Must have value="employee" with label starting with "Employee"
  assert(
    content.includes('<option value="employee">Employee'),
    'Dialog does not contain <option value="employee">Employee'
  );

  // Must not have "Staff" as role option label in the Add Member dialog
  assert(
    !content.includes('<option value="employee">Staff'),
    'Dialog still labels employee role option as "Staff"'
  );
});

// ---------------------------------------------------------------------------
// 3. Delete Member Flow & Empty UUID Prevention Test
// ---------------------------------------------------------------------------
runTest('removeMember in useOrganizationMembers validates UUID and blocks empty string', () => {
  const hookPath = path.resolve(__dirname, '../lib/hooks/useOrganizationMembers.ts');
  assert(fs.existsSync(hookPath), 'useOrganizationMembers.ts does not exist');
  const content = fs.readFileSync(hookPath, 'utf8');

  // Check that UUID validation exists in removeMember
  assert(
    content.includes('UUID_REGEX') || content.includes('Invalid or missing member ID'),
    'useOrganizationMembers removeMember lacks UUID validation'
  );

  // Check that mappedPendingMembers assigns a non-empty ID
  assert(
    !content.includes("userId: '',"),
    'useOrganizationMembers still assigns empty string to userId in mappedPendingMembers'
  );

  // Check that revoke_organization_invitation is supported for pending members
  assert(
    content.includes('revoke_organization_invitation'),
    'useOrganizationMembers does not support revoke_organization_invitation for pending members'
  );
});

runTest('handleRemoveMember in employees/page.tsx validates UUID and guards delete flow', () => {
  const pagePath = path.resolve(__dirname, '../app/employees/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Check UUID validation before submitting
  assert(
    content.includes('UUID_REGEX') && content.includes('Cannot remove'),
    'handleRemoveMember lacks client-side UUID validation and user-facing error'
  );

  // Check that card button passes the actual UUID and isPending flag
  assert(
    content.includes('memberActualId') && content.includes('isPendingMember'),
    'Staff card button does not compute memberActualId or pass isPendingMember'
  );
});

// ---------------------------------------------------------------------------
// 4. Staff Card Redesign Test (View Profile, Remove Profile, No Assign Project)
// ---------------------------------------------------------------------------
runTest('Staff card UI has View Profile and Remove Profile, and no Assign Project button', () => {
  const pagePath = path.resolve(__dirname, '../app/employees/page.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Check buttons
  assert(content.includes('View Profile'), 'Staff card lacks "View Profile" button');
  assert(content.includes('Remove Profile'), 'Staff card lacks "Remove Profile" button');
  assert(!content.includes('<span>Assign Project</span>'), 'Staff card still has "Assign Project" button');
});

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}

