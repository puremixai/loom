import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useSkills(refresh = false) {
    return useQuery({
        queryKey: ['skills', { refresh }],
        queryFn: () => apiFetch(`/api/skills${refresh ? '?refresh=1' : ''}`),
    });
}
