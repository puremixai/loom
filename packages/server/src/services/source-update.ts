import { access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Skill, SourceRef } from '@loom/shared';

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function findGitRoot(skillDir: string, stopAt: string): Promise<string | null> {
  const normalizedStop = stopAt.replace(/[\\/]+$/, '');
  let p = skillDir;
  for (let i = 0; i < 32; i++) {
    // p must be inside (or equal to) the stop boundary to be considered
    if (!p.startsWith(normalizedStop)) return null;
    if (await pathExists(join(p, '.git'))) return p;
    // do not walk above the boundary
    if (p === normalizedStop) return null;
    const parent = dirname(p);
    if (parent === p) return null;
    p = parent;
  }
  return null;
}

export async function detectGitRoots(skills: Skill[]): Promise<SourceRef[]> {
  const byRoot = new Map<string, SourceRef>();
  for (const skill of skills) {
    const gitRoot = await findGitRoot(skill.skillDir, skill.sourceRoot);
    if (!gitRoot) continue;
    const existing = byRoot.get(gitRoot);
    if (existing) {
      existing.skillIds.push(skill.id);
      continue;
    }
    const isPlugin = skill.source === 'plugin';
    const ref: SourceRef = isPlugin
      ? {
          kind: 'plugin',
          gitRoot,
          displayName: skill.pluginName ?? basename(gitRoot),
          skillIds: [skill.id],
          marketplace: skill.pluginName?.split('/')[0],
          pluginName: skill.pluginName,
        }
      : {
          kind: 'git-source',
          gitRoot,
          displayName: basename(gitRoot),
          skillIds: [skill.id],
        };
    byRoot.set(gitRoot, ref);
  }
  return [...byRoot.values()];
}

export function formatPluginUpdateCmd(ref: SourceRef): string {
  if (ref.kind !== 'plugin' || !ref.pluginName) return '';
  return `claude plugins update ${ref.pluginName}`;
}
