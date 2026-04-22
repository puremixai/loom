import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useRules(projectId) {
    return useQuery({
        enabled: !!projectId,
        queryKey: ['rules', projectId],
        queryFn: () => apiFetch(`/api/projects/${projectId}/rules`),
    });
}
export function useSaveRules() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch(`/api/projects/${input.projectId}/rules`, {
            method: 'PUT', body: JSON.stringify(input.rules),
        }),
        onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['rules', v.projectId] }); },
    });
}
