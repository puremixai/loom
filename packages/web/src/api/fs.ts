import type { FsBrowseResponse } from '@loom/shared';
import { apiFetch } from './client';

export async function browseDir(path?: string): Promise<FsBrowseResponse> {
  const q = path !== undefined ? `?path=${encodeURIComponent(path)}` : '';
  return apiFetch<FsBrowseResponse>(`/api/fs/browse${q}`);
}
