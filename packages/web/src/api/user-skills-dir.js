import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
export function useOpenUserSkillsDir() {
    return useMutation({
        mutationFn: () => apiFetch('/api/user-skills-dir/open', { method: 'POST' }),
    });
}
