'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
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
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="text-xs text-slate-400 font-mono">Loading workspace credentials...</span>
        </div>
      </div>
    );
  }

  const displayName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Team Lead';

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar with user identity & logout */}
      <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-800 bg-navy-900/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white">
            {displayName[0].toUpperCase()}
          </div>
          <span>{user?.email}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSignOut}
          className="text-xs text-slate-400 hover:text-rose-400"
        >
          <LogOut className="h-3.5 w-3.5 mr-1" />
          <span>Sign Out</span>
        </Button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center space-y-3 z-10">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 shadow-glow mb-2">
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <Badge variant="cyan" size="sm">
            <Sparkles className="h-3 w-3 mr-1" />
            Step 1 of 1: Workspace Setup
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Create your primary organization workspace to activate workforce monitoring, project capacity tracking, and AI-assisted task matching.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg z-10">
        <Card className="border-slate-800 bg-navy-900/90 shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-5">
          {hasAmbiguousMembership && availableOrganizations.length > 1 && (
            <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-violet-400 shrink-0" />
                <span className="text-xs font-bold text-white">Select Active Workspace</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                You belong to multiple organizations. Please choose which workspace you wish to enter:
              </p>
              <div className="space-y-2">
                {availableOrganizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => selectOrganization(org.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-navy-950/80 hover:border-violet-500 hover:bg-violet-950/40 transition-all text-left group"
                  >
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-violet-300 block">
                        {org.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">slug: {org.slug}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-violet-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-800">
                Or create a brand new organization below:
              </div>
            </div>
          )}

          <form onSubmit={handleCreateWorkspace} className="space-y-5">
            {errorMessage && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-rose-200">Workspace initialization issue:</span>
                  <p className="text-rose-300/90 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Organization Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Organization / Company Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Acme Technologies Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Your team and clients will see this name across all reports and project boards.
              </p>
            </div>

            {/* Organization Slug Preview & Customization */}
            <div className="space-y-2 rounded-xl border border-slate-800/80 bg-navy-950/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-cyan-400" />
                  Workspace URL Slug
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomizingSlug(!isCustomizingSlug)}
                  className="text-[11px] text-violet-400 hover:text-violet-300 underline font-medium"
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
                    className="w-full rounded-lg border border-slate-700 bg-navy-900 px-3 py-1.5 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 font-mono">
                    Must be lowercase alphanumeric characters with single hyphens.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300/90 bg-navy-900/80 rounded-lg px-2.5 py-1.5 border border-slate-800">
                  <span className="text-slate-500">workforce-platform.vercel.app/</span>
                  <span className="font-bold text-cyan-400">{effectiveSlug || 'your-org-slug'}</span>
                </div>
              )}
            </div>

            {/* Organizer Role Confirmation Notice */}
            <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-3 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-violet-300">
                <ShieldCheck className="h-4 w-4 text-violet-400" />
                Automatic Organizer & Ownership Privileges
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                As the workspace creator, your account is bootstrapped as the initial Workspace Organizer and Owner. You will have full authority over organization settings, member invitations (Admins, Managers, Employees), and workforce governance.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting || !orgName.trim()}
              className="w-full justify-center shadow-glow"
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
