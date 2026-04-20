import { mkdir, stat } from 'node:fs/promises';
import { DEFAULT_USER_SKILLS_DIR } from '@loom/shared';
import type { CenterDbStore } from '../storage/center-db.js';

export function resolveUserSkillsDir(db: CenterDbStore): string {
  return db.data.userSkillsDir ?? DEFAULT_USER_SKILLS_DIR;
}

export async function ensureUserSkillsDir(db: CenterDbStore): Promise<string> {
  const dir = resolveUserSkillsDir(db);
  await mkdir(dir, { recursive: true });
  if (!db.data.userSkillsDir) {
    db.data.userSkillsDir = dir;
    await db.write();
  }
  return dir;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export async function validateUserSkillsDir(candidate: string): Promise<ValidationResult> {
  if (!candidate || candidate.trim().length === 0) {
    return { ok: false, error: 'Path is empty' };
  }
  try {
    const s = await stat(candidate);
    if (!s.isDirectory()) return { ok: false, error: 'Path exists but is not a directory' };
    return { ok: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true };
    return { ok: false, error: (err as Error).message };
  }
}
