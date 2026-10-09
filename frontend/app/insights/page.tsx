'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import {
  Flame,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
} from 'lucide-react';

export default function InsightsPage() {
  const { employees } = useMockStore();

  const sortedByRisk = [...employees].sort(
    (a, b) => b.burnoutRiskScore - a.burnoutRiskScore
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Employee Performance & Operational Risk
            </h2>
            <Badge variant="rose" size="sm">
              Operational Risk Matrix
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track milestone velocities, delivery metrics, and operational scheduling congestion
          </p>
        </div>
      </div>

      {/* Ethical Framework Disclaimer Alert */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 shadow-card">
        <div className="flex items-start gap-3.5">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-white text-sm block">
              Ethical Risk & Operational Metric Guidelines
            </span>
            <p className="text-slate-300 leading-relaxed">
              WorkForce strictly frames all risk indexes as <strong>operational capacity and delivery metrics</strong>. Scores are calculated deterministically from scheduled task hours, consecutive overload weeks, and deadline tightness. They are designed to assist managers in balancing workloads and do not constitute psychological or clinical predictions.
            </p>
          </div>
        </div>
      </div>

      {/* Velocity and Performance Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Avg. On-Time Completion
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                94.2%
              </div>
              <p className="text-[11px] text-slate-400">+2.4% over last 4 weeks</p>
            </div>
            <TrendingUp className="h-8 w-8 text-emerald-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                Sprint Milestone Velocity
              </span>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                88.6 hrs / wk
              </div>
              <p className="text-[11px] text-slate-400">Across 4 engineering squads</p>
            </div>
            <Activity className="h-8 w-8 text-cyan-400 opacity-80" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold text-slate-400">
                AI Match Acceptance Rate
              </span>
              <div className="text-2xl font-bold font-mono text-violet-400">
                86.7%
              </div>
              <p className="text-[11px] text-slate-400">Manager approved assignments</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-violet-400 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Operational Scheduling Congestion Table */}
      <Card>
        <CardHeader>
          <CardTitle>Operational Scheduling Risk Index</CardTitle>
          <CardDescription>
            Heuristic indicators based on active task density and capacity allocation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="border-b border-slate-800 bg-navy-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Weekly Load</th>
                  <th className="px-4 py-3">On-Time Velocity</th>
                  <th className="px-4 py-3">Operational Risk Index</th>
                  <th className="px-4 py-3">Status Assessment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sortedByRisk.map((emp) => {
                  const riskPct = Math.round(emp.burnoutRiskScore * 100);
                  const utilPct = Math.round(
                    (emp.currentLoadHours / emp.weeklyCapacityHours) * 100
                  );

                  return (
                    <tr key={emp.id} className="hover:bg-navy-800/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        {emp.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{emp.department}</td>
                      <td className="px-4 py-3 font-mono">
                        <span className={utilPct > 100 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {emp.currentLoadHours}h ({utilPct}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400">
                        {emp.onTimeCompletionRate}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span>Score:</span>
                            <span className={riskPct > 60 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {riskPct}%
                            </span>
                          </div>
                          <ProgressBar value={riskPct} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {riskPct > 70 ? (
                          <Badge variant="rose" size="sm">
                            High Scheduling Risk
                          </Badge>
                        ) : riskPct > 40 ? (
                          <Badge variant="amber" size="sm">
                            Moderate Load
                          </Badge>
                        ) : (
                          <Badge variant="emerald" size="sm">
                            Healthy Capacity
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
