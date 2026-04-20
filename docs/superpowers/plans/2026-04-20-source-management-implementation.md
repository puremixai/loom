# Source Management & Navigation (v0.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Loom with a first-class user skills directory (F4), tree-based Skills Library navigation (F2), and source update detection with safe git-pull / plugin-prompt flows (F1).

**Architecture:** Three independent milestones on top of the v0.1 MVP. M1 adds `userSkillsDir` and `source: 'user-local'` plumbing. M2 is pure frontend — introduces a sidebar tree driven by in-browser derivation. M3 adds a `SourceUpdateService` that shells to `git` via `execFile`, exposes three REST endpoints, and renders a banner + drawer UI.

**Tech Stack:** Same as v0.1 — TypeScript 5.6, pnpm workspaces, Fastify 5, React 19 + Vite 6, Tailwind + custom Vercel/Geist tokens, Zod, vitest, `@radix-ui/react-dialog` (drawer variant), Node `child_process` for `git`.

**Spec reference:** [docs/superpowers/specs/2026-04-20-source-management-design.md](../specs/2026-04-20-source-management-design.md)

**Phases:**
- **M1** — Feature 4 (user skills directory) · Tasks 1–9
- **M2** — Feature 2 (tree sidebar) · Tasks 10–13
- **M3** — Feature 1 (source updates) · Tasks 14–22

---

## M1 — User skills directory

### Task 1: Extend shared schemas and constants

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/test/schemas.test.ts`

- [ ] **Step 1: Add `DEFAULT_USER_SKILLS_DIR` constant**

Edit `packages/shared/src/constants.ts`. Find the block that defines `DEFAULT_SCAN_PATHS`. Below it, add:

```ts
export const DEFAULT_USER_SKILLS_DIR = join(homedir(), '.loom', 'skills');
```

`homedir` and `join` are already imported at the top of the file.

- [ ] **Step 2: Extend `SkillSchema.source` enum to include `'user-local'`**

Edit `packages/shared/src/schemas.ts`. Find:

```ts
source: z.enum(['user', 'custom', 'plugin']),
```

Change to:

```ts
source: z.enum(['user', 'custom', 'plugin', 'user-local']),
```

- [ ] **Step 3: Extend `CenterDbSchema` with `userSkillsDir`**

In the same file, find the `CenterDbSchema` definition. Add a new property between `scanPaths` and `ai`:

```ts
export const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  scanPaths: z.array(z.string()).default([]),
  userSkillsDir: z.string().optional(),
  ai: AiConfigSchema.partial().default({}),
});
```

- [ ] **Step 4: Add failing test for `user-local` source**

Edit `packages/shared/test/schemas.test.ts`. Add inside the existing `describe('schemas', ...)` block, after the last test:

```ts
  it('accepts user-local as a valid Skill source', () => {
    const parsed = SkillSchema.parse({
      id: 'abc123',
      name: 'foo',
      description: 'd',
      source: 'user-local',
      sourceRoot: '/tmp',
      absolutePath: '/tmp/foo/SKILL.md',
      skillDir: '/tmp/foo',
      fingerprint: '1',
    });
    expect(parsed.source).toBe('user-local');
  });

  it('parses CenterDb with userSkillsDir', () => {
    const db = CenterDbSchema.parse({
      userSkillsDir: '/home/me/.loom/skills',
    });
    expect(db.userSkillsDir).toBe('/home/me/.loom/skills');
  });
```

- [ ] **Step 5: Run tests**

```bash
export PATH="/c/Users/ausu/AppData/Local/pnpm/.tools/pnpm/9.12.0/bin:/c/Users/ausu/AppData/Roaming/fnm/node-versions/v22.20.0/installation:$PATH"
cd D:/VibeProjects/skill-manager
pnpm --filter @loom/shared test
```
Expected: 7 tests pass (5 prior + 2 new).

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add userSkillsDir and user-local source"
```

---

### Task 2: UserDirService — ensure/validate/resolve

**Files:**
- Create: `packages/server/src/services/user-dir.ts`
- Create: `packages/server/test/user-dir.test.ts`

- [ ] **Step 1: Create `packages/server/src/services/user-dir.ts`**

```ts
import { mkdir, stat } from 'node:fs/promises';
import { DEFAULT_USER_SKILLS_DIR } from '@loom/shared';
import type { CenterDbStore } from '../storage/center-db.js';

export function resolveUserSkillsDir(db: CenterDbStore): string {
  return db.data.userSkillsDir ?? DEFAULT_USER_SKILLS_DIR;
}

export async function ensureUserSkillsDir(db: CenterDbStore): Promise<string> {
  const dir = resolveUserSkillsDir(db);
  await mkdir(dir, { recursive: true });
  if (!db.data.userSkillsDir) {
    db.data.userSkillsDir = dir;
    await db.write();
  }
  return dir;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export async function validateUserSkillsDir(candidate: string): Promise<ValidationResult> {
  if (!candidate || candidate.trim().length === 0) {
    return { ok: false, error: 'Path is empty' };
  }
  try {
    const s = await stat(candidate);
    if (!s.isDirectory()) return { ok: false, error: 'Path exists but is not a directory' };
    return { ok: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true };
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Write failing tests `packages/server/test/user-dir.test.ts`**

```ts
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
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: 7 new tests pass (total ~34).

- [ ] **Step 4: Commit**

```bash
git add packages/server
git commit -m "feat(server): add UserDirService with ensure/validate/resolve"
```

---

### Task 3: Wire `ensureUserSkillsDir` into app startup + extend scanner

**Files:**
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/services/scanner.ts`
- Modify: `packages/server/test/scanner.test.ts`
- Create: `packages/server/test/fixtures/fake-user-local/my-user-skill/SKILL.md`

- [ ] **Step 1: Update `classifySource` in `packages/server/src/services/scanner.ts`**

Find the current `classifySource` function:

```ts
function classifySource(sourceRoot: string): SourceKind {
  const normalized = sourceRoot.replace(/[\\/]+$/, '');
  if (/[\\/]plugins[\\/]cache$/.test(normalized)) return 'plugin';
  if (/[\\/]custom-skills$/.test(normalized)) return 'custom';
  return 'user';
}
```

Change the function signature and body to accept an optional `userSkillsDir`:

```ts
function classifySource(sourceRoot: string, userSkillsDir?: string): SourceKind {
  const normalized = sourceRoot.replace(/[\\/]+$/, '');
  if (userSkillsDir && normalized === userSkillsDir.replace(/[\\/]+$/, '')) return 'user-local';
  if (/[\\/]plugins[\\/]cache$/.test(normalized)) return 'plugin';
  if (/[\\/]custom-skills$/.test(normalized)) return 'custom';
  return 'user';
}
```

Also update the local type definition at the top:

```ts
type SourceKind = 'user' | 'custom' | 'plugin' | 'user-local';
```

- [ ] **Step 2: Extend `ScanOptions` and `scanSkills` to auto-merge `userSkillsDir`**

In the same file, find `ScanOptions`:

```ts
export interface ScanOptions {
  scanPaths: string[];
  cachePath?: string;
  forceRefresh?: boolean;
}
```

Change to:

```ts
export interface ScanOptions {
  scanPaths: string[];
  userSkillsDir?: string;
  cachePath?: string;
  forceRefresh?: boolean;
}
```

Then inside `scanSkills`, find the `for (const sourceRoot of opts.scanPaths)` loop. Just before it, add the auto-merge logic:

```ts
  const mergedScanPaths = opts.userSkillsDir
    ? [opts.userSkillsDir, ...opts.scanPaths.filter(p => p !== opts.userSkillsDir)]
    : opts.scanPaths;
