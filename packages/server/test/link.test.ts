import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySkills, unapplySkills } from '../src/services/link.js';
import type { Skill, Manifest } from '@skill-manager/shared';

function makeSkill(id: string, name: string, skillDir: string): Skill {
  return {
    id, name, description: `${name} desc`,
    source: 'user',
    sourceRoot: join(skillDir, '..'),
    absolutePath: join(skillDir, 'SKILL.md'),
    skillDir,
    fingerprint: '1-1',
  };
}

describe('link engine', () => {
  let work: string;
  let skillRoot: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'sm-work-'));
    skillRoot = join(work, 'fake-skills');
    mkdirSync(skillRoot, { recursive: true });
  });

  afterEach(() => { rmSync(work, { recursive: true, force: true }); });

  it('applies a single skill and writes manifest', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');

    const projectPath = join(work, 'proj');
    mkdirSync(projectPath);
    const result = await applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    });

    expect(result.manifest.skills).toHaveLength(1);
    expect(['symlink', 'junction', 'copy']).toContain(result.method);
    const linked = join(projectPath, '.claude', 'skills', 'alpha');
    const linkedStat = await stat(linked);
    expect(linkedStat.isDirectory()).toBe(true);
    const readManifest = JSON.parse(await readFile(join(projectPath, '.claude', 'skill-manager.json'), 'utf8')) as Manifest;
    expect(readManifest.skills[0]!.id).toBe('id1');
  });

  it('unapplies removes link and updates manifest', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');

    const projectPath = join(work, 'proj');
    mkdirSync(projectPath);
    const applied = await applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    });

    await unapplySkills({ projectPath, manifest: applied.manifest });
    const linked = join(projectPath, '.claude', 'skills', 'alpha');
    await expect(stat(linked)).rejects.toThrow();
  });

  it('refuses to overwrite non-managed existing target', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');
    const projectPath = join(work, 'proj');
    mkdirSync(join(projectPath, '.claude', 'skills', 'alpha'), { recursive: true });
    writeFileSync(join(projectPath, '.claude', 'skills', 'alpha', 'HAND-WRITTEN.md'), 'do not delete');

    await expect(applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    })).rejects.toThrow(/not managed/);
  });
});
