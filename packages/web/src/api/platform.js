import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
export function usePlatform() {
    return useQuery({
        queryKey: ['platform'],
        queryFn: () => apiFetch('/api/platform'),
    });
}
