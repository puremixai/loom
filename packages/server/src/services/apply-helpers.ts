import { Mutex } from 'async-mutex';
import { scanSkills } from './scanner.js';
import { readManifest } from './manifest.js';
import { applySkills, unapplySkills } from './link.js';
import type { CenterDbStore } from '../storage/center-db.js';
import type { Skill, DiffPreview, ManifestEntry } from '@loom/shared';

const locks = new Map<string, Mutex>();

export function getLock(projectId: string): Mutex {
  let m = locks.get(projectId);
  if (!m) { m = new Mutex(); locks.set(projectId, m); }
  return m;
}

export async function resolveSkills(db: CenterDbStore, cachePath: string | undefined, ids: string[]): Promise<{ found: Skill[]; missing: string[] }> {
  const { skills } = await scanSkills({ scanPaths: db.data.scanPaths, userSkillsDir: db.data.userSkillsDir, cachePath });
  const byId = new Map(skills.map(s => [s.id, s]));
  const found: Skill[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (s) found.push(s); else missing.push(id);
  }
  return { found, missing };
}

export async function computeDiff(opts: {
  db: CenterDbStore;
  cachePath?: string;
  projectPath: string;
  desiredIds: string[];
}): Promise<DiffPreview & { missing: string[] }> {
  const { found, missing } = await resolveSkills(opts.db, opts.cachePath, opts.desiredIds);
  const manifest = await readManifest(opts.projectPath);
  const currentIds = new Set((manifest?.skills ?? []).map(s => s.id));
  const desiredIds = new Set(found.map(s => s.id));
  return {
    toAdd: found.filter(s => !currentIds.has(s.id)),
    toKeep: found.filter(s => currentIds.has(s.id)),
    toRemove: (manifest?.skills ?? []).filter(e => !desiredIds.has(e.id)) as ManifestEntry[],
    missing,
  };
}

export { applySkills, unapplySkills };
