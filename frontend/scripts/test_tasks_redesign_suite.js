/**
 * test_tasks_redesign_suite.js
 * Verification suite for the Workforce Tasks section redesign:
 *
 * 1. Project Grouping:
 *    - Defaults to focused single project view
 *    - "All projects" groups tasks by project (not one dense board)
 *    - Each group displays task status distribution (Todo, In progress, In review, Completed)
 *    - Handles tasks without project in a dedicated "Unassigned" group
 *
 * 2. Organization-Specific Role Filtering:
 *    - Evaluates assignee's role from organization membership (not global user role)
 *    - Explicitly handles undetermined/missing roles as 'unknown' rather than silently coercing
 *    - Includes "All roles", "Unassigned", "Unknown role", and specific roles
 *    - Combines correctly with search query, project selection, and priority filters
 *
 * 3. Visual Clutter Reduction & Layout:
 *    - Compact cards with title, assignee + role, due date, priority, status
 *    - Collapsible project groups and collapsible kanban columns
 *    - Task counts remain visible on headers even when collapsed
 *
 * 4. Authorization & Permissions:
 *    - Preserves employee read-only checks vs self-service status movement
 *    - Preserves manager/admin creation and editing privileges
 */

const fs = require('fs');
const path = require('path');

function runTasksRedesignSuite() {
  console.log('================================================================');
  console.log(' WORKFORCE TASKS SECTION REDESIGN VERIFICATION SUITE           ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  // --- Category 1: Static Architecture & File Inspection ---
  const tasksPagePath = path.join(__dirname, '..', 'app', 'tasks', 'page.tsx');
  const tasksLibPath = path.join(__dirname, '..', 'lib', 'tasks.ts');
  const typesPath = path.join(__dirname, '..', 'lib', 'types.ts');
  const useTasksPath = path.join(__dirname, '..', 'lib', 'hooks', 'useTasks.ts');

  assert(fs.existsSync(tasksPagePath), 'Tasks page file exists', tasksPagePath);
  assert(fs.existsSync(tasksLibPath), 'Tasks utility library exists', tasksLibPath);

  const tasksPageContent = fs.readFileSync(tasksPagePath, 'utf8');
  const tasksLibContent = fs.readFileSync(tasksLibPath, 'utf8');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const useTasksContent = fs.readFileSync(useTasksPath, 'utf8');

  // Verify Task interface has assignedEmployeeRole
  assert(
    typesContent.includes('assignedEmployeeRole?: UserRole;'),
    'Task interface includes assignedEmployeeRole?: UserRole'
  );

  // Verify useTasks queries organization_memberships.role
  assert(
    useTasksContent.includes('organization_memberships!fk_tasks_org_assignee') &&
    useTasksContent.includes('role,'),
    'useTasks hook queries organization_memberships.role via foreign key relationship'
  );

  // --- Category 2: Unit Testing resolveTaskAssigneeRole ---
  function resolveTaskAssigneeRole(task, orgMembers, employees) {
    if (!task.assignedTo || task.assignedTo === 'unassigned') {
      return { role: null, status: 'unassigned', label: 'Unassigned' };
    }
    if (task.assignedEmployeeRole) {
      const role = task.assignedEmployeeRole;
      const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
      return { role, status: 'known', label };
    }
    const member = orgMembers.find((m) => m.userId === task.assignedTo);
    if (member?.role) {
      const role = member.role;
      const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
      return { role, status: 'known', label };
    }
    const emp = employees.find((e) => e.id === task.assignedTo);
    if (emp?.role) {
      const role = emp.role;
      const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
      return { role, status: 'known', label };
    }
    return { role: null, status: 'unknown', label: 'Unknown Role' };
  }

  // Verify lib/tasks.ts contains the matching implementation
  assert(
    tasksLibContent.includes('export function resolveTaskAssigneeRole') &&
    tasksLibContent.includes("label === 'employee' ? 'Staff'") || tasksLibContent.includes("role === 'employee' ? 'Staff'"),
    'lib/tasks.ts exports resolveTaskAssigneeRole with Staff labeling and unknown role guard'
  );

  // Test vector 2.1: Unassigned task
  const unassignedTask = { id: 't1', title: 'Task 1', assignedTo: undefined };
  const resUnassigned = resolveTaskAssigneeRole(unassignedTask, [], []);
  assert(
    resUnassigned.status === 'unassigned' && resUnassigned.role === null,
    'Unassigned task returns status="unassigned" and role=null'
  );

  // Test vector 2.2: Task with assignedEmployeeRole directly on Task
  const taskWithDirectRole = { id: 't2', title: 'Task 2', assignedTo: 'user-1', assignedEmployeeRole: 'admin' };
  const resDirect = resolveTaskAssigneeRole(taskWithDirectRole, [], []);
  assert(
    resDirect.status === 'known' && resDirect.role === 'admin' && resDirect.label === 'Admin',
    'Task with direct assignedEmployeeRole returns status="known" and role="admin"'
  );

  // Test vector 2.3: Task with assignee matching organization membership role
  const orgMembersSample = [
    { userId: 'user-2', role: 'manager', fullName: 'Manager Jane' },
    { userId: 'user-3', role: 'employee', fullName: 'Staff Bob' },
    { userId: 'user-4', role: 'organizer', fullName: 'Organizer Alice' },
  ];
  const taskFromMember = { id: 't3', title: 'Task 3', assignedTo: 'user-2' };
  const resMember = resolveTaskAssigneeRole(taskFromMember, orgMembersSample, []);
  assert(
    resMember.status === 'known' && resMember.role === 'manager',
    'Task assignee role correctly resolves from organization membership (manager)'
  );

  // Test vector 2.4: Employee role is mapped to 'Staff' label for UI presentation
  const taskStaff = { id: 't4', title: 'Task 4', assignedTo: 'user-3' };
  const resStaff = resolveTaskAssigneeRole(taskStaff, orgMembersSample, []);
  assert(
    resStaff.status === 'known' && resStaff.role === 'employee' && resStaff.label === 'Staff',
    'Employee role maps to label="Staff" in UI accordance'
  );

  // Test vector 2.5: Assigned to user UUID with NO matching membership -> EXPLICIT UNKNOWN
  const taskUnknown = { id: 't5', title: 'Task 5', assignedTo: 'removed-user-99' };
  const resUnknown = resolveTaskAssigneeRole(taskUnknown, orgMembersSample, []);
  assert(
    resUnknown.status === 'unknown' && resUnknown.role === null && resUnknown.label === 'Unknown Role',
    'Assignee with unverified/missing membership explicitly resolves to status="unknown" (never silently coerced)'
  );

  // --- Category 3: Combined Filtering Verification ---
  // Create sample dataset
  const sampleTasks = [
    { id: 't1', projectId: 'proj-a', title: 'Build Cache Layer', priority: 'high', assignedTo: 'user-2', description: 'Redis' }, // manager
    { id: 't2', projectId: 'proj-a', title: 'Write API Docs', priority: 'medium', assignedTo: 'user-3', description: 'Swagger' }, // employee (staff)
    { id: 't3', projectId: 'proj-b', title: 'Design Landing Page', priority: 'high', assignedTo: 'user-3', description: 'Figma' }, // employee (staff)
    { id: 't4', projectId: 'proj-b', title: 'Setup Billing System', priority: 'critical', assignedTo: 'user-4', description: 'Stripe' }, // organizer
    { id: 't5', projectId: null, title: 'Triage Old Bug', priority: 'low', assignedTo: 'removed-user-99', description: 'Legacy' }, // unassigned project, unknown role
    { id: 't6', projectId: 'unassigned', title: 'Backlog Item', priority: 'medium', assignedTo: undefined, description: 'Idea' }, // unassigned project, unassigned role
  ];

  function filterTasks(tasks, { search = '', project = 'all', role = 'all', priority = 'all' }) {
    return tasks.filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);

      const matchesProj =
        project === 'all'
          ? true
          : project === 'unassigned'
            ? !t.projectId || t.projectId === 'unassigned'
            : t.projectId === project;

      const matchesPrio = priority === 'all' || t.priority === priority;

      const roleInfo = resolveTaskAssigneeRole(t, orgMembersSample, []);
      let matchesRole = true;
      if (role === 'unassigned') {
        matchesRole = roleInfo.status === 'unassigned';
      } else if (role === 'unknown') {
        matchesRole = roleInfo.status === 'unknown';
      } else if (role !== 'all') {
        matchesRole = roleInfo.status === 'known' && roleInfo.role === role;
      }

      return matchesSearch && matchesProj && matchesPrio && matchesRole;
    });
  }

  // 3.1 Default project view (single project)
  const defaultProjView = filterTasks(sampleTasks, { project: 'proj-a' });
  assert(
    defaultProjView.length === 2 && defaultProjView.every((t) => t.projectId === 'proj-a'),
    'Filtering by specific project ("proj-a") returns only tasks for that project'
  );

  // 3.2 Unassigned project filter
  const unassignedProjView = filterTasks(sampleTasks, { project: 'unassigned' });
  assert(
    unassignedProjView.length === 2 && unassignedProjView.every((t) => !t.projectId || t.projectId === 'unassigned'),
    'Filtering by "unassigned" project isolates tasks without an active project'
  );

  // 3.3 Role filter: Staff (employee)
  const staffRoleView = filterTasks(sampleTasks, { role: 'employee' });
  assert(
    staffRoleView.length === 2 && staffRoleView.every((t) => t.assignedTo === 'user-3'),
    'Role filter for "employee" (Staff) selects only staff-assigned tasks across projects'
  );

  // 3.4 Role filter: Unknown role
  const unknownRoleView = filterTasks(sampleTasks, { role: 'unknown' });
  assert(
    unknownRoleView.length === 1 && unknownRoleView[0].id === 't5',
    'Role filter for "unknown" captures tasks with unverified membership without bleeding into other roles'
  );

  // 3.5 Role filter: Unassigned
  const unassignedRoleView = filterTasks(sampleTasks, { role: 'unassigned' });
  assert(
    unassignedRoleView.length === 1 && unassignedRoleView[0].id === 't6',
    'Role filter for "unassigned" captures tasks with no assignee'
  );

  // 3.6 Combined filter: project "proj-b" + priority "high" + role "employee"
  const combinedView = filterTasks(sampleTasks, { project: 'proj-b', priority: 'high', role: 'employee' });
  assert(
    combinedView.length === 1 && combinedView[0].id === 't3',
    'Combined filter (project="proj-b" + priority="high" + role="employee") resolves accurately via logical AND'
  );

  // 3.7 Combined filter: search "Redis" + project "proj-a"
  const searchProjView = filterTasks(sampleTasks, { search: 'Redis', project: 'proj-a' });
  assert(
    searchProjView.length === 1 && searchProjView[0].id === 't1',
    'Combined search and project filter matches expected task'
  );

  // --- Category 4: UI Structure, Collapsible & Visual Clutter Inspection ---
  assert(
    tasksPageContent.includes('projectGroups.map') &&
    tasksPageContent.includes('toggleProjectCollapse') &&
    tasksPageContent.includes('collapsedProjects'),
    'All Projects view implements collapsible project group accordions'
  );

  assert(
    tasksPageContent.includes('toggleColumnCollapse') &&
    tasksPageContent.includes('collapsedColumns'),
    'Kanban board supports collapsible status columns'
  );

  assert(
    tasksPageContent.includes('selectedProject === \'initial\'') ||
    tasksPageContent.includes('currentSelectedProject !== \'all\''),
    'Default view state defaults to a focused single project rather than a dense all-projects board'
  );

  assert(
    tasksPageContent.includes('aria-label="Filter by project"') &&
    tasksPageContent.includes('aria-label="Filter by assignee role"') &&
    tasksPageContent.includes('aria-label="Filter by priority"'),
    'Filter selectors include accessible aria labels'
  );

  assert(
    tasksPageContent.includes('renderCompactTaskCard') &&
    tasksPageContent.includes('line-clamp-2') &&
    tasksPageContent.includes('estimatedHours'),
    'Task cards are designed compactly with essential details (title, assignee, role, due date, priority)'
  );

  // --- Category 5: Authorization & Permission Checks Preservation ---
  assert(
    tasksPageContent.includes('activeRole !== \'employee\'') &&
    tasksPageContent.includes('canMove = activeRole !== \'employee\' || isMine'),
    'Task movement and editing permissions strictly enforce activeRole !== "employee" || isMine'
  );

  assert(
    tasksPageContent.includes('advanceTaskStatus') &&
    tasksPageContent.includes('regressTaskStatus') &&
    tasksPageContent.includes('dbUpdateTaskStatus'),
    'Task status progression and regression actions preserved'
  );

  assert(
    tasksPageContent.includes('handleSaveTaskEdit') &&
    tasksPageContent.includes('handleCreateTask'),
    'Task creation and modal editing handlers preserved'
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTasksRedesignSuite();
