'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { generateSlug, isValidSlug } from '@/lib/slug';
import {
  Sparkles,
  Building2,
  Globe,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Users,
  Layers,
} from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user,
    profile,
    organization,
    availableOrganizations,
    hasAmbiguousMembership,
    selectOrganization,
    bootstrapOrganization,
    isAuthenticated,
    isLoading,
    signOut,
  } = useAuth();

  const [orgName, setOrgName] = React.useState('');
  const [customSlug, setCustomSlug] = React.useState('');
  const [isCustomizingSlug, setIsCustomizingSlug] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Pre-fill from user metadata if available
  React.useEffect(() => {
    if (user?.user_metadata?.organization_name && !orgName) {
      setOrgName(user.user_metadata.organization_name);
    }
    if (user?.user_metadata?.organization_slug && !customSlug) {
      setCustomSlug(user.user_metadata.organization_slug);
      setIsCustomizingSlug(true);
    }
  }, [user, orgName, customSlug]);

  // If already associated with an organization, redirect to dashboard
  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (organization) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, organization, isLoading, router]);

  const effectiveSlug = React.useMemo(() => {
    if (isCustomizingSlug && customSlug) {
      return generateSlug(customSlug);
    }
    return generateSlug(orgName);
  }, [orgName, customSlug, isCustomizingSlug]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = orgName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage('Organization name must be at least 2 characters long.');
      return;
    }

    if (!isValidSlug(effectiveSlug)) {
      setErrorMessage('Organization slug must be between 2 and 50 lowercase alphanumeric characters and single hyphens.');
      return;
    }

    setIsSubmitting(true);

    const result = await bootstrapOrganization(trimmedName, effectiveSlug);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-wf-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wf-brand-burgundy border-t-transparent" />
          <span className="text-xs text-wf-text-secondary font-mono">Loading workspace credentials...</span>
        </div>
      </div>
    );
  }

  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Lead';

  return (
    <div className="min-h-screen bg-wf-canvas text-wf-text-primary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <ThemeToggle variant="compact" />
      </div>
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar with user identity & logout */}
      <div className="absolute top-6 left-6 flex items-center gap-3 z-20">
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-wf-border-default bg-wf-surface-card px-3 py-1.5 text-xs text-wf-text-primary backdrop-blur-md shadow-card">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-wf-brand-burgundy text-[9px] font-bold text-white">
            {displayName[0].toUpperCase()}
          </div>
          <span>{user?.email}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSignOut}
          className="text-xs"
        >
          <LogOut className="h-3.5 w-3.5 mr-1" />
          <span>Sign Out</span>
        </Button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-wf-brand-burgundy text-white shadow-sm mb-2">
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="burgundy" size="sm">
            <Sparkles className="h-3 w-3 mr-1" />
            Step 1 of 1: Workspace Setup
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold text-wf-text-primary tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="text-sm text-wf-text-secondary max-w-md mx-auto">
          Create your primary organization workspace to activate workforce monitoring, project capacity tracking, and AI-assisted task matching.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
        <Card className="border-wf-border-default bg-wf-surface-card shadow-elevated p-6 sm:p-8 backdrop-blur-xl space-y-5">
          {hasAmbiguousMembership && availableOrganizations.length > 1 && (
            <div className="rounded-xl border border-wf-border-default bg-wf-surface-subtle p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream shrink-0" />
                <span className="text-xs font-bold text-wf-text-primary">Select Active Workspace</span>
              </div>
              <p className="text-[11px] text-wf-text-secondary leading-relaxed">
                You belong to multiple organizations. Please choose which workspace you wish to enter:
              </p>
              <div className="space-y-2">
                {availableOrganizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => selectOrganization(org.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-wf-border-default bg-wf-surface-card hover:border-wf-border-strong hover:bg-wf-surface-subtle transition-all text-left group shadow-card"
                  >
                    <div>
                      <span className="text-xs font-bold text-wf-text-primary group-hover:text-wf-brand-burgundy dark:group-hover:text-wf-cream block">
                        {org.name}
                      </span>
                      <span className="text-[10px] text-wf-text-tertiary font-mono">slug: {org.slug}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-wf-text-tertiary text-center pt-2 border-t border-wf-border-subtle">
                Or create a brand new organization below:
              </div>
            </div>
          )}

          <form onSubmit={handleCreateWorkspace} className="space-y-5">
            {errorMessage && (
              <div className="rounded-xl border border-wf-semantic-danger-border bg-wf-semantic-danger-bg p-3.5 text-xs text-wf-semantic-danger flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-wf-semantic-danger shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-wf-semantic-danger">Workspace initialization issue:</span>
                  <p className="text-wf-semantic-danger/90 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Organization Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-wf-text-secondary">
                Organization / Company Name <span className="text-wf-semantic-danger">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-wf-text-tertiary" />
                <input
                  type="text"
                  required
                  placeholder="Acme Technologies Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-xl border border-wf-border-default bg-wf-surface-subtle pl-9 pr-3 py-2 text-sm text-wf-text-primary placeholder:text-wf-text-tertiary focus:border-wf-border-focus focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-wf-text-tertiary">
                Your team and clients will see this name across all reports and project boards.
              </p>
            </div>

            {/* Organization Slug Preview & Customization */}
            <div className="space-y-2 rounded-xl border border-wf-border-default bg-wf-surface-subtle p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-wf-text-secondary flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-wf-brand-burgundy dark:text-wf-cream" />
                  Workspace URL Slug
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomizingSlug(!isCustomizingSlug)}
                  className="text-[11px] text-wf-brand-burgundy dark:text-wf-cream hover:underline font-medium"
                >
                  {isCustomizingSlug ? 'Auto-generate' : 'Customize URL'}
                </button>
              </div>

              {isCustomizingSlug ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="custom-org-slug"
                    className="w-full rounded-lg border border-wf-border-default bg-wf-surface-card px-3 py-1.5 text-xs font-mono text-wf-text-primary placeholder:text-wf-text-tertiary focus:border-wf-border-focus focus:outline-none"
                  />
                  <span className="text-[10px] text-wf-text-tertiary font-mono">
                    Must be lowercase alphanumeric characters with single hyphens.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-wf-text-primary bg-wf-surface-card rounded-lg px-2.5 py-1.5 border border-wf-border-default">
                  <span className="text-wf-text-tertiary">workforce-platform.vercel.app/</span>
                  <span className="font-bold text-wf-brand-burgundy dark:text-wf-cream">{effectiveSlug || 'your-org-slug'}</span>
                </div>
              )}
            </div>

            {/* Organizer Role Confirmation Notice */}
            <div className="rounded-xl border border-wf-border-default bg-wf-surface-subtle/70 p-3 text-xs text-wf-text-secondary space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-wf-text-primary">
                <ShieldCheck className="h-4 w-4 text-wf-brand-burgundy dark:text-wf-cream" />
                Automatic Organizer & Ownership Privileges
              </div>
              <p className="text-[11px] text-wf-text-tertiary leading-relaxed">
                As the workspace creator, your account is bootstrapped as the initial Workspace Organizer and Owner. You will have full authority over organization settings, member invitations (Admins, Managers, Employees), and workforce governance.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting || !orgName.trim()}
              className="w-full justify-center"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Bootstrapping Workspace...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Create Organization Workspace <ArrowRight className="h-4 w-4 ml-1" />
                </span>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
