'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMockStore } from '@/lib/mockStore';
import { useAuth } from '@/lib/authContext';
import { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  Sparkles,
  BarChart3,
  Flame,
  FileSpreadsheet,
  History,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  allowedRoles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const masterNavigationGroups: NavGroup[] = [
  {
    label: 'Core Workspace',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        allowedRoles: ['admin', 'manager', 'hr', 'employee'],
      },
      {
        name: 'Employees',
        href: '/employees',
        icon: Users,
        allowedRoles: ['admin', 'manager', 'hr'],
      },
      {
        name: 'Projects',
        href: '/projects',
        icon: FolderKanban,
        allowedRoles: ['admin', 'manager', 'hr', 'employee'],
      },
      {
        name: 'Tasks',
        href: '/tasks',
        icon: CheckSquare,
        allowedRoles: ['admin', 'manager', 'hr', 'employee'],
      },
    ],
  },
  {
    label: 'AI & Capacity',
    items: [
      {
        name: 'AI Recommendations',
        href: '/matching',
        icon: Sparkles,
        badge: 'AI',
        allowedRoles: ['admin', 'manager', 'hr'],
      },
      {
        name: 'Workload',
        href: '/workload',
        icon: BarChart3,
        allowedRoles: ['admin', 'manager', 'hr'],
      },
      {
        name: 'Employee Insights',
        href: '/insights',
        icon: Flame,
        allowedRoles: ['admin', 'manager', 'hr'],
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        name: 'Reports',
        href: '/reports',
        icon: FileSpreadsheet,
        allowedRoles: ['admin', 'manager', 'hr'],
      },
      {
        name: 'Audit Logs',
        href: '/audit',
        icon: History,
        allowedRoles: ['admin'],
      },
      {
        name: 'Notifications',
        href: '/notifications',
        icon: Bell,
        badge: '3',
        allowedRoles: ['admin', 'manager', 'hr', 'employee'],
      },
      {
        name: 'Settings',
        href: '/settings',
        icon: Settings,
        allowedRoles: ['admin', 'hr'],
      },
    ],
  },
];

export function AppSidebar({
  isMobileOpen,
  setIsMobileOpen,
}: {
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { activeRole: mockRole, currentUser: mockUser } = useMockStore();
  const { user, profile, role: authRole, isAuthenticated, organization } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const isLive = isAuthenticated && Boolean(organization?.id);
  const activeRole = (isLive && authRole ? authRole : mockRole) as UserRole;

  const displayUser = React.useMemo(() => {
    if (isLive) {
      const name = profile?.fullName || user?.email?.split('@')[0] || 'User';
      const avatar = (profile?.fullName || user?.email || 'U')[0].toUpperCase();
      return {
        name,
        department: organization?.name || 'Workspace',
        role: authRole || 'member',
        avatar,
      };
    }
    return mockUser;
  }, [isLive, profile, user, authRole, organization, mockUser]);

  // Filter groups based on active role
  const visibleGroups = masterNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.allowedRoles.includes(activeRole)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-40 flex flex-col border-r border-slate-800/80 bg-navy-900 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Branding Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 overflow-hidden group"
            onClick={() => setIsMobileOpen?.(false)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-glow group-hover:scale-105 transition-transform">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                  WorkForce
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-400 border border-violet-800/50">
                    SaaS
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                  AI Capacity Platform
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-navy-800 hover:text-slate-200 lg:flex focus:outline-none"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileOpen?.(false)}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 select-none',
                        isActive
                          ? 'bg-violet-600/15 text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] border border-violet-500/30'
                          : 'text-slate-400 hover:bg-navy-800/80 hover:text-slate-200'
                      )}
                      title={isCollapsed ? item.name : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                      )}
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-violet-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        )}
                      />
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.name}</span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            item.badge === 'AI'
                              ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-mono'
                              : 'bg-slate-800 text-slate-300'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Account / Footer */}
        <div className="border-t border-slate-800/80 p-3 bg-navy-950/40">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl p-2 bg-navy-850/60 border border-slate-800/60',
              isCollapsed && 'justify-center p-1.5'
            )}
          >
            <div className="relative">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 to-purple-800 font-semibold text-white text-xs border border-violet-400/40 shadow-sm">
                {displayUser.avatar}
              </div>
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-navy-900" />
            </div>

            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {displayUser.name}
                  </span>
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="truncate">{displayUser.department}</span>
                  <span>•</span>
                  <span className="text-violet-400 font-mono text-[10px] uppercase">
                    {displayUser.role}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
