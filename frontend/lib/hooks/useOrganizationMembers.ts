'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/authContext';
import { OrganizationMember, DepartmentSummary, UserRole } from '@/lib/types';

export interface UpdateProfileInput {
  fullName: string;
  phone?: string | null;
  department: string;
  jobTitle: string;
  weeklyCapacityHours: number;
}

export interface UseOrganizationMembersResult {
  members: OrganizationMember[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalMembers: number;
  totalCapacityHours: number;
  departments: DepartmentSummary[];
  inviteMember: (email: string, role?: UserRole) => Promise<{ error: string | null; data?: any }>;
  updateMemberRole: (targetUserId: string, newRole: UserRole) => Promise<{ error: string | null; data?: any }>;
  removeMember: (targetUserId: string) => Promise<{ error: string | null }>;
  updateCurrentUserProfile: (updates: UpdateProfileInput) => Promise<{ error: string | null }>;
}

/**
 * useOrganizationMembers
 *
 * Securely loads active memberships and associated user profiles for the
 * verified authenticated user's organization from Supabase PostgreSQL.
 *
 * Zero-Trust & Authorization Directives:
 * - Derives the organization ID strictly from the verified authenticated session.
 * - Never trusts or accepts a client-provided organization ID parameter.
 * - Enforces database RLS policies as the ultimate security boundary.
 * - An empty query result remains strictly empty; never falls back to synthetic mock data.
 */
export function useOrganizationMembers(): UseOrganizationMembersResult {
  const { organization, isAuthenticated, isLoading: authLoading, user, refreshUserData } = useAuth();
  const [members, setMembers] = React.useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);

  // Securely derive organization ID strictly from verified auth state
  const verifiedOrgId = organization?.id || null;

