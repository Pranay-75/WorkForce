/**
 * useMatchingAPI.ts
 * Fetches real AI task matching and manager governance data from the FastAPI backend.
 * Falls back gracefully if backend is unreachable.
 *
 * Endpoints consumed:
 *  POST /api/v1/ai/match-task                   → TaskMatchResponse
 *  POST /api/v1/recommendations/{id}/decision   → ManagerDecisionResponse
 */

'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types mirroring backend schemas ──────────────────────────────────────────

export interface MatchedSkillDetail {
  skill: string;
  required_level: string;
  candidate_level: string;
  meets_requirement: boolean;
}

export interface SkillMatchBreakdown {
  matched_skills: MatchedSkillDetail[];
  missing_skills: string[];
  skill_score: number;
}

export interface WorkloadImpact {
  current_load_hours: number;
  task_estimated_hours: number;
  projected_load_hours: number;
  weekly_capacity_hours: number;
  projected_utilization_pct: number;
  is_projected_overloaded: boolean;
}

export interface CandidateRecommendation {
  candidate_id: string;
  candidate_name: string;
  candidate_title: string;
  candidate_department: string;
  candidate_avatar?: string | null;
  match_score: number;
  is_eligible: boolean;
  skill_match_breakdown: SkillMatchBreakdown;
  workload_impact: WorkloadImpact;
  rationale: string;
  risk_factors: string[];
  // Governance state (managed locally after decisions)
  status?: 'pending' | 'accepted' | 'rejected' | 'overridden';
  decision_reason?: string;
}

export interface TaskMatchResponse {
  task_id: string;
  task_title: string;
  recommendations: CandidateRecommendation[];
  total_candidates_evaluated: number;
  eligible_candidate_count: number;
  no_match_reason?: string | null;
}

export interface ManagerDecisionResponse {
  recommendation_id: string;
  task_id: string;
  status: string;
  assigned_to?: string | null;
  feedback_reason?: string | null;
  decided_at: string;
  audit_event_id?: string | null;
}

// ─── Helper: get Supabase JWT for backend auth ─────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please log in.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── Hook: useTaskMatching ─────────────────────────────────────────────────────

export function useTaskMatching() {
  const [result, setResult] = React.useState<TaskMatchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Local decision state so UI updates immediately after approve/reject
  const [decisions, setDecisions] = React.useState<
    Record<string, { status: 'accepted' | 'rejected' | 'overridden'; reason?: string }>
  >({});

  const matchTask = React.useCallback(async (taskId: string, maxCandidates = 5) => {
    setLoading(true);
    setError(null);
    setDecisions({});
    try {
      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_URL}/api/v1/ai/match-task`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task_id: taskId, max_candidates: maxCandidates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json: TaskMatchResponse = await res.json();
      // Initialize all as pending
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Failed to match task candidates');
    } finally {
      setLoading(false);
    }
  }, []);


  const approveRecommendation = React.useCallback(
    async (recommendationId: string) => {
      const headers = await getAuthHeaders();
      const res = await window.fetch(
        `${API_URL}/api/v1/recommendations/${encodeURIComponent(recommendationId)}/decision`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ decision: 'accepted' }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const json: ManagerDecisionResponse = await res.json();

      setDecisions((prev) => ({
        ...prev,
        [recommendationId]: { status: 'accepted' },
      }));

      return json;
    },
    []
  );

  const rejectRecommendation = React.useCallback(
    async (recommendationId: string, reason: string) => {
      if (!reason.trim()) {
        throw new Error('Please provide a reason for rejection.');
      }

      const headers = await getAuthHeaders();
      const res = await window.fetch(
        `${API_URL}/api/v1/recommendations/${encodeURIComponent(recommendationId)}/decision`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            decision: 'rejected',
            feedback_reason: reason.trim(),
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const json: ManagerDecisionResponse = await res.json();

      setDecisions((prev) => ({
        ...prev,
        [recommendationId]: {
          status: 'rejected',
          reason: reason.trim(),
        },
      }));

      return json;
    },
    []
  );

  // Merge local decisions into recommendations so UI reflects immediately
  const recommendations: CandidateRecommendation[] =
    result?.recommendations.map((rec) => {
      const recId = `rec-${result.task_id}-${rec.candidate_id}`;
      const decision = decisions[recId];
      return decision
        ? { ...rec, status: decision.status, decision_reason: decision.reason }
        : { ...rec, status: rec.status ?? 'pending' };
    }) ?? [];

  return {
    result,
    recommendations,
    loading,
    error,
    matchTask,
    approveRecommendation,
    rejectRecommendation,
  };
}
