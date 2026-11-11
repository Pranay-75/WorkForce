'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { AppBottomNav } from './AppBottomNav';
import { AppMobileMenuDrawer } from './AppMobileMenuDrawer';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const { feedbackMessage, setFeedbackMessage, isDemoMode, currentUser, exitDemoMode } = useMockStore();
  const { isAuthenticated, organization, isLoading } = useAuth();

  const isStandalonePublicRoute =
    pathname === '/' ||
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
      if (!isAuthenticated && !isDemoMode && !isStandalonePublicRoute) {
        router.push('/login');
      } else if (isAuthenticated && !organization && !isStandalonePublicRoute) {
        router.push('/onboarding');
      }
    }
  }, [isLoading, isAuthenticated, isDemoMode, organization, isStandalonePublicRoute, router]);

  // Auth, public landing, and onboarding pages render cleanly as standalone full-screen pages
  if (isStandalonePublicRoute) {
    return <div className="min-h-screen bg-wf-canvas text-wf-text-primary">{children}</div>;
  }

  // If loading session on protected routes, show clean loading placeholder
  if (isLoading) {
    return (
      <div className="min-h-screen bg-wf-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-wf-brand-burgundy border-t-transparent" />
          <span className="text-xs text-wf-text-secondary font-mono">Verifying workspace session...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated and not in demo mode, or un-onboarded, prevent rendering protected layout while redirecting
  if ((!isAuthenticated && !isDemoMode) || (isAuthenticated && !organization)) {
    return <div className="min-h-screen bg-wf-canvas text-wf-text-primary" />;
  }

  return (
    <div className="min-h-screen bg-wf-canvas text-wf-text-primary flex">
      {/* Sidebar (Desktop fixed + Tablet/Mobile off-canvas drawer) */}
      <AppSidebar
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-nav ease-apple-nav',
          isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
        )}
      >
        {/* Interactive Demo Showcase Banner: Sleek single line, avoids excessive vertical space on mobile */}
        {isDemoMode && !isAuthenticated && (
          <div className="bg-wf-surface-subtle border-b border-wf-border-default px-3 sm:px-4 py-2 sm:py-2.5 text-xs flex flex-row items-center justify-between gap-2 shadow-sm z-40 transition-colors select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-2 w-2 rounded-full bg-wf-brand-burgundy animate-pulse shrink-0" />
              <Badge variant="burgundy" size="sm" className="font-semibold uppercase tracking-wider text-[10px] shrink-0">
                <Sparkles className="h-3 w-3 mr-1 text-wf-cream" />
                Demo
              </Badge>
              <span className="text-wf-text-secondary truncate text-[11px] sm:text-xs">
                <span className="hidden sm:inline">Organization: </span>
                <strong className="text-wf-text-primary font-semibold">Acme Systems</strong>
                <span className="mx-2 text-wf-border-strong hidden md:inline">•</span>
                <span className="hidden md:inline">
                  Viewing as <strong className="text-wf-brand-burgundy dark:text-wf-cream">{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-wf-text-tertiary font-mono hidden lg:inline">
                Isolated synthetic dataset
              </span>
              {/* Desktop exit demo: on mobile, Exit Demo is prominently accessible in the mobile menu drawer */}
              <button
                type="button"
                onClick={() => {
                  exitDemoMode();
                  router.push('/login');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-wf-surface-card hover:bg-wf-surface-subtle text-wf-text-primary border border-wf-border-default transition-all shadow-sm active:scale-[0.98]"
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
          <div className="fixed bottom-24 lg:bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-wf-border-default bg-wf-surface-elevated/95 px-4 py-3 text-sm text-wf-text-primary shadow-elevated backdrop-blur-md animate-in slide-in-from-bottom-4 duration-reveal max-w-md">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-wf-semantic-success-bg text-wf-semantic-success border border-wf-semantic-success-border shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium text-wf-text-primary break-words leading-snug">{feedbackMessage}</span>
              <span className="text-[10px] text-wf-text-tertiary font-mono">
                {isDemoMode && !isAuthenticated ? 'Simulated Demo Action' : 'Live Workspace Action'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-wf-text-tertiary hover:text-wf-text-primary p-1 rounded-md transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Page Body: Standardized 1440px Spacious Content Canvas with Mobile Bottom Nav Clearance */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8 max-w-[1440px] w-full mx-auto space-y-8">
          {children}
        </main>
      </div>

      {/* Mobile Fixed 64px 5-Slot Bottom Navigation (<1024px) */}
      <AppBottomNav onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

      {/* Mobile Role-Aware Menu Bottom Sheet */}
      <AppMobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </div>
  );
}