  const fetchMembers = React.useCallback(async () => {
    // If auth is still loading, wait
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    // If not authenticated or no active organization, return clean empty state
    if (!isAuthenticated || !verifiedOrgId) {
      setMembers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Query active organization memberships joined with user_profiles
      const { data, error: queryError } = await supabase
        .from('organization_memberships')
        .select(`
          id,
          organization_id,
          user_id,
          role,
          status,
          created_at,
          user_profiles (
            id,
            email,
            full_name,
            avatar_url,
            phone,
            department,
            job_title,
            weekly_capacity_hours
          )
        `)
        .eq('organization_id', verifiedOrgId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (queryError) {
        console.error('Failed to query organization members from Supabase:', queryError);
        setError(queryError.message || 'Failed to load organization members.');
        setMembers([]);
        return;
      }

      // Defensively parse and map database rows
      const mappedMembers: OrganizationMember[] = (data || []).map((row: any) => {
        const profile = Array.isArray(row.user_profiles)
          ? row.user_profiles[0]
          : row.user_profiles;

        const rawCapacity = profile?.weekly_capacity_hours;
        let capacity: number;
        if (rawCapacity === undefined || rawCapacity === null || rawCapacity === '') {
          capacity = 40;
        } else {
          const num = Number(rawCapacity);
          if (!Number.isFinite(num)) {
            capacity = 40;
          } else if (num < 0) {
            // Defensive: Never convert negative values to 40; clamp to 0 to prevent overstating capacity
            capacity = 0;
          } else {
            capacity = num;
          }
        }

        return {
          id: row.id,
          membershipId: row.id,
          userId: row.user_id,
          organizationId: row.organization_id,
          role: (row.role as UserRole) || 'employee',
          status: row.status || 'active',
          fullName: profile?.full_name || 'Team Member',
          email: profile?.email || '',
          avatarUrl: profile?.avatar_url || null,
          phone: profile?.phone || null,
          department: profile?.department || 'General',
          jobTitle: profile?.job_title || 'Software Engineer',
          weeklyCapacityHours: capacity,
          joinedAt: row.created_at,
        };
      });

      // Pure database records: never fall back to initialEmployees or synthetic records
      setMembers(mappedMembers);
      setError(null);
    } catch (err: any) {
      console.error('Unexpected error fetching organization members:', err);
      setError(err?.message || 'An unexpected error occurred while loading team members.');
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, isAuthenticated, verifiedOrgId, authLoading]);

  React.useEffect(() => {
    let isMounted = true;

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !verifiedOrgId) {
      setMembers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, verifiedOrgId, fetchMembers]);

  // Aggregate total members count
  const totalMembers = members.length;

  // Aggregate total weekly capacity across active members
  const totalCapacityHours = React.useMemo(() => {
    return members.reduce((sum, m) => sum + m.weeklyCapacityHours, 0);
  }, [members]);

  // Aggregate departmental breakdowns dynamically from real members
  const departments = React.useMemo(() => {
    const deptMap = new Map<string, { count: number; capacity: number }>();

    for (const member of members) {
      const deptName = member.department || 'General';
      const existing = deptMap.get(deptName) || { count: 0, capacity: 0 };
      deptMap.set(deptName, {
        count: existing.count + 1,
        capacity: existing.capacity + member.weeklyCapacityHours,
      });
    }

    const result: DepartmentSummary[] = [];
    deptMap.forEach((val, key) => {
      result.push({
        department: key,
        headcount: val.count,
        totalCapacityHours: val.capacity,
      });
    });

    return result.sort(
      (a, b) => b.headcount - a.headcount || a.department.localeCompare(b.department)
    );
  }, [members]);

  const inviteMember = React.useCallback(
    async (email: string, role: UserRole = 'employee') => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };
      try {
        const { data, error: rpcError } = await supabase.rpc('invite_organization_member', {
          p_organization_id: verifiedOrgId,
          p_email: email.trim().toLowerCase(),
          p_role: role,
        });
        if (rpcError) return { error: rpcError.message };
        await fetchMembers();
        return { error: null, data };
      } catch (err: any) {
        return { error: err.message || 'Failed to invite member' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers]
  );

  const updateMemberRole = React.useCallback(
    async (targetUserId: string, newRole: UserRole) => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };
      try {
        const { data, error: rpcError } = await supabase.rpc('update_member_role', {
          p_organization_id: verifiedOrgId,
          p_member_user_id: targetUserId,
          p_new_role: newRole,
        });
        if (rpcError) return { error: rpcError.message };
        await fetchMembers();
        return { error: null, data };
      } catch (err: any) {
        return { error: err.message || 'Failed to update member role' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers]
  );

  const removeMember = React.useCallback(
    async (targetUserId: string) => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };
      try {
        const { data: _res, error: rpcError } = await supabase.rpc('remove_organization_member', {
          p_organization_id: verifiedOrgId,
          p_member_user_id: targetUserId,
        });
        if (rpcError) return { error: rpcError.message };
        await fetchMembers();
        return { error: null };
      } catch (err: any) {
        return { error: err.message || 'Failed to remove member' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers]
  );

  const updateCurrentUserProfile = React.useCallback(
    async (updates: UpdateProfileInput) => {
      if (!isAuthenticated || !user?.id) {
        return { error: 'Authentication required to update profile details.' };
      }

      // Input validation
      const trimmedName = updates.fullName.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return { error: 'Full name must be between 2 and 100 characters.' };
      }

      const trimmedJob = updates.jobTitle.trim();
      if (trimmedJob.length < 2 || trimmedJob.length > 100) {
        return { error: 'Job title must be between 2 and 100 characters.' };
      }

      const capacity = Number(updates.weeklyCapacityHours);
      if (isNaN(capacity) || capacity <= 0 || capacity > 168) {
        return { error: 'Weekly capacity hours must be greater than 0 and at most 168 hours.' };
      }

      try {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            full_name: trimmedName,
            phone: updates.phone ? updates.phone.trim() : null,
            department: updates.department.trim(),
            job_title: trimmedJob,
            weekly_capacity_hours: capacity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          return { error: updateError.message || 'Failed to update profile.' };
        }

        // Refresh auth state and local organization members cache
        if (refreshUserData) {
          await refreshUserData();
        }
        await fetchMembers();

        return { error: null };
      } catch (err: any) {
        return { error: err?.message || 'An unexpected error occurred while updating profile.' };
      }
    },
    [supabase, isAuthenticated, user?.id, refreshUserData, fetchMembers]
  );

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    totalMembers,
    totalCapacityHours,
    departments,
    inviteMember,
    updateMemberRole,
    removeMember,
    updateCurrentUserProfile,
  };
}