```

And change the loop to iterate `mergedScanPaths` instead. Also update the `classifySource` call inside the loop to pass `opts.userSkillsDir`:

```ts
  for (const sourceRoot of mergedScanPaths) {
    if (!(await pathExists(sourceRoot))) continue;
    const matches = await glob('**/SKILL.md', { cwd: sourceRoot, absolute: true, filesOnly: true });
    const source = classifySource(sourceRoot, opts.userSkillsDir);
    // ... rest of loop unchanged
```

- [ ] **Step 3: Wire `ensureUserSkillsDir` into `buildApp`**

Edit `packages/server/src/app.ts`. Add import near the top:

```ts
import { ensureUserSkillsDir } from './services/user-dir.js';
```

Inside `buildApp`, find where `db` is opened (either `opts.db ?? await openCenterDb(opts.dbFile)`). Right after that line, add:

```ts
  await ensureUserSkillsDir(db);
```

- [ ] **Step 4: Create fixture `packages/server/test/fixtures/fake-user-local/my-user-skill/SKILL.md`**

```markdown
---
name: my-user-skill
description: A user-local skill used for testing.
---

User-local body.
```

- [ ] **Step 5: Add failing test for user-local classification**

Edit `packages/server/test/scanner.test.ts`. Add inside the existing `describe('scanSkills', ...)` block, at the end:

```ts
  it('classifies skills under userSkillsDir as source=user-local', async () => {
    const userLocalRoot = join(here, 'fixtures', 'fake-user-local');
    const result = await scanSkills({
      scanPaths: [],
      userSkillsDir: userLocalRoot,
      cachePath: join(cacheDir, 'c.json'),
    });
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]!.name).toBe('my-user-skill');
    expect(result.skills[0]!.source).toBe('user-local');
    rmSync(cacheDir, { recursive: true, force: true });
  });
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: scanner test file gains 1 test; all previous tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/server
git commit -m "feat(server): scanner recognizes userSkillsDir as user-local source"
```

---

### Task 4: Settings + Platform APIs — surface userSkillsDir

**Files:**
- Modify: `packages/server/src/routes/settings.ts`
- Modify: `packages/server/src/routes/platform.ts`
- Modify: `packages/server/src/routes/skills.ts`
- Modify: `packages/server/src/services/apply-helpers.ts`
- Modify: `packages/server/src/routes/sync.ts`
- Modify: `packages/server/src/routes/ai.ts`

- [ ] **Step 1: Update `packages/server/src/routes/settings.ts` for userSkillsDir**

Replace the entire file content with:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AiConfigSchema } from '@loom/shared';
import type { CenterDbStore } from '../storage/center-db.js';
import { ensureUserSkillsDir, validateUserSkillsDir } from '../services/user-dir.js';

const SettingsBody = z.object({
  scanPaths: z.array(z.string()).optional(),
  userSkillsDir: z.string().optional(),
  ai: AiConfigSchema.partial().optional(),
});

function maskApiKey<T extends { apiKey?: string }>(ai: T): T {
  if (!ai.apiKey) return ai;
  return { ...ai, apiKey: ai.apiKey.length > 8 ? `${ai.apiKey.slice(0, 4)}****${ai.apiKey.slice(-2)}` : '****' };
}

export const settingsRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.get('/api/settings', async () => ({
    ok: true as const,
    data: {
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      ai: maskApiKey(deps.db.data.ai),
    },
  }));

  app.put('/api/settings', async (req, reply) => {
    const body = SettingsBody.parse(req.body);
    if (body.userSkillsDir !== undefined) {
      const v = await validateUserSkillsDir(body.userSkillsDir);
      if (!v.ok) {
        reply.status(400);
        return { ok: false as const, error: { code: 'INVALID_USER_SKILLS_DIR', message: v.error } };
      }
      deps.db.data.userSkillsDir = body.userSkillsDir;
      await ensureUserSkillsDir(deps.db);
    }
    if (body.scanPaths) deps.db.data.scanPaths = body.scanPaths;
    if (body.ai) deps.db.data.ai = { ...deps.db.data.ai, ...body.ai };
    await deps.db.write();
    return {
      ok: true as const,
      data: {
        scanPaths: deps.db.data.scanPaths,
        userSkillsDir: deps.db.data.userSkillsDir,
        ai: maskApiKey(deps.db.data.ai),
      },
    };
  });
};
```

- [ ] **Step 2: Update `packages/server/src/routes/platform.ts` to include userSkillsDir**

Replace file contents:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { platform, release, arch } from 'node:os';
import { probeLinkMethod } from '../utils/platform-probe.js';
import type { CenterDbStore } from '../storage/center-db.js';
import { resolveUserSkillsDir } from '../services/user-dir.js';

export const platformRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.get('/api/platform', async () => {
    const linkMethodPreview = await probeLinkMethod();
    return {
      ok: true as const,
      data: {
        os: platform(),
        release: release(),
        arch: arch(),
        node: process.version,
        linkMethodPreview,
        userSkillsDir: resolveUserSkillsDir(deps.db),
      },
    };
  });
};
```

- [ ] **Step 3: Update `packages/server/src/app.ts` to pass db to platformRoutes**

Find the line `await app.register(platformRoutes);` and change to:

```ts
  await app.register(platformRoutes({ db }));
```

- [ ] **Step 4: Propagate `userSkillsDir` through scanner call sites**

Edit `packages/server/src/routes/skills.ts`. Find the two `scanSkills(...)` calls inside the plugin. Change both to include `userSkillsDir: deps.db.data.userSkillsDir`:

```ts
    const { skills, warnings } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
      forceRefresh,
    });
```

And the second one (in the `:id` handler):

```ts
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
```

- [ ] **Step 5: Propagate `userSkillsDir` in `apply-helpers.ts`**

Edit `packages/server/src/services/apply-helpers.ts`. Find the two `scanSkills(...)` calls in `resolveSkills` and `computeDiff`. Add `userSkillsDir: db.data.userSkillsDir` to both.

Inside `resolveSkills`:
```ts
  const { skills } = await scanSkills({
    scanPaths: db.data.scanPaths,
    userSkillsDir: db.data.userSkillsDir,
    cachePath,
  });
```

The `computeDiff` function calls `resolveSkills` so no change needed there.

- [ ] **Step 6: Propagate `userSkillsDir` in sync + ai routes**

Edit `packages/server/src/routes/sync.ts`. Find the `scanSkills(...)` call. Add `userSkillsDir`:
```ts
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
```

Edit `packages/server/src/routes/ai.ts`. Same treatment on the `scanSkills` call.

- [ ] **Step 7: Run typecheck and full test suite**

```bash
pnpm --filter @loom/server typecheck
pnpm --filter @loom/server test
```
Expected: 0 errors; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/server
git commit -m "feat(server): thread userSkillsDir through settings, platform, and all scan call sites"
```

---

### Task 5: New route — `POST /api/user-skills-dir/open`

**Files:**
- Create: `packages/server/src/routes/user-skills-dir.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create `packages/server/src/routes/user-skills-dir.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import open from 'open';
import { resolveUserSkillsDir } from '../services/user-dir.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const userSkillsDirRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  app.post('/api/user-skills-dir/open', async (_req, reply) => {
    const dir = resolveUserSkillsDir(deps.db);
    try {
      await open(dir);
      return { ok: true as const, data: { path: dir } };
    } catch (err) {
      reply.status(500);
      return { ok: false as const, error: { code: 'OPEN_FAILED', message: (err as Error).message } };
    }
  });
};
```

- [ ] **Step 2: Register route in `packages/server/src/app.ts`**

Add import near the top with the other route imports:

```ts
import { userSkillsDirRoutes } from './routes/user-skills-dir.js';
```

After `settingsRoutes` registration, add:

```ts
  await app.register(userSkillsDirRoutes({ db }));
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @loom/server typecheck
```
Expected: 0 errors. (No new tests — this endpoint opens OS-level file manager; not automatable in CI.)

- [ ] **Step 4: Commit**

```bash
git add packages/server
git commit -m "feat(server): add POST /api/user-skills-dir/open to reveal folder in OS"
```

---

### Task 6: Web API hooks — settings, platform, user-skills-dir

**Files:**
- Modify: `packages/web/src/api/settings.ts`
- Modify: `packages/web/src/api/platform.ts`
- Create: `packages/web/src/api/user-skills-dir.ts`

- [ ] **Step 1: Update `packages/web/src/api/settings.ts`**

Find the `SettingsResponse` interface and add `userSkillsDir`. Replace the whole file with:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { AiConfig } from '@loom/shared';

interface SettingsResponse {
  scanPaths: string[];
  userSkillsDir?: string;
  ai: Partial<AiConfig>;
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/api/settings'),
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { scanPaths?: string[]; userSkillsDir?: string; ai?: Partial<AiConfig> }) =>
      apiFetch<SettingsResponse>('/api/settings', {
        method: 'PUT', body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: ['platform'] });
    },
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; latencyMs: number } | { ok: false; error: string }>('/api/ai/test', { method: 'POST' }),
  });
}
```

