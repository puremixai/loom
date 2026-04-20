import { stat } from 'node:fs/promises';

export async function computeFingerprint(path: string): Promise<string> {
  const s = await stat(path);
  return `${Math.floor(s.mtimeMs)}-${s.size}`;
}
