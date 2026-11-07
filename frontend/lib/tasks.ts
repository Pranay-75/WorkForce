import { Task, UserRole, OrganizationMember, Employee } from '@/lib/types';

export type RoleFilterValue = 'all' | UserRole | 'unassigned' | 'unknown';

/**
 * Resolves the assignee role strictly within the currently selected organization.
 * Distinguishes known roles, unassigned tasks, and indeterminate/unknown roles.
 */
export function resolveTaskAssigneeRole(
  task: Task,
  orgMembers: OrganizationMember[],
  employees: Employee[]
): {
  role: UserRole | null;
  status: 'unassigned' | 'known' | 'unknown';
  label: string;
} {
  if (!task.assignedTo || task.assignedTo === 'unassigned') {
    return { role: null, status: 'unassigned', label: 'Unassigned' };
  }

  // 1. Direct role from membership record if present
  if (task.assignedEmployeeRole) {
    const role = task.assignedEmployeeRole;
    const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
    return { role, status: 'known', label };
  }

  // 2. Organization members map (organization-specific membership role)
  const member = orgMembers.find((m) => m.userId === task.assignedTo);
  if (member?.role) {
    const role = member.role;
    const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
    return { role, status: 'known', label };
  }

  // 3. Fallback to mock employees if in demo/mock mode
  const emp = employees.find((e) => e.id === task.assignedTo);
  if (emp?.role) {
    const role = emp.role;
    const label = role === 'employee' ? 'Staff' : role.charAt(0).toUpperCase() + role.slice(1);
    return { role, status: 'known', label };
  }

  // 4. Assigned to a user ID, but membership role cannot be verified
  return { role: null, status: 'unknown', label: 'Unknown Role' };
}

