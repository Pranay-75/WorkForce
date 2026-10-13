export type UserRole = 'admin' | 'manager' | 'employee';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'blocked';
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'overridden';
export type NotificationType = 'task_assigned' | 'recommendation_ready' | 'capacity_alert' | 'deadline_warning';

export interface Skill {
  id: string;
  name: string;
  category: 'Frontend' | 'Backend' | 'Design' | 'DevOps' | 'QA' | 'Management';
}

export interface EmployeeSkill {
  skillId: string;
  skillName: string;
  category: string;
  proficiency: SkillLevel;
  verified: boolean;
}

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: UserRole;
  department: 'Engineering' | 'Design' | 'Product' | 'QA' | 'DevOps';
  jobTitle: string;
  weeklyCapacityHours: number;
  currentLoadHours: number;
  burnoutRiskScore: number; // 0.0 to 1.0 (operational scheduling risk)
  skills: EmployeeSkill[];
  activeTaskCount: number;
  onTimeCompletionRate: number; // percentage
  location: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  startDate: string;
  targetEndDate: string;
  managerId: string;
  managerName: string;
  memberIds: string[];
  totalHours: number;
  completedHours: number;
}

export interface TaskSkillPrerequisite {
  skillId: string;
  skillName: string;
  minProficiency: SkillLevel;
}

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedHours: number;
  dueDate: string;
  assignedTo?: string; // employeeId
  assignedEmployeeName?: string;
  assignedEmployeeAvatar?: string;
  requiredSkills: TaskSkillPrerequisite[];
  createdAt: string;
}

export interface MatchedSkill {
  skill: string;
  requiredLevel: SkillLevel;
  candidateLevel: SkillLevel;
}

export interface AIRecommendation {
  id: string;
  taskId: string;
  taskTitle: string;
  candidateId: string;
  candidateName: string;
  candidateTitle: string;
  candidateDepartment: string;
  candidateAvatar?: string;
  matchScore: number; // 0 to 100
  skillMatchBreakdown: {
    matchedSkills: MatchedSkill[];
    missingSkills: string[];
    skillScore: number;
  };
  workloadImpact: {
    currentLoadHours: number;
    taskEstimatedHours: number;
    projectedLoadHours: number;
    weeklyCapacityHours: number;
    projectedUtilizationPct: number;
  };
  rationale: string;
  riskFactors: string[];
  status: RecommendationStatus;
  decisionReason?: string;
}

export interface WorkloadRedistributionProposal {
  id: string;
  taskId: string;
  taskTitle: string;
  taskHours: number;
  sourceEmployeeId: string;
  sourceEmployeeName: string;
  sourceCurrentLoad: number;
  sourceProjectedLoad: number;
  targetEmployeeId: string;
  targetEmployeeName: string;
  targetCurrentLoad: number;
  targetProjectedLoad: number;
  rationale: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: 'Task' | 'Recommendation' | 'Employee' | 'Project' | 'Workload';
  entityId: string;
  entityTitle: string;
  details: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string;
  isRead: boolean;
  timestamp: string;
}

export interface OrganizationMember {
  id: string; // membership id
  membershipId: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  status: 'active' | 'invited' | 'suspended';
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  department: string;
  jobTitle: string;
  weeklyCapacityHours: number;
  joinedAt: string;
}

export interface DepartmentSummary {
  department: string;
  headcount: number;
  totalCapacityHours: number;
}

