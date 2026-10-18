'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/authContext';
import {
  Project,
  ProjectStatus,
  PriorityLevel,
  CreateProjectInput,
  UpdateProjectInput,
} from '@/lib/types';

export type { CreateProjectInput, UpdateProjectInput };

export interface UseProjectsResult {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<{ project?: Project; error?: string }>;
  updateProject: (id: string, updates: UpdateProjectInput) => Promise<{ error?: string }>;
  deleteProject: (id: string) => Promise<{ error?: string }>;
  addProjectMember: (projectId: string, userId: string) => Promise<{ error?: string }>;
  removeProjectMember: (projectId: string, userId: string) => Promise<{ error?: string }>;
}

/**
 * useProjects
 *
 * Securely loads and manages projects and project members for the
 * verified authenticated user's organization from Supabase PostgreSQL.
 *
 * Zero-Trust & Authorization Directives:
 * - Derives the organization ID strictly from the verified authenticated session.
 * - Never trusts or accepts a client-provided organization ID parameter.
 * - Relies on database Row-Level Security (RLS) as the security boundary.
 * - An empty query result remains strictly empty; never falls back to synthetic mock data.
 * - Prevents duplicate requests and stale state via active mount and request tracking.
 */
export function useProjects(): UseProjectsResult {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const verifiedOrgId = organization?.id || null;

  // Active request ref to prevent stale state from interleaved responses
  const activeRequestIdRef = React.useRef<number>(0);

  const fetchProjects = React.useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !verifiedOrgId) {
      setProjects([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('projects')
        .select(`
          id,
          organization_id,
          name,
          description,
          status,
          priority,
          manager_id,
          start_date,
          target_end_date,
          total_hours,
          completed_hours,
          created_at,
          updated_at,
          project_members (
            user_id
          ),
          organization_memberships!fk_projects_org_manager (
            user_profiles (
              full_name
            )
          )
        `)
        .eq('organization_id', verifiedOrgId)
        .order('created_at', { ascending: false });

      // Discard stale response if a newer request was dispatched
      if (requestId !== activeRequestIdRef.current) return;

      if (queryError) {
        console.error('Failed to query projects from Supabase:', queryError);
        setError(queryError.message || 'Failed to load projects.');
        setProjects([]);
        return;
      }

      const mappedProjects: Project[] = (data || []).map((row: any) => {
        const membership = Array.isArray(row.organization_memberships)
          ? row.organization_memberships[0]
          : row.organization_memberships;
        const profile = Array.isArray(membership?.user_profiles)
          ? membership.user_profiles[0]
          : membership?.user_profiles;

        const memberIds: string[] = Array.isArray(row.project_members)
          ? row.project_members.map((pm: any) => pm.user_id)
          : [];

        return {
          id: row.id,
          name: row.name,
          description: row.description || '',
          status: row.status as ProjectStatus,
          priority: row.priority as PriorityLevel,
          startDate: row.start_date || '',
          targetEndDate: row.target_end_date || '',
          managerId: row.manager_id || '',
          managerName: profile?.full_name || (row.manager_id ? 'Assigned Manager' : 'Unassigned'),
          memberIds,
          totalHours: Number(row.total_hours) || 0,
          completedHours: Number(row.completed_hours) || 0,
        };
      });

      setProjects(mappedProjects);
      setError(null);
    } catch (err: any) {
      if (requestId !== activeRequestIdRef.current) return;
      console.error('Unexpected error fetching projects:', err);
      setError(err?.message || 'An unexpected error occurred while loading projects.');
      setProjects([]);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [supabase, isAuthenticated, verifiedOrgId, authLoading]);

  React.useEffect(() => {
    let isMounted = true;

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !verifiedOrgId) {
      setProjects([]);
      setIsLoading(false);
      return;
    }

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [fetchProjects, authLoading, isAuthenticated, verifiedOrgId]);

  const createProject = React.useCallback(
    async (input: CreateProjectInput): Promise<{ project?: Project; error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required. No active organization found.' };
      }

      if (!input.name || !input.name.trim()) {
        return { error: 'Project name is required.' };
      }

      try {
        const insertPayload: any = {
          organization_id: verifiedOrgId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          priority: input.priority || 'medium',
          status: input.status || 'planning',
          start_date: input.startDate || null,
          target_end_date: input.targetEndDate || null,
          total_hours: Number(input.totalHours) || 0,
          manager_id: input.managerId && input.managerId.trim() !== '' ? input.managerId : null,
        };

        const { data: newRow, error: insertError } = await supabase
          .from('projects')
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          return { error: insertError.message };
        }

        // Add initial members if specified
        if (input.memberIds && input.memberIds.length > 0) {
          const membersToInsert = input.memberIds.map((uid) => ({
            project_id: newRow.id,
            user_id: uid,
            organization_id: verifiedOrgId,
          }));

          const { error: membersError } = await supabase
            .from('project_members')
            .insert(membersToInsert);

          if (membersError) {
            console.warn('Project created but some members could not be attached:', membersError.message);
          }
        }

        await fetchProjects();

        const createdProject: Project = {
          id: newRow.id,
          name: newRow.name,
          description: newRow.description || '',
          status: newRow.status as ProjectStatus,
          priority: newRow.priority as PriorityLevel,
          startDate: newRow.start_date || '',
          targetEndDate: newRow.target_end_date || '',
          managerId: newRow.manager_id || '',
          managerName: 'Assigned Manager',
          memberIds: input.memberIds || [],
          totalHours: Number(newRow.total_hours) || 0,
          completedHours: Number(newRow.completed_hours) || 0,
        };

        return { project: createdProject };
      } catch (err: any) {
        return { error: err?.message || 'Failed to create project.' };
      }
    },
    [supabase, verifiedOrgId, fetchProjects]
  );

  const updateProject = React.useCallback(
    async (id: string, updates: UpdateProjectInput): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const dbUpdates: any = {
          updated_at: new Date().toISOString(),
        };

        if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
        if (updates.description !== undefined) dbUpdates.description = updates.description.trim() || null;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate || null;
        if (updates.targetEndDate !== undefined) dbUpdates.target_end_date = updates.targetEndDate || null;
        if (updates.totalHours !== undefined) dbUpdates.total_hours = Number(updates.totalHours) || 0;
        if (updates.managerId !== undefined) {
          dbUpdates.manager_id = updates.managerId && updates.managerId.trim() !== '' ? updates.managerId : null;
        }

        const { error: updateError } = await supabase
          .from('projects')
          .update(dbUpdates)
          .eq('id', id)
          .eq('organization_id', verifiedOrgId);

        if (updateError) {
          return { error: updateError.message };
        }

        await fetchProjects();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to update project.' };
      }
    },
    [supabase, verifiedOrgId, fetchProjects]
  );

  const deleteProject = React.useCallback(
    async (id: string): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const { error: deleteError } = await supabase
          .from('projects')
          .delete()
          .eq('id', id)
          .eq('organization_id', verifiedOrgId);

        if (deleteError) {
          return { error: deleteError.message };
        }

        await fetchProjects();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to delete project.' };
      }
    },
    [supabase, verifiedOrgId, fetchProjects]
  );

  const addProjectMember = React.useCallback(
    async (projectId: string, userId: string): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const { error: insertError } = await supabase
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: userId,
            organization_id: verifiedOrgId,
          });

        if (insertError) {
          return { error: insertError.message };
        }

        await fetchProjects();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to add project member.' };
      }
    },
    [supabase, verifiedOrgId, fetchProjects]
  );

  const removeProjectMember = React.useCallback(
    async (projectId: string, userId: string): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const { error: removeError } = await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .eq('organization_id', verifiedOrgId);

        if (removeError) {
          return { error: removeError.message };
        }

        await fetchProjects();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to remove project member.' };
      }
    },
    [supabase, verifiedOrgId, fetchProjects]
  );

  return {
    projects,
    isLoading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    addProjectMember,
    removeProjectMember,
  };
}
