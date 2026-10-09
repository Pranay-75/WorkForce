'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function AuditPage() {
  const { auditEvents } = useMockStore();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAction, setSelectedAction] = React.useState('all');

  const filteredEvents = auditEvents.filter((ev) => {
    const matchesSearch =
      ev.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.entityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.actorName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction =
      selectedAction === 'all' || ev.entityType.toLowerCase() === selectedAction.toLowerCase();

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Compliance & System Audit Trail
            </h2>
            <Badge variant="cyan" size="sm">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Immutable Log
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete chronological record of all task assignments, AI recommendations approved, and load rebalancing events
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-xl border border-slate-800 bg-navy-900/80 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit actions, actors, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="rounded-lg border border-slate-700/80 bg-navy-850 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
        >
          <option value="all">All Entity Types (All)</option>
          <option value="Recommendation">AI Recommendation Decisions</option>
          <option value="Task">Task Actions</option>
          <option value="Workload">Workload Rebalancing</option>
          <option value="Employee">Employee & Skill Updates</option>
        </select>
      </div>

      {/* Audit Timeline List */}
      <div className="space-y-3">
        {filteredEvents.map((ev) => (
          <Card
            key={ev.id}
            className="border-slate-800/90 hover:border-slate-700 transition-colors"
          >
            <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      ev.entityType === 'Recommendation'
                        ? 'violet'
                        : ev.entityType === 'Workload'
                        ? 'cyan'
                        : ev.entityType === 'Task'
                        ? 'emerald'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {ev.entityType}
                  </Badge>
                  <span className="text-xs font-bold text-white">
                    {ev.action}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-violet-300">
                  {ev.entityTitle}
                </h4>

                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {ev.details}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                  <span>Actor: <strong>{ev.actorName}</strong></span>
                  <span>•</span>
                  <span>Timestamp: <strong className="text-slate-300 font-mono">{ev.timestamp}</strong></span>
                </div>
              </div>

              <Badge variant="slate" size="sm" className="font-mono text-[10px] shrink-0">
                Event ID: {ev.id}
              </Badge>
            </div>
          </Card>
        ))}

        {filteredEvents.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-navy-900/40 p-8 text-center text-slate-400">
            <History className="mx-auto h-8 w-8 text-slate-500 mb-2" />
            <p className="text-xs font-medium text-slate-300">
              No audit events found matching filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
