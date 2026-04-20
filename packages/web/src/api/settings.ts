import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { AiConfig } from '@loom/shared';

interface SettingsResponse {
  scanPaths: string[];
  ai: Partial<AiConfig>;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/api/settings'),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { scanPaths?: string[]; ai?: Partial<AiConfig> }) =>
      apiFetch<SettingsResponse>('/api/settings', {
        method: 'PUT', body: JSON.stringify(input),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); },
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; latencyMs: number } | { ok: false; error: string }>('/api/ai/test', { method: 'POST' }),
  });
}
