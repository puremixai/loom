import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: () => apiFetch('/api/settings'),
    });
}
export function useSaveSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch('/api/settings', {
            method: 'PUT', body: JSON.stringify(input),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settings'] });
            qc.invalidateQueries({ queryKey: ['skills'] });
            qc.invalidateQueries({ queryKey: ['platform'] });
        },
    });
}
export function useTestAi() {
    return useMutation({
        mutationFn: () => apiFetch('/api/ai/test', { method: 'POST' }),
    });
}
