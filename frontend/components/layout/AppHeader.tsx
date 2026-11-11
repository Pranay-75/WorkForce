'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMockStore, demoIdentities } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Menu,
  Bell,
  ChevronRight,
  ChevronDown,
  LogOut,
  LogIn,
} from 'lucide-react';

const routeTitleMap: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Design System & Architecture Showcase', subtitle: 'Foundation UI components & navigation inventory' },
  '/dashboard': { title: 'Executive Overview', subtitle: 'Workforce capacity, active projects & pending approvals' },
  '/employees': { title: 'Employee Directory', subtitle: 'Talent roster, skill matrices & individual capacity' },
  '/projects': { title: 'Project Portfolio', subtitle: 'Track ongoing initiatives, milestones & allocated hours' },
  '/tasks': { title: 'Task Management', subtitle: 'Priorities, deadlines, skill prerequisites & assignments' },
  '/matching': { title: 'AI Matching Hub', subtitle: 'Explainable candidate ranking powered by Gemini' },
  '/workload': { title: 'Capacity Monitor', subtitle: 'Organization-wide workload heatmaps & overload alerts' },
  '/insights': { title: 'Employee Insights', subtitle: 'Velocity trends and transparent operational risk factors' },
  '/reports': { title: 'Reports & Analytics', subtitle: 'Capacity utilization, AI accuracy & project velocity' },
  '/audit': { title: 'Audit History', subtitle: 'Immutable compliance trail of assignments and approvals' },
  '/notifications': { title: 'Notifications', subtitle: 'Task updates, risk alerts and recommendation status' },
  '/settings': { title: 'Workspace Settings', subtitle: 'Organization configuration & synthetic demo seeder' },
};

