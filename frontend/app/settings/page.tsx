'use client';

import * as React from 'react';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { useOrganizationMembers } from '@/lib/hooks/useOrganizationMembers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
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
  const { organization, role: authRole, isAuthenticated, user, refreshUserData } = useAuth();
  const isLive = isAuthenticated && Boolean(organization?.id);
  const {
    skills,
    resetAllSyntheticData,
    activeRole: mockRole,
    employees,
    currentUserId,
    switchDemoRole,
  } = useMockStore();

  const {
    activeMembers,
    isLoading: isMembersLoading,
    refetch: refetchMembers,
  } = useOrganizationMembers();

  const activeRole = isLive && authRole ? authRole : mockRole;
  const isOrganizer = activeRole === 'organizer';
  const isOrganizerOrAdmin = isOrganizer || activeRole === 'admin';

  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);
  const [orgName, setOrgName] = React.useState(organization?.name || 'Acme Systems Engineering');
  const [isSavingOrg, setIsSavingOrg] = React.useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = React.useState<string | null>(null);

  // Ownership transfer states
  const [selectedNewOwnerId, setSelectedNewOwnerId] = React.useState('');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = React.useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = React.useState(false);
  const [transferSuccessMsg, setTransferSuccessMsg] = React.useState<string | null>(null);
  const [transferErrorMsg, setTransferErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (organization?.name) {
      setOrgName(organization.name);
    }
  }, [organization?.name]);

  // Compute eligible transfer targets: active members who are not the current organizer
  const eligibleMembers = React.useMemo(() => {
    if (isLive) {
      return (activeMembers || [])
        .filter(
          (m) =>
            m.userId !== user?.id &&
            m.status === 'active' &&
            m.role !== 'organizer'
        )
        .map((m) => ({
          id: m.userId,
          name: m.fullName?.trim() || m.email,
          email: m.email,
          role: m.role,
        }));
    } else {
      return (employees || [])
        .filter((e) => e.id !== currentUserId && e.role !== 'organizer')
        .map((e) => ({
          id: e.id,
          name: e.fullName,
          email: e.email,
          role: e.role,
        }));
    }
  }, [isLive, activeMembers, user?.id, employees, currentUserId]);

  const selectedTargetMember = React.useMemo(() => {
    return eligibleMembers.find((m) => m.id === selectedNewOwnerId) || null;
  }, [eligibleMembers, selectedNewOwnerId]);

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

    if (!isOrganizer) {
      setSaveErrorMsg('Only verified Organization Organizers can modify workspace settings.');
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

  // Defense-in-depth: initiate transfer handler
  const handleInitiateTransfer = () => {
    setTransferErrorMsg(null);
    setTransferSuccessMsg(null);

    if (!isOrganizer) {
      setTransferErrorMsg('Access denied: Only the Organization Organizer can transfer workspace ownership.');
      return;
    }

    if (!selectedNewOwnerId) {
      setTransferErrorMsg('Please select an active member to receive workspace ownership.');
      return;
    }

    const currentCallerId = isLive ? user?.id : currentUserId;
    if (selectedNewOwnerId === currentCallerId) {
      setTransferErrorMsg('Cannot transfer ownership to yourself.');
      return;
    }

    if (!selectedTargetMember) {
      setTransferErrorMsg('The selected member is not an eligible active member of this organization.');
      return;
    }

    setIsTransferDialogOpen(true);
  };

  // Defense-in-depth: RPC execution handler
  const handleExecuteOwnershipTransfer = async () => {
    setTransferErrorMsg(null);
    setTransferSuccessMsg(null);

    // Defense-in-depth pre-execution assertions
    if (!isOrganizer) {
      setTransferErrorMsg('Unauthorized: Only the current Organizer can transfer workspace ownership.');
      setIsTransferDialogOpen(false);
      return;
    }

    const currentCallerId = isLive ? user?.id : currentUserId;
    if (!selectedNewOwnerId || selectedNewOwnerId === currentCallerId) {
      setTransferErrorMsg('Invalid recipient: Cannot transfer ownership to yourself or an empty selection.');
      setIsTransferDialogOpen(false);
      return;
    }

    if (!selectedTargetMember) {
      setTransferErrorMsg('Selected recipient is not an active eligible member.');
      setIsTransferDialogOpen(false);
      return;
    }

    setIsTransferringOwnership(true);

    try {
      if (isLive) {
        if (!organization?.id) {
          setTransferErrorMsg('Missing organization identifier.');
          setIsTransferDialogOpen(false);
          return;
        }

        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc('transfer_organization_ownership', {
          p_organization_id: organization.id,
          p_new_organizer_user_id: selectedNewOwnerId,
        });

        if (error) {
          setTransferErrorMsg(error.message || 'Failed to transfer organization ownership.');
          setIsTransferDialogOpen(false);
          return;
        }

        const recipientName = selectedTargetMember.name;
        setTransferSuccessMsg(
          `Workspace ownership successfully transferred to ${recipientName}. Your role has been transitioned to Organization Administrator.`
        );
        setIsTransferDialogOpen(false);
        setSelectedNewOwnerId('');

        // Refresh live auth role and organization membership state
        if (refreshUserData) {
          await refreshUserData();
        }
        await refetchMembers();
      } else {
        // Demo Sandbox mode
        switchDemoRole('admin');
        setTransferSuccessMsg(
          `[Demo Mode] Workspace ownership transferred to ${selectedTargetMember.name}. Your role in the demo sandbox is now Organization Administrator.`
        );
        setIsTransferDialogOpen(false);
        setSelectedNewOwnerId('');
      }
    } catch (err: any) {
      setTransferErrorMsg(err.message || 'An unexpected error occurred during ownership transfer.');
      setIsTransferDialogOpen(false);
    } finally {
      setIsTransferringOwnership(false);
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
            <Badge variant={isOrganizer ? 'violet' : isOrganizerOrAdmin ? 'cyan' : 'slate'} size="sm">
              {activeRole === 'organizer' ? 'Super Admin / Organizer' : activeRole === 'admin' ? 'Organization Admin' : activeRole === 'hr' ? 'People & HR Admin' : 'Member'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure organization metadata, manage skill taxonomies, and view governance controls
          </p>
        </div>
      </div>

      {(saveSuccessMsg || transferSuccessMsg) && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg || transferSuccessMsg}</span>
        </div>
      )}

      {(saveErrorMsg || transferErrorMsg) && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{saveErrorMsg || transferErrorMsg}</span>
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
            disabled={!isOrganizer || isSavingOrg}
          />
          {isLive && (
            <div className="space-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 block">Workspace Slug:</span>
              <code className="text-cyan-400 font-mono bg-navy-850 px-2 py-1 rounded border border-slate-800">
                {organization?.slug || 'default'}
              </code>
            </div>
          )}
          {isOrganizer ? (
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
              Organization workspace settings can only be edited by an Organizer.
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

      {/* Organizer-Only: Workspace Ownership Transfer (Danger Zone) */}
      {isOrganizer && (
        <Card className="border-rose-900/50 bg-navy-900/70 p-6">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
                <h3 className="text-base font-bold text-white">
                  Transfer Workspace Ownership
                </h3>
              </div>
              <Badge variant="rose" size="sm">
                Organizer Only
              </Badge>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Permanently transfer super-admin and primary ownership rights of this workspace to another active member. You will automatically become an Organization Administrator.
            </p>

            {isMembersLoading ? (
              <div className="rounded-lg border border-slate-800 bg-navy-950/40 p-4 text-xs text-slate-400 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Loading workspace members...</span>
              </div>
            ) : eligibleMembers.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  No eligible active members found in this workspace to receive ownership. Invite and onboard a team member before transferring ownership.
                </span>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <Select
                  label="Select New Workspace Owner"
                  id="new-owner-select"
                  value={selectedNewOwnerId}
                  onChange={(e) => {
                    setSelectedNewOwnerId(e.target.value);
                    setTransferErrorMsg(null);
                  }}
                  options={[
                    { label: '-- Select an active member --', value: '' },
                    ...eligibleMembers.map((m) => ({
                      label: `${m.name} (${m.role}) - ${m.email}`,
                      value: m.id,
                    })),
                  ]}
                  helperText="Only verified active members who are not currently organizers can be selected."
                  disabled={isTransferringOwnership}
                />

                <div className="pt-1">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleInitiateTransfer}
                    disabled={!selectedNewOwnerId || isTransferringOwnership}
                  >
                    <span>Transfer Ownership...</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

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

      {/* Ownership Transfer Confirmation Modal */}
      <Dialog
        isOpen={isTransferDialogOpen && isOrganizer}
        onClose={() => {
          if (!isTransferringOwnership) {
            setIsTransferDialogOpen(false);
          }
        }}
        title="Transfer Workspace Ownership"
        description="This action transfers primary ownership and cannot be undone by you."
        maxWidth="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsTransferDialogOpen(false)}
              disabled={isTransferringOwnership}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleExecuteOwnershipTransfer}
              isLoading={isTransferringOwnership}
            >
              Confirm Ownership Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-1 text-xs text-slate-300">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Critical Ownership Transition Notice</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              You are about to transfer primary workspace ownership of{' '}
              <strong className="text-white">{organization?.name || 'this organization'}</strong> to:
            </p>
            {selectedTargetMember && (
              <div className="bg-navy-950/80 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="font-bold text-white text-sm">{selectedTargetMember.name}</div>
                <div className="text-slate-400 font-mono text-[11px]">{selectedTargetMember.email}</div>
                <div className="text-[11px] text-cyan-400 font-medium">
                  Current Role: <span className="capitalize">{selectedTargetMember.role}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pl-1">
            <p className="font-semibold text-slate-200">What happens after transfer:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 leading-relaxed">
              <li>
                <strong className="text-white">{selectedTargetMember?.name}</strong> will become the sole{' '}
                <span className="text-violet-300 font-semibold">Organizer</span> of this workspace.
              </li>
              <li>
                Your role will immediately be changed to{' '}
                <span className="text-cyan-300 font-semibold">Organization Administrator (admin)</span>.
              </li>
              <li>
                You will no longer have authority to transfer workspace ownership or delete the organization.
              </li>
            </ul>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
