'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTaskMatching } from '@/lib/hooks/useMatchingAPI';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
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
  Award,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

export default function MatchingHubPage() {
  const { recommendations, result, loading, error, matchTask, approveRecommendation, rejectRecommendation } = useTaskMatching();

  const [selectedTaskId, setSelectedTaskId] = React.useState<string>('');
  const [rejectModalRecId, setRejectModalRecId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionFeedback, setActionFeedback] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [decisionState, setDecisionState] = React.useState<Record<string, { status: 'accepted' | 'rejected'; reason?: string }>>({});

  // Sync selected task ID
  React.useEffect(() => {
    if (tasks.length > 0 && (!selectedTaskId || !tasks.find((t) => t.id === selectedTaskId))) {
      const firstUnassigned = tasks.find((t) => !t.assignedTo) || tasks[0];
      setSelectedTaskId(firstUnassigned.id);
    }
  }, [tasks, selectedTaskId]);

  const targetTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  // Dynamic recommendations for live or mock
  const taskRecommendations = React.useMemo(() => {
    if (!targetTask) return [];

    if (!isLive) {
      return mockRecommendations.filter((r) => r.taskId === selectedTaskId);
    }

    const taskHours = Number(targetTask.estimatedHours) || 0;
    const isUnestimated = taskHours === 0;

    return liveMembers.map((m) => {
      const assigned = liveTasks.filter((t) => t.assignedTo === m.userId && t.status !== 'completed');
      const curLoad = assigned.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
      const cap = m.weeklyCapacityHours;
      const projLoad = curLoad + taskHours;
      const projUtil = cap > 0 ? Math.round((projLoad / cap) * 100) : 999;

      const requiredSkills = targetTask.requiredSkills || [];
      const matchedSkills: { skill: string; requiredLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'; candidateLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' }[] = [];
      const missingSkills: string[] = [];

      if (requiredSkills.length > 0) {
        requiredSkills.forEach((req) => {
          const deptMatch = m.department && req.skillName.toLowerCase().includes(m.department.toLowerCase());
          const titleMatch = m.jobTitle && req.skillName.toLowerCase().includes(m.jobTitle.toLowerCase());
          if (deptMatch || titleMatch) {
            matchedSkills.push({
              skill: req.skillName,
              requiredLevel: req.minProficiency,
              candidateLevel: req.minProficiency,
            });
          } else {
            missingSkills.push(req.skillName);
          }
        });
      }

      const skillScore = requiredSkills.length > 0
        ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
        : 85;

      // Deterministic heuristic score: 50% capacity availability + 50% skill match
      const capScore = cap > 0 ? Math.max(0, 100 - Math.min(projUtil, 100)) : 0;
      const matchScore = Math.min(99, Math.max(10, Math.round(capScore * 0.5 + skillScore * 0.5)));

      const isCurrentAssignee = targetTask.assignedTo === m.userId;
      const dec = decisionState[`${targetTask.id}:${m.userId}`];

      const riskFactors: string[] = [];
      if (cap === 0) {
        riskFactors.push('Member has 0h configured weekly capacity');
      } else if (projUtil > 100) {
        riskFactors.push(`Projected load exceeds ${cap}h weekly capacity`);
      }

      let rationale = '';
      if (isCurrentAssignee) {
        rationale = `Currently assigned to this task. Active workload is ${curLoad}h (${cap > 0 ? Math.round((curLoad / cap) * 100) : 0}% capacity).`;
      } else {
        const bandwidthText = cap > 0 ? `${Math.max(0, cap - curLoad)}h available bandwidth` : '0h configured capacity';
        const hoursText = isUnestimated ? 'Task hours unestimated (0h logged).' : `Task requires ${taskHours}h.`;
        const skillText = requiredSkills.length > 0
          ? `Matches ${matchedSkills.length}/${requiredSkills.length} required skills.`
          : 'No prerequisite skills specified for task.';
        rationale = `${bandwidthText}. ${hoursText} ${skillText} Projected load is ${cap > 0 ? `${projUtil}%` : 'unbounded'}.`;
      }

  const handleConfirmReject = async () => {
    if (rejectModalRecId && rejectReason.trim()) {
      await rejectRecommendation(rejectModalRecId, rejectReason);
      setRejectModalRecId(null);
      setRejectReason('');
      setActionFeedback({
        text: 'Recommendation rejected with documented rationale.',
        type: 'success',
      });
    }
  };

  const handleMatchTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    if (taskId) matchTask(taskId);
  };

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
              {isLive ? 'Live Advisory Engine' : 'Gemini Advisory Demo'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic candidate pre-filtering combined with natural-language explainability and human-in-the-loop sign-off
          </p>
        </div>

        {/* Task ID Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Task ID:</span>
          <input
            type="text"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            placeholder="Enter task ID..."
            className="rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:border-violet-500 focus:outline-none w-48"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleMatchTask(selectedTaskId)}
            disabled={!selectedTaskId || loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white mr-1" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1" />
            )}
            {loading ? 'Matching...' : 'Find Candidates'}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-sm text-rose-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="rounded-xl border border-slate-700 bg-navy-900/40 p-12 text-center space-y-3">
          <Sparkles className="mx-auto h-10 w-10 text-violet-400/50" />
          <h3 className="text-base font-bold text-white">Ready to Match</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Enter a Task ID above and click &ldquo;Find Candidates&rdquo; to run the AI matching engine against real workload data.
          </p>
        </div>
      )}

      {/* Selected Task Overview Banner */}
      {result && (
        <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span>Task ID: {result.task_id}</span>
                <span>•</span>
                <span className="text-slate-300">Evaluated: {result.total_candidates_evaluated} candidates</span>
                <span>•</span>
                <span className="text-slate-300">Eligible: {result.eligible_candidate_count}</span>
              </div>
              <h3 className="text-lg font-bold text-white">{result.task_title}</h3>
              {result.no_match_reason && (
                <p className="text-xs text-amber-300">{result.no_match_reason}</p>
              )}
            </div>
            <Badge variant="violet" size="sm">AI Match Complete</Badge>
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
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">
              Ranked Candidate Suggestions ({recommendations.length})
            </h3>
            <span className="text-xs text-slate-400">
              Weighted on: Skill Overlap (60%), Capacity Fit (40%)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {recommendations.map((rec, rankIdx) => {
              const recId = `rec-${result?.task_id}-${rec.candidate_id}`;
              const isAccepted = rec.status === 'accepted';
              const isRejected = rec.status === 'rejected';

              return (
                <Card
                  key={rec.candidate_id}
                  className={`border-slate-800 transition-all ${isAccepted
                    ? 'border-emerald-500/60 bg-navy-900'
                    : isRejected
                      ? 'opacity-60 border-slate-800'
                      : 'hover:border-violet-500/50'
                    }`}
                >
                  <div className="p-5 space-y-4">
                    {/* Candidate Header & Composite Score */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-700 to-indigo-800 text-sm font-bold text-white shadow-glow border border-violet-400/40">
                          {rec.candidate_avatar || 'EM'}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              Rank #{rankIdx + 1}
                            </span>
                            <h4 className="text-base font-bold text-white">
                              {rec.candidate_name}
                            </h4>
                            {isAccepted && (
                              <Badge variant="emerald" size="sm">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Assigned by Manager
                              </Badge>
                            )}
                            {isRejected && (
                              <Badge variant="rose" size="sm">
                                Rejected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            {rec.candidate_title} • {rec.candidate_department}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                            Composite Match
                          </span>
                          <span
                            className={`text-2xl font-extrabold font-mono ${rec.match_score >= 90
                              ? 'text-emerald-400'
                              : rec.match_score >= 70
                                ? 'text-cyan-400'
                                : 'text-rose-400'
                              }`}
                          >
                            {rec.match_score}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Multi-Factor Breakdown Grid */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {/* 1. Skill Overlap */}
                      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5 text-cyan-400" />
                            Skill Overlap Breakdown:
                          </span>
                          <span className="font-mono text-emerald-400 font-bold">
                            {rec.skill_match_breakdown.skill_score}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rec.skill_match_breakdown.matched_skills.map((ms, idx) => (
                            <Badge key={idx} variant="cyan" size="sm">
                              {ms.skill}: {ms.candidate_level} (Req: {ms.required_level})
                            </Badge>
                          ))}
                          {rec.skill_match_breakdown.missing_skills.map((miss, idx) => (
                            <Badge key={idx} variant="amber" size="sm">
                              Missing: {miss}
                            </Badge>
                          ))}
                        </div>
                        {rec.skill_match_breakdown.missing_skills.length > 0 && (
                          <p className="text-[10px] font-mono text-amber-400/80 pt-0.5">
                            {rec.skill_match_breakdown.missing_skills.length} missing prerequisite(s)
                          </p>
                        )}
                      </div>

                      {/* 2. Capacity Impact */}
                      <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">
                            Workload Impact Simulation:
                          </span>
                          <span className="font-mono text-slate-300">
                            {rec.workload_impact.current_load_hours}h →{' '}
                            <strong
                              className={
                                rec.workload_impact.projected_utilization_pct > 100
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {rec.workload_impact.projected_load_hours}h (
                              {rec.workload_impact.projected_utilization_pct}%)
                            </strong>
                          </span>
                        </div>
                        <ProgressBar
                          value={rec.workload_impact.projected_utilization_pct}
                        />
                      </div>
                    </div>

                    {/* AI Explainability Rationale */}
                    <div className="rounded-xl border border-violet-500/20 bg-navy-950/60 p-3.5 space-y-1.5 text-xs">
                      <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                        Gemini Advisory Rationale:
                      </span>
                      <p className="text-slate-200 leading-relaxed italic">
                        &ldquo;{rec.rationale}&rdquo;
                      </p>
                      {rec.risk_factors.length > 0 && (
                        <div className="pt-1 text-[11px] text-amber-300 space-y-0.5">
                          {rec.risk_factors.map((rf: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Risk Note: {rf}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Manager Action Bar */}
                    {!isAccepted && !isRejected && (
                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRejectModalRecId(recId)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject with Reason
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => approveRecommendation(recId)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve & Assign Task
                        </Button>
                      </div>
                    )}

                    {rec.decision_reason && (
                      <div className="rounded-lg bg-navy-950 p-2.5 text-xs text-rose-300 border border-rose-900/40">
                        <strong>Rejection Feedback:</strong> {rec.decision_reason}
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
