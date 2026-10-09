'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { MetricCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Input, Select } from '@/components/ui/Input';
import {
  Users,
  FolderKanban,
  CheckSquare,
  Sparkles,
  BarChart3,
  Flame,
  FileSpreadsheet,
  History,
  Bell,
  Settings,
  ArrowRight,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';

interface SampleEmployee {
  id: string;
  name: string;
  role: string;
  department: string;
  skills: string[];
  capacityHours: number;
  allocatedHours: number;
  utilizationPct: number;
}

const sampleEmployees: SampleEmployee[] = [
  {
    id: '1',
    name: 'Sarah Connor',
    role: 'Engineering Lead',
    department: 'Engineering',
    skills: ['Python', 'FastAPI', 'Architecture'],
    capacityHours: 40,
    allocatedHours: 28,
    utilizationPct: 70,
  },
  {
    id: '2',
    name: 'Alex Chen',
    role: 'Senior Frontend Engineer',
    department: 'Engineering',
    skills: ['React', 'TypeScript', 'Tailwind'],
    capacityHours: 40,
    allocatedHours: 32,
    utilizationPct: 80,
  },
  {
    id: '3',
    name: 'David Kim',
    role: 'Backend Architect',
    department: 'Engineering',
    skills: ['PostgreSQL', 'Go', 'Kubernetes'],
    capacityHours: 40,
    allocatedHours: 46,
    utilizationPct: 115,
  },
  {
    id: '4',
    name: 'Elena Rostova',
    role: 'Product Designer',
    department: 'Design',
    skills: ['Figma', 'Design Systems', 'UI/UX'],
    capacityHours: 40,
    allocatedHours: 22,
    utilizationPct: 55,
  },
];

export default function HomePage() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isLoadingState, setIsLoadingState] = React.useState(false);
  const [isEmptyState, setIsEmptyState] = React.useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = React.useState<string | null>(null);

  const triggerFeedback = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const columns: Column<SampleEmployee>[] = [
    {
      header: 'Employee',
      cell: (emp) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-800 text-xs font-bold text-white shadow-sm">
            {emp.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <div className="font-medium text-slate-100">{emp.name}</div>
            <div className="text-[11px] text-slate-400">{emp.role}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      accessorKey: 'department',
      cell: (emp) => (
        <Badge variant="slate" size="sm">
          {emp.department}
        </Badge>
      ),
    },
    {
      header: 'Key Skills',
      cell: (emp) => (
        <div className="flex flex-wrap gap-1">
          {emp.skills.map((skill) => (
            <Badge key={skill} variant="cyan" size="sm">
              {skill}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      header: 'Workload & Capacity',
      className: 'w-48',
      cell: (emp) => (
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-mono">
            <span
              className={
                emp.utilizationPct > 100
                  ? 'text-rose-400 font-bold'
                  : 'text-slate-300'
              }
            >
              {emp.allocatedHours}h / {emp.capacityHours}h
            </span>
            <span
              className={
                emp.utilizationPct > 100
                  ? 'text-rose-400 font-bold'
                  : 'text-slate-400'
              }
            >
              {emp.utilizationPct}%
            </span>
          </div>
          <ProgressBar value={emp.utilizationPct} />
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (emp) => {
        if (emp.utilizationPct > 100)
          return <Badge variant="rose">Overloaded</Badge>;
        if (emp.utilizationPct >= 80)
          return <Badge variant="amber">Near Limit</Badge>;
        return <Badge variant="emerald">Optimal</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 sm:p-8 shadow-card">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="violet" size="md">
              <Zap className="h-3 w-3 fill-current" />
              Phase 1 Foundation
            </Badge>
            <Badge variant="cyan" size="md">
              Design System Active
            </Badge>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            WorkForce Design System & Application Shell
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Engineered for precision workforce capacity management. Featuring a deep
            navy foundation, violet highlights, cyan accents, deterministic capacity
            gauges, and human-in-the-loop AI matching interfaces.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsDialogOpen(true)}
            >
              Preview Interactive Dialog
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsConfirmOpen(true)}
            >
              Preview Confirm Action
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => {
                setIsLoadingState(!isLoadingState);
                triggerFeedback(
                  isLoadingState
                    ? 'Switched to rendered view'
                    : 'Switched to pulsating skeleton loading state'
                );
              }}
            >
              {isLoadingState ? 'Show Loaded State' : 'Simulate Loading Skeletons'}
            </Button>
          </div>
        </div>
      </div>

      {/* Success Banner Alert */}
      {actionSuccessMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Org Capacity Utilization"
          value="78.4%"
          subtitle="960h total weekly capacity"
          trend={{ value: 4.2, isPositiveGood: true }}
          icon={<Activity className="h-5 w-5 text-violet-400" />}
          progress={{ value: 78.4, max: 100 }}
        />
        <MetricCard
          title="Active Workforce"
          value="24"
          subtitle="4 Engineering & Design Teams"
          badgeText="All Active"
          badgeVariant="emerald"
          icon={<Users className="h-5 w-5 text-cyan-400" />}
        />
        <MetricCard
          title="Pending AI Matches"
          value="6"
          subtitle="Awaiting manager sign-off"
          badgeText="Action Required"
          badgeVariant="amber"
          icon={<Sparkles className="h-5 w-5 text-amber-400" />}
        />
        <MetricCard
          title="Overload Risk Flags"
          value="1"
          subtitle="David Kim (>115% capacity)"
          badgeText="High Risk"
          badgeVariant="rose"
          icon={<Flame className="h-5 w-5 text-rose-400" />}
        />
      </div>

      {/* Data Table Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Talent Capacity & Skill Matrix Preview
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic workload metrics across core engineering profiles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsEmptyState(!isEmptyState);
                triggerFeedback(
                  isEmptyState ? 'Populated sample table' : 'Emptied table to preview EmptyState'
                );
              }}
            >
              {isEmptyState ? 'Populate Table' : 'Simulate Empty State'}
            </Button>
            <Link href="/employees">
              <Button variant="secondary" size="sm">
                <span>View All 24 Employees</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={isEmptyState ? [] : sampleEmployees}
          isLoading={isLoadingState}
          emptyTitle="No talent records found"
          emptyDescription="Seed the organization with synthetic data or invite your first team member."
          emptyAction={
            <Button
              variant="accent"
              size="sm"
              onClick={() => {
                setIsEmptyState(false);
                triggerFeedback('Sample data populated.');
              }}
            >
              Restore Sample Records
            </Button>
          }
        />
      </div>

      {/* Navigation Hub: Links to All 11 Product Sections */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">
            Navigation Hub & Screen Inventory
          </h3>
          <p className="text-xs text-slate-400">
            All 11 primary platform routes wired and ready for Phase 2 implementation
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Executive Dashboard',
              href: '/dashboard',
              icon: Activity,
              desc: 'High-level capacity gauges, project health, and pending approvals.',
            },
            {
              title: 'Employee Directory',
              href: '/employees',
              icon: Users,
              desc: 'Roster of 20+ profiles, skill taxonomies, and individual workloads.',
            },
            {
              title: 'Project Portfolio',
              href: '/projects',
              icon: FolderKanban,
              desc: 'Track milestones, deadlines, and project member allocations.',
            },
            {
              title: 'Task Management',
              href: '/tasks',
              icon: CheckSquare,
              desc: 'Prioritized Kanban boards with skill prerequisite tags.',
            },
            {
              title: 'AI Recommendations Hub',
              href: '/matching',
              icon: Sparkles,
              desc: 'Gemini-powered explainable matching with manager approval.',
            },
            {
              title: 'Capacity & Workload Monitor',
              href: '/workload',
              icon: BarChart3,
              desc: 'Department heatmaps, overload warnings, and rebalancing sandbox.',
            },
            {
              title: 'Employee Insights & Risk',
              href: '/insights',
              icon: Flame,
              desc: 'Operational bottleneck diagnostics and velocity tracking.',
            },
            {
              title: 'Reports & Analytics',
              href: '/reports',
              icon: FileSpreadsheet,
              desc: 'Capacity trends, AI acceptance rate, and CSV exports.',
            },
            {
              title: 'Audit History',
              href: '/audit',
              icon: History,
              desc: 'Immutable compliance trail of all system assignments and overrides.',
            },
            {
              title: 'Notifications Center',
              href: '/notifications',
              icon: Bell,
              desc: 'Real-time alert dispatch for task assignments and capacity warnings.',
            },
            {
              title: 'Workspace Settings',
              href: '/settings',
              icon: Settings,
              desc: 'Organization profile and one-click synthetic demonstration seeder.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full hover:border-violet-500/50 hover:bg-navy-800/80 transition-all group">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-800 group-hover:bg-violet-600/20 text-violet-400 border border-slate-700/60 transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm font-semibold group-hover:text-violet-300 transition-colors">
                          {item.title}
                        </CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-xs text-slate-400 leading-relaxed">
                      {item.desc}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Interactive Demonstration Modal */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="WorkForce Design System Modal"
        description="Accessible dialog testing keyboard focus, backdrop blur, and dark styling."
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDialogOpen(false);
                triggerFeedback('Dialog action confirmed successfully!');
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Sample Input Control"
            placeholder="e.g., Senior Backend Engineer"
            helperText="Form controls adapt seamlessly to the dark navy theme."
          />
          <Select
            label="Sample Select Control"
            options={[
              { label: 'Engineering (Default)', value: 'engineering' },
              { label: 'Product & Design', value: 'design' },
              { label: 'Quality Assurance', value: 'qa' },
            ]}
          />
        </div>
      </Dialog>

      {/* Interactive Confirm Modal */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          triggerFeedback('Confirmed dangerous action!');
        }}
        title="Approve AI Task Assignment?"
        description="This will assign the 10-hour task to Jordan Lee, bringing their weekly capacity to 25%."
        confirmText="Approve & Assign"
        variant="primary"
      />
    </div>
  );
}
