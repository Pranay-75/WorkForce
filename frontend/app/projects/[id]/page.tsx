'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const { projects, employees, tasks } = useMockStore();

  const projectId = params?.id as string;
  const project = projects.find((p) => p.id === projectId);

  const [activeTab, setActiveTab] = React.useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');

  if (!project) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Project Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested project does not exist in the active workspace.
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

  const projectMembers = employees.filter((e) =>
    project.memberIds.includes(e.id)
  );
  const progressPct = Math.round(
    (project.completedHours / project.totalHours) * 100
  );

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
              {project.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                Target: {project.targetEndDate}
              </span>
              <span>•</span>
              <span>Lead: {project.managerName}</span>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projectMembers.map((m) => {
              const util = Math.round(
                (m.currentLoadHours / m.weeklyCapacityHours) * 100
              );
              return (
                <Link key={m.id} href={`/employees/${m.id}`}>
                  <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3 hover:border-violet-500/50 transition-all group">
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
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>Load:</span>
                        <span className={util > 100 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {m.currentLoadHours}h ({util}%)
                        </span>
                      </div>
                      <ProgressBar value={util} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
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
                      <Calendar className="h-3 w-3" /> Due {t.dueDate}
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
