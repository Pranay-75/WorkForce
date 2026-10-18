'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/authContext';
import {
  Task,
  TaskStatus,
  PriorityLevel,
  TaskSkillPrerequisite,
  CreateTaskInput,
  UpdateTaskDetailsInput,
} from '@/lib/types';

export type { CreateTaskInput, UpdateTaskDetailsInput };

export interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<{ task?: Task; error?: string }>;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus) => Promise<{ error?: string }>;
  updateTaskDetails: (taskId: string, updates: UpdateTaskDetailsInput) => Promise<{ error?: string }>;
  assignTask: (taskId: string, assigneeId: string | null) => Promise<{ error?: string }>;
  deleteTask: (taskId: string) => Promise<{ error?: string }>;
}

/**
 * useTasks
 *
 * Securely loads and manages tasks for the verified authenticated user's
 * organization from Supabase PostgreSQL.
 *
 * Zero-Trust & Authorization Directives:
 * - Derives organization ID strictly from the verified authenticated session.
 * - Never trusts or accepts a client-provided organization ID parameter.
 * - Direct updates to `assigned_to` are blocked by database column-level security.
 * - Reassignment is strictly delegated to the `assign_task()` RPC function.
 * - Employees may update status only on their own assigned tasks (enforced by RLS + DB triggers).
 * - Avoids duplicate requests and stale state using request tracking.
 */
