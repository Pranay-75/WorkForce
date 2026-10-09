'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMockStore } from '@/lib/mockStore';
import { TaskStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  ArrowLeft,
  CheckSquare,
  Calendar,
  Clock,
  Sparkles,
  FolderKanban,
  ShieldCheck,
  Award,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  Plus,
  Minus,
} from 'lucide-react';

export default function TaskDetailPage() {
  const params = useParams();
  const { tasks, employees, activeRole, currentUserId, updateTaskStatus, updateTaskDetails } = useMockStore();

  const taskId = params?.id as string;
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-12 text-center space-y-3">
        <h3 className="text-lg font-bold text-white">Task Not Found</h3>
        <p className="text-xs text-slate-400">
          The requested task identifier does not exist in the active project backlog.
        </p>
        <Link href="/tasks">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Task List
          </Button>
        </Link>
      </div>
    );
  }

  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin';
  const assignee = employees.find((e) => e.id === task.assignedTo);
  const assigneeUtilPct = assignee
    ? Math.round((assignee.currentLoadHours / assignee.weeklyCapacityHours) * 100)
    : 0;

  const handleAdjustHours = (delta: number) => {
    const newHours = Math.max(1, (task.estimatedHours || 0) + delta);
    updateTaskDetails(task.id, { estimatedHours: newHours });
  };

  const handleReassign = (newEmpId: string) => {
    updateTaskDetails(task.id, {
      assignedTo: newEmpId === 'unassigned' ? undefined : newEmpId,
      status: newEmpId === 'unassigned' ? 'todo' : task.status,
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span>Back to All Tasks</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              task.priority === 'critical'
                ? 'rose'
                : task.priority === 'high'
                ? 'amber'
                : 'slate'
            }
            size="sm"
          >
            {task.priority.toUpperCase()} PRIORITY
          </Badge>
          <Badge variant="cyan" size="sm">
            STATUS: {task.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Task Specification Card */}
      <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-mono text-violet-400">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>{task.projectName}</span>
              <span>•</span>
              <span>ID: {task.id}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {task.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {task.description}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80">
            {/* Estimated Effort (Interactive Adjustment for Manager/Admin) */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Estimated Effort (Hours)
              </span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold font-mono text-cyan-400">
                  {task.estimatedHours}h
                </span>
                {isManagerOrAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAdjustHours(-2)}
                      disabled={task.estimatedHours <= 2}
                      className="rounded bg-navy-800 p-1 text-slate-300 hover:bg-navy-700 hover:text-white disabled:opacity-40"
                      title="Reduce effort by 2 hours"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAdjustHours(2)}
                      className="rounded bg-navy-800 p-1 text-slate-300 hover:bg-navy-700 hover:text-white"
                      title="Increase effort by 2 hours"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Target Deadline
              </span>
              <div className="text-base font-bold font-mono text-white flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {task.dueDate}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Complexity
              </span>
              <div className="text-base font-bold text-slate-200">
                {task.complexity}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400">
                Task Workflow
              </span>
              {(() => {
                const canModify = activeRole !== 'employee' || task.assignedTo === currentUserId;
                return (
                  <div>
                    <select
                      value={task.status}
                      disabled={!canModify}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                      className="rounded-lg border border-slate-700 bg-navy-850 px-2.5 py-1 text-xs text-slate-100 font-semibold focus:border-violet-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In Progress</option>
                      <option value="in_review">In Review</option>
                      <option value="completed">Completed</option>
                    </select>
                    {!canModify && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-1">
                        Read-only (Assigned to {task.assignedEmployeeName || 'someone else'})
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Required Skills + Assignee / Dynamic Workload Recalculation Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Required Technical Skills */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" />
              <CardTitle>Mandatory Technical Prerequisites</CardTitle>
            </div>
            <CardDescription>
              Deterministic skill requirements validated before matching candidates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.requiredSkills.map((req, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-900/60 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-white">
                    {req.skillName}
                  </span>
                </div>
                <Badge variant="cyan" size="sm">
                  MIN: {req.minProficiency.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Assignment & Dynamic Workload Recalculation Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-violet-400" />
                <CardTitle>Assignee & Live Workload Impact</CardTitle>
              </div>
              <Badge variant={task.assignedTo ? 'emerald' : 'amber'} size="sm">
                {task.assignedTo ? 'Assigned' : 'Unassigned'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 flex-1">
            {assignee ? (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-navy-900/80 p-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-800 text-sm font-bold text-white shadow-sm">
                    {assignee.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white">
                      {assignee.fullName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {assignee.jobTitle} • {assignee.department}
                    </p>
                  </div>
                  <Link href={`/employees/${assignee.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Profile
                    </Button>
                  </Link>
                </div>

                {/* Assignee Current Live Workload */}
                <div className="rounded-xl border border-slate-800/80 bg-navy-900/60 p-3.5 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Live Calculated Workload</span>
                    <span
                      className={
                        assigneeUtilPct > 100
                          ? 'text-rose-400 font-bold'
                          : 'text-slate-200 font-semibold'
                      }
                    >
                      {assignee.currentLoadHours}h / {assignee.weeklyCapacityHours}h ({assigneeUtilPct}%)
                    </span>
                  </div>
                  <ProgressBar value={assigneeUtilPct} />
                </div>

                {/* Manager Reassignment Control */}
                {isManagerOrAdmin && (
                  <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                    <label className="block text-xs font-medium text-slate-400">
                      Reassign to Team Member:
                    </label>
                    <select
                      value={task.assignedTo || 'unassigned'}
                      onChange={(e) => handleReassign(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="unassigned">Unassigned (Send to AI Matching Hub)</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName} ({e.department} - {e.currentLoadHours}h load)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-5 space-y-3 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-violet-400 animate-pulse" />
                <h4 className="text-sm font-bold text-white">
                  No Talent Assigned Yet
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                  Run explainable AI candidate ranking to match available team members based on skills, capacity, and deadlines.
                </p>
                <div className="pt-1 flex justify-center gap-2">
                  <Link href="/matching">
                    <Button variant="primary" size="sm">
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Open AI Matching Hub
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
