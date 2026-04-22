import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useProjects() {
    return useQuery({
        queryKey: ['projects'],
        queryFn: () => apiFetch('/api/projects'),
    });
}
export function useAddProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
    });
}
export function useRemoveProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
    });
}
export function useManifest(projectId) {
    return useQuery({
        enabled: !!projectId,
        queryKey: ['manifest', projectId],
        queryFn: () => apiFetch(`/api/projects/${projectId}/manifest`),
    });
}
export function useDiffPreview() {
    return useMutation({
        mutationFn: (input) => apiFetch(`/api/projects/${input.projectId}/diff-preview`, {
            method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
        }),
    });
}
export function useApply() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch(`/api/projects/${input.projectId}/apply`, {
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
        mutationFn: (input) => apiFetch(`/api/projects/${input.projectId}/unapply`, {
            method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
        }),
        onSuccess: (_d, v) => {
            qc.invalidateQueries({ queryKey: ['manifest', v.projectId] });
            qc.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}
