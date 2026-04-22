import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';

const IS_WIN = platform() === 'win32';

let app: FastifyInstance;
let tmp: string;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'loom-fs-test-'));
  mkdirSync(join(tmp, 'alpha'));
  mkdirSync(join(tmp, 'beta'));
  mkdirSync(join(tmp, '.hidden'));
  mkdirSync(join(tmp, 'nested', 'deeper'), { recursive: true });
  writeFileSync(join(tmp, 'a-file.txt'), 'not a dir');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('GET /api/fs/browse', () => {
  it('lists sub-directories of an absolute path, sorted, hiding dotfiles and files', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/fs/browse?path=${encodeURIComponent(tmp)}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    const names = body.data.entries.map((e: { name: string }) => e.name);
    expect(names).toEqual(['alpha', 'beta', 'nested']);
    // Sorted alphabetically, case-insensitive
    expect(names).toEqual([...names].sort());
    // Path join uses platform separator
    expect(body.data.entries[0].path).toBe(join(tmp, 'alpha'));
    expect(body.data.cwd).toBe(tmp);
    expect(body.data.isRoot).toBe(false);
    expect(body.data.home).toBeTypeOf('string');
  });

  it('returns parent path correctly for a nested dir', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/fs/browse?path=${encodeURIComponent(join(tmp, 'nested'))}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cwd).toBe(join(tmp, 'nested'));
    expect(body.data.parent).toBe(tmp);
    expect(body.data.entries.map((e: { name: string }) => e.name)).toEqual(['deeper']);
  });

  it('returns 404 for non-existent path', async () => {
    const missing = join(tmp, 'does-not-exist');
    const res = await app.inject({
      method: 'GET',
      url: `/api/fs/browse?path=${encodeURIComponent(missing)}`,
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when target is a file, not a directory', async () => {
    const filePath = join(tmp, 'a-file.txt');
    const res = await app.inject({
      method: 'GET',
      url: `/api/fs/browse?path=${encodeURIComponent(filePath)}`,
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('NOT_A_DIRECTORY');
  });

  it('returns 400 when path is relative (not absolute)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/fs/browse?path=relative/path' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('INVALID_PATH');
  });

  it('expands ~ to home directory', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/fs/browse?path=~' });
    // Home always exists — at minimum returns 200 with home as cwd
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.cwd).toBe(body.data.home);
  });

  it('omitted path returns a platform root listing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/fs/browse' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.isRoot).toBe(true);
    expect(body.data.parent).toBeNull();
    if (IS_WIN) {
      // Drive picker: cwd is empty, entries are drive letters
      expect(body.data.cwd).toBe('');
      expect(body.data.separator).toBe('\\');
      // At minimum C: should be present on any Windows CI runner
      const drives = body.data.entries.map((e: { name: string }) => e.name);
      expect(drives.length).toBeGreaterThan(0);
      expect(drives.every((n: string) => /^[A-Z]:$/.test(n))).toBe(true);
    } else {
      // POSIX: cwd is '/', separator is '/'
      expect(body.data.cwd).toBe('/');
      expect(body.data.separator).toBe('/');
    }
  });

  it('from a drive root on Windows returns empty parent (not dirname /)', async () => {
    if (!IS_WIN) return;
    // Use whatever drive tmp lives on (typically C: on CI)
    const drive = tmp.slice(0, 3); // 'C:\'
    const res = await app.inject({
      method: 'GET',
      url: `/api/fs/browse?path=${encodeURIComponent(drive)}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.isRoot).toBe(true);
    // Windows drive root → parent points back to the drive picker ('')
    expect(body.data.parent).toBe('');
  });
});
