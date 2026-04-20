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
});
