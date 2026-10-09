'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMockStore } from '@/lib/mockStore';
import { PriorityLevel, ProjectStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  FolderKanban,
  Calendar,
  Users,
  CheckSquare,
  ArrowRight,
  Plus,
  Clock,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';

export default function ProjectsPage() {
  const { projects, employees, tasks, activeRole, currentUser, addNewProject } = useMockStore();
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Form State
  const [projectName, setProjectName] = React.useState('');
  const [projectDesc, setProjectDesc] = React.useState('');
  const [priority, setPriority] = React.useState<PriorityLevel>('high');
  const [status, setStatus] = React.useState<ProjectStatus>('in_progress');
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [targetEndDate, setTargetEndDate] = React.useState('2026-12-31');
  const [totalHours, setTotalHours] = React.useState('200');
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([currentUser.id]);

  const isManagerOrAdmin = activeRole === 'manager' || activeRole === 'admin';

  const filteredProjects = projects.filter((p) =>
    selectedStatus === 'all' ? true : p.status === selectedStatus
  );

  const toggleMemberSelection = (empId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    addNewProject({
      name: projectName,
      description: projectDesc || 'Strategic engineering initiative delivering key product milestones.',
      priority,
      status,
      startDate,
      targetEndDate,
      managerId: currentUser.id,
      managerName: currentUser.name,
      memberIds: selectedMemberIds.length > 0 ? selectedMemberIds : [currentUser.id],
      totalHours: parseFloat(totalHours) || 160,
    });

    setIsCreateModalOpen(false);
    setProjectName('');
    setProjectDesc('');
    setSelectedMemberIds([currentUser.id]);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Project Portfolio & Delivery Benchmarks
            </h2>
            <Badge variant="violet" size="sm">
              {projects.length} Active Initiatives
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Monitor delivery milestones, tracked project effort, and team member commitments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="all">All Project Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
          </select>

          {isManagerOrAdmin && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filteredProjects.map((proj) => {
          const progressPct = Math.round((proj.completedHours / proj.totalHours) * 100);
          const projectTasks = tasks.filter((t) => t.projectId === proj.id);
          const projectMembers = employees.filter((e) =>
            proj.memberIds.includes(e.id)
          );

          return (
            <Card
              key={proj.id}
              className="flex flex-col justify-between border-slate-800/90 hover:border-violet-500/50 transition-all hover:shadow-card group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-violet-400" />
                      <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                        {proj.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description}
                    </p>
                  </div>
                  <Badge
                    variant={
                      proj.priority === 'critical'
                        ? 'rose'
                        : proj.priority === 'high'
                        ? 'amber'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {proj.priority}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Total Completion</span>
                    <span className="text-slate-200 font-bold">
                      {proj.completedHours}h / {proj.totalHours}h ({progressPct}%)
                    </span>
                  </div>
                  <ProgressBar value={progressPct} />
                </div>

                {/* Dates & Lead */}
                <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-400 rounded-xl bg-navy-900/60 p-3 border border-slate-800/60">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block">Target Deadline</span>
                    <span className="text-slate-200 font-mono font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-cyan-400" />
                      {proj.targetEndDate}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block">Project Lead</span>
                    <span className="text-slate-200 font-semibold truncate block">
                      {proj.managerName}
                    </span>
                  </div>
                </div>

                {/* Team Avatars & Task Count */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Team:</span>
                    <div className="flex -space-x-2 overflow-hidden">
                      {projectMembers.map((m) => (
                        <div
                          key={m.id}
                          title={m.fullName}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-[10px] font-bold text-white ring-2 ring-navy-900"
                        >
                          {m.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
                    <span className="font-mono">
                      {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </CardContent>

              <div className="border-t border-slate-800/80 bg-navy-950/40 p-3 px-5 flex items-center justify-between">
                <Badge variant={proj.status === 'in_progress' ? 'cyan' : 'slate'} size="sm">
                  {proj.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Link href={`/projects/${proj.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs">
                    <span>Project Dashboard</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Create Project Dialog Modal */}
      <Dialog
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project Initiative"
        description={`Author a new project portfolio managed by ${currentUser.name} (${currentUser.role.toUpperCase()}).`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 py-2">
          <Input
            label="Project Name *"
            placeholder="e.g. Edge Ingestion Pipeline v3"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Project Description & Scope
            </label>
            <textarea
              rows={3}
              placeholder="Outline project deliverables, core architectural components, and milestones..."
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-700/80 bg-navy-850 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              options={[
                { label: 'High Priority', value: 'high' },
                { label: 'Critical Priority', value: 'critical' },
                { label: 'Medium Priority', value: 'medium' },
                { label: 'Low Priority', value: 'low' },
              ]}
            />
            <Select
              label="Initial Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              options={[
                { label: 'In Progress', value: 'in_progress' },
                { label: 'Planning', value: 'planning' },
              ]}
            />
            <Input
              label="Effort Budget (Hours) *"
              type="number"
              value={totalHours}
              onChange={(e) => setTotalHours(e.target.value)}
              min="10"
              max="2000"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Target Completion Date"
              type="date"
              value={targetEndDate}
              onChange={(e) => setTargetEndDate(e.target.value)}
              required
            />
          </div>

          {/* Team Members Assignment Selector */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300">
                Allocate Team Members ({selectedMemberIds.length} Selected)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Manager: {currentUser.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-navy-950/60 p-2.5">
              {employees.map((emp) => {
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <button
                    type="button"
                    key={emp.id}
                    onClick={() => toggleMemberSelection(emp.id)}
                    className={`flex items-center justify-between rounded-lg p-2 text-left text-xs transition-colors border ${
                      isSelected
                        ? 'border-violet-500/60 bg-violet-950/30 text-white'
                        : 'border-slate-800 bg-navy-900/40 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 text-[10px] font-bold text-white shrink-0">
                        {emp.fullName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {emp.department} • {emp.currentLoadHours}h load
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-cyan-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              <span>Launch Project</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
