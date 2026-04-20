import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Skill } from '@skill-manager/shared';

interface SkillsResponse { skills: Skill[]; warnings: string[] }

export function useSkills(refresh = false) {
  return useQuery({
    queryKey: ['skills', { refresh }],
    queryFn: () => apiFetch<SkillsResponse>(`/api/skills${refresh ? '?refresh=1' : ''}`),
  });
}
