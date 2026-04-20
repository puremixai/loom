import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { SourceRef, UpdateStatus, PullResult } from '@loom/shared';

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => apiFetch<{ refs: SourceRef[] }>('/api/sources'),
  });
}

export function useCheckSources() {
  return useMutation({
    mutationFn: (input: { refs?: SourceRef[] } = {}) =>
      apiFetch<{ statuses: UpdateStatus[] }>('/api/sources/check', {
        method: 'POST', body: JSON.stringify(input),
      }),
  });
}

export function usePullSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gitRoot: string }) =>
      apiFetch<PullResult>('/api/sources/pull', {
        method: 'POST', body: JSON.stringify(input),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); },
  });
}
