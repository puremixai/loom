import { describe, it, expect } from 'vitest';
import { SkillSchema, ManifestSchema, CenterDbSchema } from '../src/schemas.js';

describe('schemas', () => {
  it('parses a valid Skill', () => {
    const parsed = SkillSchema.parse({
      id: 'abc123',
      name: 'foo',
      description: 'does foo',
      source: 'user',
      sourceRoot: '/tmp/a',
      absolutePath: '/tmp/a/foo/SKILL.md',
      skillDir: '/tmp/a/foo',
      fingerprint: '123-456',
    });
    expect(parsed.source).toBe('user');
  });

  it('rejects bad source enum', () => {
    expect(() =>
      SkillSchema.parse({
        id: 'x', name: 'x', description: 'x',
        source: 'bogus', sourceRoot: '/', absolutePath: '/', skillDir: '/',
        fingerprint: '1',
      })
    ).toThrow();
  });

  it('applies CenterDb defaults', () => {
    const db = CenterDbSchema.parse({});
    expect(db.projects).toEqual([]);
    expect(db.scanPaths).toEqual([]);
    expect(db.ai).toEqual({});
  });

  it('manifest requires version=1 and tool=skill-manager', () => {
    expect(() =>
      ManifestSchema.parse({
        version: 2, tool: 'skill-manager',
        appliedAt: new Date().toISOString(), method: 'symlink', skills: [],
      })
    ).toThrow();
  });
});
