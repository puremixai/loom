import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findGitRoot, detectGitRoots, formatPluginUpdateCmd } from '../src/services/source-update.js';
import type { Skill } from '@loom/shared';

function mkSkill(id: string, name: string, skillDir: string, sourceRoot: string, source: Skill['source'] = 'user-local', pluginName?: string): Skill {
  return {
    id, name, description: `${name} desc`, source,
    sourceRoot, absolutePath: join(skillDir, 'SKILL.md'), skillDir,
    fingerprint: '1', pluginName,
  };
}

describe('source-update git detection', () => {
  let work: string;
  beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'sm-gd-')); });
  afterEach(() => { rmSync(work, { recursive: true, force: true }); });

  it('findGitRoot returns the directory containing .git', async () => {
    const repoRoot = join(work, 'repo');
    const skillDir = join(repoRoot, 'skills', 'alpha');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, work);
    expect(found).toBe(repoRoot);
  });

  it('findGitRoot returns null when no .git in scope', async () => {
    const skillDir = join(work, 'plain', 'alpha');
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, work);
    expect(found).toBeNull();
  });

  it('findGitRoot respects stopAt boundary', async () => {
    mkdirSync(join(work, '.git'), { recursive: true });
    const scope = join(work, 'scope');
    const skillDir = join(scope, 'skill');
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, scope);
    expect(found).toBeNull();
  });

  it('detectGitRoots merges multiple skills under the same gitRoot', async () => {
    const repoRoot = join(work, 'repo');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    const a = join(repoRoot, 'a'); const b = join(repoRoot, 'b');
    mkdirSync(a); mkdirSync(b);
    const skills: Skill[] = [
      mkSkill('id1', 'a', a, work),
      mkSkill('id2', 'b', b, work),
    ];
    const refs = await detectGitRoots(skills);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.skillIds.sort()).toEqual(['id1', 'id2']);
    expect(refs[0]!.kind).toBe('git-source');
    expect(refs[0]!.displayName).toBe('repo');
  });

  it('detectGitRoots produces plugin kind and extracts marketplace', async () => {
    const repoRoot = join(work, 'cache', 'market-a', 'plugin-x', 'v1');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    const skillDir = join(repoRoot, 'skill');
    mkdirSync(skillDir);
    const skills: Skill[] = [
      mkSkill('id-p', 's', skillDir, work, 'plugin', 'market-a/plugin-x'),
    ];
    const refs = await detectGitRoots(skills);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.kind).toBe('plugin');
    expect(refs[0]!.marketplace).toBe('market-a');
    expect(refs[0]!.pluginName).toBe('market-a/plugin-x');
    expect(refs[0]!.displayName).toBe('market-a/plugin-x');
  });

  it('formatPluginUpdateCmd produces claude CLI command', () => {
    const cmd = formatPluginUpdateCmd({
      kind: 'plugin', gitRoot: '/g', displayName: 'm/p',
      skillIds: [], marketplace: 'm', pluginName: 'm/p',
    });
    expect(cmd).toBe('claude plugins update m/p');
  });

  it('formatPluginUpdateCmd returns empty string for git-source', () => {
    const cmd = formatPluginUpdateCmd({
      kind: 'git-source', gitRoot: '/g', displayName: 'x', skillIds: [],
    });
    expect(cmd).toBe('');
  });
});
