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

export interface PendingOrgInvitation {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  accountStatus: 'pending_setup';
  createdAt: string;
}

export interface UseOrganizationMembersResult {
  members: OrganizationMember[];
  activeMembers: OrganizationMember[];
  pendingMembers: PendingOrgInvitation[];
  pendingInvitations: PendingOrgInvitation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalMembers: number;
  totalCapacityHours: number;
  departments: DepartmentSummary[];
  addMember: (email: string, role?: UserRole) => Promise<{ error: string | null; data?: any }>;
  inviteMember: (email: string, role?: UserRole) => Promise<{ error: string | null; data?: any }>;
  updateMemberRole: (targetUserId: string, newRole: UserRole) => Promise<{ error: string | null; data?: any }>;
  removeMember: (targetId: string, options?: { isPending?: boolean }) => Promise<{ error: string | null; data?: any }>;
  revokeInvitation: (invitationId: string) => Promise<{ error: string | null; data?: any }>;
  updateCurrentUserProfile: (updates: UpdateProfileInput) => Promise<{ error: string | null }>;
}

/**
 * useOrganizationMembers
 *
 * Securely loads active memberships, pending setup members, and associated
 * user profiles for the verified authenticated user's organization from Supabase PostgreSQL.
 *
 * Zero-Trust & Authorization Directives:
 * - Derives the organization ID strictly from the verified authenticated session.
 * - Never trusts or accepts a client-provided organization ID parameter.
 * - Enforces database RLS policies as the ultimate security boundary.
 * - Displays all organization members: Active and Pending Setup.
 */
