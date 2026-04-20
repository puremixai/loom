import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildApp } from '../src/app.js';
import { openCenterDb } from '../src/storage/center-db.js';

async function makeApp(dir: string) {
  const db = await openCenterDb(join(dir, 'db.json'));
  return { db, app: await buildApp({ db, cachePath: join(dir, 'cache.json') }) };
}

describe('projects CRUD', () => {
  it('adds, lists, patches, deletes a project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const { app } = await makeApp(dir);
      const target = mkdtempSync(join(tmpdir(), 'sm-proj-'));
      try {
        const add = await app.inject({
          method: 'POST', url: '/api/projects',
          payload: { path: target, name: 'demo' },
        });
        expect(add.statusCode).toBe(200);
        const addBody = add.json();
        const id = addBody.data.id;

        const list = await app.inject({ method: 'GET', url: '/api/projects' });
        expect(list.json().data).toHaveLength(1);
        expect(list.json().data[0].status).toBe('ok');

        const patch = await app.inject({
          method: 'PATCH', url: `/api/projects/${id}`,
          payload: { name: 'renamed' },
        });
        expect(patch.json().data.name).toBe('renamed');

        const del = await app.inject({ method: 'DELETE', url: `/api/projects/${id}` });
        expect(del.statusCode).toBe(200);
        const listAfter = await app.inject({ method: 'GET', url: '/api/projects' });
        expect(listAfter.json().data).toHaveLength(0);
      } finally { rmSync(target, { recursive: true, force: true }); }
      await app.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects non-existent path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const { app } = await makeApp(dir);
      const res = await app.inject({
        method: 'POST', url: '/api/projects',
        payload: { path: '/nope/does/not/exist' },
      });
      expect(res.statusCode).toBe(400);
      await app.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
