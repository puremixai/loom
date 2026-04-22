import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useRecommend() {
    return useMutation({
        mutationFn: (input) => apiFetch('/api/ai/recommend', {
            method: 'POST', body: JSON.stringify(input),
        }),
    });
}
