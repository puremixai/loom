import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { buildApp } from '../src/app.js';
import { openCenterDb } from '../src/storage/center-db.js';

const execFile = promisify(execFileCb);

async function gitInit(dir: string): Promise<void> {
  await execFile('git', ['init', '--quiet'], { cwd: dir });
  await execFile('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  await execFile('git', ['config', 'user.name', 'Test'], { cwd: dir });
  await execFile('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
}

describe('GET /api/sources + POST /check', () => {
  it('lists git-backed source refs from scanned skills', async () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-sr-'));
    try {
      // Create a repo-backed user-local skill
      const userSkills = join(work, 'user-skills');
      mkdirSync(userSkills);
      await gitInit(userSkills);
      const skillDir = join(userSkills, 'alpha');
      mkdirSync(skillDir);
      writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');
      await execFile('git', ['add', '-A'], { cwd: userSkills });
      await execFile('git', ['commit', '-m', 'init', '--no-gpg-sign'], { cwd: userSkills });

      const db = await openCenterDb(join(work, 'db.json'));
      db.data.scanPaths = [];
      db.data.userSkillsDir = userSkills;
      await db.write();
      const app = await buildApp({ db, cachePath: join(work, 'cache.json') });

      const listRes = await app.inject({ method: 'GET', url: '/api/sources' });
      expect(listRes.statusCode).toBe(200);
      const refs = listRes.json().data.refs;
      expect(refs).toHaveLength(1);
      expect(refs[0].kind).toBe('git-source');
      expect(refs[0].displayName).toBe('user-skills');
      await app.close();
    } finally { rmSync(work, { recursive: true, force: true }); }
  });

  it('POST /api/sources/pull returns 404 for non-existent gitRoot', async () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-sr-'));
    try {
      const db = await openCenterDb(join(work, 'db.json'));
      await db.write();
      const app = await buildApp({ db, cachePath: join(work, 'cache.json') });
      const missing = await app.inject({
        method: 'POST', url: '/api/sources/pull',
        payload: { gitRoot: '/definitely/not/a/path' },
      });
      expect(missing.statusCode).toBe(404);
      await app.close();
    } finally { rmSync(work, { recursive: true, force: true }); }
  });
});
