import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openCenterDb } from '../src/storage/center-db.js';
import { ensureUserSkillsDir, resolveUserSkillsDir, validateUserSkillsDir } from '../src/services/user-dir.js';

describe('UserDirService', () => {
  it('ensureUserSkillsDir creates directory and persists to DB on first run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      const target = join(dir, 'user-skills');
      db.data.userSkillsDir = target;
      const out = await ensureUserSkillsDir(db);
      expect(out).toBe(target);
      expect(statSync(target).isDirectory()).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('ensureUserSkillsDir uses DEFAULT when userSkillsDir is unset and persists it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      // userSkillsDir is undefined initially
      const out = await ensureUserSkillsDir(db);
      expect(out).toBeTruthy();
      expect(db.data.userSkillsDir).toBe(out);   // persisted
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('resolveUserSkillsDir returns DEFAULT when unset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const db = await openCenterDb(join(dir, 'db.json'));
      expect(resolveUserSkillsDir(db)).toBeTruthy();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('validateUserSkillsDir accepts existing directory', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const result = await validateUserSkillsDir(dir);
      expect(result.ok).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('validateUserSkillsDir accepts non-existent path (will be created)', async () => {
    const result = await validateUserSkillsDir('/some/nonexistent/path/xyz');
    expect(result.ok).toBe(true);
  });

  it('validateUserSkillsDir rejects a file path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sm-'));
    try {
      const file = join(dir, 'f.txt');
      writeFileSync(file, 'x');
      const result = await validateUserSkillsDir(file);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('not a directory');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('validateUserSkillsDir rejects empty string', async () => {
    const result = await validateUserSkillsDir('');
    expect(result.ok).toBe(false);
  });
});
