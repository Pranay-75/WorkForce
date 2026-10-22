'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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
  AlertTriangle,
  Info,
} from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

export default function SettingsPage() {
  const { organization, role: authRole, isAuthenticated, refreshUserData } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);
  const { skills, resetAllSyntheticData, activeRole: mockRole } = useMockStore();

  const activeRole = isLive && authRole ? authRole : mockRole;
  const isOrganizerOrAdmin = activeRole === 'organizer' || activeRole === 'admin';

  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);
  const [orgName, setOrgName] = React.useState(organization?.name || 'Acme Systems Engineering');
  const [isSavingOrg, setIsSavingOrg] = React.useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (organization?.name) {
      setOrgName(organization.name);
    }
  }, [organization?.name]);

  if (activeRole !== 'organizer' && activeRole !== 'admin' && activeRole !== 'hr') {
    return (
      <AccessDenied
        resourceName="Workspace Governance Settings"
        currentRole={activeRole}
        requiredRoles={['organizer', 'admin', 'hr']}
        description="Organization-level workspace configuration, governance policies, and skill taxonomy administration are restricted to administrators and human resources."
      />
    );
  }

  const handleSaveOrgProfile = async () => {
    if (!isLive || !organization?.id) {
      setSaveSuccessMsg('Organization profile updated in local demo state.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
      return;
    }

    if (!isOrganizerOrAdmin) {
      setSaveErrorMsg('Only verified Organization Administrators and Organizers can modify workspace settings.');
      return;
    }

    if (!orgName.trim()) {
      setSaveErrorMsg('Organization name cannot be blank.');
      return;
    }

    setIsSavingOrg(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('organizations')
        .update({ name: orgName.trim() })
        .eq('id', organization.id);

      if (error) {
        setSaveErrorMsg(error.message);
      } else {
        setSaveSuccessMsg('Organization name updated successfully in the verified database.');
        if (refreshUserData) {
          await refreshUserData();
        }
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setSaveErrorMsg(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSavingOrg(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-white">
              Workspace Settings &amp; Governance
            </h2>
            <Badge variant={isOrganizerOrAdmin ? 'violet' : 'slate'} size="sm">
              {activeRole === 'organizer' ? 'Super Admin / Organizer' : activeRole === 'admin' ? 'Organization Admin' : activeRole === 'hr' ? 'People & HR Admin' : 'Member'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure organization metadata, manage skill taxonomies, and view governance controls
          </p>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {saveErrorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{saveErrorMsg}</span>
        </div>
      )}

      {/* Organization Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <CardTitle>Organization Metadata</CardTitle>
          </div>
          <CardDescription>
            Multi-tenant workspace identity and verified database records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <Input
            label="Organization Legal Name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={!isOrganizerOrAdmin || isSavingOrg}
          />
          {isLive && (
            <div className="space-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block">Workspace Slug:</span>
              <code className="text-cyan-400 font-mono bg-navy-850 px-2 py-1 rounded border border-slate-800">
                {organization?.slug || 'default'}
              </code>
            </div>
          )}
          {isOrganizerOrAdmin ? (
            <div className="pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveOrgProfile}
                disabled={isSavingOrg}
              >
                {isSavingOrg ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Organization Name</span>
                )}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              Organization name can only be edited by an Organizer or Administrator.
            </p>
          )}
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

      {/* Demo Seeder & Reset Banner */}
      <Card className="border-slate-800 bg-navy-900/60 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <h3 className="text-base font-bold text-white">
                Demonstration Sandbox Environment
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isLive
                ? 'Resetting demo data only affects client-side demonstration sandboxes. It will never overwrite, alter, or delete your actual verified organization data.'
                : 'Reset the in-memory talent pool, active projects, tasks, and recommendation proposals to the standard demonstration baseline.'}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsResetConfirmOpen(true)}
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span>Reset Demo Store</span>
          </Button>
        </div>
      </Card>

      {/* Reset Confirmation Modal */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          resetAllSyntheticData();
          setIsResetConfirmOpen(false);
          setSaveSuccessMsg('Client demonstration sandbox data reset to pristine baseline.');
          setTimeout(() => setSaveSuccessMsg(null), 3000);
        }}
        title="Reset Client-Side Demonstration Sandbox?"
        description="This will restore the in-memory demo talent pool and projects. Live database records are unaffected."
        confirmText="Reset Demo Data"
        variant="primary"
      />
    </div>
  );
}
