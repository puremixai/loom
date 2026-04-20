import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readRules, writeRules } from '../src/services/rule.js';

describe('rules service', () => {
  it('roundtrips a rules file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-r-'));
    try {
      await writeRules(dir, {
        version: 1,
        projectHint: 'React app',
        includes: ['skill-a'],
        excludes: [],
        keywords: ['react'],
      });
      const content = await readFile(join(dir, '.claude', 'skill-manager.rules.yaml'), 'utf8');
      expect(content).toContain('projectHint: React app');
      const parsed = await readRules(dir);
      expect(parsed?.includes).toEqual(['skill-a']);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('returns null when file missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-r-'));
    try {
      expect(await readRules(dir)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
