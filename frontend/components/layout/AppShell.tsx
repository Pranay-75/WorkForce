'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const { feedbackMessage } = useMockStore();
  const { isAuthenticated, organization, isLoading } = useAuth();

  const isAuthOrOnboardingRoute =
    pathname.startsWith('/presentation') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth');

  // Enforce zero-trust authentication & onboarding routing guards
  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && !isAuthOrOnboardingRoute) {
        router.push('/login');
      } else if (isAuthenticated && !organization && !isAuthOrOnboardingRoute) {
        router.push('/onboarding');
      }
    }
  }, [isLoading, isAuthenticated, organization, isAuthOrOnboardingRoute, router]);

  // Auth and Onboarding pages render cleanly as standalone full-screen pages
  if (isAuthOrOnboardingRoute) {
    return <div className="min-h-screen bg-navy-950 text-slate-100">{children}</div>;
  }

  // If loading session on protected routes, show clean loading placeholder
  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="text-xs text-slate-400 font-mono">Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated or un-onboarded, prevent rendering protected layout while redirecting
  if (!isAuthenticated || !organization) {
    return <div className="min-h-screen bg-navy-950 text-slate-100" />;
  }

  return (
    <div className="min-h-screen bg-background-base text-slate-100 flex">
      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <AppSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-64">
        {/* Sticky Header */}
        <AppHeader onMobileMenuToggle={() => setIsMobileOpen(true)} />

        {/* Global Floating Feedback Toast */}
        {feedbackMessage && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl border border-violet-500/50 bg-navy-900/95 px-4 py-3 text-sm text-slate-200 shadow-elevated backdrop-blur-md animate-in slide-in-from-top-4 duration-200">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600/30 text-violet-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-white">{feedbackMessage}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                Live Workspace State
              </span>
            </div>
            <Badge variant="violet" size="sm" className="ml-2">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              Live
            </Badge>
          </div>
        )}

        {/* Dynamic Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
