import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Project, Manifest, DiffPreview } from '@skill-manager/shared';

export type ProjectWithStatus = Project & { status: 'ok' | 'broken' };

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<ProjectWithStatus[]>('/api/projects'),
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { path: string; name?: string; notes?: string }) =>
      apiFetch<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
}

export function useRemoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
}

export function useManifest(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ['manifest', projectId],
    queryFn: () => apiFetch<{ manifest: Manifest | null }>(`/api/projects/${projectId}/manifest`),
  });
}

export function useDiffPreview() {
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds: string[] }) =>
      apiFetch<DiffPreview & { missing: string[] }>(`/api/projects/${input.projectId}/diff-preview`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds: string[] }) =>
      apiFetch<{ manifest: Manifest; method: string }>(`/api/projects/${input.projectId}/apply`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['manifest', v.projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUnapply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds?: string[] }) =>
      apiFetch<{ removed: unknown[] }>(`/api/projects/${input.projectId}/unapply`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['manifest', v.projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
