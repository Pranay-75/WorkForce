'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';

export default function MatchingHubPage() {
  const { recommendations, tasks, approveRecommendation, rejectRecommendation } = useMockStore();

  const [selectedTaskId, setSelectedTaskId] = React.useState<string>('task-104');
  const [rejectModalRecId, setRejectModalRecId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const targetTask = tasks.find((t) => t.id === selectedTaskId) || tasks[3];
  const taskRecommendations = recommendations.filter((r) => r.taskId === selectedTaskId);

  const handleConfirmReject = () => {
    if (rejectModalRecId && rejectReason.trim()) {
      rejectRecommendation(rejectModalRecId, rejectReason);
      setRejectModalRecId(null);
      setRejectReason('');
    }
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
            <Badge variant="violet" size="sm">
              <Sparkles className="h-3 w-3 mr-1" />
              Gemini Advisory Engine
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Deterministic candidate pre-filtering combined with natural-language explainability and human-in-the-loop sign-off
          </p>
        </div>

        {/* Task Selection Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Target Task:</span>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-navy-850 px-3 py-1.5 text-xs font-semibold text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.estimatedHours}h - {t.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Task Overview Banner */}
      {targetTask && (
        <Card className="border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <span>Project: {targetTask.projectName}</span>
                <span>•</span>
                <span className="text-slate-300">Estimated: {targetTask.estimatedHours}h</span>
                <span>•</span>
                <span className="text-slate-300">Due: {targetTask.dueDate}</span>
              </div>
              <h3 className="text-lg font-bold text-white">
                {targetTask.title}
              </h3>
              <p className="text-xs text-slate-300 line-clamp-2">
                {targetTask.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
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
      )}

      {/* Human In The Loop Governance Notice */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3.5 px-4 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>
            <strong>Human-in-the-Loop Governance:</strong> AI rankings are strictly advisory. Final assignments require explicit manager approval and are logged to the immutable audit history.
          </span>
        </div>
      </div>

      {/* Candidate Recommendation Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight">
            Ranked Candidate Suggestions ({taskRecommendations.length})
          </h3>
          <span className="text-xs text-slate-400">
            Weighted on: Skill Overlap (40%), Capacity Delta (40%), Deadline Feasibility (20%)
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {taskRecommendations.map((rec, rankIdx) => {
            const isAccepted = rec.status === 'accepted';
            const isRejected = rec.status === 'rejected';

            return (
              <Card
                key={rec.id}
                className={`border-slate-800 transition-all ${
                  isAccepted
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
                        {rec.candidateAvatar || 'EM'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            Rank #{rankIdx + 1}
                          </span>
                          <h4 className="text-base font-bold text-white">
                            {rec.candidateName}
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
                          {rec.candidateTitle} • {rec.candidateDepartment}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                          Composite Match
                        </span>
                        <span
                          className={`text-2xl font-extrabold font-mono ${
                            rec.matchScore >= 90
                              ? 'text-emerald-400'
                              : rec.matchScore >= 70
                              ? 'text-cyan-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {rec.matchScore}%
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
                          {rec.skillMatchBreakdown.skillScore}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rec.skillMatchBreakdown.matchedSkills.map((ms, idx) => (
                          <Badge key={idx} variant="cyan" size="sm">
                            {ms.skill}: {ms.candidateLevel} (Req: {ms.requiredLevel})
                          </Badge>
                        ))}
                        {rec.skillMatchBreakdown.missingSkills.map((miss, idx) => (
                          <Badge key={idx} variant="amber" size="sm">
                            Missing: {miss}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* 2. Capacity Impact */}
                    <div className="rounded-xl border border-slate-800 bg-navy-900/60 p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200">
                          Workload Impact Simulation:
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
                      <ProgressBar
                        value={rec.workloadImpact.projectedUtilizationPct}
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

                  {/* Manager Action Bar */}
                  {!isAccepted && !isRejected && (
                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectModalRecId(rec.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject with Reason
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approveRecommendation(rec.id)}
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
