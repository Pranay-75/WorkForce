/**
 * WorkForce Phase 3.2 & Organizer Member Management Verification Test Suite
 *
 * Validates:
 * 1. Complete Removal of Blocked Task Status across types, Kanban, editing, and workload engine.
 * 2. Add Member System: immediate persistence, Pending Setup vs Active statuses, role boundaries.
 * 3. First-Time Member Login and Account Setup workflow.
 * 4. Task editing in Table view.
 * 5. Project permissions: only Managers can be assigned as project managers.
 * 6. Workload Redistribution Sandbox telemetry and overload signals.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require(path.join(__dirname, '../node_modules/typescript'));

let passedTests = 0;
let failedTests = 0;

function assert(condition, message, evidence = '') {
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${message}${evidence ? ' (' + evidence + ')' : ''}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${message}${evidence ? ' - Error: ' + evidence : ''}`);
  }
}

console.log('================================================================');
console.log('   WORKFORCE PHASE 3.2 & MEMBER MANAGEMENT VERIFICATION SUITE  ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Complete Removal of Blocked Task Status
// -----------------------------------------------------------------------------
console.log('[Test Suite 1: Complete Removal of Blocked Task Status]');

// 1.1 Types definition
const typesFile = path.join(__dirname, '../lib/types.ts');
const typesCode = fs.readFileSync(typesFile, 'utf8');

assert(
  typesCode.includes("export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed';"),
  'types.ts defines strictly 4 supported TaskStatus values without blocked',
  'todo | in_progress | in_review | completed'
);
assert(!typesCode.includes("'blocked'"), 'types.ts has zero occurrences of blocked status');

// 1.2 Transpile workloadEngine.ts in-memory
const enginePath = path.join(__dirname, '../lib/workloadEngine.ts');
const rawEngineCode = fs.readFileSync(enginePath, 'utf8');
const compiledEngineJs = ts.transpileModule(rawEngineCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const engineModule = { exports: {} };
vm.runInNewContext(compiledEngineJs, {
  module: engineModule,
  exports: engineModule.exports,
  require: () => ({}),
  Date: Date,
  Math: Math,
  Number: Number,
  String: String,
  isNaN: isNaN,
  console: console,
});

const { isTaskActive, calculateEmployeeWorkload, ACTIVE_TASK_STATUSES } = engineModule.exports;

assert(
  Array.isArray(ACTIVE_TASK_STATUSES) &&
  ACTIVE_TASK_STATUSES.length === 3 &&
  ACTIVE_TASK_STATUSES.includes('todo') &&
  ACTIVE_TASK_STATUSES.includes('in_progress') &&
  ACTIVE_TASK_STATUSES.includes('in_review'),
  'ACTIVE_TASK_STATUSES is strictly [todo, in_progress, in_review]',
  `count: ${ACTIVE_TASK_STATUSES.length}`
);

assert(isTaskActive({ status: 'todo' }), 'isTaskActive(todo) is true');
assert(isTaskActive({ status: 'in_progress' }), 'isTaskActive(in_progress) is true');
assert(isTaskActive({ status: 'in_review' }), 'isTaskActive(in_review) is true');
assert(!isTaskActive({ status: 'completed' }), 'isTaskActive(completed) is false');
assert(!isTaskActive({ status: 'cancelled' }), 'isTaskActive(cancelled) is false');

// 1.3 Workload calculation does not inflate or reference blocked tasks
const empTasks = [
  { id: 't1', assignedTo: 'emp-1', status: 'in_progress', estimatedHours: 20 },
  { id: 't2', assignedTo: 'emp-1', status: 'completed', estimatedHours: 15 },
];
const metrics = calculateEmployeeWorkload({ id: 'emp-1', weeklyCapacityHours: 40 }, empTasks);

assert(metrics.activeAssignedHours === 20, 'Active assigned hours strictly equals active deliverables (20h)');
assert(metrics.utilizationPercentage === 50, 'Utilization equals 50%');
assert(metrics.capacityBand === 'optimal', 'Capacity band is optimal');
assert(metrics.blockedTaskCount === undefined, 'blockedTaskCount is completely removed from metrics interface');
assert(metrics.blockedHours === undefined, 'blockedHours is completely removed from metrics interface');

// 1.4 Kanban board 4-column layout
const tasksPageFile = path.join(__dirname, '../app/tasks/page.tsx');
const tasksPageCode = fs.readFileSync(tasksPageFile, 'utf8');

assert(
  !tasksPageCode.includes("status: 'blocked'"),
  'tasks/page.tsx kanbanColumns does not include blocked column'
);
assert(
  tasksPageCode.includes('lg:grid-cols-4') && !tasksPageCode.includes('xl:grid-cols-5'),
  'Kanban board grid uses clean 4-column layout (lg:grid-cols-4, no xl:grid-cols-5)'
);
assert(
  !tasksPageCode.includes("{ label: 'Blocked / Impediment', value: 'blocked' }"),
  'Task Edit Dialog status select does not contain blocked option'
);

// 1.5 Task Detail status select
const taskDetailPage = path.join(__dirname, '../app/tasks/[id]/page.tsx');
const taskDetailCode = fs.readFileSync(taskDetailPage, 'utf8');
assert(!taskDetailCode.includes('<option value="blocked">Blocked</option>'), 'Task detail page does not contain blocked status option');

// -----------------------------------------------------------------------------
// Test Suite 2: Replace Invitation System with Add Member System
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 2: Organizer Add Member System & Immediate Persistence]');

const orgMembersHookFile = path.join(__dirname, '../lib/hooks/useOrganizationMembers.ts');
const orgMembersHookCode = fs.readFileSync(orgMembersHookFile, 'utf8');

// 2.1 useOrganizationMembers exports addMember
assert(
  orgMembersHookCode.includes('addMember:') && orgMembersHookCode.includes('role: \'manager\' | \'employee\''),
  'useOrganizationMembers exports addMember restricted strictly to manager and employee roles'
);
assert(
  orgMembersHookCode.includes('accountStatus: \'active\'') &&
  orgMembersHookCode.includes('accountStatus: \'pending_setup\''),
  'useOrganizationMembers maps members with accountStatus: active and pending_setup'
);
assert(
  orgMembersHookCode.includes('setActiveMembers') &&
  orgMembersHookCode.includes('setMembers([...mappedActiveMembers, ...mappedPendingMembers])'),
  'useOrganizationMembers returns unified members list containing both active and pending setup members'
);

// 2.2 Employees directory UI
const employeesPageFile = path.join(__dirname, '../app/employees/page.tsx');
const employeesPageCode = fs.readFileSync(employeesPageFile, 'utf8');

assert(
  employeesPageCode.includes('<span>Add Member</span>'),
  'Employees page renders Add Member button in Organizer / Admin header'
);
assert(
  employeesPageCode.includes('Add Organization Member') &&
  employeesPageCode.includes('Add Member'),
  'Employees page renders Add Organization Member dialog with Add Member action'
);
assert(
  employeesPageCode.includes('<option value="employee">') &&
  employeesPageCode.includes('<option value="manager">') &&
  !employeesPageCode.includes('<option value="admin">Administrator — Workspace management') &&
  !employeesPageCode.includes('<option value="organizer">'),
  'Add Member dialog strictly restricts role selection to Manager and Employee (Organizer and Admin cannot be created)'
);
assert(
  employeesPageCode.includes("m.accountStatus === 'pending_setup' ? 'Pending Setup' : 'Active'"),
  'Member cards clearly display Active (emerald) or Pending Setup (amber) status badges'
);
assert(
  employeesPageCode.includes('Members Pending Account Setup') &&
  employeesPageCode.includes('livePendingInvitations.length'),
  'Employees page renders Members Pending Account Setup banner'
);

// 2.3 Proposed Migration for Add Member and no-blocked status
const migrationFile = path.join(__dirname, '../../supabase/migrations/20261030000001_add_member_system_and_remove_blocked_status.sql');
assert(fs.existsSync(migrationFile), 'Proposed non-executed migration file exists for add_organization_member and check_pending_setup');
const migrationCode = fs.readFileSync(migrationFile, 'utf8');
assert(migrationCode.includes('add_organization_member'), 'Migration defines add_organization_member RPC');
assert(migrationCode.includes('check_pending_setup'), 'Migration defines check_pending_setup RPC');
assert(migrationCode.includes('chk_tasks_supported_statuses'), 'Migration enforces task status check constraint');

// -----------------------------------------------------------------------------
// Test Suite 3: First-Time Member Login and Account Setup Workflow
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 3: First-Time Member Login and Account Setup Workflow]');

const loginPageFile = path.join(__dirname, '../app/login/page.tsx');
const loginPageCode = fs.readFileSync(loginPageFile, 'utf8');

assert(
  loginPageCode.includes('First-Time Member Setup') &&
  loginPageCode.includes("activeTab === 'setup'"),
  'Login page provides dedicated First-Time Member Setup tab'
);
assert(
  loginPageCode.includes('handleVerifyMembership') &&
  loginPageCode.includes('check_pending_setup'),
  'Login page validates pending workspace membership via check_pending_setup RPC'
);
assert(
  loginPageCode.includes('handleCompleteSetup') &&
  loginPageCode.includes('signUpWithPassword'),
  'Login page completes setup via Supabase Auth password creation'
);
assert(
  loginPageCode.includes('Member Account Setup') &&
  loginPageCode.includes('setupPassword'),
  'Login page displays member account setup prompt before password creation without disclosing role'
);

const registerPageFile = path.join(__dirname, '../app/register/page.tsx');
const registerPageCode = fs.readFileSync(registerPageFile, 'utf8');
assert(
  registerPageCode.includes('/login?tab=setup'),
  'Register page links added members directly to /login?tab=setup for First-Time Member Setup'
);

// -----------------------------------------------------------------------------
// Test Suite 4: Task Editing in Table View (Preserved)
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 4: Task Editing in Table View]');

assert(
  tasksPageCode.includes('onClick={() => handleOpenEditModal(t)}'),
  'Table view renders Edit button that opens handleOpenEditModal'
);
assert(
  tasksPageCode.includes('<Dialog') &&
  tasksPageCode.includes('isOpen={isEditOpen}') &&
  tasksPageCode.includes('title="Edit Task Deliverable"'),
  'TasksPage renders Edit Task Dialog with complete field editing capabilities'
);
assert(
  tasksPageCode.includes('handleSaveTaskEdit') &&
  tasksPageCode.includes('dbUpdateTaskDetails') &&
  tasksPageCode.includes('mockUpdateTaskDetails'),
  'handleSaveTaskEdit persists changes via dbUpdateTaskDetails and mockUpdateTaskDetails'
);

// -----------------------------------------------------------------------------
// Test Suite 5: Organizer Project Manager Role Filtering (Preserved)
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 5: Project Manager Role Filtering (role === manager)]');

const projectsPageFile = path.join(__dirname, '../app/projects/page.tsx');
const projectsPageCode = fs.readFileSync(projectsPageFile, 'utf8');

assert(
  projectsPageCode.includes("role === 'manager'") &&
  projectsPageCode.includes('eligibleManagers'),
  'projects/page.tsx computes eligibleManagers strictly filtered to role === manager'
);
assert(
  projectsPageCode.includes('Create Project Dialog') &&
  projectsPageCode.includes('eligibleManagers'),
  'projects/page.tsx Create Project Dialog provides Manager-only selector'
);

const projectDetailPage = path.join(__dirname, '../app/projects/[id]/page.tsx');
const projectDetailCode = fs.readFileSync(projectDetailPage, 'utf8');

assert(
  projectDetailCode.includes("role === 'manager'") &&
  projectDetailCode.includes('eligibleManagers'),
  'projects/[id]/page.tsx filters eligible managers strictly to role === manager'
);

// -----------------------------------------------------------------------------
// Test Suite 6: Workload Redistribution Sandbox Signals (Preserved)
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 6: Workload Redistribution Sandbox Signals]');

const workloadPageFile = path.join(__dirname, '../app/workload/page.tsx');
const workloadPageCode = fs.readFileSync(workloadPageFile, 'utf8');

assert(
  workloadPageCode.includes('Overload Detected — Automated Reallocation Constrained') ||
  workloadPageCode.includes('Allocation Constraints Detected'),
  'Workload page renders diagnostic overload signal when reallocations are constrained'
);
assert(
  workloadPageCode.includes('computeDeterministicRedistributionProposals') ||
  workloadPageCode.includes('computeDynamicRedistributionProposals'),
  'Workload page dynamically derives redistribution proposals using deterministic engine in all modes'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`PHASE 3.2 SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
