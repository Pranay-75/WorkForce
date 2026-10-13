'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Settings,
  Sparkles,
  RefreshCw,
  Building2,
  Award,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Plus,
} from 'lucide-react';

export default function SettingsPage() {
  const { organization } = useAuth();
  const { skills, resetAllSyntheticData } = useMockStore();

  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);
  const [orgName, setOrgName] = React.useState(organization?.name || 'Acme Cloud Technologies');
  const [orgDomain, setOrgDomain] = React.useState('acme.corp');
  const [newSkillName, setNewSkillName] = React.useState('');
  const [newSkillCategory, setNewSkillCategory] = React.useState('Frontend');

  React.useEffect(() => {
    if (organization?.name) {
      setOrgName(organization.name);
    }
  }, [organization]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Workspace Settings & Demo Controls
            </h2>
            <Badge variant="violet" size="sm">
              Admin & HR Access
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure organization metadata, manage skill taxonomies, and control synthetic demonstration states
          </p>
        </div>
      </div>

      {/* Demo Seeder & Reset Banner */}
      <Card className="border-violet-500/40 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">
                Synthetic Demonstration Environment
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Reset the in-memory talent pool, active projects, tasks, and recommendation proposals to the standard demonstration baseline.
            </p>
          </div>

          <Button
            variant="accent"
            size="md"
            onClick={() => setIsResetConfirmOpen(true)}
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span>Reset Demo Data</span>
          </Button>
        </div>
      </Card>

      {/* Organization Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <CardTitle>Organization Metadata</CardTitle>
          </div>
          <CardDescription>
            Multi-tenant workspace identity and default working capacity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <Input
            label="Organization Legal Name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <Input
            label="Corporate Domain"
            value={orgDomain}
            onChange={(e) => setOrgDomain(e.target.value)}
          />
          <div className="pt-1">
            <Button variant="secondary" size="sm">
              Save Org Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Skill Taxonomy Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-violet-400" />
              <CardTitle>Skill Taxonomy Matrix ({skills.length})</CardTitle>
            </div>
          </div>
          <CardDescription>
            Defined technical and domain competencies used for AI candidate matching
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {skills.map((s) => (
              <Badge key={s.id} variant="cyan" size="md">
                <span>{s.name}</span>
                <span className="text-[10px] text-cyan-300 font-mono">
                  ({s.category})
                </span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirmation Modal */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          resetAllSyntheticData();
          setIsResetConfirmOpen(false);
        }}
        title="Reset All Synthetic Demonstration Data?"
        description="This will restore all employees, projects, tasks, and recommendation queues to the original pristine demonstration state."
        confirmText="Reset Workspace"
        variant="primary"
      />
    </div>
  );
}
