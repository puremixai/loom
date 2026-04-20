import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { openCenterDb } from '../src/storage/center-db.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'fake-claude', 'skills');

describe('POST /api/projects/:id/apply', () => {
  it('applies selected skills end-to-end', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    const projectDir = mkdtempSync(join(tmpdir(), 'sm-proj-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      db.data.scanPaths = [fixtureRoot];
      await db.write();
      const app = await buildApp({ db, cachePath: join(dir, 'cache.json') });

      const added = await app.inject({ method: 'POST', url: '/api/projects', payload: { path: projectDir } });
      const pid = added.json().data.id;

      const skills = await app.inject({ method: 'GET', url: '/api/skills' });
      const demo = skills.json().data.skills.find((s: any) => s.name === 'demo-skill');
      expect(demo).toBeTruthy();

      const diff = await app.inject({
        method: 'POST', url: `/api/projects/${pid}/diff-preview`,
        payload: { skillIds: [demo.id] },
      });
      expect(diff.json().data.toAdd).toHaveLength(1);

      const applied = await app.inject({
        method: 'POST', url: `/api/projects/${pid}/apply`,
        payload: { skillIds: [demo.id] },
      });
      expect(applied.statusCode).toBe(200);
      expect(applied.json().data.manifest.skills).toHaveLength(1);

      const manifestRes = await app.inject({ method: 'GET', url: `/api/projects/${pid}/manifest` });
      expect(manifestRes.json().data.manifest.skills[0].name).toBe('demo-skill');

      const unapplied = await app.inject({
        method: 'POST', url: `/api/projects/${pid}/unapply`,
        payload: {},
      });
      expect(unapplied.statusCode).toBe(200);
      await app.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
