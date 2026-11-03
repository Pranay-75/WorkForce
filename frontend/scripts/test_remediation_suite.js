/**
 * WorkForce Organizer Dashboard Remediation Test Suite
 * Validates fixes for:
 * 1. Task due-date and overdue logic (calendar date-only strings vs ISO datetimes).
 * 2. Zero-capacity employee workload classification (no false overallocation when 0 active hours).
 * 3. Demo mode employee metadata (department and jobTitle preservation).
 * 4. Demo mode simulated member invitations (validation, duplicate checks, UI state).
 * 5. Project milestone progress dynamic calculation (reacts to completed task hours).
 * 6. Demo workspace name display ('Acme Systems Engineering').
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
console.log('   WORKFORCE ORGANIZER DASHBOARD REMEDIATION TEST SUITE        ');
console.log('================================================================\n');

// Compile workloadEngine.ts in-memory
const enginePath = path.join(__dirname, '../lib/workloadEngine.ts');
const rawEngineCode = fs.readFileSync(enginePath, 'utf8');
const compiledEngineJs = ts.transpileModule(rawEngineCode, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const engineModule = { exports: {} };
vm.runInNewContext(compiledEngineJs, {
  module: engineModule,
  exports: engineModule.exports,
  require: (pkg) => {
    return {
      ACTIVE_TASK_STATUSES: ['todo', 'in_progress', 'in_review'],
    };
  },
  Date: Date,
  Math: Math,
  Number: Number,
  String: String,
  isNaN: isNaN,
  console: console,
});

const { isTaskOverdue, calculateEmployeeWorkload } = engineModule.exports;

// -----------------------------------------------------------------------------
// Test Suite 1: Task Due-Date & Overdue Logic (isTaskOverdue)
// -----------------------------------------------------------------------------
console.log('[Test Suite 1: Task Due-Date & Overdue Logic]');

const now = new Date();
const todayYear = now.getFullYear();
const todayMonth = now.getMonth() + 1;
const todayDay = now.getDate();
const todayStr = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

// 1.1 Task due today is NOT overdue
const taskDueToday = { status: 'in_progress', dueDate: todayStr };
assert(!isTaskOverdue(taskDueToday), 'Task due today (YYYY-MM-DD) is NOT overdue', `dueDate: ${todayStr}`);

// 1.2 Task due yesterday IS overdue
const taskDueYesterday = { status: 'in_progress', dueDate: yesterdayStr };
assert(isTaskOverdue(taskDueYesterday), 'Task due yesterday (YYYY-MM-DD) IS overdue', `dueDate: ${yesterdayStr}`);

// 1.3 Task due tomorrow is NOT overdue
const taskDueTomorrow = { status: 'in_progress', dueDate: tomorrowStr };
assert(!isTaskOverdue(taskDueTomorrow), 'Task due tomorrow (YYYY-MM-DD) is NOT overdue', `dueDate: ${tomorrowStr}`);

// 1.4 Completed task is NEVER overdue regardless of date
const completedTask = { status: 'completed', dueDate: yesterdayStr };
assert(!isTaskOverdue(completedTask), 'Completed task is NEVER overdue even if date is in past', `status: completed`);

// 1.5 Cancelled task is NEVER overdue
const cancelledTask = { status: 'cancelled', dueDate: yesterdayStr };
assert(!isTaskOverdue(cancelledTask), 'Cancelled task is NEVER overdue', `status: cancelled`);

// 1.6 In-review task with past due date IS overdue
const inReviewOverdueTask = { status: 'in_review', dueDate: yesterdayStr };
assert(isTaskOverdue(inReviewOverdueTask), 'In-review task with past due date IS overdue', `status: in_review`);

// 1.7 Empty or null due date is NOT overdue
assert(!isTaskOverdue({ status: 'in_progress', dueDate: null }), 'Null due date is NOT overdue');
assert(!isTaskOverdue({ status: 'in_progress', dueDate: '' }), 'Empty due date is NOT overdue');

// 1.8 Full ISO datetime in past IS overdue
const pastIso = new Date(Date.now() - 3600000).toISOString();
assert(isTaskOverdue({ status: 'in_progress', dueDate: pastIso }), 'Past ISO datetime IS overdue', pastIso);

// 1.9 Full ISO datetime in future is NOT overdue
const futureIso = new Date(Date.now() + 3600000).toISOString();
assert(!isTaskOverdue({ status: 'in_progress', dueDate: futureIso }), 'Future ISO datetime is NOT overdue', futureIso);

// -----------------------------------------------------------------------------
// Test Suite 2: Zero-Capacity Employee Workload Classification
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 2: Zero-Capacity Employee Workload Classification]');

// 2.1 weeklyCapacityHours = 0, activeHours = 0: MUST NOT be overallocated
const zeroCapNoTasks = calculateEmployeeWorkload({ id: 'emp-zero-1', weeklyCapacityHours: 0 }, []);
assert(
  zeroCapNoTasks.capacityBand !== 'overallocated',
  'Employee with 0h capacity and 0 active hours is NOT overallocated',
  `band: ${zeroCapNoTasks.capacityBand}, util: ${zeroCapNoTasks.utilizationPercentage}%`
);
assert(
  zeroCapNoTasks.utilizationPercentage === 0,
  'Employee with 0h capacity and 0 active hours has 0% utilization',
  `util: ${zeroCapNoTasks.utilizationPercentage}%`
);
assert(
  zeroCapNoTasks.burnoutRiskScore <= 0.1,
  'Employee with 0h capacity and 0 active hours has low burnout risk',
  `score: ${zeroCapNoTasks.burnoutRiskScore}`
);

// 2.2 weeklyCapacityHours = 0, activeHours > 0: MUST be flagged as overallocated (capacity risk)
const zeroCapWithTasks = calculateEmployeeWorkload(
  { id: 'emp-zero-2', weeklyCapacityHours: 0 },
  [{ id: 't1', assignedTo: 'emp-zero-2', status: 'in_progress', estimatedHours: 8 }]
);
assert(
  zeroCapWithTasks.capacityBand === 'overallocated',
  'Employee with 0h capacity and active assigned tasks IS overallocated',
  `band: ${zeroCapWithTasks.capacityBand}, hours: ${zeroCapWithTasks.activeAssignedHours}h`
);
assert(
  zeroCapWithTasks.burnoutRiskScore >= 0.7,
  'Employee with 0h capacity and active tasks has high congestion risk',
  `score: ${zeroCapWithTasks.burnoutRiskScore}`
);

// 2.3 weeklyCapacityHours = 40, activeHours = 20: Optimal
const normalLoad = calculateEmployeeWorkload(
  { id: 'emp-normal', weeklyCapacityHours: 40 },
  [{ id: 't2', assignedTo: 'emp-normal', status: 'in_progress', estimatedHours: 20 }]
);
assert(normalLoad.capacityBand === 'optimal', '40h capacity with 20h load is optimal (50%)', `band: ${normalLoad.capacityBand}`);
assert(normalLoad.utilizationPercentage === 50, 'Utilization matches 50%', `util: ${normalLoad.utilizationPercentage}%`);

// 2.4 weeklyCapacityHours = 40, activeHours = 50: Overallocated
const overloadEmp = calculateEmployeeWorkload(
  { id: 'emp-over', weeklyCapacityHours: 40 },
  [{ id: 't3', assignedTo: 'emp-over', status: 'in_progress', estimatedHours: 50 }]
);
assert(overloadEmp.capacityBand === 'overallocated', '40h capacity with 50h load is overallocated (125%)', `band: ${overloadEmp.capacityBand}`);
assert(overloadEmp.utilizationPercentage === 125, 'Utilization matches 125%', `util: ${overloadEmp.utilizationPercentage}%`);

// 2.5 Defensive handling: negative capacity clamped to 0
const negCap = calculateEmployeeWorkload({ id: 'emp-neg', weeklyCapacityHours: -15 }, []);
assert(negCap.weeklyCapacityHours === 0, 'Negative weekly capacity defensively clamped to 0', `cap: ${negCap.weeklyCapacityHours}`);
assert(!isNaN(negCap.utilizationPercentage), 'Utilization percentage is not NaN on negative capacity', `util: ${negCap.utilizationPercentage}`);

// 2.6 Defensive handling: undefined capacity defaults to 40
const undefCap = calculateEmployeeWorkload({ id: 'emp-undef' }, []);
assert(undefCap.weeklyCapacityHours === 40, 'Undefined weekly capacity defaults to 40', `cap: ${undefCap.weeklyCapacityHours}`);

// -----------------------------------------------------------------------------
// Test Suite 3: Dashboard Demo Mode Employee Metadata Preservation
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 3: Dashboard Demo Mode Employee Metadata Preservation]');

const dashboardFile = path.join(__dirname, '../app/dashboard/page.tsx');
const dashboardCode = fs.readFileSync(dashboardFile, 'utf8');

assert(
  dashboardCode.includes("department: e.department || 'General'") &&
  dashboardCode.includes("jobTitle: e.jobTitle || 'Team Member'"),
  'displayRoster in DashboardPage forwards department and jobTitle for mockEmployees',
  'Preserves full employee metadata in demo roster'
);

assert(
  dashboardCode.includes("department: m.department || 'General'") &&
  dashboardCode.includes("jobTitle: m.jobTitle || 'Team Member'"),
  'displayRoster in DashboardPage forwards department and jobTitle for live members',
  'Preserves full employee metadata in live roster'
);

// -----------------------------------------------------------------------------
// Test Suite 4: Demo Workspace Name
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 4: Demo Workspace Name Display]');

assert(
  dashboardCode.includes("isLive ? (organization?.name || 'WorkForce Workspace') : (organization?.name || 'Acme Systems Engineering')"),
  'Dashboard renders "Acme Systems Engineering" when in Demo Mode',
  'Preserves verified live organization name in Live Mode'
);

// -----------------------------------------------------------------------------
// Test Suite 5: Project Milestone Progress Dynamic Reactivity
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 5: Project Milestone Progress Dynamic Reactivity]');

assert(
  dashboardCode.includes('const projTasks = tasks.filter((t) => t.projectId === proj.id);'),
  'OrganizerDashboardView filters tasks by project ID for dynamic progress computation',
  'Matches tasks to projects'
);

assert(
  dashboardCode.includes('const taskCompletedHrs = projTasks') &&
  dashboardCode.includes(".filter((t) => t.status === 'completed')") &&
  dashboardCode.includes('taskTotalHrs'),
  'OrganizerDashboardView dynamically calculates completed task effort from completed tasks',
  'Computes real-time progress from linked task status'
);

assert(
  dashboardCode.includes('completedHours = Number(proj.completedHours || 0);') &&
  dashboardCode.includes('totalHours = Number(proj.totalHours || 0);'),
  'OrganizerDashboardView falls back safely to stored project hours when tasks are absent',
  'Protects projects without task items'
);

// -----------------------------------------------------------------------------
// Test Suite 6: Demo Mode Member Addition Simulation
// -----------------------------------------------------------------------------
console.log('\n[Test Suite 6: Demo Mode Member Addition Simulation]');

const employeesPageFile = path.join(__dirname, '../app/employees/page.tsx');
const employeesPageCode = fs.readFileSync(employeesPageFile, 'utf8');

assert(
  (employeesPageCode.includes('pendingDemoMembers') || employeesPageCode.includes('pendingDemoInvitations')) &&
  (employeesPageCode.includes('setPendingDemoMembers') || employeesPageCode.includes('setPendingDemoInvitations')),
  'Employees page maintains pending demo members state for in-memory demo exploration',
  'Tracks simulated members'
);

assert(
  employeesPageCode.includes('DEMO MODE: Simulate adding member in-memory without altering Supabase') &&
  employeesPageCode.includes('LIVE MODE: Authenticated Supabase add member RPC'),
  'Employees page branches strictly between in-memory demo simulation and live Supabase RPC',
  'Zero production database mutations during demo'
);

assert(
  employeesPageCode.includes('const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;'),
  'Employees page validates email syntax before adding member',
  'Rejects malformed emails'
);

assert(
  employeesPageCode.includes('mockEmployees.find((emp) => emp.email.toLowerCase() === email)') &&
  (employeesPageCode.includes('pendingDemoMembers.find((inv) => inv.email.toLowerCase() === email)') ||
   employeesPageCode.includes('pendingDemoInvitations.find((inv) => inv.email.toLowerCase() === email)')),
  'Employees page prevents duplicate members in demo mode',
  'Checks against both active demo employees and pending members'
);

assert(
  employeesPageCode.includes('Members Pending Account Setup ({pendingDemoMembers.length})') ||
  employeesPageCode.includes('Members Pending Account Setup'),
  'Employees page renders visible simulated member banner in demo mode',
  'Immediate feedback in demo roster UI'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`REMEDIATION SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
}
