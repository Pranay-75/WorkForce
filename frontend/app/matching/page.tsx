'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/authContext';
import { useTasks } from '@/lib/hooks/useTasks';
import { useProjects } from '@/lib/hooks/useProjects';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { useMockStore } from '@/lib/mockStore';
import {
  computeDeterministicMatchScores,
  calculateEmployeeWorkload,
} from '@/lib/workloadEngine';
import {
  getAIMatchingExplanation,
  MatchingExplanationResult,
} from '@/lib/aiService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

export default function MatchingHubPage() {
  const { isAuthenticated, organization, session, role: authRole } = useAuth();
  const isLive = Boolean(isAuthenticated && organization?.id);

  // Live hooks
  const {
    tasks: liveTasks,
    isLoading: isTasksLoading,
    assignTask: dbAssignTask,
    refetch: refetchTasks,
  } = useTasks();

  const { projects: liveProjects } = useProjects();

  const {
    members: liveMembers,
    isLoading: isMembersLoading,
  } = useOrganizationMembers();

  // Mock store fallback
  const {
    recommendations: mockRecommendations,
    projects: mockProjects,
    employees: mockEmployees,
    tasks: mockTasks,
    approveRecommendation: mockApproveRecommendation,
    rejectRecommendation: mockRejectRecommendation,
    activeRole: mockRole,
  } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;

  const tasks = isLive ? liveTasks : mockTasks;

  const [selectedTaskId, setSelectedTaskId] = React.useState<string>('');
  const [rejectModalRecId, setRejectModalRecId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionFeedback, setActionFeedback] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [decisionState, setDecisionState] = React.useState<Record<string, { status: 'accepted' | 'rejected'; reason?: string }>>({});
  const [aiExplanations, setAiExplanations] = React.useState<Record<string, MatchingExplanationResult>>({});
  const [explainingId, setExplainingId] = React.useState<string | null>(null);

  // Sync selected task ID
  React.useEffect(() => {
    if (tasks.length > 0 && (!selectedTaskId || !tasks.find((t) => t.id === selectedTaskId))) {
      const firstUnassigned = tasks.find((t) => !t.assignedTo) || tasks[0];
      setSelectedTaskId(firstUnassigned.id);
    }
  }, [tasks, selectedTaskId]);

  const targetTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const projects = isLive ? liveProjects : mockProjects;

  // Dynamic recommendations using shared workload engine
  const taskRecommendations = React.useMemo(() => {
    if (!targetTask) return [];

    const currentProj = projects.find((p) => p.id === targetTask.projectId);
    const projMemberIds = currentProj?.memberIds || [];

    const candidatesList = isLive
      ? liveMembers.map((m) => ({
          id: m.userId,
          fullName: m.fullName,
          jobTitle: m.jobTitle || 'Team Member',
          department: m.department || 'Engineering',
          weeklyCapacityHours: m.weeklyCapacityHours || 40,
        }))
      : mockEmployees;

    const baseRecs = computeDeterministicMatchScores(
      targetTask,
      candidatesList as any,
      tasks,
      projMemberIds
    );

    return baseRecs.map((rec) => {
      const isCurrentAssignee = targetTask.assignedTo === rec.candidateId;
      const dec = decisionState[`${targetTask.id}:${rec.candidateId}`];

      return {
        ...rec,
        status: isCurrentAssignee
          ? ('accepted' as const)
          : dec?.status === 'rejected'
          ? ('rejected' as const)
          : ('pending' as const),
        decisionReason: dec?.reason,
      };
    });
  }, [isLive, liveMembers, mockEmployees, tasks, targetTask, projects, decisionState]);

  const handleExplainWithAI = async (rec: typeof taskRecommendations[0]) => {
    setExplainingId(rec.candidateId);
    const explanation = await getAIMatchingExplanation(
      {
        task_title: rec.taskTitle,
        estimated_hours: rec.workloadImpact.taskEstimatedHours,
        candidate_name: rec.candidateName,
        candidate_job_title: rec.candidateTitle,
        candidate_department: rec.candidateDepartment,
        current_load_hours: rec.workloadImpact.currentLoadHours,
        weekly_capacity_hours: rec.workloadImpact.weeklyCapacityHours,
        projected_utilization_pct: rec.workloadImpact.projectedUtilizationPct,
        match_score: rec.matchScore,
        is_allocated_to_project: projects.find((p) => p.id === targetTask?.projectId)?.memberIds?.includes(rec.candidateId) ?? true,
        satisfied_skills: rec.skillMatchBreakdown.matchedSkills.map((s) => s.skill),
        missing_skills: rec.skillMatchBreakdown.missingSkills,
      },
      session?.access_token,
      organization?.id
    );

    setAiExplanations((prev) => ({
      ...prev,
      [rec.candidateId]: explanation,
    }));
    setExplainingId(null);
  };

  if (activeRole === 'employee') {
    return (
      <AccessDenied
        resourceName="AI Matching Hub"
        currentRole={activeRole}
        requiredRoles={['manager', 'admin', 'hr', 'organizer']}
        description="Candidate recommendation rankings, workload impact projections, and AI match scoring are restricted to team managers and administrators."
      />
    );
  }

  const handleApprove = async (rec: typeof taskRecommendations[0]) => {
    setActionLoading(true);
    setActionFeedback(null);

    if (isLive) {
      const res = await dbAssignTask(rec.taskId, rec.candidateId);
      setActionLoading(false);
      if (res.error) {
        setActionFeedback({ text: res.error, type: 'error' });
      } else {
        // Assignment state is derived from refetched tasks (isCurrentAssignee)
        setActionFeedback({
          text: `Task "${rec.taskTitle}" assigned to ${rec.candidateName} successfully.`,
          type: 'success',
        });
      }
    } else {
      mockApproveRecommendation(rec.id);
      setActionLoading(false);
      setActionFeedback({
        text: `Task assigned to ${rec.candidateName} (Demo).`,
        type: 'success',
      });
    }
  };

  const handleConfirmReject = () => {
    if (rejectModalRecId && rejectReason.trim()) {
      const rec = taskRecommendations.find((r) => r.id === rejectModalRecId);
      if (rec) {
        setDecisionState((prev) => ({
          ...prev,
          [`${rec.taskId}:${rec.candidateId}`]: { status: 'rejected', reason: rejectReason.trim() },
        }));
      }
      if (!isLive) {
        mockRejectRecommendation(rejectModalRecId, rejectReason);
      }
      setRejectModalRecId(null);
      setRejectReason('');
      setActionFeedback({
        text: 'Recommendation rejected with documented rationale.',
        type: 'success',
      });
    }
  };

  if (isLive && isTasksLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm text-slate-400">Loading live organization tasks &amp; matching parameters...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Explainable AI Task Matching Hub
            </h2>
            <Badge variant={isLive ? 'cyan' : 'violet'} size="sm">
              <Sparkles className="h-3 w-3 mr-1" />
              {isLive ? 'Live Advisory Engine' : 'Simulated Demo Advisory'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic candidate pre-filtering combined with natural-language explainability and human-in-the-loop sign-off
          </p>
        </div>

        {/* Task Selection Selector */}
        {tasks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Target Task:</span>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:border-violet-500 focus:outline-none max-w-xs truncate"
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.estimatedHours}h - {t.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionFeedback && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3.5 text-xs ${
            actionFeedback.type === 'success'
              ? 'border border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              : 'border border-rose-500/40 bg-rose-950/30 text-rose-300'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{actionFeedback.text}</span>
        </div>
      )}

      {/* Selected Task Overview Banner */}
      {targetTask ? (
        <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span>Project: {targetTask.projectName || 'Active Workspace'}</span>
                <span>•</span>
                <span className="text-slate-300">Estimated: {targetTask.estimatedHours}h</span>
                {targetTask.dueDate && (
                  <>
                    <span>•</span>
                    <span className="text-slate-300">Due: {targetTask.dueDate}</span>
                  </>
                )}
              </div>
              <h3 className="text-lg font-bold text-white">
                {targetTask.title}
              </h3>
              <p className="text-xs text-slate-300 line-clamp-2">
                {targetTask.description || 'No detailed task description provided.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={
                  targetTask.priority === 'critical'
                    ? 'rose'
                    : targetTask.priority === 'high'
                    ? 'amber'
                    : 'slate'
                }
                size="sm"
              >
                {targetTask.priority.toUpperCase()} PRIORITY
              </Badge>
              <Badge variant="cyan" size="sm">
                STATUS: {targetTask.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </Card>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-navy-900/40 p-12 text-center text-slate-400 space-y-3">
          <Sparkles className="mx-auto h-10 w-10 text-slate-500 mb-2" />
          <h4 className="text-base font-bold text-white">No Tasks Available for Matching</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create tasks in the Tasks section to generate AI-assisted matching recommendations.
          </p>
          <Link href="/tasks">
            <Button variant="primary" size="sm" className="mt-2">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Go to Tasks</span>
            </Button>
          </Link>
        </div>
      )}

      {/* Human In The Loop Governance Notice */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 px-4 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>
            <strong>Human-in-the-Loop Governance:</strong> AI rankings are strictly advisory. Final assignments require explicit manager approval and execute database-enforced transactions.
          </span>
        </div>
      </div>

      {/* Candidate Recommendation Cards */}
      {taskRecommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">
              Ranked Candidate Suggestions ({taskRecommendations.length})
            </h3>
            <span className="text-xs text-slate-400">
              Weighted on: Capacity Availability (50%) & Department Alignment (50%)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {taskRecommendations.map((rec) => {
              const isAccepted = rec.status === 'accepted';
              const isRejected = rec.status === 'rejected';

              return (
                <Card
                  key={rec.id}
                  className={`border-slate-800 transition-all ${
                    isAccepted
                      ? 'border-emerald-500/60 bg-emerald-950/15'
                      : isRejected
                      ? 'border-rose-900/40 opacity-75'
                      : 'hover:border-violet-500/40'
                  }`}
                >
                  <div className="p-5 space-y-4">
                    {/* Candidate Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-800 text-sm font-bold text-white">
                          {rec.candidateName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">
                              {rec.candidateName}
                            </h4>
                            <Badge variant="cyan" size="sm">
                              {rec.candidateDepartment}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400">{rec.candidateTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Match Score
                          </span>
                          <span className="text-xl font-extrabold font-mono text-cyan-400">
                            {rec.matchScore}%
                          </span>
                        </div>
                        <Badge
                          variant={
                            isAccepted ? 'emerald' : isRejected ? 'rose' : 'violet'
                          }
                          size="md"
                        >
                          {isAccepted ? 'Assigned' : isRejected ? 'Rejected' : 'Recommended'}
                        </Badge>
                      </div>
                    </div>

                    {/* Breakdown & Workload Impact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Skills */}
                      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2">
                        <span className="text-xs font-semibold text-slate-200 block">
                          Capability Alignment:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.skillMatchBreakdown.matchedSkills.map((ms, idx) => (
                            <Badge key={idx} variant="cyan" size="sm">
                              {ms.skill} ({ms.candidateLevel})
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Capacity Impact */}
                      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            Workload Impact:
                          </span>
                          <span className="font-mono text-slate-300">
                            {rec.workloadImpact.currentLoadHours}h →{' '}
                            <strong
                              className={
                                rec.workloadImpact.projectedUtilizationPct > 100
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {rec.workloadImpact.projectedLoadHours}h (
                              {rec.workloadImpact.projectedUtilizationPct}%)
                            </strong>
                          </span>
                        </div>
                        <ProgressBar value={rec.workloadImpact.projectedUtilizationPct} />
                      </div>
                    </div>

                    {/* Explainability Rationale */}
                    <div className="rounded-xl border border-violet-500/20 bg-navy-950/60 p-3.5 space-y-1.5 text-xs">
                      <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        Recommendation Rationale:
                      </span>
                      <p className="text-slate-200 leading-relaxed italic">
                        &ldquo;{rec.rationale}&rdquo;
                      </p>
                      {rec.riskFactors.length > 0 && (
                        <div className="pt-1 text-[11px] text-amber-300 space-y-0.5">
                          {rec.riskFactors.map((rf, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Risk Note: {rf}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Gemini AI Detailed Explanation Card */}
                    {aiExplanations[rec.candidateId] && (
                      <div className="rounded-xl border border-violet-500/40 bg-navy-950/80 p-3.5 space-y-2 text-xs animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-violet-300 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                            Executive Assessment ({aiExplanations[rec.candidateId].model_used || 'Operational AI'}):
                          </span>
                          <Badge variant={aiExplanations[rec.candidateId].is_ai_generated ? 'violet' : 'slate'} size="sm">
                            {aiExplanations[rec.candidateId].is_ai_generated ? 'Powered by Gemini 3.8-Flash' : 'Deterministic Rationale'}
                          </Badge>
                        </div>
                        <p className="text-slate-200 leading-relaxed font-medium">
                          {aiExplanations[rec.candidateId].ai_rationale}
                        </p>
                        <p className="text-slate-300">
                          <strong>Capacity Impact:</strong> {aiExplanations[rec.candidateId].capacity_assessment}
                        </p>
                        {aiExplanations[rec.candidateId].trade_offs.length > 0 && (
                          <div className="space-y-0.5 pt-1 text-slate-400">
                            <span className="font-semibold text-slate-300 block">Trade-Off Considerations:</span>
                            {aiExplanations[rec.candidateId].trade_offs.map((to, i) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className="text-amber-400">•</span>
                                <span>{to}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Manager Action Bar */}
                    {!isAccepted && !isRejected && (
                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleExplainWithAI(rec)}
                          disabled={explainingId === rec.candidateId}
                          className="text-xs"
                        >
                          <Sparkles className={`h-3.5 w-3.5 mr-1 text-violet-400 ${explainingId === rec.candidateId ? 'animate-spin' : ''}`} />
                          <span>{explainingId === rec.candidateId ? 'Consulting Gemini...' : 'Explain Fit with Gemini'}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRejectModalRecId(rec.id)}
                          disabled={actionLoading}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject with Reason
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(rec)}
                          disabled={actionLoading}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve & Assign Task
                        </Button>
                      </div>
                    )}

                    {rec.decisionReason && (
                      <div className="rounded-lg bg-navy-950 p-2.5 text-xs text-rose-300 border border-rose-900/40">
                        <strong>Rejection Feedback:</strong> {rec.decisionReason}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Reject Reason Dialog */}
      <Dialog
        isOpen={!!rejectModalRecId}
        onClose={() => setRejectModalRecId(null)}
        title="Reject AI Recommendation"
        description="Provide structured manager feedback to record in the audit trail."
      >
        <div className="space-y-3.5 py-2">
          <label className="block text-xs font-medium text-slate-300">
            Reason for Rejection *
          </label>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Employee already focusing on upcoming SDK milestone or requires different domain familiarity..."
            className="w-full rounded-lg border border-slate-700 bg-navy-850 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejectModalRecId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
