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
  FolderKanban,
  CheckSquare,
  Bell,
  Users,
  Sparkles,
  Flame,
  Settings,
  History,
  MoreHorizontal,
} from 'lucide-react';

export interface BottomNavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isAction?: boolean; // If true, triggers menu drawer instead of navigation
  badge?: number;
}

export function AppBottomNav({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu: () => void;
}) {
  const pathname = usePathname() || '/dashboard';
  const { activeRole: mockRole, notifications } = useMockStore();
  const { role: authRole, isAuthenticated, organization } = useAuth();

  const isLive = isAuthenticated && Boolean(organization?.id);
  const activeRole = (isLive && authRole ? authRole : mockRole) as UserRole;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // 5-slot bottom bar layout configured strictly per V3.1 Section 5.3
  const navItems = React.useMemo<BottomNavItem[]>(() => {
    switch (activeRole) {
      case 'employee':
        return [
          { id: 'focus', name: 'My Focus', href: '/dashboard', icon: LayoutDashboard },
          { id: 'projects', name: 'Projects', href: '/projects', icon: FolderKanban },
          { id: 'tasks', name: 'My Tasks', href: '/tasks', icon: CheckSquare },
          { id: 'alerts', name: 'Alerts', href: '/notifications', icon: Bell, badge: unreadCount },
          { id: 'menu', name: 'Menu', href: '#menu', icon: MoreHorizontal, isAction: true },
        ];
      case 'manager':
        return [
          { id: 'overview', name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
          { id: 'projects', name: 'Projects', href: '/projects', icon: FolderKanban },
          { id: 'tasks', name: 'Tasks', href: '/tasks', icon: CheckSquare },
          { id: 'matching', name: 'Matching', href: '/matching', icon: Sparkles },
          { id: 'menu', name: 'Menu', href: '#menu', icon: MoreHorizontal, isAction: true },
        ];
      case 'hr':
        return [
          { id: 'overview', name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
          { id: 'staff', name: 'Staff', href: '/employees', icon: Users },
          { id: 'insights', name: 'Insights', href: '/insights', icon: Flame },
          { id: 'settings', name: 'Settings', href: '/settings', icon: Settings },
          { id: 'menu', name: 'Menu', href: '#menu', icon: MoreHorizontal, isAction: true },
        ];
      case 'organizer':
      case 'admin':
      default:
        return [
          { id: 'overview', name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
          { id: 'staff', name: 'Staff', href: '/employees', icon: Users },
          { id: 'projects', name: 'Projects', href: '/projects', icon: FolderKanban },
          { id: 'audit', name: 'Audit', href: '/audit', icon: History },
          { id: 'menu', name: 'Menu', href: '#menu', icon: MoreHorizontal, isAction: true },
        ];
    }
  }, [activeRole, unreadCount]);

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-wf-border-default bg-wf-surface-card/95 backdrop-blur-xl lg:hidden select-none shadow-elevated transition-colors"
    >
      <div className="grid h-16 grid-cols-5 items-center justify-around px-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isRouteActive =
            !item.isAction &&
            (item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === item.href || pathname.startsWith(item.href + '/'));
          const Icon = item.icon;

          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={onOpenMobileMenu}
                className="flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 text-wf-text-secondary hover:text-wf-text-primary active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus rounded-xl"
                aria-label="Open workspace menu drawer"
              >
                <div className="relative flex items-center justify-center">
                  <Icon className="h-5 w-5 transition-transform" />
                </div>
                <span className="text-[10px] font-medium tracking-tight mt-1 truncate">
                  {item.name}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'group relative flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 text-xs transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wf-border-focus rounded-xl',
                isRouteActive
                  ? 'text-wf-brand-burgundy dark:text-wf-cream font-semibold'
                  : 'text-wf-text-secondary hover:text-wf-text-primary'
              )}
            >
              {/* Active top subtle highlight pip */}
              {isRouteActive && (
                <div className="absolute top-1.5 h-1 w-6 rounded-full bg-wf-brand-burgundy dark:bg-wf-cream transition-all duration-nav ease-apple-nav" />
              )}
              <div className="relative flex items-center justify-center mt-1">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isRouteActive
                      ? 'text-wf-brand-burgundy dark:text-wf-cream'
                      : 'text-wf-text-secondary group-hover:text-wf-text-primary'
                  )}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-wf-brand-burgundy text-[9px] font-bold text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
