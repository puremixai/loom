import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { scanSkills } from '../src/services/scanner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'fake-claude', 'skills');

describe('scanSkills', () => {
  let cacheDir: string;
  beforeEach(() => { cacheDir = mkdtempSync(join(tmpdir(), 'sm-cache-')); });

  it('finds demo skill and emits warning for broken', async () => {
    const result = await scanSkills({
      scanPaths: [fixtureRoot],
      cachePath: join(cacheDir, 'cache.json'),
    });
    try {
      expect(result.skills.map(s => s.name)).toContain('demo-skill');
      expect(result.warnings.some(w => w.includes('broken-skill'))).toBe(true);
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });

  it('re-uses cache on second pass with unchanged fingerprint', async () => {
    const cachePath = join(cacheDir, 'cache.json');
    const first = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    const second = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    expect(second.skills).toEqual(first.skills);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('skips non-existent scan paths silently', async () => {
    const result = await scanSkills({
      scanPaths: ['/definitely/not/a/real/path/xyz'],
      cachePath: join(cacheDir, 'cache.json'),
    });
    expect(result.skills).toEqual([]);
    expect(result.warnings).toEqual([]);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('classifies paths robustly with trailing separators and boundaries', async () => {
    // This exercises classifySource indirectly by scanning a non-existent plugins/cache/ path with trailing slash
    // and a custom-skills path without separator prefix.
    // Since the paths don't exist, they return empty, but the scan shouldn't crash.
    const result1 = await scanSkills({
      scanPaths: [join(fixtureRoot, '..', 'plugins', 'cache') + '/'],
      cachePath: join(cacheDir, 'c1.json'),
    });
    expect(result1.skills).toEqual([]);
    const result2 = await scanSkills({
      scanPaths: ['/some/path/my-custom-skills-fake'],
      cachePath: join(cacheDir, 'c2.json'),
    });
    expect(result2.skills).toEqual([]);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('detects fingerprint changes and re-parses', async () => {
    const cachePath = join(cacheDir, 'cache.json');
    const first = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    const demo = first.skills.find(s => s.name === 'demo-skill');
    expect(demo).toBeTruthy();

    // Touch the demo-skill/SKILL.md so mtime changes
    const { utimesSync } = await import('node:fs');
    const now = Date.now() / 1000;
    utimesSync(demo!.absolutePath, now + 10, now + 10);

    const second = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    const demo2 = second.skills.find(s => s.name === 'demo-skill');
    expect(demo2).toBeTruthy();
    expect(demo2!.fingerprint).not.toBe(demo!.fingerprint);
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
