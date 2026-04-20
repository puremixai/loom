import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCenterDb } from '../src/storage/center-db.js';

describe('center db', () => {
  it('initializes defaults on first open', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const file = join(dir, 'db.json');
      const db = await openCenterDb(file);
      expect(db.data.projects).toEqual([]);
      expect(db.data.scanPaths.length).toBe(3);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('persists across re-open', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const file = join(dir, 'db.json');
      const db1 = await openCenterDb(file);
      db1.data.projects.push({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'demo',
        path: dir,
        addedAt: new Date().toISOString(),
      });
      await db1.write();

      const db2 = await openCenterDb(file);
      expect(db2.data.projects).toHaveLength(1);
      expect(db2.data.projects[0]!.name).toBe('demo');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('rejects malformed JSON with file path in error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const { writeFileSync } = await import('node:fs');
      const file = join(dir, 'db.json');
      writeFileSync(file, '{not json', 'utf8');
      let caught: Error | null = null;
      try { await openCenterDb(file); } catch (e) { caught = e as Error; }
      expect(caught).not.toBeNull();
      expect(caught!.message).toContain('Failed to read center db');
      expect(caught!.message).toContain(file);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
