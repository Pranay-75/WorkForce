import {
  Employee,
  Project,
  Task,
  AIRecommendation,
  WorkloadRedistributionProposal,
  AuditEvent,
  NotificationItem,
  Skill,
  SkillLevel,
} from './types';

export const initialSkills: Skill[] = [
  { id: 's1', name: 'React', category: 'Frontend' },
  { id: 's2', name: 'TypeScript', category: 'Frontend' },
  { id: 's3', name: 'Tailwind CSS', category: 'Frontend' },
  { id: 's4', name: 'Next.js', category: 'Frontend' },
  { id: 's5', name: 'Python', category: 'Backend' },
  { id: 's6', name: 'FastAPI', category: 'Backend' },
  { id: 's7', name: 'PostgreSQL', category: 'Backend' },
  { id: 's8', name: 'Redis', category: 'Backend' },
  { id: 's9', name: 'Docker', category: 'DevOps' },
  { id: 's10', name: 'Kubernetes', category: 'DevOps' },
  { id: 's11', name: 'AWS', category: 'DevOps' },
  { id: 's12', name: 'Figma', category: 'Design' },
  { id: 's13', name: 'Design Systems', category: 'Design' },
  { id: 's14', name: 'UI/UX Research', category: 'Design' },
  { id: 's15', name: 'Playwright / E2E', category: 'QA' },
  { id: 's16', name: 'Pytest', category: 'QA' },
];

