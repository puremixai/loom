import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface PlatformResponse {
  os: string;
  release: string;
  arch: string;
  node: string;
  linkMethodPreview: 'symlink' | 'junction' | 'copy';
  userSkillsDir: string;
}

export function usePlatform() {
  return useQuery({
    queryKey: ['platform'],
    queryFn: () => apiFetch<PlatformResponse>('/api/platform'),
  });
}