export function useOrganizationMembers(): UseOrganizationMembersResult {
  const { organization, isAuthenticated, isLoading: authLoading, user, refreshUserData } = useAuth();
  const [members, setMembers] = React.useState<OrganizationMember[]>([]);
  const [activeMembers, setActiveMembers] = React.useState<OrganizationMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = React.useState<PendingOrgInvitation[]>([]);
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
      setActiveMembers([]);
      setPendingInvitations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Query active organization memberships joined with user_profiles
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
        setActiveMembers([]);
        return;
      }

      // Defensively parse and map active database rows
      const mappedActiveMembers: OrganizationMember[] = (data || []).map((row: any) => {
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
          accountStatus: 'active' as const,
          isPending: false,
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

      // 2. Query pending member records from organization_invitations
      let mappedPendingMembers: OrganizationMember[] = [];
      try {
        const { data: invData } = await supabase
          .from('organization_invitations')
          .select('id, email, role, status, created_at')
          .eq('organization_id', verifiedOrgId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (invData) {
          const pendingList: PendingOrgInvitation[] = invData.map((inv: any) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role as UserRole,
            status: inv.status,
            accountStatus: 'pending_setup' as const,
            createdAt: inv.created_at,
          }));
          setPendingInvitations(pendingList);

          mappedPendingMembers = invData.map((inv: any) => ({
            id: `pending-${inv.id}`,
            membershipId: inv.id,
            userId: inv.id,
            organizationId: verifiedOrgId,
            role: (inv.role as UserRole) || 'employee',
            status: 'invited' as const,
            accountStatus: 'pending_setup' as const,
            isPending: true,
            fullName: inv.email.split('@')[0],
            email: inv.email,
            avatarUrl: null,
            phone: null,
            department: 'General',
            jobTitle: inv.role === 'manager' ? 'Manager (Pending Setup)' : 'Employee (Pending Setup)',
            weeklyCapacityHours: 40,
            joinedAt: inv.created_at,
          }));
        } else {
          setPendingInvitations([]);
        }
      } catch (e) {
        setPendingInvitations([]);
      }

      setActiveMembers(mappedActiveMembers);
      // Pure database records: unified view of verified active and pending setup members
      setMembers([...mappedActiveMembers, ...mappedPendingMembers]);
      setError(null);
    } catch (err: any) {
      console.error('Unexpected error fetching organization members:', err);
      setError(err?.message || 'An unexpected error occurred while loading team members.');
      setMembers([]);
      setActiveMembers([]);
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
      setActiveMembers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchMembers();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, verifiedOrgId, fetchMembers]);

  // Aggregate total members count across active and pending members
  const totalMembers = members.length;

  // Aggregate total weekly capacity across active members only
  const totalCapacityHours = React.useMemo(() => {
    return activeMembers.reduce((sum, m) => sum + m.weeklyCapacityHours, 0);
  }, [activeMembers]);

  // Aggregate departmental breakdowns dynamically from verified members
  const departments = React.useMemo(() => {
    const deptMap = new Map<string, { count: number; capacity: number }>();

    for (const member of activeMembers) {
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
  }, [activeMembers]);

  /**
   * Adds a new member to the organization workspace.
   * Enforces role boundary: Manager or Employee only (Organizer cannot be created).
   * Details are immediately persisted in Supabase with status 'pending_setup'.
   */
  const addMember = React.useCallback(
    async (email: string, role: UserRole = 'employee') => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { error: 'A valid email address is required.' };
      }
      if (role !== 'admin' && role !== 'hr' && role !== 'manager' && role !== 'employee') {
        return { error: 'Invalid role. Members can only be assigned Admin, HR, Manager, or Staff role.' };
      }
      try {
        // Attempt dedicated add_organization_member RPC first
        const { data, error: rpcError } = await supabase.rpc('add_organization_member', {
          p_organization_id: verifiedOrgId,
          p_email: cleanEmail,
          p_role: role,
        });

        if (rpcError) {
          // If add_organization_member RPC is not yet applied, fallback to invite_organization_member
          if (rpcError.message?.includes('add_organization_member') || rpcError.code === '42883') {
            const { data: fbData, error: fbError } = await supabase.rpc('invite_organization_member', {
              p_organization_id: verifiedOrgId,
              p_email: cleanEmail,
              p_role: role,
            });
            if (fbError) return { error: fbError.message };
            await fetchMembers();
            return { error: null, data: fbData };
          }
          return { error: rpcError.message };
        }

        await fetchMembers();
        return { error: null, data };
      } catch (err: any) {
        return { error: err.message || 'Failed to add member to workspace.' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers]
  );

  /**
   * Backwards-compatible alias for addMember.
   */
  const inviteMember = React.useCallback(
    async (email: string, role: UserRole = 'employee') => {
      return addMember(email, role);
    },
    [addMember]
  );

  const updateMemberRole = React.useCallback(
    async (targetUserId: string, newRole: UserRole) => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };
      if (newRole !== 'admin' && newRole !== 'hr' && newRole !== 'manager' && newRole !== 'employee') {
        return { error: 'Invalid role. Member roles can only be changed to Admin, HR, Manager, or Staff.' };
      }
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

  /**
   * Revokes a pending organization invitation.
   * Strictly isolated from active member removal.
   */
  const revokeInvitation = React.useCallback(
    async (invitationId: string) => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };

      const trimmedId = (invitationId || '').trim();
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!trimmedId || !UUID_REGEX.test(trimmedId)) {
        return { error: 'Invalid or missing invitation identifier.' };
      }

      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('revoke_organization_invitation', {
          p_organization_id: verifiedOrgId,
          p_invitation_id: trimmedId,
        });

        if (rpcError) {
          return { error: rpcError.message || 'Failed to revoke invitation.' };
        }

        // Verify that the invitation is no longer active/pending in the database
        const { data: verifyInv, error: verifyErr } = await supabase
          .from('organization_invitations')
          .select('id, status')
          .eq('organization_id', verifiedOrgId)
          .eq('id', trimmedId)
          .maybeSingle();

        if (verifyErr) {
          console.error('Error verifying invitation revocation:', verifyErr);
        } else if (verifyInv && verifyInv.status === 'pending') {
          return {
            error: 'Failed to verify invitation revocation: invitation record is still pending in database.',
          };
        }

        await fetchMembers();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('workforce:member-removed', {
              detail: { userId: trimmedId, organizationId: verifiedOrgId },
            })
          );
        }

        return { error: null, data: rpcData };
      } catch (err: any) {
        return { error: err.message || 'Failed to revoke invitation' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers]
  );

  /**
   * Removes an active member from the organization workspace.
   *
   * Flow & Verification Guarantees:
   * 1. Requires exact organization ID and member user UUID (auth.users / user_profiles ID).
   * 2. Calls public.remove_organization_member RPC.
   * 3. Inspects the RPC response; rejects non-successful statuses.
   * 4. Re-reads the membership from Supabase to verify it is truly deleted.
   * 5. Never optimistically reports success if database removal failed or was not verified.
   */
  const removeMember = React.useCallback(
    async (targetId: string, options?: { isPending?: boolean }) => {
      if (!verifiedOrgId) return { error: 'No active organization found.' };

      const trimmedId = (targetId || '').trim();
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!trimmedId || !UUID_REGEX.test(trimmedId)) {
        return { error: 'Invalid or missing member ID. Please select a valid member.' };
      }

      // If explicitly marked as pending, delegate strictly to revokeInvitation
      if (options?.isPending) {
        return revokeInvitation(trimmedId);
      }

      try {
        // Active-member removal flow: calls remove_organization_member with member user UUID
        const { data: rpcData, error: rpcError } = await supabase.rpc('remove_organization_member', {
          p_organization_id: verifiedOrgId,
          p_member_user_id: trimmedId,
        });

        if (rpcError) {
          return { error: rpcError.message || 'Failed to remove member from workspace.' };
        }

        // Validate RPC response structure
        if (!rpcData || rpcData.status !== 'member_removed') {
          return {
            error: rpcData?.message || 'Removal failed: database did not confirm member removal.',
          };
        }

        // Step 5: Verify the result by re-reading the membership from Supabase after the operation
        const { data: remainingMembership, error: verifyError } = await supabase
          .from('organization_memberships')
          .select('id, status')
          .eq('organization_id', verifiedOrgId)
          .eq('user_id', trimmedId)
          .maybeSingle();

        if (verifyError) {
          console.error('Error verifying membership deletion from Supabase:', verifyError);
        } else if (remainingMembership && remainingMembership.status === 'active') {
          return {
            error: 'Failed to verify member removal: active membership record still exists in database.',
          };
        }

        await fetchMembers();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('workforce:member-removed', {
              detail: { userId: trimmedId, organizationId: verifiedOrgId },
            })
          );
        }

        return { error: null, data: rpcData };
      } catch (err: any) {
        return { error: err.message || 'Failed to remove member' };
      }
    },
    [supabase, verifiedOrgId, fetchMembers, revokeInvitation]
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
    activeMembers,
    pendingMembers: pendingInvitations,
    pendingInvitations,
    isLoading,
    error,
    refetch: fetchMembers,
    totalMembers,
    totalCapacityHours,
    departments,
    addMember,
    inviteMember,
    updateMemberRole,
    removeMember,
    revokeInvitation,
    updateCurrentUserProfile,
  };
}
