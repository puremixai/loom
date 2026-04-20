import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { openCenterDb } from '../src/storage/center-db.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'fake-claude', 'skills');

describe('GET /api/skills', () => {
  it('returns skills from configured scan paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      db.data.scanPaths = [fixtureRoot];
      await db.write();
      const app = await buildApp({ db, cachePath: join(dir, 'cache.json') });
      const res = await app.inject({ method: 'GET', url: '/api/skills' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.data.skills.some((s: any) => s.name === 'demo-skill')).toBe(true);
      await app.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('returns 404 for unknown skill id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      db.data.scanPaths = [fixtureRoot];
      await db.write();
      const app = await buildApp({ db, cachePath: join(dir, 'cache.json') });
      const res = await app.inject({ method: 'GET', url: '/api/skills/nonexistent' });
      expect(res.statusCode).toBe(404);
      await app.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
