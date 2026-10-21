/**
 * useWorkloadAPI.ts
 * Fetches real workload intelligence data from the FastAPI backend.
 * Falls back gracefully to mock data if backend is unreachable.
 *
 * Endpoints consumed:
 *  GET  /api/v1/workload/overview          → OrganizationWorkloadOverview
 *  POST /api/v1/ai/redistribute-workload   → WorkloadRedistributionResponse
 */

'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Types mirroring backend schemas ──────────────────────────────────────────

export interface EmployeeWorkloadStats {
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  job_title: string;
  avatar_url?: string | null;
  weekly_capacity_hours: number;
  current_load_hours: number;
  utilization_pct: number;
  remaining_capacity_hours: number;
  is_overloaded: boolean;
  active_task_count: number;
  operational_risk_score: number;
  load_band: 'optimal' | 'near_limit' | 'overloaded';
}

export interface DepartmentWorkloadBreakdown {
  department: string;
  capacity_hours: number;
  allocated_hours: number;
  utilization_pct: number;
  employee_count: number;
}

export interface OrganizationWorkloadOverview {
  total_employees: number;
  total_capacity_hours: number;
  total_allocated_hours: number;
  average_utilization_pct: number;
  overloaded_count: number;
  underutilized_count: number;
  department_breakdown: DepartmentWorkloadBreakdown[];
  employee_workloads: EmployeeWorkloadStats[];
}

export interface RedistributionEmployeeInfo {
  id: string;
  name: string;
  current_load: number;
  projected_load: number;
  weekly_capacity: number;
  projected_utilization_pct: number;
}

export interface WorkloadRedistributionProposal {
  id: string;
  task_id: string;
  task_title: string;
  task_hours: number;
  source_employee: RedistributionEmployeeInfo;
  target_employee: RedistributionEmployeeInfo;
  rationale: string;
}

export interface WorkloadRedistributionResponse {
  proposals: WorkloadRedistributionProposal[];
  net_capacity_impact: {
    overloaded_reduced_count: number;
    average_utilization_delta: number;
  };
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

// ─── Hook: useWorkloadOverview ─────────────────────────────────────────────────

export function useWorkloadOverview(department?: string) {
  const [data, setData] = React.useState<OrganizationWorkloadOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Named fetchWorkload to avoid shadowing window.fetch
  const fetchWorkload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const params = department ? `?department=${encodeURIComponent(department)}` : '';
      const res = await window.fetch(`${API_URL}/api/v1/workload/overview${params}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json: OrganizationWorkloadOverview = await res.json();
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load workload data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [department]);

  React.useEffect(() => { fetchWorkload(); }, [fetchWorkload]);

  return { data, loading, error, refetch: fetchWorkload };
}

// ─── Hook: useRedistributionProposals ─────────────────────────────────────────

export function useRedistributionProposals() {
  const [data, setData] = React.useState<WorkloadRedistributionResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Named fetchRedist to avoid shadowing window.fetch
  const fetchRedist = React.useCallback(async (department?: string, targetMaxUtilization = 90) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await window.fetch(`${API_URL}/api/v1/ai/redistribute-workload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          department: department || null,
          target_max_utilization_pct: targetMaxUtilization,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json: WorkloadRedistributionResponse = await res.json();
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load redistribution proposals';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchRedist(); }, [fetchRedist]);

  return { data, loading, error, refetch: fetchRedist };
}
