import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { RuleFile } from '@skill-manager/shared';

export function useRules(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ['rules', projectId],
    queryFn: () => apiFetch<{ rules: RuleFile | null }>(`/api/projects/${projectId}/rules`),
  });
}

export function useSaveRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; rules: RuleFile }) =>
      apiFetch<{ rules: RuleFile }>(`/api/projects/${input.projectId}/rules`, {
        method: 'PUT', body: JSON.stringify(input.rules),
      }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['rules', v.projectId] }); },
  });
}
