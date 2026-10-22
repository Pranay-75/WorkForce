'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const { feedbackMessage, isDemoMode, currentUser, exitDemoMode } = useMockStore();
  const { isAuthenticated, organization, isLoading } = useAuth();

  const isAuthOrOnboardingRoute =
    pathname.startsWith('/presentation') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth');

  // Enforce zero-trust authentication & onboarding routing guards
  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated && !isDemoMode && !isAuthOrOnboardingRoute) {
        router.push('/login');
      } else if (isAuthenticated && !organization && !isAuthOrOnboardingRoute) {
        router.push('/onboarding');
      }
    }
  }, [isLoading, isAuthenticated, isDemoMode, organization, isAuthOrOnboardingRoute, router]);

  // Auth and Onboarding pages render cleanly as standalone full-screen pages
  if (isAuthOrOnboardingRoute) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>;
  }

  // If loading session on protected routes, show clean loading placeholder
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
          <span className="text-xs text-zinc-400 font-mono">Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated and not in demo mode, or un-onboarded, prevent rendering protected layout while redirecting
  if ((!isAuthenticated && !isDemoMode) || (isAuthenticated && !organization)) {
    return <div className="min-h-screen bg-zinc-950 text-zinc-100" />;
  }

  return (
    <div className="min-h-screen bg-background-base text-zinc-100 flex">
      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <AppSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        )}
      >
        {/* Interactive Demo Showcase Banner */}
        {isDemoMode && !isAuthenticated && (
          <div className="bg-gradient-to-r from-violet-950/90 via-indigo-950/90 to-navy-950/90 border-b border-violet-800/50 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md z-40">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <Badge variant="violet" size="sm" className="font-semibold uppercase tracking-wider text-[10px]">
                <Sparkles className="h-3 w-3 mr-1 text-violet-300" />
                Demo Mode
              </Badge>
              <span className="text-zinc-200">
                Organization: <strong className="text-white font-semibold">Acme Systems Engineering</strong>
                <span className="mx-2 text-zinc-600 hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Viewing as <strong className="text-violet-300">{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 font-mono hidden md:inline">
                Isolated synthetic dataset • No Supabase changes
              </span>
              <button
                type="button"
                onClick={() => {
                  exitDemoMode();
                  router.push('/login');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-violet-900/60 hover:bg-violet-800/80 text-violet-200 border border-violet-700/60 transition-all hover:text-white shadow-sm"
              >
                Exit Demo
              </button>
            </div>
          </div>
        )}
        {/* Sticky Header */}
        <AppHeader onMobileMenuToggle={() => setIsMobileOpen(true)} />

        {/* Global Floating Feedback Toast */}
        {feedbackMessage && (
          <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-200 shadow-elevated backdrop-blur-md animate-in slide-in-from-top-4 duration-200">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-white">{feedbackMessage}</span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Live Workspace State
              </span>
            </div>
            <Badge variant="slate" size="sm" className="ml-2">
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
