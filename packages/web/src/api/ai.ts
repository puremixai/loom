import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Skill } from '@skill-manager/shared';

export interface AiRecommendResponse {
  picks: Array<{ skill: Skill; reason: string }>;
  warnings: string[];
  rawResponse: string;
}

export function useRecommend() {
  return useMutation({
    mutationFn: (input: {
      projectId: string; projectHint: string;
      includes: string[]; excludes: string[]; keywords: string[]; aiGuidance?: string;
    }) => apiFetch<AiRecommendResponse>('/api/ai/recommend', {
      method: 'POST', body: JSON.stringify(input),
    }),
  });
}