- [ ] **Step 2: Update `packages/web/src/api/platform.ts`**

Replace with:

```ts
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface PlatformResponse {
  os: string;
  release: string;
  arch: string;
  node: string;
  linkMethodPreview: 'symlink' | 'junction' | 'copy';
  userSkillsDir: string;
}

export function usePlatform() {
  return useQuery({
    queryKey: ['platform'],
    queryFn: () => apiFetch<PlatformResponse>('/api/platform'),
  });
}
```

- [ ] **Step 3: Create `packages/web/src/api/user-skills-dir.ts`**

```ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';

export function useOpenUserSkillsDir() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ path: string }>('/api/user-skills-dir/open', { method: 'POST' }),
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(web): add settings/platform/user-skills-dir api hooks"
```

---

### Task 7: `UserSkillsDirCard` component

**Files:**
- Create: `packages/web/src/components/UserSkillsDirCard.tsx`

- [ ] **Step 1: Create `packages/web/src/components/UserSkillsDirCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { useOpenUserSkillsDir } from '@/api/user-skills-dir';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function UserSkillsDirCard() {
  const { data: settings } = useSettings();
  const { data: platform } = usePlatform();
  const save = useSaveSettings();
  const open = useOpenUserSkillsDir();

  const [path, setPath] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
    setPath(current);
  }, [settings, platform]);

  const effectivePath = settings?.userSkillsDir ?? platform?.userSkillsDir ?? '';
  const copyCommand = `claude "use skill-creator to create <skill-name> in ${effectivePath}"`;

  async function handleSave() {
    setErr(null); setSaved(false);
    try {
      await save.mutateAsync({ userSkillsDir: path.trim() });
      setSaved(true);
    } catch (e) { setErr((e as Error).message); }
  }

  async function copyCmd() {
    await navigator.clipboard.writeText(copyCommand);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User skills directory</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-ink-500">
          Loom-managed location for your own skills. Auto-scanned and shown under the <code className="font-mono">user-local</code> source.
        </p>

        <div className="flex gap-2">
          <Input className="font-mono text-xs" value={path} onChange={e => setPath(e.target.value)} placeholder="/home/you/.loom/skills" />
          <Button onClick={handleSave} disabled={save.isPending || path.trim() === effectivePath}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={() => open.mutate()} disabled={open.isPending}>
            {open.isPending ? 'Opening…' : 'Open folder'}
          </Button>
        </div>

        {err && <p className="text-xs text-ship-red">{err}</p>}
        {saved && <p className="text-xs text-badge-green-text">Saved.</p>}
        {open.error && <p className="text-xs text-ship-red">{(open.error as Error).message}</p>}

        <div className="rounded-lg bg-ink-50 p-3 shadow-ring-light">
          <p className="mb-2 text-xs font-medium text-ink-900">Create a new skill</p>
          <ol className="space-y-1 text-xs text-ink-600">
            <li>1. In Claude Code, run the command below (replace <code className="font-mono">&lt;skill-name&gt;</code>).</li>
            <li>2. Return here and click <strong>Refresh</strong> on the Skills Library.</li>
          </ol>
          <pre className="mt-3 overflow-x-auto rounded bg-white p-2 font-mono text-xs text-ink-900 shadow-ring-light">
{copyCommand}
          </pre>
          <Button size="sm" variant="secondary" className="mt-2" onClick={copyCmd}>Copy command</Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/UserSkillsDirCard.tsx
git commit -m "feat(web): add UserSkillsDirCard component"
```

---

### Task 8: Integrate card into Settings page

**Files:**
- Modify: `packages/web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add import**

At the top of `packages/web/src/pages/SettingsPage.tsx`, add:

```tsx
import { UserSkillsDirCard } from '@/components/UserSkillsDirCard';
```

- [ ] **Step 2: Insert the card before the Scan paths card**

Find the JSX fragment `<Card>` that contains `<CardTitle>Scan paths</CardTitle>`. Just before it (after the AI configuration Card's closing `</Card>`), insert:

```tsx
      <UserSkillsDirCard />
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Manual smoke**

Start server + web dev, visit `/settings`. Expected:
- User skills directory card shows above Scan paths
- Default path displayed is `~/.loom/skills` (or OS-specific equivalent)
- Changing the input then clicking Save updates; verify by reloading the page
- "Open folder" opens the directory in OS file manager

If smoke fails, report; don't modify spec.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/pages/SettingsPage.tsx
git commit -m "feat(web): surface UserSkillsDirCard on Settings page"
```

**M1 checkpoint reached** — user skills directory is first-class: auto-initialized, scanned, editable in UI, source classified as `user-local`.

---

## M2 — Tree sidebar for Skills Library

### Task 9: `useSkillTree` hook — tree building + selection + collapse state

**Files:**
- Create: `packages/web/src/hooks/useSkillTree.ts`
- Create: `packages/web/test/useSkillTree.test.ts`
- Modify: `packages/web/vite.config.ts` (add vitest config)

- [ ] **Step 1: Add vitest config to `packages/web/vite.config.ts`**

Open the file and extend the defineConfig to include test config:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4178',
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 2: Add vitest jsdom deps**

Edit `packages/web/package.json`. In devDependencies add:

```json
"vitest": "2.1.2",
"jsdom": "25.0.1",
"@testing-library/react": "16.0.1",
"@testing-library/jest-dom": "6.5.0"
```

Run:
```bash
cd D:/VibeProjects/skill-manager
pnpm install
```

- [ ] **Step 3: Create `packages/web/src/hooks/useSkillTree.ts`**

```ts
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Skill } from '@loom/shared';

export const ROOT_KEY = '__root__';
const COLLAPSED_STORAGE_KEY = 'loom:skill-tree:collapsed';

export interface TreeNode {
  key: string;
  label: string;
  depth: number;
  count: number;
  directCount: number;
  children: TreeNode[];
  skills: Skill[];
}

export function skillPath(s: Skill): string[] {
  if (s.source === 'plugin') {
    const parts = (s.pluginName ?? 'unknown').split('/');
    return ['plugin', ...parts];
  }
  return [s.source];
}

export function buildTree(skills: Skill[]): TreeNode {
  const root: TreeNode = { key: ROOT_KEY, label: 'All', depth: 0, count: 0, directCount: 0, children: [], skills: [] };
  for (const skill of skills) {
    const path = skillPath(skill);
    let node = root;
    for (let i = 0; i < path.length; i++) {
      const segment = path[i]!;
      const childKey = node.key === ROOT_KEY ? segment : `${node.key}/${segment}`;
      let child = node.children.find(c => c.key === childKey);
      if (!child) {
        child = { key: childKey, label: segment, depth: node.depth + 1, count: 0, directCount: 0, children: [], skills: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.skills.push(skill);
    node.directCount++;
  }
  // Recursively compute counts (sum of directCounts over subtree)
  const computeCount = (n: TreeNode): number => {
    const childrenSum = n.children.reduce((sum, c) => sum + computeCount(c), 0);
    n.count = n.directCount + childrenSum;
    return n.count;
  };
  computeCount(root);
  // Sort children alphabetically at each level
  const sortTree = (n: TreeNode): void => {
    n.children.sort((a, b) => a.label.localeCompare(b.label));
    n.children.forEach(sortTree);
  };
  sortTree(root);
  return root;
}

function getVisibleSkills(tree: TreeNode, selectedKey: string): Skill[] {
  const find = (n: TreeNode): TreeNode | null => {
    if (n.key === selectedKey) return n;
    for (const c of n.children) {
      const found = find(c);
      if (found) return found;
    }
    return null;
  };
  const target = find(tree);
  if (!target) return [];
  const collect = (n: TreeNode): Skill[] => [...n.skills, ...n.children.flatMap(collect)];
  return collect(target);
}

function loadCollapsed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch { return new Set(); }
}

function saveCollapsed(collapsed: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsed]));
}

