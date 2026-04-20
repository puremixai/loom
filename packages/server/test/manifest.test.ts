import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readManifest } from '../src/services/manifest.js';

describe('readManifest', () => {
  it('returns null when file missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-m-'));
    try {
      expect(await readManifest(dir)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('parses a valid manifest', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-m-'));
    try {
      mkdirSync(join(dir, '.claude'));
      writeFileSync(join(dir, '.claude', 'skill-manager.json'), JSON.stringify({
        version: 1, tool: 'skill-manager',
        appliedAt: new Date().toISOString(), method: 'symlink', skills: [],
      }));
      const m = await readManifest(dir);
      expect(m?.version).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