export function useTasks(): UseTasksResult {
  const { organization, isAuthenticated, isLoading: authLoading } = useAuth();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const supabase = React.useMemo(() => createClient(), []);
  const verifiedOrgId = organization?.id || null;

  // Active request ref to prevent stale state from interleaved responses
  const activeRequestIdRef = React.useRef<number>(0);

  const fetchTasks = React.useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;

    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !verifiedOrgId) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('tasks')
        .select(`
          id,
          organization_id,
          project_id,
          title,
          description,
          assigned_to,
          status,
          priority,
          complexity,
          due_date,
          estimated_hours,
          actual_hours,
          required_skills,
          created_at,
          updated_at,
          projects (
            name
          ),
          organization_memberships!fk_tasks_org_assignee (
            user_profiles (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('organization_id', verifiedOrgId)
        .order('created_at', { ascending: false });

      // Discard stale response if newer request dispatched
      if (requestId !== activeRequestIdRef.current) return;

      if (queryError) {
        console.error('Failed to query tasks from Supabase:', queryError);
        setError(queryError.message || 'Failed to load tasks.');
        setTasks([]);
        return;
      }

      const mappedTasks: Task[] = (data || []).map((row: any) => {
        const proj = Array.isArray(row.projects) ? row.projects[0] : row.projects;
        const membership = Array.isArray(row.organization_memberships)
          ? row.organization_memberships[0]
          : row.organization_memberships;
        const profile = Array.isArray(membership?.user_profiles)
          ? membership.user_profiles[0]
          : membership?.user_profiles;

        const assignedName = profile?.full_name || undefined;
        let assignedAvatar: string | undefined = undefined;
        if (profile?.avatar_url) {
          assignedAvatar = profile.avatar_url;
        } else if (assignedName) {
          assignedAvatar = assignedName
            .split(' ')
            .filter(Boolean)
            .map((n: string) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
        }

        return {
          id: row.id,
          projectId: row.project_id,
          projectName: proj?.name || 'Project',
          title: row.title,
          description: row.description || '',
          status: row.status as TaskStatus,
          priority: row.priority as PriorityLevel,
          complexity: (row.complexity || 'Medium') as 'Low' | 'Medium' | 'High',
          estimatedHours: Number(row.estimated_hours) || 0,
          dueDate: row.due_date ? row.due_date.split('T')[0] : '',
          assignedTo: row.assigned_to || undefined,
          assignedEmployeeName: assignedName,
          assignedEmployeeAvatar: assignedAvatar,
          requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
          createdAt: row.created_at,
        };
      });

      setTasks(mappedTasks);
      setError(null);
    } catch (err: any) {
      if (requestId !== activeRequestIdRef.current) return;
      console.error('Unexpected error fetching tasks:', err);
      setError(err?.message || 'An unexpected error occurred while loading tasks.');
      setTasks([]);
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
      setTasks([]);
      setIsLoading(false);
      return;
    }

    fetchTasks();

    return () => {
      isMounted = false;
    };
  }, [fetchTasks, authLoading, isAuthenticated, verifiedOrgId]);

  const createTask = React.useCallback(
    async (input: CreateTaskInput): Promise<{ task?: Task; error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required. No active organization found.' };
      }

      if (!input.title || !input.title.trim()) {
        return { error: 'Task title is required.' };
      }

      if (!input.projectId) {
        return { error: 'Project association is required.' };
      }

      try {
        const targetAssignee =
          input.assignedTo && input.assignedTo !== 'unassigned' && input.assignedTo.trim() !== ''
            ? input.assignedTo
            : null;

        const insertPayload: any = {
          organization_id: verifiedOrgId,
          project_id: input.projectId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          status: input.status || 'todo',
          priority: input.priority || 'medium',
          complexity: input.complexity || 'Medium',
          estimated_hours: Number(input.estimatedHours) || 0,
          due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
          assigned_to: targetAssignee,
          required_skills: input.requiredSkills || [],
        };

        const { data: newRow, error: insertError } = await supabase
          .from('tasks')
          .insert(insertPayload)
          .select(`
            *,
            projects (name)
          `)
          .single();

        if (insertError) {
          return { error: insertError.message };
        }

        await fetchTasks();

        const proj = Array.isArray(newRow.projects) ? newRow.projects[0] : newRow.projects;
        const createdTask: Task = {
          id: newRow.id,
          projectId: newRow.project_id,
          projectName: proj?.name || 'Project',
          title: newRow.title,
          description: newRow.description || '',
          status: newRow.status as TaskStatus,
          priority: newRow.priority as PriorityLevel,
          complexity: newRow.complexity as 'Low' | 'Medium' | 'High',
          estimatedHours: Number(newRow.estimated_hours) || 0,
          dueDate: newRow.due_date ? newRow.due_date.split('T')[0] : '',
          assignedTo: newRow.assigned_to || undefined,
          requiredSkills: Array.isArray(newRow.required_skills) ? newRow.required_skills : [],
          createdAt: newRow.created_at,
        };

        return { task: createdTask };
      } catch (err: any) {
        return { error: err?.message || 'Failed to create task.' };
      }
    },
    [supabase, verifiedOrgId, fetchTasks]
  );

  const updateTaskStatus = React.useCallback(
    async (taskId: string, newStatus: TaskStatus): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId)
          .eq('organization_id', verifiedOrgId);

        if (updateError) {
          return { error: updateError.message };
        }

        await fetchTasks();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to update task status.' };
      }
    },
    [supabase, verifiedOrgId, fetchTasks]
  );

  const updateTaskDetails = React.useCallback(
    async (taskId: string, updates: UpdateTaskDetailsInput): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const dbUpdates: any = {
          updated_at: new Date().toISOString(),
        };

        if (updates.title !== undefined) dbUpdates.title = updates.title.trim();
        if (updates.description !== undefined) dbUpdates.description = updates.description.trim() || null;
        if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
        if (updates.complexity !== undefined) dbUpdates.complexity = updates.complexity;
        if (updates.estimatedHours !== undefined) dbUpdates.estimated_hours = Number(updates.estimatedHours) || 0;
        if (updates.dueDate !== undefined) {
          dbUpdates.due_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
        }
        if (updates.requiredSkills !== undefined) dbUpdates.required_skills = updates.requiredSkills;

        const { error: updateError } = await supabase
          .from('tasks')
          .update(dbUpdates)
          .eq('id', taskId)
          .eq('organization_id', verifiedOrgId);

        if (updateError) {
          return { error: updateError.message };
        }

        await fetchTasks();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to update task details.' };
      }
    },
    [supabase, verifiedOrgId, fetchTasks]
  );

  const assignTask = React.useCallback(
    async (taskId: string, assigneeId: string | null): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const targetAssignee =
          !assigneeId || assigneeId === 'unassigned' || assigneeId.trim() === ''
            ? null
            : assigneeId;

        const { error: rpcError } = await supabase.rpc('assign_task', {
          p_task_id: taskId,
          p_assignee_id: targetAssignee,
        });

        if (rpcError) {
          return { error: rpcError.message };
        }

        await fetchTasks();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to assign task.' };
      }
    },
    [supabase, verifiedOrgId, fetchTasks]
  );

  const deleteTask = React.useCallback(
    async (taskId: string): Promise<{ error?: string }> => {
      if (!verifiedOrgId) {
        return { error: 'Authentication required.' };
      }

      try {
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('organization_id', verifiedOrgId);

        if (deleteError) {
          return { error: deleteError.message };
        }

        await fetchTasks();
        return {};
      } catch (err: any) {
        return { error: err?.message || 'Failed to delete task.' };
      }
    },
    [supabase, verifiedOrgId, fetchTasks]
  );

  return {
    tasks,
    isLoading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTaskStatus,
    updateTaskDetails,
    assignTask,
    deleteTask,
  };
}