export interface UseSkillTreeResult {
  tree: TreeNode;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  collapsed: Set<string>;
  toggleCollapsed: (key: string) => void;
  visibleSkills: Skill[];
}

export function useSkillTree(skills: Skill[]): UseSkillTreeResult {
  const tree = useMemo(() => buildTree(skills), [skills]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedKey = searchParams.get('path') ?? ROOT_KEY;
  const setSelectedKey = useCallback((key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === ROOT_KEY) next.delete('path');
    else next.set('path', key);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());
  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const visibleSkills = useMemo(() => getVisibleSkills(tree, selectedKey), [tree, selectedKey]);

  return { tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed, visibleSkills };
}
```

- [ ] **Step 4: Write failing test `packages/web/test/useSkillTree.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildTree, skillPath, ROOT_KEY } from '../src/hooks/useSkillTree';
import type { Skill } from '@loom/shared';

function mk(id: string, name: string, source: Skill['source'], pluginName?: string): Skill {
  return {
    id, name,
    description: `${name} description`,
    source,
    sourceRoot: '/root', absolutePath: `/root/${name}/SKILL.md`, skillDir: `/root/${name}`,
    fingerprint: '1', pluginName,
  };
}

describe('useSkillTree pure helpers', () => {
  it('skillPath returns [source] for non-plugin', () => {
    expect(skillPath(mk('a', 'alpha', 'user'))).toEqual(['user']);
    expect(skillPath(mk('b', 'beta', 'user-local'))).toEqual(['user-local']);
  });

  it('skillPath splits pluginName into path segments', () => {
    expect(skillPath(mk('c', 'gamma', 'plugin', 'claude-plugins-official/superpowers'))).toEqual(
      ['plugin', 'claude-plugins-official', 'superpowers']
    );
  });

  it('buildTree groups skills by path and computes counts', () => {
    const skills: Skill[] = [
      mk('1', 'a', 'user'),
      mk('2', 'b', 'user-local'),
      mk('3', 'c', 'plugin', 'market-a/plugin-x'),
      mk('4', 'd', 'plugin', 'market-a/plugin-x'),
      mk('5', 'e', 'plugin', 'market-a/plugin-y'),
    ];
    const root = buildTree(skills);
    expect(root.key).toBe(ROOT_KEY);
    expect(root.count).toBe(5);
    const userNode = root.children.find(c => c.key === 'user')!;
    expect(userNode.count).toBe(1);
    const pluginNode = root.children.find(c => c.key === 'plugin')!;
    expect(pluginNode.count).toBe(3);
    const marketNode = pluginNode.children.find(c => c.key === 'plugin/market-a')!;
    expect(marketNode.count).toBe(3);
    const pluginX = marketNode.children.find(c => c.label === 'plugin-x')!;
    expect(pluginX.directCount).toBe(2);
  });

  it('buildTree sorts children alphabetically', () => {
    const skills: Skill[] = [
      mk('1', 'z', 'plugin', 'z-market/p'),
      mk('2', 'a', 'user-local'),
      mk('3', 'm', 'plugin', 'a-market/p'),
    ];
    const root = buildTree(skills);
    const labels = root.children.map(c => c.label);
    expect(labels).toEqual([...labels].sort());
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @loom/web test
```
Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/web pnpm-lock.yaml
git commit -m "feat(web): add useSkillTree hook with build/path/collapse utilities"
```

---

### Task 10: `SkillTreeNode` + `SkillTree` components

**Files:**
- Create: `packages/web/src/components/SkillTreeNode.tsx`
- Create: `packages/web/src/components/SkillTree.tsx`

- [ ] **Step 1: Create `packages/web/src/components/SkillTreeNode.tsx`**

```tsx
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '@/hooks/useSkillTree';

export interface SkillTreeNodeProps {
  node: TreeNode;
  selectedKey: string;
  collapsed: Set<string>;
  onSelect: (key: string) => void;
  onToggleCollapse: (key: string) => void;
}

export function SkillTreeNode({ node, selectedKey, collapsed, onSelect, onToggleCollapse }: SkillTreeNodeProps) {
  const isSelected = node.key === selectedKey;
  const isCollapsed = collapsed.has(node.key);
  const hasChildren = node.children.length > 0;
  const isEmpty = node.count === 0;

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
          isSelected
            ? 'bg-ink-50 text-ink-900 font-semibold shadow-ring-light'
            : isEmpty
              ? 'text-ink-400 hover:bg-ink-50/60'
              : 'text-ink-700 hover:bg-ink-50',
        )}
        style={{ paddingLeft: `${8 + node.depth * 16}px` }}
        onClick={() => onSelect(node.key)}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            className="flex h-4 w-4 items-center justify-center text-ink-400 hover:text-ink-900"
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.key); }}
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        {hasChildren && !isCollapsed
          ? <FolderOpen className="h-4 w-4 text-ink-500" />
          : <Folder className="h-4 w-4 text-ink-500" />}
        <span className="flex-1 truncate text-sm">{node.label}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink-400">{node.count}</span>
      </div>
      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map(child => (
            <SkillTreeNode
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              collapsed={collapsed}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `packages/web/src/components/SkillTree.tsx`**

```tsx
import type { UseSkillTreeResult } from '@/hooks/useSkillTree';
import { SkillTreeNode } from './SkillTreeNode';

export function SkillTree({ tree, selectedKey, setSelectedKey, collapsed, toggleCollapsed }: UseSkillTreeResult) {
  return (
    <nav aria-label="Skills tree" className="w-60 shrink-0 self-start sticky top-20">
      <SkillTreeNode
        node={tree}
        selectedKey={selectedKey}
        collapsed={collapsed}
        onSelect={setSelectedKey}
        onToggleCollapse={toggleCollapsed}
      />
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components
git commit -m "feat(web): add SkillTree and SkillTreeNode components"
```

---

### Task 11: Refactor `SkillsPage` into two-column layout

**Files:**
- Modify: `packages/web/src/pages/SkillsPage.tsx`

- [ ] **Step 1: Replace file contents**

```tsx
import { useMemo, useState } from 'react';
import { useSkills } from '@/api/skills';
import { useSkillTree } from '@/hooks/useSkillTree';
import { SkillTree } from '@/components/SkillTree';
import { SkillCard } from '@/components/SkillCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Skill } from '@loom/shared';

export function SkillsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading, refetch, isFetching } = useSkills();
  const skills = data?.skills ?? [];
  const treeResult = useSkillTree(skills);
  const { visibleSkills, tree, selectedKey } = treeResult;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return visibleSkills;
    return visibleSkills.filter((s: Skill) =>
      s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [visibleSkills, q]);

  const currentLabel = selectedKey === tree.key ? 'All skills' : selectedKey.split('/').pop()!;

  return (
    <div className="flex gap-8">
      <aside className="hidden md:block">
        <SkillTree {...treeResult} />
      </aside>

      <div className="flex-1 space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="font-semibold leading-tight tracking-heading text-ink-900" style={{ fontSize: '32px' }}>
              {currentLabel}
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              {filtered.length} of {skills.length} skills
              {q.trim() && <> matching "{q.trim()}"</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-80" />
            <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-ink-500">Loading…</p>}

        {data?.warnings.length ? (
          <div className="rounded-lg bg-badge-yellow-bg p-4 shadow-ring-light">
            <p className="text-sm font-medium text-badge-yellow-text">
              {data.warnings.length} skills failed to parse
            </p>
            <p className="mt-1 font-mono text-xs text-badge-yellow-text/80">{data.warnings[0]}</p>
          </div>
        ) : null}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-lg bg-white py-16 text-center shadow-border">
            <p className="text-base text-ink-900">No skills in this path</p>
            <p className="mt-1 text-sm text-ink-500">Pick another folder in the sidebar, or clear the search.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => <SkillCard key={s.id} skill={s} />)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke**

Start dev servers, visit `/skills`. Expected:
- Left sidebar tree renders with proper counts
- Clicking a node filters the main area
- Folding arrows work
- URL updates (`/skills?path=plugin/claude-plugins-official`)
- Browser back/forward restores selection
- <768px viewport: sidebar hidden (use browser devtools to shrink)

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/SkillsPage.tsx
git commit -m "feat(web): convert SkillsPage to two-column tree layout"
```

**M2 checkpoint reached** — tree sidebar replaces flat grouping; URL state enables shareable / navigable paths.

---

## M3 — Source updates

### Task 12: Shared schemas for source updates

**Files:**
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/test/schemas.test.ts`

- [ ] **Step 1: Add schemas to `packages/shared/src/schemas.ts`**

At the end of the file (after existing type exports), add:

```ts
export const SourceKindSchema = z.enum(['git-source', 'plugin']);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceRefSchema = z.object({
  kind: SourceKindSchema,
  gitRoot: z.string().min(1),
  displayName: z.string().min(1),
  skillIds: z.array(z.string()),
  marketplace: z.string().optional(),
  pluginName: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const UpdateStatusSchema = z.object({
  ref: SourceRefSchema,
  ahead: z.number().int().nonnegative(),
  behind: z.number().int().nonnegative(),
  dirty: z.boolean(),
  lastFetchAt: z.string().datetime().optional(),
  lastCommit: z.object({
    sha: z.string(),
    subject: z.string(),
    author: z.string(),
    date: z.string(),
  }).optional(),
  error: z.string().optional(),
});
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

export const PullResultSchema = z.object({
  ok: z.boolean(),
  output: z.string(),
  error: z.string().optional(),
});
export type PullResult = z.infer<typeof PullResultSchema>;
```

- [ ] **Step 2: Add test in `packages/shared/test/schemas.test.ts`**

Inside the existing `describe('schemas', ...)` block, at the end:

```ts
  it('parses a valid SourceRef', () => {
    const r = SourceRefSchema.parse({
      kind: 'git-source',
      gitRoot: '/home/me/.loom/skills/my-custom',
      displayName: 'my-custom',
      skillIds: ['abc', 'def'],
    });
    expect(r.kind).toBe('git-source');
  });

  it('parses a plugin SourceRef with marketplace and pluginName', () => {
    const r = SourceRefSchema.parse({
      kind: 'plugin',
      gitRoot: '/cache/foo',
      displayName: 'market-a/plugin-x',
      skillIds: ['id1'],
      marketplace: 'market-a',
      pluginName: 'market-a/plugin-x',
    });
    expect(r.pluginName).toBe('market-a/plugin-x');
  });

  it('parses an UpdateStatus with zero defaults', () => {
    const s = UpdateStatusSchema.parse({
      ref: { kind: 'git-source', gitRoot: '/g', displayName: 'g', skillIds: [] },
      ahead: 0, behind: 0, dirty: false,
    });
    expect(s.dirty).toBe(false);
  });
```

And add the imports at the top of the test file:

```ts
import {
  SkillSchema, ManifestSchema, CenterDbSchema,
  SourceRefSchema, UpdateStatusSchema,
} from '../src/schemas.js';
```

(Replace the existing import if it's narrower.)

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @loom/shared test
```
Expected: 10 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add SourceRef, UpdateStatus, PullResult schemas"
```

---

### Task 13: `findGitRoot` + `detectGitRoots`

**Files:**
- Create: `packages/server/src/services/source-update.ts`
- Create: `packages/server/test/source-update.test.ts`

- [ ] **Step 1: Create `packages/server/src/services/source-update.ts`**

```ts
import { access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Skill, SourceRef } from '@loom/shared';

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function findGitRoot(skillDir: string, stopAt: string): Promise<string | null> {
  const normalizedStop = stopAt.replace(/[\\/]+$/, '');
  let p = skillDir;
  for (let i = 0; i < 32; i++) {
    if (await pathExists(join(p, '.git'))) return p;
    const parent = dirname(p);
    if (parent === p) return null;
    if (!p.startsWith(normalizedStop) && p !== normalizedStop) return null;
    p = parent;
  }
  return null;
}

export async function detectGitRoots(skills: Skill[]): Promise<SourceRef[]> {
  const byRoot = new Map<string, SourceRef>();
  for (const skill of skills) {
    const gitRoot = await findGitRoot(skill.skillDir, skill.sourceRoot);
    if (!gitRoot) continue;
    const existing = byRoot.get(gitRoot);
    if (existing) {
      existing.skillIds.push(skill.id);
      continue;
    }
    const isPlugin = skill.source === 'plugin';
    const ref: SourceRef = isPlugin
      ? {
          kind: 'plugin',
          gitRoot,
          displayName: skill.pluginName ?? basename(gitRoot),
          skillIds: [skill.id],
          marketplace: skill.pluginName?.split('/')[0],
          pluginName: skill.pluginName,
        }
      : {
          kind: 'git-source',
          gitRoot,
          displayName: basename(gitRoot),
          skillIds: [skill.id],
        };
    byRoot.set(gitRoot, ref);
  }
  return [...byRoot.values()];
}

export function formatPluginUpdateCmd(ref: SourceRef): string {
  if (ref.kind !== 'plugin' || !ref.pluginName) return '';
  return `claude plugins update ${ref.pluginName}`;
}
```

- [ ] **Step 2: Write failing tests `packages/server/test/source-update.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findGitRoot, detectGitRoots, formatPluginUpdateCmd } from '../src/services/source-update.js';
import type { Skill } from '@loom/shared';

function mkSkill(id: string, name: string, skillDir: string, sourceRoot: string, source: Skill['source'] = 'user-local', pluginName?: string): Skill {
  return {
    id, name, description: `${name} desc`, source,
    sourceRoot, absolutePath: join(skillDir, 'SKILL.md'), skillDir,
    fingerprint: '1', pluginName,
  };
}

describe('source-update git detection', () => {
  let work: string;
  beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'sm-gd-')); });
  afterEach(() => { rmSync(work, { recursive: true, force: true }); });

  it('findGitRoot returns the directory containing .git', async () => {
    const repoRoot = join(work, 'repo');
    const skillDir = join(repoRoot, 'skills', 'alpha');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, work);
    expect(found).toBe(repoRoot);
  });

  it('findGitRoot returns null when no .git in scope', async () => {
    const skillDir = join(work, 'plain', 'alpha');
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, work);
    expect(found).toBeNull();
  });

  it('findGitRoot respects stopAt boundary', async () => {
    // .git lives above stopAt -> should NOT be returned
    mkdirSync(join(work, '.git'), { recursive: true });
    const scope = join(work, 'scope');
    const skillDir = join(scope, 'skill');
    mkdirSync(skillDir, { recursive: true });
    const found = await findGitRoot(skillDir, scope);
    expect(found).toBeNull();
  });

  it('detectGitRoots merges multiple skills under the same gitRoot', async () => {
    const repoRoot = join(work, 'repo');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    const a = join(repoRoot, 'a'); const b = join(repoRoot, 'b');
    mkdirSync(a); mkdirSync(b);
    const skills: Skill[] = [
      mkSkill('id1', 'a', a, work),
      mkSkill('id2', 'b', b, work),
    ];
    const refs = await detectGitRoots(skills);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.skillIds.sort()).toEqual(['id1', 'id2']);
    expect(refs[0]!.kind).toBe('git-source');
    expect(refs[0]!.displayName).toBe('repo');
  });

  it('detectGitRoots produces plugin kind and extracts marketplace', async () => {
    const repoRoot = join(work, 'cache', 'market-a', 'plugin-x', 'v1');
    mkdirSync(join(repoRoot, '.git'), { recursive: true });
    const skillDir = join(repoRoot, 'skill');
    mkdirSync(skillDir);
    const skills: Skill[] = [
      mkSkill('id-p', 's', skillDir, work, 'plugin', 'market-a/plugin-x'),
    ];
    const refs = await detectGitRoots(skills);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.kind).toBe('plugin');
    expect(refs[0]!.marketplace).toBe('market-a');
    expect(refs[0]!.pluginName).toBe('market-a/plugin-x');
    expect(refs[0]!.displayName).toBe('market-a/plugin-x');
  });

  it('formatPluginUpdateCmd produces claude CLI command', () => {
    const cmd = formatPluginUpdateCmd({
      kind: 'plugin', gitRoot: '/g', displayName: 'm/p',
      skillIds: [], marketplace: 'm', pluginName: 'm/p',
    });
    expect(cmd).toBe('claude plugins update m/p');
  });

  it('formatPluginUpdateCmd returns empty string for git-source', () => {
    const cmd = formatPluginUpdateCmd({
      kind: 'git-source', gitRoot: '/g', displayName: 'x', skillIds: [],
    });
    expect(cmd).toBe('');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: 7 new tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server
git commit -m "feat(server): add findGitRoot, detectGitRoots, formatPluginUpdateCmd"
```

---

### Task 14: `checkUpdate` + git shell wrapper

**Files:**
- Modify: `packages/server/src/services/source-update.ts`
- Modify: `packages/server/test/source-update.test.ts`

- [ ] **Step 1: Add git wrapper and `checkUpdate` to `source-update.ts`**

Append to `packages/server/src/services/source-update.ts`:

```ts
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { UpdateStatus } from '@loom/shared';

const execFile = promisify(execFileCb);

export interface GitRunResult { stdout: string; stderr: string }

export async function runGit(args: string[], cwd: string, timeoutMs = 30_000): Promise<GitRunResult> {
  const { stdout, stderr } = await execFile('git', args, {
    cwd,
    timeout: timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

export interface CheckOptions {
  runner?: typeof runGit;
  skipFetch?: boolean;
}

export async function checkUpdate(ref: SourceRef, opts: CheckOptions = {}): Promise<UpdateStatus> {
  const runner = opts.runner ?? runGit;
  const status: UpdateStatus = { ref, ahead: 0, behind: 0, dirty: false };
  try {
    if (!opts.skipFetch) {
      await runner(['fetch', '--quiet'], ref.gitRoot);
      status.lastFetchAt = new Date().toISOString();
    }
    try {
      await runner(['rev-parse', '--abbrev-ref', '@{u}'], ref.gitRoot);
    } catch {
      return { ...status, error: 'no-remote' };
    }
    const ab = await runner(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], ref.gitRoot);
    const [aheadStr, behindStr] = ab.stdout.trim().split(/\s+/);
    status.ahead = Number(aheadStr ?? 0);
    status.behind = Number(behindStr ?? 0);
    const statusOut = await runner(['status', '--porcelain'], ref.gitRoot);
    status.dirty = statusOut.stdout.trim().length > 0;
    if (status.behind > 0) {
      const log = await runner(['log', '-1', '--pretty=format:%H%x00%s%x00%an%x00%cI', '@{u}'], ref.gitRoot);
      const [sha, subject, author, date] = log.stdout.split('\x00');
      if (sha && subject && author && date) {
        status.lastCommit = { sha, subject, author, date };
      }
    }
    return status;
  } catch (err) {
    return { ...status, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Add tests that use a mock runner**

Append to `packages/server/test/source-update.test.ts`:

```ts
import { checkUpdate, runGit } from '../src/services/source-update.js';
import type { SourceRef } from '@loom/shared';

function makeRunner(responses: Record<string, { stdout: string; stderr?: string } | Error>): typeof runGit {
  return async (args, _cwd) => {
    const key = args.join(' ');
    const r = responses[key];
    if (!r) throw new Error(`Unexpected git command: git ${key}`);
    if (r instanceof Error) throw r;
    return { stdout: r.stdout, stderr: r.stderr ?? '' };
  };
}

describe('checkUpdate', () => {
  const ref: SourceRef = {
    kind: 'git-source', gitRoot: '/tmp/x', displayName: 'x', skillIds: ['id1'],
  };

  it('reports ahead/behind and dirty when working tree clean', async () => {
    const runner = makeRunner({
      'fetch --quiet': { stdout: '' },
      'rev-parse --abbrev-ref @{u}': { stdout: 'origin/main\n' },
      'rev-list --left-right --count HEAD...@{u}': { stdout: '2\t3\n' },
      'status --porcelain': { stdout: '' },
      'log -1 --pretty=format:%H%x00%s%x00%an%x00%cI @{u}': {
        stdout: 'abc123\x00fix: foo\x00alice\x002026-04-20T00:00:00Z',
      },
    });
    const s = await checkUpdate(ref, { runner });
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(3);
    expect(s.dirty).toBe(false);
    expect(s.lastCommit?.subject).toBe('fix: foo');
    expect(s.error).toBeUndefined();
  });

  it('reports dirty when porcelain returns output', async () => {
    const runner = makeRunner({
      'fetch --quiet': { stdout: '' },
      'rev-parse --abbrev-ref @{u}': { stdout: 'origin/main' },
      'rev-list --left-right --count HEAD...@{u}': { stdout: '0\t0' },
      'status --porcelain': { stdout: ' M foo.txt\n' },
    });
    const s = await checkUpdate(ref, { runner });
    expect(s.dirty).toBe(true);
    expect(s.behind).toBe(0);
  });

  it('returns no-remote when upstream missing', async () => {
    const runner = makeRunner({
      'fetch --quiet': { stdout: '' },
      'rev-parse --abbrev-ref @{u}': new Error('no upstream'),
    });
    const s = await checkUpdate(ref, { runner });
    expect(s.error).toBe('no-remote');
  });

  it('catches fetch failure and returns error on status', async () => {
    const runner = makeRunner({
      'fetch --quiet': new Error('network down'),
    });
    const s = await checkUpdate(ref, { runner });
    expect(s.error).toContain('network down');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: 4 new tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server
git commit -m "feat(server): add checkUpdate and git shell wrapper with timeout"
```

---

### Task 15: `pullRepo` + wire into service exports

**Files:**
- Modify: `packages/server/src/services/source-update.ts`
- Modify: `packages/server/test/source-update.test.ts`

- [ ] **Step 1: Add `pullRepo` to `source-update.ts`**

Append:

```ts
import type { PullResult } from '@loom/shared';

export interface PullOptions {
  runner?: typeof runGit;
}

export async function pullRepo(ref: SourceRef, opts: PullOptions = {}): Promise<PullResult> {
  if (ref.kind !== 'git-source') {
    return { ok: false, output: '', error: 'Pull is only allowed for git-source refs. For plugins, use the claude CLI.' };
  }
  const runner = opts.runner ?? runGit;
  try {
    const { stdout, stderr } = await runner(['pull'], ref.gitRoot);
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (err) {
    return { ok: false, output: '', error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Add tests**

Append to `packages/server/test/source-update.test.ts`:

```ts
import { pullRepo } from '../src/services/source-update.js';

describe('pullRepo', () => {
  it('rejects plugin kind with explanatory error', async () => {
    const result = await pullRepo({
      kind: 'plugin', gitRoot: '/p', displayName: 'p', skillIds: [],
      marketplace: 'm', pluginName: 'm/p',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('git-source');
  });

  it('succeeds for git-source and returns output', async () => {
    const runner = makeRunner({
      'pull': { stdout: 'Updating abc..def\n', stderr: '' },
    });
    const result = await pullRepo({
      kind: 'git-source', gitRoot: '/g', displayName: 'g', skillIds: [],
    }, { runner });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('Updating');
  });

  it('returns ok=false with error when git pull fails', async () => {
    const runner = makeRunner({
      'pull': new Error('merge conflict'),
    });
    const result = await pullRepo({
      kind: 'git-source', gitRoot: '/g', displayName: 'g', skillIds: [],
    }, { runner });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('merge conflict');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: 3 new tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/server
git commit -m "feat(server): add pullRepo with plugin-kind rejection"
```

---

### Task 16: Sources routes — 3 endpoints

**Files:**
- Create: `packages/server/src/routes/sources.ts`
- Modify: `packages/server/src/app.ts`
- Create: `packages/server/test/sources-route.test.ts`

- [ ] **Step 1: Create `packages/server/src/routes/sources.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SourceRefSchema } from '@loom/shared';
import { scanSkills } from '../services/scanner.js';
import { detectGitRoots, checkUpdate, pullRepo } from '../services/source-update.js';
import type { CenterDbStore } from '../storage/center-db.js';

const CheckBody = z.object({ refs: z.array(SourceRefSchema).optional() });
const PullBody = z.object({ gitRoot: z.string().min(1) });

let inflightCheck: Promise<unknown> | null = null;

export const sourcesRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  app.get('/api/sources', async () => {
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
    const refs = await detectGitRoots(skills);
    return { ok: true as const, data: { refs } };
  });

  app.post('/api/sources/check', async (req) => {
    const body = CheckBody.parse(req.body ?? {});
    const work = async () => {
      let refs = body.refs;
      if (!refs) {
        const { skills } = await scanSkills({
          scanPaths: deps.db.data.scanPaths,
          userSkillsDir: deps.db.data.userSkillsDir,
          cachePath: deps.cachePath,
        });
        refs = await detectGitRoots(skills);
      }
      const concurrency = 5;
      const statuses: Awaited<ReturnType<typeof checkUpdate>>[] = [];
      for (let i = 0; i < refs.length; i += concurrency) {
        const chunk = refs.slice(i, i + concurrency);
        const results = await Promise.all(chunk.map(r => checkUpdate(r)));
        statuses.push(...results);
      }
      return statuses;
    };
    if (!inflightCheck) inflightCheck = work().finally(() => { inflightCheck = null; });
    const statuses = (await inflightCheck) as Awaited<ReturnType<typeof checkUpdate>>[];
    return { ok: true as const, data: { statuses } };
  });

  app.post('/api/sources/pull', async (req, reply) => {
    const body = PullBody.parse(req.body);
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      userSkillsDir: deps.db.data.userSkillsDir,
      cachePath: deps.cachePath,
    });
    const refs = await detectGitRoots(skills);
    const ref = refs.find(r => r.gitRoot === body.gitRoot);
    if (!ref) {
      reply.status(404);
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'gitRoot not found' } };
    }
    if (ref.kind !== 'git-source') {
      reply.status(400);
      return { ok: false as const, error: { code: 'CANNOT_PULL_PLUGIN', message: 'Use the claude CLI to update plugins' } };
    }
    const result = await pullRepo(ref);
    return { ok: true as const, data: result };
  });
};
```

- [ ] **Step 2: Register in `packages/server/src/app.ts`**

Add import at the top:

```ts
import { sourcesRoutes } from './routes/sources.js';
```

After `syncRoutes` registration, add:

```ts
  await app.register(sourcesRoutes({ db, cachePath: opts.cachePath }));
```

- [ ] **Step 3: Write integration test `packages/server/test/sources-route.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { buildApp } from '../src/app.js';
import { openCenterDb } from '../src/storage/center-db.js';

const execFile = promisify(execFileCb);
const here = dirname(fileURLToPath(import.meta.url));

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

  it('POST /api/sources/pull returns 400 for plugin refs', async () => {
    const work = mkdtempSync(join(tmpdir(), 'sm-sr-'));
    try {
      const db = await openCenterDb(join(work, 'db.json'));
      await db.write();
      const app = await buildApp({ db, cachePath: join(work, 'cache.json') });
      // Pull a non-existent gitRoot -> 404
      const missing = await app.inject({
        method: 'POST', url: '/api/sources/pull',
        payload: { gitRoot: '/definitely/not/a/path' },
      });
      expect(missing.statusCode).toBe(404);
      await app.close();
    } finally { rmSync(work, { recursive: true, force: true }); }
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @loom/server test
```
Expected: 2 new tests pass; note the tests run real `git init` — requires git in PATH on the test runner.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add /api/sources, /check, /pull endpoints"
```

---

### Task 17: Web API hooks for sources

**Files:**
- Create: `packages/web/src/api/sources.ts`

- [ ] **Step 1: Create `packages/web/src/api/sources.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { SourceRef, UpdateStatus, PullResult } from '@loom/shared';

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => apiFetch<{ refs: SourceRef[] }>('/api/sources'),
  });
}

export function useCheckSources() {
  return useMutation({
    mutationFn: (input: { refs?: SourceRef[] } = {}) =>
      apiFetch<{ statuses: UpdateStatus[] }>('/api/sources/check', {
        method: 'POST', body: JSON.stringify(input),
      }),
  });
}

export function usePullSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { gitRoot: string }) =>
      apiFetch<PullResult>('/api/sources/pull', {
        method: 'POST', body: JSON.stringify(input),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['skills'] }); },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/api/sources.ts
git commit -m "feat(web): add sources query/check/pull hooks"
```

---

### Task 18: `SourceUpdatesBanner` + `SourceUpdatesDrawer`

**Files:**
- Create: `packages/web/src/components/SourceUpdatesBanner.tsx`
- Create: `packages/web/src/components/SourceUpdatesDrawer.tsx`

- [ ] **Step 1: Create `packages/web/src/components/SourceUpdatesDrawer.tsx`**

```tsx
import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import { useSources, useCheckSources, usePullSource } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { UpdateStatus } from '@loom/shared';

export interface SourceUpdatesDrawerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function fmtDuration(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function pluginCmd(name?: string): string {
  return name ? `claude plugins update ${name}` : '';
}

function StatusRow({ s, onPull, pulling }: { s: UpdateStatus; onPull: (gitRoot: string) => void; pulling?: boolean }) {
  const isPlugin = s.ref.kind === 'plugin';
  return (
    <div className="rounded-lg bg-white p-4 shadow-ring-light">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-900">{s.ref.displayName}</span>
            <Badge variant={isPlugin ? 'info' : 'secondary'}>{s.ref.kind}</Badge>
            {s.dirty && <Badge variant="warning">dirty</Badge>}
          </div>
          {s.behind > 0 && (
            <p className="mt-1 text-xs text-ink-600">{s.behind} commit{s.behind > 1 ? 's' : ''} behind</p>
          )}
          {s.ahead > 0 && (
            <p className="mt-1 text-xs text-ink-600">{s.ahead} commit{s.ahead > 1 ? 's' : ''} ahead (local)</p>
          )}
          {s.lastCommit && (
            <p className="mt-1 line-clamp-2 text-xs italic text-ink-500">
              "{s.lastCommit.subject}" — {s.lastCommit.author}, {fmtDuration(s.lastCommit.date)}
            </p>
          )}
        </div>
      </div>
      {s.error && <p className="mt-2 font-mono text-xs text-ship-red">{s.error}</p>}
      {s.behind > 0 && !s.error && (
        <div className="mt-3 flex items-center gap-2">
          {isPlugin ? (
            <>
              <pre className="flex-1 overflow-x-auto rounded bg-ink-50 p-2 font-mono text-xs text-ink-900">{pluginCmd(s.ref.pluginName)}</pre>
              <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(pluginCmd(s.ref.pluginName))}>Copy</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onPull(s.ref.gitRoot)} disabled={pulling || s.dirty}>
              {pulling ? 'Pulling…' : 'Pull'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceUpdatesDrawer({ open, onOpenChange }: SourceUpdatesDrawerProps) {
  const check = useCheckSources();
  const pull = usePullSource();
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [activePull, setActivePull] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    check.mutateAsync({}).then(() => setLastCheckedAt(new Date().toISOString())).catch(() => {});
  }, [open]);

  const statuses = check.data?.statuses ?? [];
  const behind = statuses.filter(s => s.behind > 0 && !s.error);
  const upToDate = statuses.filter(s => s.behind === 0 && !s.error);
  const errors = statuses.filter(s => s.error);

  async function handlePull(gitRoot: string) {
    setActivePull(gitRoot);
    try {
      await pull.mutateAsync({ gitRoot });
      await check.mutateAsync({});
      setLastCheckedAt(new Date().toISOString());
    } finally { setActivePull(null); }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-[1px]" />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-[480px] overflow-y-auto bg-white p-6 shadow-card-elevated">
          <div className="mb-4 flex items-center justify-between">
            <DialogPrimitive.Title className="text-[17px] font-semibold tracking-heading">Source updates</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="mb-4 flex items-center gap-3 text-xs text-ink-500">
            <Button size="sm" variant="secondary" onClick={() => check.mutate({})} disabled={check.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="ml-1">{check.isPending ? 'Checking…' : 'Refresh now'}</span>
            </Button>
            {lastCheckedAt && <span>Last checked {fmtDuration(lastCheckedAt)}</span>}
          </div>

          {check.error && <p className="mb-3 font-mono text-xs text-ship-red">{(check.error as Error).message}</p>}

          <div className="space-y-5">
            {behind.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Behind upstream ({behind.length})</h3>
                <div className="space-y-2">
                  {behind.map(s => (
                    <StatusRow key={s.ref.gitRoot} s={s} onPull={handlePull} pulling={activePull === s.ref.gitRoot} />
                  ))}
                </div>
              </section>
            )}
            {upToDate.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Up to date ({upToDate.length})</h3>
                <ul className="space-y-1 text-sm text-ink-600">
                  {upToDate.map(s => <li key={s.ref.gitRoot} className="truncate">✓ {s.ref.displayName}</li>)}
                </ul>
              </section>
            )}
            {errors.length > 0 && (
              <section>
                <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-tight text-ink-500">Errors ({errors.length})</h3>
                <div className="space-y-2">
                  {errors.map(s => (
                    <div key={s.ref.gitRoot} className="rounded-lg bg-badge-red-bg p-3 shadow-ring-light">
                      <p className="text-sm font-medium text-badge-red-text">{s.ref.displayName}</p>
                      <p className="mt-1 font-mono text-xs text-badge-red-text/80">{s.error}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
```

- [ ] **Step 2: Create `packages/web/src/components/SourceUpdatesBanner.tsx`**

```tsx
import { useState } from 'react';
import { useSources, useCheckSources } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { SourceUpdatesDrawer } from './SourceUpdatesDrawer';

export function SourceUpdatesBanner() {
  const { data } = useSources();
  const check = useCheckSources();
  const [open, setOpen] = useState(false);
  const refCount = data?.refs.length ?? 0;
  const updateCount = (check.data?.statuses ?? []).filter(s => s.behind > 0 && !s.error).length;

  if (refCount === 0) return null;

  return (
    <>
      <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-ring-light">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-ink-900">Sources</span>
          <span className="text-ink-500">
            {refCount} git-backed
            {check.data && updateCount > 0 && (
              <> · <span className="text-develop-blue">{updateCount} have updates</span></>
            )}
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>View</Button>
      </div>
      <SourceUpdatesDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components
git commit -m "feat(web): add SourceUpdatesBanner and SourceUpdatesDrawer"
```

---

### Task 19: Wire banner into Skills page

**Files:**
- Modify: `packages/web/src/pages/SkillsPage.tsx`

- [ ] **Step 1: Add import and render**

Near the top of `packages/web/src/pages/SkillsPage.tsx`, add:

```tsx
import { SourceUpdatesBanner } from '@/components/SourceUpdatesBanner';
```

Inside the main column (the `<div className="flex-1 space-y-6">` block), immediately after the header flex-block (the `<div className="flex items-end justify-between gap-6">...</div>`) insert:

```tsx
        <SourceUpdatesBanner />
```

- [ ] **Step 2: Manual smoke**

```bash
pnpm dev
```

Visit `/skills`. Expected:
- Banner appears above skill grid if any git-backed sources detected
- Clicking "View" opens right-side drawer that auto-triggers a check
- Drawer sections: Behind / Up to date / Errors
- For git-source entries with `behind > 0`, Pull button works (test on a throwaway git repo with an upstream)
- For plugin entries, Copy button copies `claude plugins update ...`

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @loom/web typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/pages/SkillsPage.tsx
git commit -m "feat(web): surface source updates banner on Skills Library"
```

**M3 checkpoint reached** — source updates visible in UI; git-pull for user-managed repos, copy-command for plugins.

---

## Self-Review

**Spec coverage check** (against `2026-04-20-source-management-design.md`):

| Spec section | Task(s) |
|---|---|
| §4.1 Data model (userSkillsDir, user-local enum) | Task 1 |
| §4.2 UserDirService | Task 2 |
| §4.3 Scanner integration | Task 3 |
| §4.4 Settings UI card | Tasks 6, 7, 8 |
| §4.5 API changes (settings, platform, open folder) | Tasks 4, 5, 6 |
| §4.6 Edge cases (validate, mkdir fallback) | Covered in Task 2 validateUserSkillsDir tests + Task 4 PUT handler |
| §5.1 Tree data structure | Task 9 (useSkillTree) |
| §5.2 Component plan | Tasks 9, 10 |
| §5.3 URL state | Task 9 (useSearchParams integration) |
| §5.4 Interaction rules | Tasks 10, 11 (SkillTreeNode click handlers + SkillsPage filter chain) |
| §5.5 Styling | Task 10 (Tailwind classes match spec) |
| §5.6 Responsive | Task 11 (`hidden md:block` on sidebar) |
| §6.1 SourceUpdateService structures | Tasks 12, 13 |
| §6.2 Git command invocation | Task 14 (runGit wrapper) |
| §6.3 .git/ detection | Task 13 (findGitRoot) |
| §6.4 checkUpdate logic | Task 14 |
| §6.5 pullRepo | Task 15 |
| §6.6 formatPluginUpdateCmd | Task 13 |
| §6.7 API endpoints | Task 16 |
| §6.8 Banner + Drawer UI | Tasks 18, 19 |
| §6.9 Concurrency control | Task 16 (inflightCheck dedupe) |
| §6.10 Edge cases | Task 14 (no-remote / timeout / dirty) + UI error rows in Task 18 |

**Placeholder scan:** no TBD/TODO found. Each step shows concrete code and expected results.

**Type consistency spot-check:**
- `SourceRef` / `UpdateStatus` / `PullResult` defined in Task 12 shared schemas and used consistently in Tasks 13-19
- `TreeNode` shape defined in Task 9 is consumed verbatim in Tasks 10, 11
- `resolveUserSkillsDir` / `ensureUserSkillsDir` / `validateUserSkillsDir` names are consistent across Tasks 2, 3, 4, 5, 6
- `userSkillsDir` field is plumbed into `ScanOptions` in Task 3 and used by every call site in Task 4

**Known gaps (intentionally deferred):**
- Per-card update badge on SkillCard (spec §6.8 defers this to v0.3)
- Keyboard navigation on the tree (spec §5 defers to v0.3)
- Automatic periodic update checks (spec §6.9 non-goal)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-20-source-management-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