export function AppHeader({
  onMobileMenuToggle,
}: {
  onMobileMenuToggle?: () => void;
}) {
  const pathname = usePathname() || '/dashboard';
  const router = useRouter();
  const { activeRole: mockRole, currentUser, switchDemoRole, notifications, isDemoMode, exitDemoMode } = useMockStore();
  const { user, profile, role: authRole, organization, isAuthenticated, signOut } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const isLive = isAuthenticated && Boolean(organization?.id);
  const activeRole = (isLive && authRole ? authRole : mockRole) as UserRole;

  const currentRouteMeta = React.useMemo(() => {
    if (pathname === '/dashboard') {
      if (activeRole === 'employee') {
        return {
          title: 'My Focus',
          subtitle: 'Personal workload, assignments & skill matrix',
        };
      }
      return {
        title: 'Executive Overview',
        subtitle: 'Workforce capacity, active projects & pending approvals',
      };
    }
    if (pathname === '/tasks' && activeRole === 'employee') {
      return {
        title: 'My Tasks',
        subtitle: 'Assigned sprint deliverables & submission queue',
      };
    }
    return (
      routeTitleMap[pathname] || {
        title: 'Workforce Hub',
        subtitle: 'AI-Powered Workforce Capacity SaaS',
      }
    );
  }, [pathname, activeRole]);

  const pathSegments = pathname.split('/').filter(Boolean);

  // Click outside and Escape key handler for role dropdown
  React.useEffect(() => {
    if (!isRoleDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRoleDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoleDropdownOpen]);

  const handleSignOut = async () => {
    exitDemoMode();
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-wf-border-default bg-wf-surface-overlay px-3 sm:px-6 backdrop-blur-md transition-colors select-none">
      {/* Left section: Compact Menu trigger + Page Title (Desktop retains breadcrumbs) */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-wf-text-secondary hover:bg-wf-surface-card hover:text-wf-text-primary lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus transition-colors"
          aria-label="Open navigation sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col min-w-0">
          {/* Desktop breadcrumb trail */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-wf-text-secondary">
            <Link
              href="/dashboard"
              className="hover:text-wf-text-primary transition-colors truncate"
            >
              {organization?.name || 'WorkForce'}
            </Link>
            {pathSegments.length > 0 && (
              <>
                <ChevronRight className="h-3 w-3 text-wf-border-strong shrink-0" />
                <span className="capitalize text-wf-text-primary font-medium truncate">
                  {pathSegments[0]}
                </span>
              </>
            )}
          </div>
          {/* Concise, readable title on mobile and desktop */}
          <h1 className="text-sm sm:text-base font-semibold text-wf-text-primary tracking-tight truncate">
            {currentRouteMeta.title}
          </h1>
        </div>
      </div>

      {/* Right section: Simplified on mobile (no theme toggle or sign out clutter), complete on desktop */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Adaptive Theme Toggle (Desktop only: mobile accesses theme via mobile menu drawer) */}
        <div className="hidden sm:block">
          <ThemeToggle variant="segmented" />
        </div>

        {/* Real Supabase Auth or Simulated Mode */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-wf-border-default bg-wf-surface-card p-1 sm:px-3 sm:py-1.5 text-xs text-wf-text-primary shadow-sm min-h-[44px]">
              <div className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-wf-brand-burgundy text-[10px] font-bold text-white border border-wf-border-default">
                {(profile?.fullName || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] font-bold text-wf-text-primary leading-none">
                  {profile?.fullName || user.email?.split('@')[0]}
                </span>
                <span className="text-[9px] text-wf-text-secondary font-mono capitalize">
                  {organization?.name ? `${organization.name} • ` : ''}Role: {authRole}
                </span>
              </div>
            </div>
            {/* Desktop sign-out: on mobile, sign out is cleanly housed inside the mobile menu drawer */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="hidden sm:inline-flex text-xs text-wf-text-secondary hover:text-wf-semantic-danger min-h-[36px]"
              title="Sign out of Supabase session"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span>Sign Out</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Desktop exit demo: mobile accesses exit demo via the menu drawer */}
            {isDemoMode ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  exitDemoMode();
                  router.push('/login');
                }}
                className="hidden sm:inline-flex text-xs text-wf-text-secondary hover:text-wf-semantic-danger transition-colors min-h-[36px]"
                title="Exit Demo session and return to login"
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                <span>Exit Demo</span>
              </Button>
            ) : (
              <Link href="/login" className="hidden sm:block">
                <Button variant="secondary" size="sm" className="text-xs text-wf-text-secondary min-h-[36px]">
                  <LogIn className="h-3.5 w-3.5 mr-1" />
                  <span>Sign In</span>
                </Button>
              </Link>
            )}

            {/* Simulated Demo Identity Switcher: 44×44px hit bounds on mobile, expanded pill on desktop */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center justify-center gap-2 rounded-xl border border-wf-border-default bg-wf-surface-card p-1 sm:px-3 sm:py-1.5 text-xs text-wf-text-primary hover:border-wf-border-strong transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus min-h-[44px] min-w-[44px]"
                title="Switch Simulated Role (Demo Mode)"
                aria-expanded={isRoleDropdownOpen}
                aria-haspopup="true"
                aria-label={`Demo Role: ${currentUser.name} (${currentUser.role})`}
              >
                <div className="flex h-7 w-7 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-wf-surface-subtle text-[11px] sm:text-[9px] font-bold text-wf-text-primary border border-wf-border-default">
                  {currentUser.avatar}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] font-bold text-wf-text-primary leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] text-wf-text-secondary font-mono capitalize">
                    Demo Role: {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-wf-text-secondary hidden sm:inline" />
              </button>

              {/* Role Dropdown Menu */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 top-14 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-wf-border-default bg-wf-surface-elevated p-2 shadow-elevated backdrop-blur-xl animate-in fade-in zoom-in-95 duration-hover">
                  <div className="px-3 py-2 border-b border-wf-border-subtle mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-wf-brand-burgundy dark:text-wf-cream block">
                      ⚡ Demo Showcase Identities
                    </span>
                    <span className="text-[10px] text-wf-text-secondary font-mono">
                      Acme Systems Engineering • Simulated Roles
                    </span>
                  </div>

                  <div className="space-y-1">
                    {demoIdentities.map((identity) => {
                      const isSelected = identity.id === currentUser.id;
                      return (
                        <button
                          key={identity.id}
                          type="button"
                          onClick={() => {
                            switchDemoRole(identity.id);
                            setIsRoleDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors min-h-[44px] ${
                            isSelected
                              ? 'bg-wf-cream/30 dark:bg-wf-surface-subtle text-wf-text-primary border border-wf-border-default font-semibold'
                              : 'text-wf-text-secondary hover:bg-wf-surface-subtle hover:text-wf-text-primary'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-wf-surface-subtle text-[10px] font-bold text-wf-text-primary border border-wf-border-default shrink-0">
                              {identity.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-wf-text-primary truncate">
                                {identity.name}
                              </div>
                              <div className="text-[10px] text-wf-text-secondary truncate">
                                {identity.jobTitle}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              identity.role === 'organizer'
                                ? 'amber'
                                : identity.role === 'admin'
                                ? 'violet'
                                : identity.role === 'manager'
                                ? 'cyan'
                                : identity.role === 'hr'
                                ? 'emerald'
                                : 'slate'
                            }
                            size="sm"
                          >
                            {identity.role.toUpperCase()}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 mt-2 border-t border-wf-border-subtle">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRoleDropdownOpen(false);
                        exitDemoMode();
                        router.push('/login');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs text-wf-semantic-danger hover:bg-wf-semantic-danger-bg transition-colors min-h-[44px]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Exit Demo &amp; Sign In</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification Bell: 44×44px hit bounds */}
        <Link
          href="/notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-wf-border-default bg-wf-surface-card text-wf-text-secondary hover:text-wf-text-primary hover:border-wf-border-strong transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-wf-brand-burgundy text-[9px] font-bold text-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