export const initialEmployees: Employee[] = [
  {
    id: 'emp-1',
    email: 'sarah.connor@acme.corp',
    fullName: 'Sarah Connor',
    role: 'manager',
    department: 'Engineering',
    jobTitle: 'Engineering Lead & Architect',
    weeklyCapacityHours: 40,
    currentLoadHours: 28,
    burnoutRiskScore: 0.22,
    activeTaskCount: 2,
    onTimeCompletionRate: 98,
    location: 'San Francisco, CA (PST)',
    skills: [
      { skillId: 's5', skillName: 'Python', category: 'Backend', proficiency: 'expert', verified: true },
      { skillId: 's6', skillName: 'FastAPI', category: 'Backend', proficiency: 'expert', verified: true },
      { skillId: 's7', skillName: 'PostgreSQL', category: 'Backend', proficiency: 'advanced', verified: true },
      { skillId: 's9', skillName: 'Docker', category: 'DevOps', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-2',
    email: 'alex.chen@acme.corp',
    fullName: 'Alex Chen',
    role: 'employee',
    department: 'Engineering',
    jobTitle: 'Senior Frontend Engineer',
    weeklyCapacityHours: 40,
    currentLoadHours: 32,
    burnoutRiskScore: 0.38,
    activeTaskCount: 3,
    onTimeCompletionRate: 94,
    location: 'New York, NY (EST)',
    skills: [
      { skillId: 's1', skillName: 'React', category: 'Frontend', proficiency: 'expert', verified: true },
      { skillId: 's2', skillName: 'TypeScript', category: 'Frontend', proficiency: 'expert', verified: true },
      { skillId: 's3', skillName: 'Tailwind CSS', category: 'Frontend', proficiency: 'advanced', verified: true },
      { skillId: 's4', skillName: 'Next.js', category: 'Frontend', proficiency: 'advanced', verified: true },
    ],
  },
  {
    id: 'emp-3',
    email: 'david.kim@acme.corp',
    fullName: 'David Kim',
    role: 'employee',
    department: 'Engineering',
    jobTitle: 'Principal Backend Engineer',
    weeklyCapacityHours: 40,
    currentLoadHours: 46, // OVERLOADED (>100%)
    burnoutRiskScore: 0.88,
    activeTaskCount: 4,
    onTimeCompletionRate: 85,
    location: 'Seattle, WA (PST)',
    skills: [
      { skillId: 's5', skillName: 'Python', category: 'Backend', proficiency: 'expert', verified: true },
      { skillId: 's7', skillName: 'PostgreSQL', category: 'Backend', proficiency: 'expert', verified: true },
      { skillId: 's8', skillName: 'Redis', category: 'Backend', proficiency: 'advanced', verified: true },
      { skillId: 's10', skillName: 'Kubernetes', category: 'DevOps', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-4',
    email: 'elena.rostova@acme.corp',
    fullName: 'Elena Rostova',
    role: 'employee',
    department: 'Design',
    jobTitle: 'Staff UI/UX Designer',
    weeklyCapacityHours: 40,
    currentLoadHours: 22, // AVAILABLE (55%)
    burnoutRiskScore: 0.15,
    activeTaskCount: 2,
    onTimeCompletionRate: 96,
    location: 'Austin, TX (CST)',
    skills: [
      { skillId: 's12', skillName: 'Figma', category: 'Design', proficiency: 'expert', verified: true },
      { skillId: 's13', skillName: 'Design Systems', category: 'Design', proficiency: 'expert', verified: true },
      { skillId: 's14', skillName: 'UI/UX Research', category: 'Design', proficiency: 'advanced', verified: true },
      { skillId: 's3', skillName: 'Tailwind CSS', category: 'Frontend', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-5',
    email: 'marcus.vance@acme.corp',
    fullName: 'Marcus Vance',
    role: 'employee',
    department: 'DevOps',
    jobTitle: 'Senior Cloud & Infrastructure Engineer',
    weeklyCapacityHours: 40,
    currentLoadHours: 36,
    burnoutRiskScore: 0.45,
    activeTaskCount: 2,
    onTimeCompletionRate: 91,
    location: 'Chicago, IL (CST)',
    skills: [
      { skillId: 's9', skillName: 'Docker', category: 'DevOps', proficiency: 'expert', verified: true },
      { skillId: 's10', skillName: 'Kubernetes', category: 'DevOps', proficiency: 'expert', verified: true },
      { skillId: 's11', skillName: 'AWS', category: 'DevOps', proficiency: 'expert', verified: true },
      { skillId: 's5', skillName: 'Python', category: 'Backend', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-6',
    email: 'priya.patel@acme.corp',
    fullName: 'Priya Patel',
    role: 'employee',
    department: 'Engineering',
    jobTitle: 'Full-Stack Software Engineer',
    weeklyCapacityHours: 40,
    currentLoadHours: 18, // HIGH AVAILABILITY (45%)
    burnoutRiskScore: 0.12,
    activeTaskCount: 1,
    onTimeCompletionRate: 100,
    location: 'Toronto, ON (EST)',
    skills: [
      { skillId: 's1', skillName: 'React', category: 'Frontend', proficiency: 'advanced', verified: true },
      { skillId: 's2', skillName: 'TypeScript', category: 'Frontend', proficiency: 'advanced', verified: true },
      { skillId: 's5', skillName: 'Python', category: 'Backend', proficiency: 'intermediate', verified: true },
      { skillId: 's6', skillName: 'FastAPI', category: 'Backend', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-7',
    email: 'jordan.lee@acme.corp',
    fullName: 'Jordan Lee',
    role: 'employee',
    department: 'QA',
    jobTitle: 'Senior Automation Test Engineer',
    weeklyCapacityHours: 40,
    currentLoadHours: 26,
    burnoutRiskScore: 0.28,
    activeTaskCount: 2,
    onTimeCompletionRate: 93,
    location: 'Vancouver, BC (PST)',
    skills: [
      { skillId: 's15', skillName: 'Playwright / E2E', category: 'QA', proficiency: 'expert', verified: true },
      { skillId: 's16', skillName: 'Pytest', category: 'QA', proficiency: 'expert', verified: true },
      { skillId: 's2', skillName: 'TypeScript', category: 'Frontend', proficiency: 'intermediate', verified: true },
      { skillId: 's5', skillName: 'Python', category: 'Backend', proficiency: 'intermediate', verified: true },
    ],
  },
  {
    id: 'emp-8',
    email: 'chloe.dubois@acme.corp',
    fullName: 'Chloe Dubois',
    role: 'admin',
    department: 'Product',
    jobTitle: 'VP of Operations & Talent',
    weeklyCapacityHours: 40,
    currentLoadHours: 20,
    burnoutRiskScore: 0.18,
    activeTaskCount: 1,
    onTimeCompletionRate: 97,
    location: 'San Francisco, CA (PST)',
    skills: [
      { skillId: 's14', skillName: 'UI/UX Research', category: 'Design', proficiency: 'expert', verified: true },
      { skillId: 's12', skillName: 'Figma', category: 'Design', proficiency: 'intermediate', verified: true },
    ],
  },
];

export const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Customer Portal Redesign v2',
    description: 'Next-generation customer account portal with self-service analytics and billing dashboards.',
    status: 'in_progress',
    priority: 'critical',
    startDate: '2026-09-15',
    targetEndDate: '2026-11-30',
    managerId: 'emp-1',
    managerName: 'Sarah Connor',
    memberIds: ['emp-1', 'emp-2', 'emp-4', 'emp-6'],
    totalHours: 240,
    completedHours: 110,
  },
  {
    id: 'proj-2',
    name: 'AI Realtime Ingestion Engine',
    description: 'High-throughput stream processing pipeline integrating FastAPI with vector databases and Gemini LLMs.',
    status: 'in_progress',
    priority: 'high',
    startDate: '2026-10-01',
    targetEndDate: '2026-12-15',
    managerId: 'emp-1',
    managerName: 'Sarah Connor',
    memberIds: ['emp-1', 'emp-3', 'emp-5'],
    totalHours: 320,
    completedHours: 85,
  },
  {
    id: 'proj-3',
    name: 'Mobile SDK 3.0 Release',
    description: 'Universal cross-platform SDK for iOS/Android enterprise customers with offline synchronization.',
    status: 'planning',
    priority: 'medium',
    startDate: '2026-11-01',
    targetEndDate: '2027-01-20',
    managerId: 'emp-1',
    managerName: 'Sarah Connor',
    memberIds: ['emp-2', 'emp-6', 'emp-7'],
    totalHours: 180,
    completedHours: 20,
  },
  {
    id: 'proj-4',
    name: 'SOC2 Security & RBAC Hardening',
    description: 'Comprehensive Row-Level Security audit, cryptographic key rotation, and automated compliance logging.',
    status: 'in_progress',
    priority: 'critical',
    startDate: '2026-09-20',
    targetEndDate: '2026-10-31',
    managerId: 'emp-8',
    managerName: 'Chloe Dubois',
    memberIds: ['emp-3', 'emp-5', 'emp-7'],
    totalHours: 150,
    completedHours: 95,
  },
];

export const initialTasks: Task[] = [
  {
    id: 'task-101',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Build Interactive Workload Heatmap Component',
    description: 'Develop a responsive SVG/Canvas grid visualizing team capacity across 8-week lookaheads with dynamic hover tooltips.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'High',
    estimatedHours: 12,
    dueDate: '2026-10-16',
    assignedTo: 'emp-2',
    assignedEmployeeName: 'Alex Chen',
    assignedEmployeeAvatar: 'AC',
    requiredSkills: [
      { skillId: 's1', skillName: 'React', minProficiency: 'expert' },
      { skillId: 's2', skillName: 'TypeScript', minProficiency: 'advanced' },
      { skillId: 's3', skillName: 'Tailwind CSS', minProficiency: 'intermediate' },
    ],
    createdAt: '2026-10-02',
  },
  {
    id: 'task-102',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Audit & Standardize UI Design Tokens',
    description: 'Refactor component library color tokens, shadows, and typography scales in Figma and Tailwind configuration.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 8,
    dueDate: '2026-10-18',
    assignedTo: 'emp-4',
    assignedEmployeeName: 'Elena Rostova',
    assignedEmployeeAvatar: 'ER',
    requiredSkills: [
      { skillId: 's12', skillName: 'Figma', minProficiency: 'expert' },
      { skillId: 's13', skillName: 'Design Systems', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-03',
  },
  {
    id: 'task-103',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Optimize PostgreSQL Vector Index Queries',
    description: 'Implement pgvector cosine similarity tuning and query plan caching for high-concurrency match lookups.',
    status: 'in_progress',
    priority: 'critical',
    complexity: 'High',
    estimatedHours: 16,
    dueDate: '2026-10-15',
    assignedTo: 'emp-3',
    assignedEmployeeName: 'David Kim',
    assignedEmployeeAvatar: 'DK',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'expert' },
      { skillId: 's7', skillName: 'PostgreSQL', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-01',
  },
  {
    id: 'task-104',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Design Async Gemini Batch Ingestion Worker',
    description: 'Build robust background worker with exponential backoff retry logic and dead-letter queue for Gemini API prompts.',
    status: 'todo', // UNASSIGNED - PERFECT CANDIDATE FOR AI MATCHING
    priority: 'high',
    complexity: 'High',
    estimatedHours: 10,
    dueDate: '2026-10-22',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'advanced' },
      { skillId: 's6', skillName: 'FastAPI', minProficiency: 'intermediate' },
      { skillId: 's8', skillName: 'Redis', minProficiency: 'intermediate' },
    ],
    createdAt: '2026-10-05',
  },
  {
    id: 'task-105',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Containerize Microservices with Helm Charts',
    description: 'Author production Kubernetes manifests, horizontal pod autoscalers, and Helm values for staging and production.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 14,
    dueDate: '2026-10-24',
    assignedTo: 'emp-5',
    assignedEmployeeName: 'Marcus Vance',
    assignedEmployeeAvatar: 'MV',
    requiredSkills: [
      { skillId: 's9', skillName: 'Docker', minProficiency: 'expert' },
      { skillId: 's10', skillName: 'Kubernetes', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-04',
  },
  {
    id: 'task-106',
    projectId: 'proj-4',
    projectName: 'SOC2 Security & RBAC Hardening',
    title: 'Implement Automated End-to-End Auth Regression Suite',
    description: 'Write Playwright test specifications validating role boundaries (Admin vs Manager vs Employee) and RLS leakage prevention.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'Medium',
    estimatedHours: 12,
    dueDate: '2026-10-19',
    assignedTo: 'emp-7',
    assignedEmployeeName: 'Jordan Lee',
    assignedEmployeeAvatar: 'JL',
    requiredSkills: [
      { skillId: 's15', skillName: 'Playwright / E2E', minProficiency: 'advanced' },
      { skillId: 's2', skillName: 'TypeScript', minProficiency: 'intermediate' },
    ],
    createdAt: '2026-10-02',
  },
  {
    id: 'task-107',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Stripe Billing Webhook Handler & Invoice Generator',
    description: 'Handle subscription downgrade/upgrade webhooks and generate PDF invoice summaries.',
    status: 'in_review',
    priority: 'high',
    complexity: 'Medium',
    estimatedHours: 8,
    dueDate: '2026-10-14',
    assignedTo: 'emp-6',
    assignedEmployeeName: 'Priya Patel',
    assignedEmployeeAvatar: 'PP',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'intermediate' },
      { skillId: 's6', skillName: 'FastAPI', minProficiency: 'intermediate' },
    ],
    createdAt: '2026-10-03',
  },
  {
    id: 'task-108',
    projectId: 'proj-4',
    projectName: 'SOC2 Security & RBAC Hardening',
    title: 'Rotate Master Cryptographic Service Keys',
    description: 'Audit production secret vault and execute key rotation across all backend staging and production runners.',
    status: 'completed',
    priority: 'critical',
    complexity: 'High',
    estimatedHours: 8,
    dueDate: '2026-10-08',
    assignedTo: 'emp-3',
    assignedEmployeeName: 'David Kim',
    assignedEmployeeAvatar: 'DK',
    requiredSkills: [
      { skillId: 's11', skillName: 'AWS', minProficiency: 'advanced' },
    ],
    createdAt: '2026-09-28',
  },
  {
    id: 'task-109',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Architect Multi-Tenant Row-Level Security Policies',
    description: 'Author and verify PostgreSQL RLS tenant boundary constraints and JWT claims validation.',
    status: 'in_progress',
    priority: 'critical',
    complexity: 'High',
    estimatedHours: 20,
    dueDate: '2026-10-28',
    assignedTo: 'emp-1',
    assignedEmployeeName: 'Sarah Connor',
    assignedEmployeeAvatar: 'SC',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'expert' },
      { skillId: 's7', skillName: 'PostgreSQL', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-01',
  },
  {
    id: 'task-110',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Lead Architecture & Code Review Session',
    description: 'Conduct comprehensive sprint review and approve pull requests across backend and frontend teams.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 8,
    dueDate: '2026-10-25',
    assignedTo: 'emp-1',
    assignedEmployeeName: 'Sarah Connor',
    assignedEmployeeAvatar: 'SC',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-04',
  },
  {
    id: 'task-111',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Implement Responsive Navigation Drawer & Mobile Shell',
    description: 'Ensure smooth collapsible navigation with touch gestures and accessible ARIA attributes.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'Medium',
    estimatedHours: 12,
    dueDate: '2026-10-20',
    assignedTo: 'emp-2',
    assignedEmployeeName: 'Alex Chen',
    assignedEmployeeAvatar: 'AC',
    requiredSkills: [
      { skillId: 's1', skillName: 'React', minProficiency: 'advanced' },
      { skillId: 's3', skillName: 'Tailwind CSS', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-02',
  },
  {
    id: 'task-112',
    projectId: 'proj-3',
    projectName: 'Mobile SDK 3.0 Release',
    title: 'Optimize Next.js Client Bundle Code-Splitting',
    description: 'Reduce initial page payload by dynamically importing heavy charting modules.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 8,
    dueDate: '2026-10-26',
    assignedTo: 'emp-2',
    assignedEmployeeName: 'Alex Chen',
    assignedEmployeeAvatar: 'AC',
    requiredSkills: [
      { skillId: 's2', skillName: 'TypeScript', minProficiency: 'advanced' },
      { skillId: 's4', skillName: 'Next.js', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-05',
  },
  {
    id: 'task-113',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Write Write-Ahead Log Partitioning Engine',
    description: 'Design distributed WAL replay mechanism with zero-data-loss durability guarantees.',
    status: 'in_progress',
    priority: 'critical',
    complexity: 'High',
    estimatedHours: 18,
    dueDate: '2026-10-21',
    assignedTo: 'emp-3',
    assignedEmployeeName: 'David Kim',
    assignedEmployeeAvatar: 'DK',
    requiredSkills: [
      { skillId: 's5', skillName: 'Python', minProficiency: 'expert' },
      { skillId: 's7', skillName: 'PostgreSQL', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-01',
  },
  {
    id: 'task-114',
    projectId: 'proj-4',
    projectName: 'SOC2 Security & RBAC Hardening',
    title: 'Redis Cluster Failover Benchmark & Hardening',
    description: 'Simulate network split-brain scenarios and configure Sentinel quorum failover thresholds.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'High',
    estimatedHours: 12,
    dueDate: '2026-10-27',
    assignedTo: 'emp-3',
    assignedEmployeeName: 'David Kim',
    assignedEmployeeAvatar: 'DK',
    requiredSkills: [
      { skillId: 's8', skillName: 'Redis', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-03',
  },
  {
    id: 'task-115',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Design System Accessibility & Contrast Audit',
    description: 'Audit WCAG 2.1 AA compliance across all primary UI components, color palettes, and focus rings.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 14,
    dueDate: '2026-10-23',
    assignedTo: 'emp-4',
    assignedEmployeeName: 'Elena Rostova',
    assignedEmployeeAvatar: 'ER',
    requiredSkills: [
      { skillId: 's13', skillName: 'Design Systems', minProficiency: 'expert' },
      { skillId: 's14', skillName: 'UI/UX Research', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-04',
  },
  {
    id: 'task-116',
    projectId: 'proj-2',
    projectName: 'AI Realtime Ingestion Engine',
    title: 'Terraform AWS EKS Cluster Provisioning',
    description: 'Author Infrastructure as Code for multi-AZ Kubernetes cluster with auto-scaling node groups.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'High',
    estimatedHours: 22,
    dueDate: '2026-10-29',
    assignedTo: 'emp-5',
    assignedEmployeeName: 'Marcus Vance',
    assignedEmployeeAvatar: 'MV',
    requiredSkills: [
      { skillId: 's11', skillName: 'AWS', minProficiency: 'expert' },
      { skillId: 's10', skillName: 'Kubernetes', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-02',
  },
  {
    id: 'task-117',
    projectId: 'proj-1',
    projectName: 'Customer Portal Redesign v2',
    title: 'Frontend GraphQL Query Caching & Batching',
    description: 'Implement Apollo Client normalized cache normalization and optimistic UI updates.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 10,
    dueDate: '2026-10-22',
    assignedTo: 'emp-6',
    assignedEmployeeName: 'Priya Patel',
    assignedEmployeeAvatar: 'PP',
    requiredSkills: [
      { skillId: 's1', skillName: 'React', minProficiency: 'advanced' },
      { skillId: 's2', skillName: 'TypeScript', minProficiency: 'advanced' },
    ],
    createdAt: '2026-10-03',
  },
  {
    id: 'task-118',
    projectId: 'proj-4',
    projectName: 'SOC2 Security & RBAC Hardening',
    title: 'Pytest Automated Regression Suite for FastAPIs',
    description: 'Write comprehensive integration tests covering all RBAC permission matrix permutations.',
    status: 'in_progress',
    priority: 'high',
    complexity: 'Medium',
    estimatedHours: 14,
    dueDate: '2026-10-24',
    assignedTo: 'emp-7',
    assignedEmployeeName: 'Jordan Lee',
    assignedEmployeeAvatar: 'JL',
    requiredSkills: [
      { skillId: 's16', skillName: 'Pytest', minProficiency: 'expert' },
      { skillId: 's5', skillName: 'Python', minProficiency: 'intermediate' },
    ],
    createdAt: '2026-10-02',
  },
  {
    id: 'task-119',
    projectId: 'proj-3',
    projectName: 'Mobile SDK 3.0 Release',
    title: 'Sprint Capacity & Quarterly Roadmap Review',
    description: 'Evaluate cross-team velocity benchmarks, align dependencies, and finalize resource allocation.',
    status: 'in_progress',
    priority: 'medium',
    complexity: 'Medium',
    estimatedHours: 20,
    dueDate: '2026-10-30',
    assignedTo: 'emp-8',
    assignedEmployeeName: 'Chloe Dubois',
    assignedEmployeeAvatar: 'CD',
    requiredSkills: [
      { skillId: 's14', skillName: 'UI/UX Research', minProficiency: 'expert' },
    ],
    createdAt: '2026-10-01',
  },
];

export const initialAIRecommendations: AIRecommendation[] = [
  {
    id: 'rec-1',
    taskId: 'task-104',
    taskTitle: 'Design Async Gemini Batch Ingestion Worker',
    candidateId: 'emp-6',
    candidateName: 'Priya Patel',
    candidateTitle: 'Full-Stack Software Engineer',
    candidateDepartment: 'Engineering',
    candidateAvatar: 'PP',
    matchScore: 94.5,
    skillMatchBreakdown: {
      matchedSkills: [
        { skill: 'Python', requiredLevel: 'advanced', candidateLevel: 'intermediate' },
        { skill: 'FastAPI', requiredLevel: 'intermediate', candidateLevel: 'intermediate' },
      ],
      missingSkills: ['Redis (basic familiarity)'],
      skillScore: 92.0,
    },
    workloadImpact: {
      currentLoadHours: 18,
      taskEstimatedHours: 10,
      projectedLoadHours: 28,
      weeklyCapacityHours: 40,
      projectedUtilizationPct: 70.0,
    },
    rationale:
      'Priya is the prime candidate. She currently possesses substantial availability (only 18h allocated of 40h capacity) and proven competence in Python and FastAPI. Assigning this 10-hour task raises her utilization to a balanced 70% with zero deadline collisions before Oct 22.',
    riskFactors: [
      'Priya is intermediate in Redis, but backend lead Sarah Connor is available for pairing.',
    ],
    status: 'pending',
  },
  {
    id: 'rec-2',
    taskId: 'task-104',
    taskTitle: 'Design Async Gemini Batch Ingestion Worker',
    candidateId: 'emp-1',
    candidateName: 'Sarah Connor',
    candidateTitle: 'Engineering Lead & Architect',
    candidateDepartment: 'Engineering',
    candidateAvatar: 'SC',
    matchScore: 88.0,
    skillMatchBreakdown: {
      matchedSkills: [
        { skill: 'Python', requiredLevel: 'advanced', candidateLevel: 'expert' },
        { skill: 'FastAPI', requiredLevel: 'intermediate', candidateLevel: 'expert' },
        { skill: 'Redis', requiredLevel: 'intermediate', candidateLevel: 'advanced' },
      ],
      missingSkills: [],
      skillScore: 100.0,
    },
    workloadImpact: {
      currentLoadHours: 28,
      taskEstimatedHours: 10,
      projectedLoadHours: 38,
      weeklyCapacityHours: 40,
      projectedUtilizationPct: 95.0,
    },
    rationale:
      'Sarah satisfies 100% of the required technical criteria with expert proficiency. However, assigning 10 additional hours will elevate her weekly capacity to 95%, leaving minimal bandwidth for managerial reviews.',
    riskFactors: [
      'Elevates weekly capacity to 95% (Near Limit warning threshold).',
    ],
    status: 'pending',
  },
  {
    id: 'rec-3',
    taskId: 'task-104',
    taskTitle: 'Design Async Gemini Batch Ingestion Worker',
    candidateId: 'emp-3',
    candidateName: 'David Kim',
    candidateTitle: 'Principal Backend Engineer',
    candidateDepartment: 'Engineering',
    candidateAvatar: 'DK',
    matchScore: 42.0,
    skillMatchBreakdown: {
      matchedSkills: [
        { skill: 'Python', requiredLevel: 'advanced', candidateLevel: 'expert' },
        { skill: 'Redis', requiredLevel: 'intermediate', candidateLevel: 'advanced' },
      ],
      missingSkills: [],
      skillScore: 100.0,
    },
    workloadImpact: {
      currentLoadHours: 46,
      taskEstimatedHours: 10,
      projectedLoadHours: 56,
      weeklyCapacityHours: 40,
      projectedUtilizationPct: 140.0,
    },
    rationale:
      'NOT RECOMMENDED. Although David possesses 100% skill match, he is severely over-allocated at 46h (115% capacity). Assigning this task would push him to 140% utilization, inducing extreme scheduling bottleneck.',
    riskFactors: [
      'CRITICAL: Candidate is already over 100% capacity.',
      'High risk of project milestone delay.',
    ],
    status: 'pending',
  },
];

export const initialRedistributionProposals: WorkloadRedistributionProposal[] = [
  {
    id: 'prop-1',
    taskId: 'task-103',
    taskTitle: 'Optimize PostgreSQL Vector Index Queries',
    taskHours: 16,
    sourceEmployeeId: 'emp-3',
    sourceEmployeeName: 'David Kim',
    sourceCurrentLoad: 46,
    sourceProjectedLoad: 30, // 46 - 16 = 30h (75%)
    targetEmployeeId: 'emp-1',
    targetEmployeeName: 'Sarah Connor',
    targetCurrentLoad: 28,
    targetProjectedLoad: 40, // 28 + 12 (shared/reallocated) = 40h (100%)
    rationale:
      'Transferring vector tuning reduces David Kim from an alarming 115% overload down to a healthy 75% load, preventing imminent milestone burnout.',
  },
  {
    id: 'prop-2',
    taskId: 'task-101',
    taskTitle: 'Build Interactive Workload Heatmap Component',
    taskHours: 12,
    sourceEmployeeId: 'emp-2',
    sourceEmployeeName: 'Alex Chen',
    sourceCurrentLoad: 32,
    sourceProjectedLoad: 26,
    targetEmployeeId: 'emp-6',
    targetEmployeeName: 'Priya Patel',
    targetCurrentLoad: 18,
    targetProjectedLoad: 24,
    rationale:
      'Reallocating frontend sub-components to Priya Patel utilizes her open bandwidth (18h) while keeping Alex Chen well within optimal capacity margins.',
  },
];

export const initialAuditEvents: AuditEvent[] = [
  {
    id: 'aud-1',
    actorId: 'emp-1',
    actorName: 'Sarah Connor (Manager)',
    action: 'Approved AI Recommendation',
    entityType: 'Recommendation',
    entityId: 'rec-1',
    entityTitle: 'Priya Patel -> Async Gemini Batch Ingestion Worker',
    details: 'Manager approved 94.5% match score. 10 hours allocated. Priya load updated to 28h (70%).',
    timestamp: '2026-10-09 18:32 UTC',
  },
  {
    id: 'aud-2',
    actorId: 'emp-1',
    actorName: 'Sarah Connor (Manager)',
    action: 'Created Task',
    entityType: 'Task',
    entityId: 'task-104',
    entityTitle: 'Design Async Gemini Batch Ingestion Worker',
    details: 'Created with 10 estimated hours, high priority, skills: Python, FastAPI, Redis.',
    timestamp: '2026-10-09 17:15 UTC',
  },
  {
    id: 'aud-3',
    actorId: 'emp-3',
    actorName: 'David Kim',
    action: 'Task Status Updated',
    entityType: 'Task',
    entityId: 'task-108',
    entityTitle: 'Rotate Master Cryptographic Service Keys',
    details: 'Status transitioned from in_review -> completed. Capacity freed: 8 hours.',
    timestamp: '2026-10-08 14:02 UTC',
  },
  {
    id: 'aud-4',
    actorId: 'emp-8',
    actorName: 'Chloe Dubois (Admin)',
    action: 'Verified Skill',
    entityType: 'Employee',
    entityId: 'emp-7',
    entityTitle: 'Jordan Lee (QA)',
    details: 'Verified skill: Playwright / E2E at expert proficiency.',
    timestamp: '2026-10-07 11:20 UTC',
  },
];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Capacity Overload Alert',
    message: 'David Kim has exceeded 115% capacity (46h / 40h). Consider running Workload Balancing.',
    type: 'capacity_alert',
    linkUrl: '/workload',
    isRead: false,
    timestamp: '25 mins ago',
  },
  {
    id: 'notif-2',
    title: 'AI Recommendation Ready',
    message: '3 candidates ranked for "Design Async Gemini Batch Ingestion Worker". Top fit: Priya Patel (94.5%).',
    type: 'recommendation_ready',
    linkUrl: '/matching',
    isRead: false,
    timestamp: '1 hour ago',
  },
  {
    id: 'notif-3',
    title: 'Deadline Approaching',
    message: 'Task "Optimize PostgreSQL Vector Index Queries" is due in 5 days.',
    type: 'deadline_warning',
    linkUrl: '/tasks',
    isRead: false,
    timestamp: '3 hours ago',
  },
  {
    id: 'notif-4',
    title: 'Task Assigned',
    message: 'Sarah Connor assigned you to "Audit & Standardize UI Design Tokens".',
    type: 'task_assigned',
    linkUrl: '/tasks',
    isRead: true,
    timestamp: '2 days ago',
  },
];

export interface WorkforceCapacitySummary {
  totalEmployees: number;
  totalCapacityHours: number;
  totalAllocatedHours: number;
  averageUtilizationPct: number;
  overloadedCount: number;
  nearLimitCount: number;
  optimalCount: number;
  overloadedEmployees: Employee[];
  nearLimitEmployees: Employee[];
  optimalEmployees: Employee[];
  departmentBreakdowns: {
    department: string;
    headcount: number;
    allocatedHours: number;
    capacityHours: number;
    utilizationPct: number;
  }[];
}

/**
 * Calculates unified workforce capacity metrics across the synthetic employee dataset.
 * Guarantees mathematical reconciliation between department breakdowns and team totals.
 */
export function calculateWorkforceCapacitySummary(
  employees: Employee[] = initialEmployees
): WorkforceCapacitySummary {
  const totalEmployees = employees.length;
  const totalCapacityHours = employees.reduce((s, e) => s + e.weeklyCapacityHours, 0);
  const totalAllocatedHours = employees.reduce((s, e) => s + e.currentLoadHours, 0);
  const averageUtilizationPct =
    totalCapacityHours > 0 ? Math.round((totalAllocatedHours / totalCapacityHours) * 100) : 0;

  const overloadedEmployees = employees.filter(
    (e) => e.weeklyCapacityHours > 0 && e.currentLoadHours > e.weeklyCapacityHours
  );
  const nearLimitEmployees = employees.filter((e) => {
    const r = e.weeklyCapacityHours > 0 ? e.currentLoadHours / e.weeklyCapacityHours : 0;
    return r >= 0.85 && r <= 1.0;
  });
  const optimalEmployees = employees.filter((e) => {
    const r = e.weeklyCapacityHours > 0 ? e.currentLoadHours / e.weeklyCapacityHours : 0;
    return r < 0.85;
  });

  const departmentOrder = ['Engineering', 'Design', 'QA', 'Product', 'DevOps'];
  const departmentBreakdowns = departmentOrder.map((dept) => {
    const deptEmps = employees.filter((e) => e.department === dept);
    const capacityHours = deptEmps.reduce((s, e) => s + e.weeklyCapacityHours, 0);
    const allocatedHours = deptEmps.reduce((s, e) => s + e.currentLoadHours, 0);
    const utilizationPct = capacityHours > 0 ? Math.round((allocatedHours / capacityHours) * 100) : 0;
    return {
      department: dept,
      headcount: deptEmps.length,
      allocatedHours,
      capacityHours,
      utilizationPct,
    };
  });

  return {
    totalEmployees,
    totalCapacityHours,
    totalAllocatedHours,
    averageUtilizationPct,
    overloadedCount: overloadedEmployees.length,
    nearLimitCount: nearLimitEmployees.length,
    optimalCount: optimalEmployees.length,
    overloadedEmployees,
    nearLimitEmployees,
    optimalEmployees,
    departmentBreakdowns,
  };
}

/**
 * Deterministically derives synthetic candidate evaluations for a task
 * based on employee skill overlap and workload availability.
 * Overload risk meaningfully penalizes the composite score to enforce capacity constraints.
 * All generated evaluations are synthetic demo estimations, not live AI inference.
 */
export function deriveSyntheticCandidateEvaluations(
  task: Task,
  employees: Employee[] = initialEmployees
): AIRecommendation[] {
  const proficiencyWeights: Record<SkillLevel, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
  };

  const taskEstimatedHours = task.estimatedHours || 8;
  const reqSkills = task.requiredSkills || [];

  // Evaluate every employee deterministically
  const scoredCandidates = employees.map((emp) => {
    // 1. Skill Overlap Breakdown
    let matchedSkillScoreSum = 0;
    const matchedSkills: { skill: string; requiredLevel: SkillLevel; candidateLevel: SkillLevel }[] = [];
    const missingSkills: string[] = [];

    if (reqSkills.length === 0) {
      matchedSkillScoreSum = 1;
    } else {
      reqSkills.forEach((req) => {
        const found = emp.skills.find(
          (s) =>
            s.skillId === req.skillId ||
            s.skillName.toLowerCase() === req.skillName.toLowerCase()
        );
        if (found) {
          const candWeight = proficiencyWeights[found.proficiency] || 1;
          const reqWeight = proficiencyWeights[req.minProficiency] || 1;
          const ratio = candWeight >= reqWeight ? 1.0 : candWeight / reqWeight;
          matchedSkillScoreSum += ratio;
          matchedSkills.push({
            skill: req.skillName,
            requiredLevel: req.minProficiency,
            candidateLevel: found.proficiency,
          });
        } else {
          missingSkills.push(req.skillName);
        }
      });
    }

    const skillScorePct =
      reqSkills.length === 0
        ? 100
        : Math.round((matchedSkillScoreSum / reqSkills.length) * 1000) / 10;

    // 2. Workload & Capacity Availability
    const currentLoadHours = emp.currentLoadHours ?? 0;
    const weeklyCapacityHours = emp.weeklyCapacityHours ?? 40;
    const isZeroCapacity = weeklyCapacityHours <= 0;
    const projectedLoadHours = currentLoadHours + taskEstimatedHours;
    const projectedUtilizationPct = isZeroCapacity
      ? 999
      : Math.round((projectedLoadHours / weeklyCapacityHours) * 1000) / 10;

    let workloadAvailabilityScore = 80;
    let overloadPenalty = 0;
    const isOverloaded = isZeroCapacity || projectedUtilizationPct > 100;

    if (isZeroCapacity) {
      workloadAvailabilityScore = 0;
      overloadPenalty = 55;
    } else if (currentLoadHours > weeklyCapacityHours) {
      // Already overloaded prior to assignment
      workloadAvailabilityScore = Math.max(10, Math.round(100 - (projectedUtilizationPct - 100) * 1.8));
      overloadPenalty = Math.round(25 + Math.min(35, (projectedUtilizationPct - 100) * 1.5));
    } else if (projectedUtilizationPct <= 75) {
      // Optimal capacity band (ample availability)
      workloadAvailabilityScore = Math.round(100 - (projectedUtilizationPct / 100) * 10);
    } else if (projectedUtilizationPct <= 85) {
      // Healthy utilization band
      workloadAvailabilityScore = Math.round(90 - ((projectedUtilizationPct - 75) / 10) * 15);
    } else if (projectedUtilizationPct <= 100) {
      // Near limit band (bandwidth is tight)
      workloadAvailabilityScore = Math.round(75 - ((projectedUtilizationPct - 85) / 15) * 25);
    } else {
      // Becomes overloaded with this assignment
      workloadAvailabilityScore = Math.max(15, Math.round(50 - (projectedUtilizationPct - 100) * 1.5));
      overloadPenalty = Math.round(20 + Math.min(30, (projectedUtilizationPct - 100) * 1.5));
    }

    // 3. One clearly defined Composite Match Score (0 - 100)
    // 55% skill compatibility + 45% workload availability - overload penalty
    const rawComposite = skillScorePct * 0.55 + workloadAvailabilityScore * 0.45 - overloadPenalty;
    const compositeMatchScore = Math.max(10, Math.min(99, Math.round(rawComposite * 10) / 10));

    // 4. Concise explainable deterministic rationale with trade-off analysis
    let rationale = '';
    if (matchedSkills.length === reqSkills.length && reqSkills.length > 0) {
      rationale = `${emp.fullName} satisfies 100% of required technical criteria (${matchedSkills.map((m) => m.skill).join(', ')}).`;
    } else if (matchedSkills.length > 0) {
      rationale = `${emp.fullName} matches ${matchedSkills.length} of ${reqSkills.length} required skills (${matchedSkills.map((m) => m.skill).join(', ')}). Missing: ${missingSkills.join(', ')}.`;
    } else if (reqSkills.length === 0) {
      rationale = `${emp.fullName} is available for this general initiative with operational bandwidth in ${emp.department}.`;
    } else {
      rationale = `${emp.fullName} has available operational bandwidth in ${emp.department}, but lacks direct prerequisites (${reqSkills.map((r) => r.skillName).join(', ')}).`;
    }

    if (isZeroCapacity) {
      rationale += ` UNAVAILABLE: ${emp.fullName} has 0 weekly capacity hours allocated.`;
    } else if (isOverloaded) {
      if (skillScorePct >= 70) {
        rationale += ` Trade-off Analysis: Despite strong technical alignment (${skillScorePct}%), assigning ${taskEstimatedHours}h increases allocation to ${projectedLoadHours}h (${projectedUtilizationPct}% capacity). Operational capacity limits trigger a -${overloadPenalty}% constraint penalty, prioritizing team sustainability over technical seniority.`;
      } else {
        rationale += ` CAPACITY WARNING: Assigning ${taskEstimatedHours}h increases allocation to ${projectedLoadHours}h (${projectedUtilizationPct}% capacity), inducing severe workload risk with a -${overloadPenalty}% score penalty.`;
      }
    } else if (projectedUtilizationPct >= 85) {
      if (skillScorePct >= 70) {
        rationale += ` High-qualification match (${skillScorePct}%), but near-limit capacity: assigning ${taskEstimatedHours}h elevates weekly load to ${projectedLoadHours}h (${projectedUtilizationPct}%). Manager oversight recommended.`;
      } else {
        rationale += ` Assigning ${taskEstimatedHours}h raises weekly load to ${projectedLoadHours}h (${projectedUtilizationPct}% capacity), approaching maximum threshold.`;
      }
    } else {
      if (skillScorePct >= 70) {
        rationale += ` Optimal fit: Strong technical match (${skillScorePct}%) paired with healthy capacity (${currentLoadHours}h → ${projectedLoadHours}h, ${projectedUtilizationPct}%), ensuring dependable on-time delivery.`;
      } else {
        rationale += ` Balanced availability: Assigning ${taskEstimatedHours}h increases load from ${currentLoadHours}h to ${projectedLoadHours}h (${projectedUtilizationPct}% capacity) within safe limits.`;
      }
    }

    const riskFactors: string[] = [];
    if (isZeroCapacity) {
      riskFactors.push(`Zero Capacity: Candidate has 0 scheduled weekly hours.`);
    } else if (isOverloaded) {
      riskFactors.push(`Critical Overload: Projected at ${projectedUtilizationPct}% of maximum capacity (${projectedLoadHours}h / ${weeklyCapacityHours}h).`);
    } else if (projectedUtilizationPct >= 85) {
      riskFactors.push(`Near-Limit Bandwidth: Projected at ${projectedUtilizationPct}% (${projectedLoadHours}h / ${weeklyCapacityHours}h).`);
    }
    if (missingSkills.length > 0) {
      riskFactors.push(`Skill Gap: Lacks verified expertise in ${missingSkills.join(', ')}; pairing or onboarding required.`);
    }

    return {
      emp,
      compositeMatchScore,
      skillScorePct,
      matchedSkills,
      missingSkills,
      currentLoadHours,
      weeklyCapacityHours,
      projectedLoadHours,
      projectedUtilizationPct,
      rationale,
      riskFactors,
    };
  });

  // Sort strictly descending by composite score to guarantee consistent rankings
  scoredCandidates.sort((a, b) => b.compositeMatchScore - a.compositeMatchScore);

  // Return top 3 candidates formatted as AIRecommendation
  return scoredCandidates.slice(0, 3).map((item, idx) => ({
    id: `rec-synth-${task.id}-${item.emp.id}-${idx + 1}`,
    taskId: task.id,
    taskTitle: task.title,
    candidateId: item.emp.id,
    candidateName: item.emp.fullName,
    candidateTitle: item.emp.jobTitle,
    candidateDepartment: item.emp.department,
    candidateAvatar: item.emp.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    matchScore: item.compositeMatchScore,
    skillMatchBreakdown: {
      matchedSkills: item.matchedSkills,
      missingSkills: item.missingSkills,
      skillScore: item.skillScorePct,
    },
    workloadImpact: {
      currentLoadHours: item.currentLoadHours,
      taskEstimatedHours: taskEstimatedHours,
      projectedLoadHours: item.projectedLoadHours,
      weeklyCapacityHours: item.weeklyCapacityHours,
      projectedUtilizationPct: item.projectedUtilizationPct,
    },
    rationale: item.rationale,
    riskFactors: item.riskFactors,
    status: 'pending' as const,
  }));
}

// =============================================================================
// PHASE 3: INTELLIGENT WORKLOAD BALANCING & REDISTRIBUTION HEURISTIC ENGINE
// =============================================================================

export interface RedistributionCandidateEvaluation {
  candidate: Employee;
  skillMatchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  currentLoadHours: number;
  projectedLoadHours: number;
  projectedUtilPct: number;
  isEligible: boolean;
  isSafe: boolean;
  isOverloaded: boolean;
  safetyRank: number;
  compositeScore: number;
  rationale: string;
  riskFactors: string[];
}

export interface RedistributionProposalResult {
  task: Task;
  sourceEmp: Employee;
  sourceBeforeLoad: number;
  sourceBeforeUtilPct: number;
  sourceAfterLoad: number;
  sourceAfterUtilPct: number;
  candidates: RedistributionCandidateEvaluation[];
  recommendedCandidate: RedistributionCandidateEvaluation | null;
  hasEligibleCandidate: boolean;
  explanation: string;
  bottleneckReason?: string;
}

/**
 * Deterministic Workload Redistribution Heuristic Engine.
 * Evaluates alternative team members for an active task assigned to an overloaded employee.
 * Enforces mandatory skill compatibility and prioritizes capacity safety over raw seniority.
 */
export function evaluateRedistributionForTask(
  task: Task,
  sourceEmp: Employee,
  allEmployees: Employee[]
): RedistributionProposalResult {
  const taskHours = task.estimatedHours || 8;
  const sourceBeforeLoad = sourceEmp.currentLoadHours;
  const sourceBeforeUtilPct =
    sourceEmp.weeklyCapacityHours > 0
      ? Math.round((sourceBeforeLoad / sourceEmp.weeklyCapacityHours) * 100)
      : 0;
  const sourceAfterLoad = Math.max(0, sourceBeforeLoad - taskHours);
  const sourceAfterUtilPct =
    sourceEmp.weeklyCapacityHours > 0
      ? Math.round((sourceAfterLoad / sourceEmp.weeklyCapacityHours) * 100)
      : 0;

  const reqSkills = task.requiredSkills || [];

  const candidateEvals: RedistributionCandidateEvaluation[] = [];

  for (const emp of allEmployees) {
    if (emp.id === sourceEmp.id) continue;

    // Check mandatory skills
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    let matchedSkillScore = 0;
    for (const req of reqSkills) {
      const found = emp.skills.find(
        (s) => s.skillName.toLowerCase() === req.skillName.toLowerCase()
      );
      if (found) {
        matchedSkills.push(found.skillName);
        const candidateWeight =
          found.proficiency === 'expert'
            ? 1.0
            : found.proficiency === 'advanced'
            ? 0.85
            : found.proficiency === 'intermediate'
            ? 0.7
            : 0.5;
        const requiredWeight =
          req.minProficiency === 'expert'
            ? 1.0
            : req.minProficiency === 'advanced'
            ? 0.85
            : req.minProficiency === 'intermediate'
            ? 0.7
            : 0.5;
        matchedSkillScore += Math.min(1.0, candidateWeight / requiredWeight);
      } else {
        missingSkills.push(req.skillName);
      }
    }

    const skillMatchScore =
      reqSkills.length > 0
        ? Math.round((matchedSkillScore / reqSkills.length) * 100)
        : 75;

    // Workload & capacity metrics
    const currentLoad = emp.currentLoadHours;
    const weeklyCap = emp.weeklyCapacityHours || 40;
    const isZeroCapacity = weeklyCap <= 0;
    const projectedLoad = currentLoad + taskHours;
    const projectedUtilPct = !isZeroCapacity
      ? Math.round((projectedLoad / weeklyCap) * 100)
      : 999;

    const isOverloaded = projectedUtilPct > 100 || isZeroCapacity;
    const isNearLimit = projectedUtilPct >= 85 && !isOverloaded;
    const isSafe = !isOverloaded && !isZeroCapacity;

    // Must have at least one matched skill if required skills exist
    const hasSkillEligibility = reqSkills.length === 0 || matchedSkills.length > 0;
    const isEligible = hasSkillEligibility && !isZeroCapacity;

    const riskFactors: string[] = [];
    if (isZeroCapacity) {
      riskFactors.push('Zero Capacity: Candidate has 0 scheduled weekly capacity hours.');
    } else if (isOverloaded) {
      riskFactors.push(
        `Critical Overload: Absorbing ${taskHours}h would push candidate to ${projectedUtilPct}% utilization (${projectedLoad}h / ${weeklyCap}h).`
      );
    } else if (isNearLimit) {
      riskFactors.push(
        `Near-Limit Bandwidth: Absorbing ${taskHours}h elevates load to ${projectedUtilPct}% (${projectedLoad}h / ${weeklyCap}h).`
      );
    }

    if (missingSkills.length > 0) {
      riskFactors.push(
        `Skill Gap: Lacks direct coverage for ${missingSkills.join(', ')}.`
      );
    }

    // Safety-first composite score:
    // Safe buffer (50%) + Skill match (40%) + Department match (10%) - Overload penalty (55 points)
    let safetyComponent = 0;
    if (isZeroCapacity) {
      safetyComponent = 0;
    } else if (projectedUtilPct <= 75) {
      safetyComponent = 100;
    } else if (projectedUtilPct <= 85) {
      safetyComponent = 85;
    } else if (projectedUtilPct <= 95) {
      safetyComponent = 60;
    } else if (projectedUtilPct <= 100) {
      safetyComponent = 40;
    } else {
      safetyComponent = Math.max(0, 40 - (projectedUtilPct - 100) * 2);
    }

    const deptBonus = emp.department === sourceEmp.department ? 10 : 0;
    const overloadPenalty = isOverloaded ? 55 : isNearLimit ? 10 : 0;
    const missingSkillPenalty = missingSkills.length * 15;

    const rawScore =
      safetyComponent * 0.5 +
      skillMatchScore * 0.4 +
      deptBonus -
      overloadPenalty -
      missingSkillPenalty;

    const compositeScore = Math.max(5, Math.min(99, Math.round(rawScore)));

    // Rationale construction
    let rationale = '';
    if (!hasSkillEligibility) {
      rationale = `${emp.fullName} (${emp.jobTitle}) lacks required skills (${missingSkills.join(', ')}). Ineligible for transfer.`;
    } else if (isOverloaded) {
      rationale = `OVERLOAD WARNING: Although ${emp.fullName} holds relevant skills (${matchedSkills.join(', ')}), absorbing ${taskHours}h would push allocation to ${projectedLoad}h (${projectedUtilPct}% capacity). WorkForce AI marks this candidate unsafe to protect team sustainability.`;
    } else if (isNearLimit) {
      rationale = `Available but Tight: ${emp.fullName} matches required skills (${matchedSkills.join(', ')}). Absorbing ${taskHours}h increases load from ${currentLoad}h to ${projectedLoad}h (${projectedUtilPct}%). Manager oversight recommended.`;
    } else {
      rationale = `Optimal Capacity Fit: ${emp.fullName} holds verified proficiency in ${matchedSkills.join(', ')} with safe capacity headroom (${currentLoad}h → ${projectedLoad}h, ${projectedUtilPct}%). Safest team redistribution.`;
    }

    candidateEvals.push({
      candidate: emp,
      skillMatchScore,
      matchedSkills,
      missingSkills,
      currentLoadHours: currentLoad,
      projectedLoadHours: projectedLoad,
      projectedUtilPct,
      isEligible,
      isSafe,
      isOverloaded,
      safetyRank: isSafe ? (projectedUtilPct <= 85 ? 1 : 2) : 3,
      compositeScore,
      rationale,
      riskFactors,
    });
  }

  // Sort candidates:
  // 1. Eligible and Safe first
  // 2. Highest composite score
  candidateEvals.sort((a, b) => {
    if (a.isSafe !== b.isSafe) return a.isSafe ? -1 : 1;
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    return b.compositeScore - a.compositeScore;
  });

  // Pick top recommended candidate
  const recommendedCandidate =
    candidateEvals.find((c) => c.isEligible && c.isSafe) || null;

  const hasEligibleCandidate = Boolean(recommendedCandidate);

  // High-level explanation
  let explanation = '';
  let bottleneckReason: string | undefined = undefined;

  if (!hasEligibleCandidate) {
    const hasSkilledOverloaded = candidateEvals.some(
      (c) => c.matchedSkills.length > 0 && c.isOverloaded
    );
    if (hasSkilledOverloaded) {
      explanation = `No safe alternative found. Qualified engineers with matching skills (${task.requiredSkills.map((s) => s.skillName).join(', ')}) are already operating at or above capacity. Transferring this task would cause secondary overload.`;
      bottleneckReason = 'All qualified candidates are at maximum capacity limit.';
    } else {
      explanation = `No eligible alternative found. No available team member possesses mandatory skill requirements (${task.requiredSkills.map((s) => s.skillName).join(', ')}). Automated reassignment is safely blocked to protect delivery quality.`;
      bottleneckReason = `Missing mandatory skill coverage in available capacity pool (${task.requiredSkills.map((s) => s.skillName).join(', ')}).`;
    }
  } else if (recommendedCandidate) {
    // Check if the best-skilled was skipped because of capacity (Scenario 2)
    const bestSkilled = [...candidateEvals].sort(
      (a, b) => b.skillMatchScore - a.skillMatchScore
    )[0];

    if (
      bestSkilled &&
      bestSkilled.candidate.id !== recommendedCandidate.candidate.id &&
      bestSkilled.skillMatchScore > recommendedCandidate.skillMatchScore &&
      bestSkilled.isOverloaded
    ) {
      explanation = `Intelligent Workload Balancing: ${recommendedCandidate.candidate.fullName} is selected as the optimal redistribution target over senior specialist ${bestSkilled.candidate.fullName}. While ${bestSkilled.candidate.fullName} has higher technical proficiency (${bestSkilled.skillMatchScore}%), absorbing ${taskHours}h would push allocation to ${bestSkilled.projectedUtilPct}% (Critical Overload). ${recommendedCandidate.candidate.fullName} safely absorbs the deliverable to ${recommendedCandidate.projectedUtilPct}% utilization.`;
    } else {
      explanation = `Reallocating "${task.title}" (${taskHours}h) relieves ${sourceEmp.fullName} from an alarming ${sourceBeforeUtilPct}% overload down to ${sourceAfterUtilPct}% (Optimal). Safely absorbed by ${recommendedCandidate.candidate.fullName} (${recommendedCandidate.currentLoadHours}h → ${recommendedCandidate.projectedLoadHours}h, ${recommendedCandidate.projectedUtilPct}%).`;
    }
  }

  return {
    task,
    sourceEmp,
    sourceBeforeLoad,
    sourceBeforeUtilPct,
    sourceAfterLoad,
    sourceAfterUtilPct,
    candidates: candidateEvals,
    recommendedCandidate,
    hasEligibleCandidate,
    explanation,
    bottleneckReason,
  };
}

// =============================================================================
// PHASE 4: AI EMPLOYEE INTELLIGENCE DATA MODELS & ENGINE
// =============================================================================

export interface EmployeeHistoricalSprint {
  sprint: string;
  allocatedHours: number;
  capacityHours: number;
  utilizationPct: number;
  completedTasks: number;
  delayedTasks: number;
  isCurrent?: boolean;
}

export interface EmployeeWorkloadRiskAnalysis {
  riskScore: number; // 0.0 - 1.0 (operational scheduling congestion metric)
  severity: 'Critical Overload' | 'Moderate Congestion' | 'Safe Headroom' | 'Insufficient Data';
  isSustainedOverload: boolean;
  consecutiveOverloadSprints: number;
  contributingFactors: {
    factor: string;
    impact: 'High' | 'Medium' | 'Low';
    detail: string;
  }[];
  recommendedManagerAction: string;
  dataConfidence: 'High Confidence' | 'Moderate Confidence' | 'Insufficient History / Illustrative';
  confidenceNote?: string;
}

export interface EmployeeAnomalyInvestigation {
  hasAnomaly: boolean;
  anomalyTitle: string;
  severity: 'High' | 'Medium' | 'Low' | 'Informational';
  observedEvidence: string[];
  operationalContext: string;
  recommendedReviewChecklist: string[];
  isNonPunitive: true;
}

export interface EmployeeGrowthOpportunity {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  estimatedHours: number;
  matchedStrengths: string[];
  growthSkill: string;
  isCapacityGated: boolean;
  capacityStatus: string;
  recommendationRationale: string;
}

export interface EmployeeIntelligenceProfile {
  employee: Employee;
  history: EmployeeHistoricalSprint[];
  riskAnalysis: EmployeeWorkloadRiskAnalysis;
  anomaly: EmployeeAnomalyInvestigation;
  growthOpportunities: EmployeeGrowthOpportunity[];
  assignedTasks: Task[];
  contributingProjects: Project[];
  actualAssignedHours: number;
  actualUtilizationPct: number;
}

/**
 * Builds deterministic, explainable AI Employee Intelligence profiles
 * linked dynamically to the current demo state (reflecting reassignments and resets).
 */
export function getEmployeeIntelligenceProfile(
  employeeId: string,
  currentEmployees: Employee[],
  allTasks: Task[],
  allProjects: Project[]
): EmployeeIntelligenceProfile | null {
  const employee = currentEmployees.find((e) => e.id === employeeId);
  if (!employee) return null;

  // 1. Dynamic assigned tasks & hours from shared state
  const assignedTasks = allTasks.filter((t) => t.assignedTo === employee.id);
  const actualAssignedHours = assignedTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  const actualUtilizationPct =
    employee.weeklyCapacityHours > 0
      ? Math.round((actualAssignedHours / employee.weeklyCapacityHours) * 100)
      : 0;

  // 2. Contributing projects
  const projectIds = Array.from(new Set(assignedTasks.map((t) => t.projectId)));
  const contributingProjects = allProjects.filter((p) => projectIds.includes(p.id));

  // 3. Historical sprint capacity trend (synthetic history)
  let history: EmployeeHistoricalSprint[] = [];
  let dataConfidence: 'High Confidence' | 'Moderate Confidence' | 'Insufficient History / Illustrative' =
    'High Confidence';
  let confidenceNote: string | undefined = undefined;

  if (employee.id === 'emp-7') {
    // JORDAN LEE: Insufficient history case (Acceptance Test 4)
    dataConfidence = 'Insufficient History / Illustrative';
    confidenceNote =
      'Insufficient historical sprint logs (2 sprints recorded since onboarding). Workload trends and anomaly detection are labeled as Illustrative until a minimum 6-sprint baseline is established.';
    history = [
      { sprint: 'W5 (Prev)', allocatedHours: 24, capacityHours: 40, utilizationPct: 60, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W6 (Current)', allocatedHours: actualAssignedHours, capacityHours: 40, utilizationPct: actualUtilizationPct, completedTasks: 1, delayedTasks: 0, isCurrent: true },
    ];
  } else if (employee.id === 'emp-3') {
    // DAVID KIM: Sustained overload case (Acceptance Test 3 & 5)
    history = [
      { sprint: 'W1', allocatedHours: 38, capacityHours: 40, utilizationPct: 95, completedTasks: 3, delayedTasks: 0 },
      { sprint: 'W2', allocatedHours: 40, capacityHours: 40, utilizationPct: 100, completedTasks: 3, delayedTasks: 0 },
      { sprint: 'W3', allocatedHours: 42, capacityHours: 40, utilizationPct: 105, completedTasks: 2, delayedTasks: 1 },
      { sprint: 'W4', allocatedHours: 44, capacityHours: 40, utilizationPct: 110, completedTasks: 2, delayedTasks: 1 },
      { sprint: 'W5', allocatedHours: 44, capacityHours: 40, utilizationPct: 110, completedTasks: 2, delayedTasks: 1 },
      { sprint: 'W6 (Current)', allocatedHours: actualAssignedHours, capacityHours: 40, utilizationPct: actualUtilizationPct, completedTasks: 2, delayedTasks: actualUtilizationPct > 100 ? 1 : 0, isCurrent: true },
    ];
  } else if (employee.id === 'emp-5') {
    // MARCUS VANCE: Recent load spike anomaly
    history = [
      { sprint: 'W1', allocatedHours: 22, capacityHours: 40, utilizationPct: 55, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W2', allocatedHours: 22, capacityHours: 40, utilizationPct: 55, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W3', allocatedHours: 24, capacityHours: 40, utilizationPct: 60, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W4', allocatedHours: 24, capacityHours: 40, utilizationPct: 60, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W5', allocatedHours: 36, capacityHours: 40, utilizationPct: 90, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W6 (Current)', allocatedHours: actualAssignedHours, capacityHours: 40, utilizationPct: actualUtilizationPct, completedTasks: 2, delayedTasks: 0, isCurrent: true },
    ];
  } else if (employee.id === 'emp-6') {
    // PRIYA PATEL: Optimal capacity / safe headroom
    history = [
      { sprint: 'W1', allocatedHours: 22, capacityHours: 40, utilizationPct: 55, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W2', allocatedHours: 20, capacityHours: 40, utilizationPct: 50, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W3', allocatedHours: 20, capacityHours: 40, utilizationPct: 50, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W4', allocatedHours: 18, capacityHours: 40, utilizationPct: 45, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W5', allocatedHours: 18, capacityHours: 40, utilizationPct: 45, completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W6 (Current)', allocatedHours: actualAssignedHours, capacityHours: 40, utilizationPct: actualUtilizationPct, completedTasks: 2, delayedTasks: 0, isCurrent: true },
    ];
  } else {
    // Default 6-sprint history for others
    const baseLoad = Math.max(20, Math.round(actualAssignedHours * 0.9));
    history = [
      { sprint: 'W1', allocatedHours: baseLoad, capacityHours: 40, utilizationPct: Math.round((baseLoad / 40) * 100), completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W2', allocatedHours: baseLoad + 2, capacityHours: 40, utilizationPct: Math.round(((baseLoad + 2) / 40) * 100), completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W3', allocatedHours: baseLoad - 2, capacityHours: 40, utilizationPct: Math.round(((baseLoad - 2) / 40) * 100), completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W4', allocatedHours: baseLoad + 1, capacityHours: 40, utilizationPct: Math.round(((baseLoad + 1) / 40) * 100), completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W5', allocatedHours: baseLoad, capacityHours: 40, utilizationPct: Math.round((baseLoad / 40) * 100), completedTasks: 2, delayedTasks: 0 },
      { sprint: 'W6 (Current)', allocatedHours: actualAssignedHours, capacityHours: 40, utilizationPct: actualUtilizationPct, completedTasks: 2, delayedTasks: 0, isCurrent: true },
    ];
  }

  // 4. Explainable Operational Workload & Risk Diagnostic (Step 2 B)
  const isOverloadedNow = actualUtilizationPct > 100;
  const isNearLimitNow = actualUtilizationPct >= 85 && actualUtilizationPct <= 100;

  let riskScore = 0.15;
  let severity: 'Critical Overload' | 'Moderate Congestion' | 'Safe Headroom' | 'Insufficient Data' = 'Safe Headroom';
  let isSustainedOverload = false;
  let consecutiveOverloadSprints = 0;
  const contributingFactors: { factor: string; impact: 'High' | 'Medium' | 'Low'; detail: string }[] = [];
  let recommendedManagerAction = '';

  if (employee.id === 'emp-7') {
    riskScore = 0.2;
    severity = 'Insufficient Data';
    recommendedManagerAction =
      'Maintain regular 1-on-1 check-ins during initial onboarding. Continue building sprint baseline data.';
    contributingFactors.push({
      factor: 'Onboarding Phase Baseline',
      impact: 'Low',
      detail: `${actualAssignedHours}h / 40h weekly (${actualUtilizationPct}%). Normal ramping trajectory for newly joined contributor.`,
    });
    contributingFactors.push({
      factor: 'Sample Size Limitation',
      impact: 'Low',
      detail: '2 sprints logged. Heuristic risk calculation held in observational state.',
    });
  } else if (isOverloadedNow) {
    riskScore = 0.88;
    severity = 'Critical Overload';
    isSustainedOverload = true;
    consecutiveOverloadSprints = 4;
    contributingFactors.push({
      factor: 'Active Capacity Exceeded',
      impact: 'High',
      detail: `${actualAssignedHours}h assigned across ${assignedTasks.length} deliverables exceeds standard 40h capacity ceiling (${actualUtilizationPct}%).`,
    });
    contributingFactors.push({
      factor: 'Critical-Path Concurrency',
      impact: 'High',
      detail: `${assignedTasks.filter((t) => t.priority === 'critical').length} concurrent critical deliverables requiring simultaneous architectural context.`,
    });
    contributingFactors.push({
      factor: 'Sustained Multi-Sprint Congestion',
      impact: 'Medium',
      detail: 'Consecutive weekly allocation has remained >100% for 4 consecutive sprint cycles.',
    });
    recommendedManagerAction =
      'Execute WorkForce Intelligent Redistribution to transfer 12h–16h of active deliverables (e.g., PostgreSQL optimization or Redis hardening) to available engineers.';
  } else if (isNearLimitNow) {
    riskScore = 0.45;
    severity = 'Moderate Congestion';
    contributingFactors.push({
      factor: 'Approaching Upper Capacity Band',
      impact: 'Medium',
      detail: `${actualAssignedHours}h assigned (${actualUtilizationPct}% utilization). Remaining headroom is constrained (${employee.weeklyCapacityHours - actualAssignedHours}h).`,
    });
    contributingFactors.push({
      factor: 'Sprint Focus Intensity',
      impact: 'Low',
      detail: `${assignedTasks.length} active deliverables with tightly coupled deadlines.`,
    });
    recommendedManagerAction =
      'Monitor milestone velocity closely. Avoid assigning additional unplanned deliverables without deferring lower-priority scope.';
  } else {
    // Optimal capacity / Safe headroom
    riskScore = actualUtilizationPct <= 50 ? 0.12 : 0.25;
    severity = 'Safe Headroom';
    contributingFactors.push({
      factor: 'Healthy Weekly Headroom',
      impact: 'Low',
      detail: `${employee.weeklyCapacityHours - actualAssignedHours}h available headroom within 40h standard ceiling (${actualUtilizationPct}% utilization).`,
    });
    contributingFactors.push({
      factor: 'Stable Delivery Cadence',
      impact: 'Low',
      detail: `${employee.onTimeCompletionRate}% historical on-time milestone delivery record.`,
    });
    recommendedManagerAction =
      'Available for high-priority sprint deliverables or structured stretch development opportunities.';
  }

  // 5. Anomaly Investigation (Step 2 C)
  let anomaly: EmployeeAnomalyInvestigation = {
    hasAnomaly: false,
    anomalyTitle: 'Normal Operational Rhythm',
    severity: 'Informational',
    observedEvidence: ['Workload metrics fall within normal operational boundaries (±15% variance across sprints).'],
    operationalContext: 'No statistical anomalies detected in assignment distribution or velocity trends.',
    recommendedReviewChecklist: ['Standard sprint retrospective review.'],
    isNonPunitive: true,
  };

  if (employee.id === 'emp-3' && isOverloadedNow) {
    anomaly = {
      hasAnomaly: true,
      anomalyTitle: 'Sustained Multi-Sprint Over-Allocation Pattern',
      severity: 'High',
      observedEvidence: [
        'Allocation has exceeded 40h weekly baseline for 4 consecutive sprint cycles (W3–W6).',
        'On-time delivery index dipped from 95% to 85% concurrent with overlapping critical backend tasks.',
        '3 concurrent high-complexity deliverables scheduled simultaneously across PostgreSQL and Redis domains.',
      ],
      operationalContext:
        'Architectural dependencies and urgent backend scaling converged on a single principal specialist. Observation indicates scheduling bottleneck rather than contributor performance deficit.',
      recommendedReviewChecklist: [
        'Evaluate dependency decoupling and task redistribution options in Workload Sandbox.',
        'Verify whether unblocking PR reviews from upstream services resolves delivery tightness.',
        'Conduct non-punitive workload alignment to restore a sustainable 30h–35h weekly baseline.',
      ],
      isNonPunitive: true,
    };
  } else if (employee.id === 'emp-3' && !isOverloadedNow) {
    anomaly = {
      hasAnomaly: true,
      anomalyTitle: 'Workload Rebalance Active (Congestion Resolved)',
      severity: 'Informational',
      observedEvidence: [
        `Deliverable redistribution reduced allocation from 46h (115%) to ${actualAssignedHours}h (${actualUtilizationPct}%).`,
        'Active deliverable count normalized to sustainable capacity threshold.',
      ],
      operationalContext:
        'Manager-approved task transfer successfully cleared multi-sprint bottleneck. Operational risk score restored to healthy state.',
      recommendedReviewChecklist: [
        'Verify knowledge transfer completion with new assignee.',
        'Confirm sprint milestones remain on track under normalized allocation.',
      ],
      isNonPunitive: true,
    };
  } else if (employee.id === 'emp-5') {
    anomaly = {
      hasAnomaly: true,
      anomalyTitle: 'Recent Allocation Delta (+14h Spike in W5)',
      severity: 'Medium',
      observedEvidence: [
        'Workload shifted from 22h (55%) to 36h (90%) in a single sprint transition (+63% delta).',
        'Concurrent AWS EKS cluster deployment and Helm containerization deliverables.',
      ],
      operationalContext:
        'Cloud infrastructure migration milestone required consolidation into current sprint timeline.',
      recommendedReviewChecklist: [
        'Check if staging EKS validation requires additional QA support from Jordan Lee.',
        'Confirm whether cloud milestone deadline allows staged rollout.',
      ],
      isNonPunitive: true,
    };
  } else if (employee.id === 'emp-7') {
    anomaly = {
      hasAnomaly: true,
      anomalyTitle: 'Insufficient Historical Baseline Period (Onboarding Phase)',
      severity: 'Informational',
      observedEvidence: [
        'Only 2 sprint history logs recorded in system database since team onboarding.',
        'Statistical anomaly projection cannot reach 95% confidence interval.',
      ],
      operationalContext:
        'Recently joined QA engineering squad. Normal ramp-up activity without historical trend data.',
      recommendedReviewChecklist: [
        'Allow 4 additional sprints to elapse before evaluating automated trend anomalies.',
        'Rely on qualitative 1-on-1 check-ins for capacity alignment rather than automated heuristics.',
      ],
      isNonPunitive: true,
    };
  }

  // 6. Growth & Stretch Opportunities (Step 2 D)
  const growthOpportunities: EmployeeGrowthOpportunity[] = [];

  // Match employee skills against tasks across the company
  allTasks.forEach((task) => {
    // Only consider tasks not currently assigned to this employee
    if (task.assignedTo === employee.id) return;

    const matchedSkills = task.requiredSkills.filter((req) =>
      employee.skills.some((s) => s.skillName.toLowerCase() === req.skillName.toLowerCase())
    );

    const missingSkills = task.requiredSkills.filter(
      (req) => !employee.skills.some((s) => s.skillName.toLowerCase() === req.skillName.toLowerCase())
    );

    // Good candidate for growth: has at least 1 prerequisite skill, has 1 missing or stretch skill
    if (matchedSkills.length > 0 && missingSkills.length > 0) {
      const wouldOverload = actualAssignedHours + task.estimatedHours > employee.weeklyCapacityHours;
      const isCapacityGated = actualUtilizationPct > 80 || wouldOverload;

      growthOpportunities.push({
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        projectName: task.projectName,
        estimatedHours: task.estimatedHours,
        matchedStrengths: matchedSkills.map((s) => s.skillName),
        growthSkill: missingSkills.map((s) => s.skillName).join(', '),
        isCapacityGated,
        capacityStatus: isCapacityGated
          ? `Capacity Gated (${actualAssignedHours}h + ${task.estimatedHours}h = ${actualAssignedHours + task.estimatedHours}h exceeds safe 80% threshold)`
          : `Available Headroom (${actualAssignedHours}h + ${task.estimatedHours}h = ${actualAssignedHours + task.estimatedHours}h / 40h)`,
        recommendationRationale: isCapacityGated
          ? `Meets foundational prerequisites in ${matchedSkills.map((s) => s.skillName).join(', ')}, but current weekly workload (${actualUtilizationPct}%) requires rebalancing before assigning new stretch deliverables.`
          : `Optimal stretch deliverable: ${employee.fullName} demonstrates strong foundations in ${matchedSkills.map((s) => s.skillName).join(', ')}. Taking on this deliverable expands capability in ${missingSkills.map((s) => s.skillName).join(', ')} while maintaining safe capacity.`,
      });
    }
  });

  return {
    employee,
    history,
    riskAnalysis: {
      riskScore,
      severity,
      isSustainedOverload,
      consecutiveOverloadSprints,
      contributingFactors,
      recommendedManagerAction,
      dataConfidence,
      confidenceNote,
    },
    anomaly,
    growthOpportunities: growthOpportunities.slice(0, 3), // Top 3 opportunities
    assignedTasks,
    contributingProjects,
    actualAssignedHours,
    actualUtilizationPct,
  };
}
