import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySkills, unapplySkills } from '../src/services/link.js';
import type { Skill, Manifest } from '@loom/shared';

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
    const readManifest = JSON.parse(await readFile(join(projectPath, '.claude', 'loom.json'), 'utf8')) as Manifest;
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

  it('unapply refuses to delete a non-link at a managed path', async () => {
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

    // Only proceed with this test if the method was NOT copy — because in copy mode
    // the target is a real directory and we'd legitimately remove it.
    if (applied.method === 'copy') return;

    const linked = join(projectPath, '.claude', 'skills', 'alpha');
    // Replace the link with a real directory containing user data
    const { rm } = await import('node:fs/promises');
    await rm(linked, { recursive: true, force: true });
    mkdirSync(linked, { recursive: true });
    writeFileSync(join(linked, 'USER-DATA.md'), 'do not destroy');

    const result = await unapplySkills({ projectPath, manifest: applied.manifest });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('expected link but found real directory');
    // User data preserved
    const userDataStat = await stat(join(linked, 'USER-DATA.md'));
    expect(userDataStat.isFile()).toBe(true);
  });

  it('unapply with copy method removes real directories', async () => {
    // Simulate a copy-mode manifest by calling unapplySkills with method='copy' and a real dir
    const skillDir = join(skillRoot, 'beta');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: beta\ndescription: d\n---\n');

    const projectPath = join(work, 'proj2');
    mkdirSync(projectPath);
    const targetDir = join(projectPath, '.claude', 'skills', 'beta');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'copied.md'), 'copy content');

    const fakeManifest: Manifest = {
      version: 1,
      tool: 'loom',
      appliedAt: new Date().toISOString(),
      method: 'copy',
      skills: [{ id: 'id-b', name: 'beta', sourceDir: skillDir, linkedAs: '.claude/skills/beta' }],
    };

    const result = await unapplySkills({ projectPath, manifest: fakeManifest });
    expect(result.warnings).toEqual([]);
    await expect(stat(targetDir)).rejects.toThrow();
  });
});
