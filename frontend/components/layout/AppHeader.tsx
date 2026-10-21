'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMockStore, demoIdentities } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Menu,
  Bell,
  ChevronRight,
  Sparkles,
  Command,
  UserCheck,
  ChevronDown,
  LogOut,
  LogIn,
  Shield,
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
  const { currentUser, switchDemoRole, notifications } = useMockStore();
  const { user, profile, role, organization, isAuthenticated, signOut } = useAuth();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = React.useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const currentRouteMeta = routeTitleMap[pathname] || {
    title: 'Workforce Hub',
    subtitle: 'AI-Powered Workforce Capacity SaaS',
  };

  const pathSegments = pathname.split('/').filter(Boolean);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Left section: Mobile menu + Breadcrumbs & Page Meta */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuToggle}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white lg:hidden focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
            <Link
              href="/dashboard"
              className="hover:text-zinc-200 transition-colors"
            >
              {organization?.name || 'WorkForce'}
            </Link>
            {pathSegments.length > 0 && (
              <>
                <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />
                <span className="capitalize text-zinc-200 truncate">
                  {pathSegments[0]}
                </span>
              </>
            )}
          </div>
          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight truncate flex items-center gap-2">
            {currentRouteMeta.title}
          </h1>
        </div>
      </div>

      {/* Right section: Auth status, Demo Role Switcher, Notifications */}
      <div className="flex items-center gap-3">
        {/* Real Supabase Auth or Simulated Mode */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-200 shadow-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-200 border border-zinc-700">
                {(profile?.fullName || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold text-white leading-none">
                  {profile?.fullName || user.email?.split('@')[0]}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono capitalize">
                  {organization?.name ? `${organization.name} • ` : ''}Role: {role}
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="text-xs text-zinc-300 hover:text-rose-400"
              title="Sign out of Supabase session"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:block">
              <Button variant="secondary" size="sm" className="text-xs text-zinc-300">
                <LogIn className="h-3.5 w-3.5 mr-1" />
                <span>Sign In</span>
              </Button>
            </Link>

            {/* Simulated Demo Identity Switcher (Showcase Mode Only) */}
            <div className="relative">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 transition-all shadow-sm focus:outline-none"
                title="Switch Simulated Role (Demo Mode)"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-200 border border-zinc-700">
                  {currentUser.avatar}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] font-bold text-white leading-none">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] text-zinc-400 font-mono capitalize">
                    Demo Role: {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {/* Role Dropdown Menu */}
              {isRoleDropdownOpen && (
                <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 shadow-elevated backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      ⚡ Demo Showcase Identities
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Showcase Mode • Sign in for real workspace
                    </span>
                  </div>

                  <div className="space-y-1">
                    {demoIdentities.map((identity) => {
                      const isSelected = identity.id === currentUser.id;
                      return (
                        <button
                          key={identity.id}
                          onClick={() => {
                            switchDemoRole(identity.id);
                            setIsRoleDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                            isSelected
                              ? 'bg-zinc-800 text-white border border-zinc-700'
                              : 'text-zinc-300 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-200 border border-zinc-700 shrink-0">
                              {identity.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-white truncate">
                                {identity.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {identity.jobTitle}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant={
                              identity.role === 'admin'
                                ? 'rose'
                                : identity.role === 'manager'
                                ? 'slate'
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notification Bell */}
        <Link
          href="/notifications"
          className="relative rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm focus:outline-none"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-bold text-zinc-950 shadow-sm">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
