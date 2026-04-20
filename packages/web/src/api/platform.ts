import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

export function usePlatform() {
  return useQuery({
    queryKey: ['platform'],
    queryFn: () => apiFetch<{
      os: string; release: string; arch: string; node: string;
      linkMethodPreview: 'symlink' | 'junction' | 'copy';
    }>('/api/platform'),
  });
}
