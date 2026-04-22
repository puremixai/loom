import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useSources() {
    return useQuery({
        queryKey: ['sources'],
        queryFn: () => apiFetch('/api/sources'),
    });
}
export function useCheckSources() {
    return useMutation({
        mutationFn: () => apiFetch('/api/sources/check', {
            method: 'POST',
        }),
    });
}
export function usePullSource() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch('/api/sources/pull', {
            method: 'POST', body: JSON.stringify(input),
        }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); },
    });
}
