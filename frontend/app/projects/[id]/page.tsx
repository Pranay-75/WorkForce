'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTasks } from '@/lib/hooks/useTasks';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const { isAuthenticated, organization } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);

  // Live hooks
  const { projects: dbProjects, isLoading: isProjectsLoading } = useProjects();
  const { tasks: dbTasks, isLoading: isTasksLoading } = useTasks();
  const { members: orgMembers, isLoading: isMembersLoading } = useOrganizationMembers();

  // Mock store fallback
  const { projects: mockProjects, employees: mockEmployees, tasks: mockTasks } = useMockStore();

  const projects = isLive ? dbProjects : mockProjects;
  const tasks = isLive ? dbTasks : mockTasks;

  const project = projects.find((p) => p.id === projectId);
  const [activeTab, setActiveTab] = React.useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

  // Loading skeleton
  if (isLive && isProjectsLoading) {
    return (
      <div className="space-y-6 animate-pulse p-6">
        <div className="h-6 w-32 bg-slate-800 rounded" />
        <div className="h-44 bg-navy-900/60 rounded-xl border border-slate-800" />
        <div className="h-32 bg-navy-900/40 rounded-xl border border-slate-800" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested project does not exist in the active organization portfolio.
        </p>
        <Link href="/projects">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const filteredTasks = projectTasks.filter((t) =>
    activeTab === 'all' ? true : t.status === activeTab
  );

  // Resolve members allocated to this project
  const projectMembers = isLive
    ? orgMembers
        .filter((m) => project.memberIds.includes(m.userId))
        .map((m) => ({
          id: m.userId,
          fullName: m.fullName,
          jobTitle: m.jobTitle || 'Team Member',
          department: m.department || 'Engineering',
          weeklyCapacityHours: m.weeklyCapacityHours || 40,
          currentLoadHours: 0,
        }))
    : mockEmployees.filter((e) => project.memberIds.includes(e.id));

  const progressPct =
    project.totalHours > 0 ? Math.round((project.completedHours / project.totalHours) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>All Projects</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              project.priority === 'critical'
                ? 'rose'
                : project.priority === 'high'
                ? 'amber'
                : 'slate'
            }
            size="sm"
          >
            {project.priority.toUpperCase()} PRIORITY
          </Badge>
          <Badge variant="cyan" size="sm">
            {project.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Project Banner Card */}
      <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <FolderKanban className="h-6 w-6 text-violet-400" />
              <h2 className="text-2xl font-extrabold text-white">
                {project.name}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {project.description || 'No detailed scope description provided.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                Target: {project.targetEndDate || 'Unscheduled'}
              </span>
              <span>•</span>
              <span>Lead: {project.managerName || 'Unassigned'}</span>
              <span>•</span>
              <span className="font-mono">{projectTasks.length} Total Tasks</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 min-w-[200px] text-right">
            <span className="text-xs text-slate-400 uppercase font-semibold">
              Project Delivery
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {project.completedHours}h / {project.totalHours}h ({progressPct}%)
            </div>
            <div className="w-full">
              <ProgressBar value={progressPct} />
            </div>
          </div>
        </div>
      </Card>

      {/* Assigned Team Members Row */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <CardTitle>Allocated Team Members ({projectMembers.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {projectMembers.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">
              No team members have been specifically assigned to this project.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {projectMembers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 bg-navy-900/60 p-3 hover:border-violet-500/50 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-xs font-bold text-white">
                      {m.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                        {m.fullName}
                      </h4>
                      <span className="text-[10px] text-slate-400 truncate block">
                        {m.jobTitle}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Tasks Summary & Filter Tabs */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Project Task Roster
            </h3>
            <p className="text-xs text-slate-400">
              Granular breakdown of requirements, deadlines, and assigned talent
            </p>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-navy-900 p-1 border border-slate-800 text-xs">
            {(['all', 'todo', 'in_progress', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All Tasks' : tab.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="space-y-3">
          {filteredTasks.map((t) => (
            <Card
              key={t.id}
              className="border-slate-800 hover:border-violet-500/50 transition-all"
            >
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-sm font-bold text-white hover:text-violet-300 transition-colors"
                    >
                      {t.title}
                    </Link>
                    <Badge
                      variant={
                        t.priority === 'critical'
                          ? 'rose'
                          : t.priority === 'high'
                          ? 'amber'
                          : 'slate'
                      }
                      size="sm"
                    >
                      {t.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1">
                    {t.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="font-mono text-cyan-400 font-semibold">
                      {t.estimatedHours} hrs estimate
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3" /> Due {t.dueDate || 'Unscheduled'}
                    </span>
                    <span>•</span>
                    <span>
                      Assignee:{' '}
                      <strong className="text-slate-200">
                        {t.assignedEmployeeName || 'Unassigned'}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!t.assignedTo ? (
                    <Link href="/matching">
                      <Button variant="accent" size="sm">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Find AI Match
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/tasks/${t.id}`}>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {filteredTasks.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400">
              <CheckSquare className="mx-auto h-8 w-8 text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-300">
                No tasks matching "{activeTab}" status.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
