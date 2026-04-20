import { symlink, mkdir } from 'node:fs/promises';
import { copy } from 'fs-extra';
import { join } from 'node:path';
import {
  IS_WINDOWS,
  PROJECT_SKILLS_DIR,
  MANIFEST_FILENAME,
  PROJECT_CLAUDE_DIR,
  ManifestSchema,
  type Skill,
  type Manifest,
  type ManifestEntry,
} from '@loom/shared';
import { atomicWriteFile, exists, isSymlinkOrJunction, removePath } from '../utils/fs-safe.js';

export type LinkMethod = 'symlink' | 'junction' | 'copy';

export interface LinkOneResult {
  method: LinkMethod;
  target: string;
}

async function tryLink(source: string, target: string): Promise<LinkOneResult> {
  await mkdir(join(target, '..'), { recursive: true });
  try {
    await symlink(source, target, 'junction');
    return { method: IS_WINDOWS ? 'junction' : 'symlink', target };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw err;
    try {
      await copy(source, target, { dereference: true, errorOnExist: false });
      return { method: 'copy', target };
    } catch (copyErr) {
      throw copyErr;
    }
  }
}

interface JournalEntry {
  kind: 'created' | 'removed';
  path: string;
  backup?: string;
}

export interface ApplyInput {
  projectPath: string;
  desiredSkills: Skill[];
  currentManifest: Manifest | null;
}

export interface ApplyResult {
  manifest: Manifest;
  method: LinkMethod;
  toAdd: Skill[];
  toKeep: Skill[];
  toRemove: ManifestEntry[];
}

export async function applySkills(input: ApplyInput): Promise<ApplyResult> {
  const skillsDir = join(input.projectPath, PROJECT_SKILLS_DIR);
  await mkdir(skillsDir, { recursive: true });

  const currentIds = new Set((input.currentManifest?.skills ?? []).map(s => s.id));
  const desiredIds = new Set(input.desiredSkills.map(s => s.id));

  const toAdd = input.desiredSkills.filter(s => !currentIds.has(s.id));
  const toKeep = input.desiredSkills.filter(s => currentIds.has(s.id));
  const toRemove = (input.currentManifest?.skills ?? []).filter(e => !desiredIds.has(e.id));

  const journal: JournalEntry[] = [];
  let chosenMethod: LinkMethod = 'symlink';

  try {
    // Removals first (move to backup location so rollback can restore)
    for (const entry of toRemove) {
      const abs = join(input.projectPath, entry.linkedAs);
      const backup = `${abs}.loom-backup-${Date.now()}`;
      if (await exists(abs)) {
        if (await isSymlinkOrJunction(abs)) {
          await removePath(abs);
          journal.push({ kind: 'removed', path: abs });
        } else {
          const { rename } = await import('node:fs/promises');
          await rename(abs, backup);
          journal.push({ kind: 'removed', path: abs, backup });
        }
      }
    }

    // Additions
    for (const skill of toAdd) {
      const target = join(skillsDir, skill.name);
      if (await exists(target)) {
        const managed = (input.currentManifest?.skills ?? []).some(e => join(input.projectPath, e.linkedAs) === target);
        if (managed) {
          await removePath(target);
        } else {
          const err = new Error(`Target exists and is not managed by loom: ${target}`);
          (err as any).code = 'CONFLICT';
          (err as any).statusCode = 409;
          throw err;
        }
      }
      const result = await tryLink(skill.skillDir, target);
      if (result.method === 'copy') chosenMethod = 'copy';
      else if (chosenMethod !== 'copy' && result.method === 'junction') chosenMethod = 'junction';
      journal.push({ kind: 'created', path: target });
    }

    // Build new manifest
    const finalEntries: ManifestEntry[] = input.desiredSkills.map(s => ({
      id: s.id,
      name: s.name,
      sourceDir: s.skillDir,
      linkedAs: join(PROJECT_SKILLS_DIR, s.name).replace(/\\/g, '/'),
    }));
    const manifest: Manifest = ManifestSchema.parse({
      version: 1,
      tool: 'loom',
      appliedAt: new Date().toISOString(),
      method: chosenMethod,
      skills: finalEntries,
    });
    const manifestPath = join(input.projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Clean up backups from removals
    for (const op of journal) {
      if (op.kind === 'removed' && op.backup) await removePath(op.backup);
    }

    return { manifest, method: chosenMethod, toAdd, toKeep, toRemove };
  } catch (err) {
    // Rollback in reverse order
    for (const op of [...journal].reverse()) {
      try {
        if (op.kind === 'created') {
          await removePath(op.path);
        } else if (op.kind === 'removed' && op.backup) {
          const { rename } = await import('node:fs/promises');
          await rename(op.backup, op.path);
        }
      } catch { /* best-effort rollback */ }
    }
    throw err;
  }
}

export async function unapplySkills(opts: {
  projectPath: string;
  manifest: Manifest;
  skillIds?: string[];
}): Promise<{ removed: ManifestEntry[]; remaining: Manifest; warnings: string[] }> {
  const targetIds = opts.skillIds ? new Set(opts.skillIds) : null;
  const removed: ManifestEntry[] = [];
  const remaining: ManifestEntry[] = [];
  const warnings: string[] = [];

  for (const entry of opts.manifest.skills) {
    if (!targetIds || targetIds.has(entry.id)) {
      const abs = join(opts.projectPath, entry.linkedAs);
      if (await exists(abs)) {
        if (await isSymlinkOrJunction(abs)) {
          await removePath(abs);
        } else if (opts.manifest.method === 'copy') {
          // copy-mode manifests intentionally store real directories; safe to remove
          await removePath(abs);
        } else {
          // non-link at a linked path — user likely replaced it manually; refuse
          warnings.push(`Skipped ${abs}: expected link but found real directory; remove manually if intended`);
          remaining.push(entry);
          continue;
        }
      }
      removed.push(entry);
    } else {
      remaining.push(entry);
    }
  }

  const manifestPath = join(opts.projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
  if (remaining.length === 0) {
    await removePath(manifestPath);
  } else {
    const newManifest: Manifest = ManifestSchema.parse({
      version: 1,
      tool: 'loom',
      appliedAt: new Date().toISOString(),
      method: opts.manifest.method,
      skills: remaining,
    });
    await atomicWriteFile(manifestPath, JSON.stringify(newManifest, null, 2));
    return { removed, remaining: newManifest, warnings };
  }

  return {
    removed,
    remaining: { ...opts.manifest, skills: [] },
    warnings,
  };
}
