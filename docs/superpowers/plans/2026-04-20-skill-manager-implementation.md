# Skill Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Node + React web app that manages Claude skills per-project via symlinks/junctions and AI-assisted filtering.

**Architecture:** pnpm monorepo with `shared` (zod schemas + types), `server` (Fastify backend), `web` (Vite + React + shadcn SPA). Server scans `~/.claude/` skill sources, creates per-project symlinks in `<project>/.claude/skills/`, persists state in `~/.skill-manager/db.json` (lowdb) and project-local `skill-manager.json` + `skill-manager.rules.yaml`.

**Tech Stack:** TypeScript 5, pnpm workspaces, Fastify 5, React 19, Vite 6, Tailwind + shadcn/ui, TanStack Query, zod, lowdb, gray-matter, js-yaml, vitest + msw.

**Spec reference:** `docs/superpowers/specs/2026-04-20-skill-manager-design.md`

**Phases (each ends on a green commit):**
- **A.** Foundation — monorepo, shared schemas, server skeleton, storage
- **B.** Scanner + Skills browse UI
- **C.** Projects + Link engine + Manifest
- **D.** Explicit selection UI (MVP end)
- **E.** Rules + AI recommendation
- **F.** Settings + cross-cutting polish

---

## Phase A — Foundation

### Task 1: Initialize monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Modify: `.gitignore` (already exists, verify entries)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "skill-manager",
  "version": "0.1.0",
  "private": true,
  "description": "Local multi-project Claude skill management app",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "start": "pnpm --filter @skill-manager/server start",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint"
  },
  "devDependencies": {
    "typescript": "5.6.3",
    "@types/node": "20.14.10",
    "vitest": "2.1.2"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - packages/*
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 4: Create `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 5: Install and verify**

```bash
cd D:/VibeProjects/skill-manager
pnpm install
pnpm typecheck
```
Expected: install succeeds (no packages to build yet), `typecheck` is a no-op since no workspace packages exist yet.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .editorconfig
git commit -m "chore: initialize pnpm monorepo skeleton"
```

---

### Task 2: Shared package — types and zod schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/test/schemas.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@skill-manager/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "3.23.8"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `packages/shared/src/constants.ts`**

```ts
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const APP_NAME = 'skill-manager';
export const DEFAULT_PORT = 4178;

export const CENTER_DIR = join(homedir(), '.skill-manager');
export const CENTER_DB_FILE = join(CENTER_DIR, 'db.json');
export const SKILLS_CACHE_FILE = join(CENTER_DIR, 'skills-cache.json');

export const DEFAULT_SCAN_PATHS = [
  join(homedir(), '.claude', 'skills'),
  join(homedir(), '.claude', 'custom-skills'),
  join(homedir(), '.claude', 'plugins', 'cache'),
];

export const PROJECT_CLAUDE_DIR = '.claude';
export const PROJECT_SKILLS_DIR = '.claude/skills';
export const MANIFEST_FILENAME = 'skill-manager.json';
export const RULES_FILENAME = 'skill-manager.rules.yaml';

export const IS_WINDOWS = platform() === 'win32';
```

- [ ] **Step 4: Create `packages/shared/src/schemas.ts`**

```ts
import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  source: z.enum(['user', 'custom', 'plugin']),
  sourceRoot: z.string(),
  absolutePath: z.string(),
  skillDir: z.string(),
  pluginName: z.string().optional(),
  fingerprint: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  addedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const RuleFileSchema = z.object({
  version: z.literal(1),
  projectHint: z.string(),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
  lastAppliedSkills: z.array(z.string()).optional(),
});
export type RuleFile = z.infer<typeof RuleFileSchema>;

export const ManifestEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceDir: z.string(),
  linkedAs: z.string(),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const ManifestSchema = z.object({
  version: z.literal(1),
  tool: z.literal('skill-manager'),
  appliedAt: z.string().datetime(),
  method: z.enum(['symlink', 'junction', 'copy']),
  skills: z.array(ManifestEntrySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const AiConfigSchema = z.object({
  endpoint: z.string().url(),
  model: z.string().min(1),
  apiKeyEnv: z.string().optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  systemPrompt: z.string().optional(),
  requestStyle: z.enum(['openai', 'anthropic']).default('openai'),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

export const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  scanPaths: z.array(z.string()).default([]),
  ai: AiConfigSchema.partial().default({}),
});
export type CenterDb = z.infer<typeof CenterDbSchema>;

export const ApplyRequestSchema = z.object({
  skillIds: z.array(z.string()).min(1),
});
export const UnapplyRequestSchema = z.object({
  skillIds: z.array(z.string()).optional(),
});
export const DiffPreviewSchema = z.object({
  toAdd: z.array(SkillSchema),
  toKeep: z.array(SkillSchema),
  toRemove: z.array(ManifestEntrySchema),
});
export type DiffPreview = z.infer<typeof DiffPreviewSchema>;

export const AiRecommendRequestSchema = z.object({
  projectId: z.string(),
  projectHint: z.string(),
  includes: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),
});

export const AiRecommendResultSchema = z.object({
  picks: z.array(z.object({
    skill: SkillSchema,
    reason: z.string(),
  })),
  warnings: z.array(z.string()).default([]),
});
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from './schemas.js';
export * from './constants.js';
```

- [ ] **Step 6: Write failing test `packages/shared/test/schemas.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { SkillSchema, ManifestSchema, CenterDbSchema } from '../src/schemas.js';

describe('schemas', () => {
  it('parses a valid Skill', () => {
    const parsed = SkillSchema.parse({
      id: 'abc123',
      name: 'foo',
      description: 'does foo',
      source: 'user',
      sourceRoot: '/tmp/a',
      absolutePath: '/tmp/a/foo/SKILL.md',
      skillDir: '/tmp/a/foo',
      fingerprint: '123-456',
    });
    expect(parsed.source).toBe('user');
  });

  it('rejects bad source enum', () => {
    expect(() =>
      SkillSchema.parse({
        id: 'x', name: 'x', description: 'x',
        source: 'bogus', sourceRoot: '/', absolutePath: '/', skillDir: '/',
        fingerprint: '1',
      })
    ).toThrow();
  });

  it('applies CenterDb defaults', () => {
    const db = CenterDbSchema.parse({});
    expect(db.projects).toEqual([]);
    expect(db.scanPaths).toEqual([]);
    expect(db.ai).toEqual({});
  });

  it('manifest requires version=1 and tool=skill-manager', () => {
    expect(() =>
      ManifestSchema.parse({
        version: 2, tool: 'skill-manager',
        appliedAt: new Date().toISOString(), method: 'symlink', skills: [],
      })
    ).toThrow();
  });
});
```

- [ ] **Step 7: Run test (expect fail: package not installed)**

```bash
pnpm --filter @skill-manager/shared install
pnpm --filter @skill-manager/shared test
```
Expected: FAIL initially until install resolves zod; after install tests should PASS.

- [ ] **Step 8: Install and verify tests pass**

```bash
pnpm install
pnpm --filter @skill-manager/shared test
```
Expected: all 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add zod schemas for skill, project, manifest, ai config"
```

---

### Task 3: Server skeleton — Fastify + launcher

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/routes/health.ts`
- Create: `packages/server/test/health.test.ts`

- [ ] **Step 1: Create `packages/server/package.json`**

```json
{
  "name": "@skill-manager/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@skill-manager/shared": "workspace:*",
    "fastify": "5.0.0",
    "@fastify/static": "8.0.1",
    "@fastify/cors": "10.0.1",
    "open": "10.1.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "tsx": "4.19.1",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `packages/server/src/routes/health.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({
    ok: true as const,
    data: { status: 'up', version: '0.1.0', uptimeSec: Math.floor(process.uptime()) },
  }));
};
```

- [ ] **Step 4: Create `packages/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

export interface BuildOptions {
  logger?: boolean;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: /^http:\/\/(127\.0\.0\.1|localhost):\d+$/ });
  await app.register(healthRoutes);

  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({
      ok: false,
      error: {
        code: err.code ?? 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  });

  return app;
}
```

- [ ] **Step 5: Create `packages/server/src/index.ts`**

```ts
import { buildApp } from './app.js';
import { DEFAULT_PORT } from '@skill-manager/shared';
import open from 'open';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = '127.0.0.1';

const app = await buildApp({ logger: true });

await app.listen({ port, host });
console.log(`Skill Manager running at http://${host}:${port}`);

if (process.env.NO_OPEN !== '1') {
  await open(`http://${host}:${port}`);
}
```

- [ ] **Step 6: Write failing test `packages/server/test/health.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); });
afterAll(async () => { await app.close(); });

describe('GET /api/health', () => {
  it('returns status up', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('up');
  });
});
```

- [ ] **Step 7: Install and run tests**

```bash
pnpm install
pnpm --filter @skill-manager/server test
```
Expected: 1 test PASS.

- [ ] **Step 8: Manual smoke test**

```bash
NO_OPEN=1 pnpm start
```
In another terminal:
```bash
curl http://127.0.0.1:4178/api/health
```
Expected: `{"ok":true,"data":{"status":"up",...}}`. Kill the server with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
git add packages/server
git commit -m "feat(server): add fastify skeleton with health endpoint"
```

---

### Task 4: Center storage — lowdb wrapper

**Files:**
- Create: `packages/server/src/storage/center-db.ts`
- Create: `packages/server/test/center-db.test.ts`
- Modify: `packages/server/package.json` (add `lowdb`)

- [ ] **Step 1: Add dependency `lowdb`**

Edit `packages/server/package.json` dependencies:

```json
"lowdb": "7.0.1"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/storage/center-db.ts`**

```ts
import { JSONFilePreset } from 'lowdb/node';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  CENTER_DB_FILE,
  DEFAULT_SCAN_PATHS,
  CenterDbSchema,
  type CenterDb,
} from '@skill-manager/shared';

const DEFAULTS: CenterDb = {
  projects: [],
  scanPaths: [...DEFAULT_SCAN_PATHS],
  ai: {},
};

export type CenterDbStore = Awaited<ReturnType<typeof JSONFilePreset<CenterDb>>>;

export async function openCenterDb(filePath = CENTER_DB_FILE): Promise<CenterDbStore> {
  await mkdir(dirname(filePath), { recursive: true });
  const db = await JSONFilePreset<CenterDb>(filePath, DEFAULTS);
  db.data = CenterDbSchema.parse(db.data);
  if (db.data.scanPaths.length === 0) db.data.scanPaths = [...DEFAULT_SCAN_PATHS];
  await db.write();
  return db;
}
```

- [ ] **Step 3: Write failing test `packages/server/test/center-db.test.ts`**

```ts
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
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: 3 tests total (1 from Task 3 + 2 new) all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add lowdb-backed center storage with schema validation"
```

---

## Phase B — Scanner + Skills browse UI

### Task 5: ScannerService

**Files:**
- Create: `packages/server/src/services/scanner.ts`
- Create: `packages/server/src/utils/fingerprint.ts`
- Create: `packages/server/test/scanner.test.ts`
- Create: `packages/server/test/fixtures/fake-claude/skills/demo-skill/SKILL.md` (fixture)
- Modify: `packages/server/package.json` (add `gray-matter`, `tiny-glob`)

- [ ] **Step 1: Add dependencies**

Edit `packages/server/package.json` dependencies:

```json
"gray-matter": "4.0.3",
"tiny-glob": "0.2.9"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/utils/fingerprint.ts`**

```ts
import { stat } from 'node:fs/promises';

export async function computeFingerprint(path: string): Promise<string> {
  const s = await stat(path);
  return `${Math.floor(s.mtimeMs)}-${s.size}`;
}
```

- [ ] **Step 3: Create `packages/server/src/services/scanner.ts`**

```ts
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, relative, sep, join } from 'node:path';
import { createHash } from 'node:crypto';
import glob from 'tiny-glob';
import matter from 'gray-matter';
import { SKILLS_CACHE_FILE, CENTER_DIR, type Skill } from '@skill-manager/shared';
import { computeFingerprint } from '../utils/fingerprint.js';

type SourceKind = 'user' | 'custom' | 'plugin';

function classifySource(sourceRoot: string): SourceKind {
  if (sourceRoot.endsWith(`${sep}plugins${sep}cache`) || sourceRoot.endsWith('/plugins/cache')) return 'plugin';
  if (sourceRoot.endsWith('custom-skills')) return 'custom';
  return 'user';
}

function extractPluginName(sourceRoot: string, absPath: string): string | undefined {
  const rel = relative(sourceRoot, absPath);
  const parts = rel.split(/[\\/]/);
  if (parts.length < 2) return undefined;
  return `${parts[0]}/${parts[1]}`;
}

function makeSkillId(sourceRoot: string, relPath: string): string {
  return createHash('sha1').update(`${sourceRoot}::${relPath}`).digest('hex').slice(0, 12);
}

export interface ScanResult {
  skills: Skill[];
  warnings: string[];
}

export interface ScanOptions {
  scanPaths: string[];
  cachePath?: string;
  forceRefresh?: boolean;
}

type CacheFile = Record<string, Skill>;

async function loadCache(path: string): Promise<CacheFile> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as CacheFile;
  } catch {
    return {};
  }
}

async function saveCache(path: string, data: CacheFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function scanSkills(opts: ScanOptions): Promise<ScanResult> {
  const cachePath = opts.cachePath ?? SKILLS_CACHE_FILE;
  const oldCache = opts.forceRefresh ? {} : await loadCache(cachePath);
  const newCache: CacheFile = {};
  const warnings: string[] = [];
  const skills: Skill[] = [];

  for (const sourceRoot of opts.scanPaths) {
    if (!(await pathExists(sourceRoot))) continue;
    const matches = await glob('**/SKILL.md', { cwd: sourceRoot, absolute: true, filesOnly: true });
    const source = classifySource(sourceRoot);

    for (const absPath of matches) {
      const fp = await computeFingerprint(absPath);
      const relPath = relative(sourceRoot, absPath);
      const id = makeSkillId(sourceRoot, relPath);
      const cached = oldCache[id];
      if (cached && cached.fingerprint === fp) {
        newCache[id] = cached;
        skills.push(cached);
        continue;
      }
      try {
        const raw = await readFile(absPath, 'utf8');
        const parsed = matter(raw);
        const name = typeof parsed.data.name === 'string' ? parsed.data.name : '';
        const desc = typeof parsed.data.description === 'string' ? parsed.data.description : '';
        if (!name || !desc) {
          warnings.push(`Missing name/description in frontmatter: ${absPath}`);
          continue;
        }
        const skill: Skill = {
          id,
          name,
          description: desc,
          source,
          sourceRoot,
          absolutePath: absPath,
          skillDir: dirname(absPath),
          pluginName: source === 'plugin' ? extractPluginName(sourceRoot, absPath) : undefined,
          fingerprint: fp,
        };
        newCache[id] = skill;
        skills.push(skill);
      } catch (err) {
        warnings.push(`Failed to parse ${absPath}: ${(err as Error).message}`);
      }
    }
  }

  await saveCache(cachePath, newCache);
  return { skills, warnings };
}
```

- [ ] **Step 4: Create fixture `packages/server/test/fixtures/fake-claude/skills/demo-skill/SKILL.md`**

```markdown
---
name: demo-skill
description: A demo skill used for scanner tests.
---

# Demo Skill

Body content.
```

- [ ] **Step 5: Create fixture `packages/server/test/fixtures/fake-claude/skills/broken-skill/SKILL.md`**

```markdown
---
description: missing name on purpose
---

body
```

- [ ] **Step 6: Write failing test `packages/server/test/scanner.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { scanSkills } from '../src/services/scanner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'fake-claude', 'skills');

describe('scanSkills', () => {
  let cacheDir: string;
  beforeEach(() => { cacheDir = mkdtempSync(join(tmpdir(), 'sm-cache-')); });

  it('finds demo skill and emits warning for broken', async () => {
    const result = await scanSkills({
      scanPaths: [fixtureRoot],
      cachePath: join(cacheDir, 'cache.json'),
    });
    try {
      expect(result.skills.map(s => s.name)).toContain('demo-skill');
      expect(result.warnings.some(w => w.includes('broken-skill'))).toBe(true);
    } finally { rmSync(cacheDir, { recursive: true, force: true }); }
  });

  it('re-uses cache on second pass with unchanged fingerprint', async () => {
    const cachePath = join(cacheDir, 'cache.json');
    const first = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    const second = await scanSkills({ scanPaths: [fixtureRoot], cachePath });
    expect(second.skills).toEqual(first.skills);
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('skips non-existent scan paths silently', async () => {
    const result = await scanSkills({
      scanPaths: ['/definitely/not/a/real/path/xyz'],
      cachePath: join(cacheDir, 'cache.json'),
    });
    expect(result.skills).toEqual([]);
    expect(result.warnings).toEqual([]);
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm install
pnpm --filter @skill-manager/server test
```
Expected: 3 new scanner tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/server
git commit -m "feat(server): add scanner service with fingerprint cache"
```

---

### Task 6: GET /api/skills endpoint

**Files:**
- Create: `packages/server/src/routes/skills.ts`
- Modify: `packages/server/src/app.ts` (register route + pass store)
- Create: `packages/server/test/skills-route.test.ts`

- [ ] **Step 1: Create `packages/server/src/routes/skills.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import type { CenterDbStore } from '../storage/center-db.js';
import { scanSkills } from '../services/scanner.js';

export interface SkillsRoutesDeps {
  db: CenterDbStore;
  cachePath?: string;
}

export const skillsRoutes = (deps: SkillsRoutesDeps): FastifyPluginAsync => async (app) => {
  app.get<{ Querystring: { refresh?: string } }>('/api/skills', async (req) => {
    const forceRefresh = req.query.refresh === '1';
    const { skills, warnings } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      cachePath: deps.cachePath,
      forceRefresh,
    });
    return { ok: true as const, data: { skills, warnings } };
  });

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const { skills } = await scanSkills({
      scanPaths: deps.db.data.scanPaths,
      cachePath: deps.cachePath,
    });
    const skill = skills.find(s => s.id === req.params.id);
    if (!skill) {
      reply.status(404);
      return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Skill not found' } };
    }
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(skill.absolutePath, 'utf8');
    return { ok: true as const, data: { skill, content } };
  });
};
```

- [ ] **Step 2: Update `packages/server/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { skillsRoutes } from './routes/skills.js';
import { openCenterDb, type CenterDbStore } from './storage/center-db.js';

export interface BuildOptions {
  logger?: boolean;
  dbFile?: string;
  cachePath?: string;
  db?: CenterDbStore;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: /^http:\/\/(127\.0\.0\.1|localhost):\d+$/ });

  const db = opts.db ?? await openCenterDb(opts.dbFile);

  await app.register(healthRoutes);
  await app.register(skillsRoutes({ db, cachePath: opts.cachePath }));

  app.setErrorHandler((err, _req, reply) => {
    reply.status(err.statusCode ?? 500).send({
      ok: false,
      error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
    });
  });

  app.addHook('onClose', async () => { /* db is file-backed, nothing to close */ });
  return app;
}
```

- [ ] **Step 3: Write failing test `packages/server/test/skills-route.test.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: all existing + 2 new PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add GET /api/skills and /api/skills/:id endpoints"
```

---

### Task 7: Web skeleton — Vite + React + Tailwind + shadcn

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/index.css`
- Create: `packages/web/tailwind.config.ts`
- Create: `packages/web/postcss.config.js`

- [ ] **Step 1: Create `packages/web/package.json`**

```json
{
  "name": "@skill-manager/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@skill-manager/shared": "workspace:*",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-router-dom": "6.27.0",
    "@tanstack/react-query": "5.59.0",
    "zod": "3.23.8",
    "class-variance-authority": "0.7.0",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.4",
    "lucide-react": "0.447.0"
  },
  "devDependencies": {
    "@types/react": "19.0.0",
    "@types/react-dom": "19.0.0",
    "@vitejs/plugin-react": "4.3.2",
    "vite": "6.0.0",
    "tailwindcss": "3.4.13",
    "postcss": "8.4.47",
    "autoprefixer": "10.4.20",
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Create `packages/web/vite.config.ts`**

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
});
```

- [ ] **Step 3: Create `packages/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create `packages/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Create `packages/web/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: Create `packages/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Skill Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `packages/web/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { @apply bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50; }
```

- [ ] **Step 8: Create `packages/web/src/App.tsx`**

```tsx
export default function App() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Skill Manager</h1>
      <p className="mt-2 text-sm text-neutral-500">Web UI boot OK.</p>
    </div>
  );
}
```

- [ ] **Step 9: Create `packages/web/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const qc = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 10: Install and manual smoke test**

```bash
pnpm install
pnpm --filter @skill-manager/web dev
```
Expected: Vite dev server starts on 5173; open browser → see "Skill Manager" + "Web UI boot OK." Kill with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
git add packages/web
git commit -m "feat(web): add vite + react + tailwind skeleton"
```

---

### Task 8: shadcn/ui primitives + utils

**Files:**
- Create: `packages/web/src/lib/utils.ts`
- Create: `packages/web/src/components/ui/button.tsx`
- Create: `packages/web/src/components/ui/card.tsx`
- Create: `packages/web/src/components/ui/badge.tsx`
- Create: `packages/web/src/components/ui/input.tsx`
- Create: `packages/web/components.json`

- [ ] **Step 1: Create `packages/web/components.json`** (for future `npx shadcn add`)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": false
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 2: Create `packages/web/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `packages/web/src/components/ui/button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200',
        secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100',
        outline: 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800',
        ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 4: Create `packages/web/src/components/ui/card.tsx`**

```tsx
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900', className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-base font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
```

- [ ] **Step 5: Create `packages/web/src/components/ui/badge.tsx`**

```tsx
import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
        secondary: 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100',
        outline: 'border border-neutral-300 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100',
        destructive: 'bg-red-600 text-white',
        success: 'bg-green-600 text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

- [ ] **Step 6: Create `packages/web/src/components/ui/input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-neutral-300 bg-white px-3 py-1 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [ ] **Step 7: Smoke test**

```bash
pnpm --filter @skill-manager/web typecheck
```
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add packages/web
git commit -m "feat(web): add shadcn-style primitives (button, card, badge, input)"
```

---

### Task 9: API client + Skills page

**Files:**
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/api/skills.ts`
- Create: `packages/web/src/pages/SkillsPage.tsx`
- Create: `packages/web/src/components/SkillCard.tsx`
- Modify: `packages/web/src/App.tsx` (add router + skills page)

- [ ] **Step 1: Create `packages/web/src/api/client.ts`**

```ts
export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.ok) throw new Error(`${body.error.code}: ${body.error.message}`);
  return body.data;
}
```

- [ ] **Step 2: Create `packages/web/src/api/skills.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Skill } from '@skill-manager/shared';

interface SkillsResponse { skills: Skill[]; warnings: string[] }

export function useSkills(refresh = false) {
  return useQuery({
    queryKey: ['skills', { refresh }],
    queryFn: () => apiFetch<SkillsResponse>(`/api/skills${refresh ? '?refresh=1' : ''}`),
  });
}
```

- [ ] **Step 3: Create `packages/web/src/components/SkillCard.tsx`**

```tsx
import type { Skill } from '@skill-manager/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface SkillCardProps {
  skill: Skill;
  selected?: boolean;
  onToggle?: (skill: Skill) => void;
}

export function SkillCard({ skill, selected, onToggle }: SkillCardProps) {
  return (
    <Card
      role={onToggle ? 'button' : undefined}
      onClick={onToggle ? () => onToggle(skill) : undefined}
      className={selected ? 'ring-2 ring-neutral-900 dark:ring-neutral-100' : undefined}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{skill.name}</CardTitle>
          <Badge variant="outline">{skill.pluginName ?? skill.source}</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-neutral-600 dark:text-neutral-400">
        {skill.description}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `packages/web/src/pages/SkillsPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useSkills } from '@/api/skills';
import { SkillCard } from '@/components/SkillCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Skill } from '@skill-manager/shared';

function group(skills: Skill[]): Record<string, Skill[]> {
  const out: Record<string, Skill[]> = {};
  for (const s of skills) {
    const key = s.source === 'plugin' ? `plugin · ${s.pluginName ?? '(unknown)'}` : s.source;
    (out[key] ??= []).push(s);
  }
  return out;
}

export function SkillsPage() {
  const [q, setQ] = useState('');
  const { data, isLoading, refetch, isFetching } = useSkills();
  const filtered = useMemo(() => {
    if (!data) return [] as Skill[];
    const needle = q.trim().toLowerCase();
    if (!needle) return data.skills;
    return data.skills.filter(s =>
      s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [data, q]);
  const groups = useMemo(() => group(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Skills ({data?.skills.length ?? 0})</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Search name or description..." value={q} onChange={e => setQ(e.target.value)} className="w-80" />
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
      {data?.warnings.length ? (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900 dark:bg-yellow-950/40">
          {data.warnings.length} skills failed to parse. First: {data.warnings[0]}
        </div>
      ) : null}
      {Object.entries(groups).map(([key, skills]) => (
        <section key={key} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{key} ({skills.length})</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {skills.map(s => <SkillCard key={s.id} skill={s} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Update `packages/web/src/App.tsx`**

```tsx
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SkillsPage } from './pages/SkillsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <header className="border-b bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold">Skill Manager</Link>
            <Link to="/" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Projects</Link>
            <Link to="/skills" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Skills</Link>
            <Link to="/settings" className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300">Settings</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl p-6">
          <Routes>
            <Route path="/" element={<div>Projects (Task 15)</div>} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/settings" element={<div>Settings (Task 24)</div>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Smoke test**

Terminal 1:
```bash
NO_OPEN=1 pnpm --filter @skill-manager/server start
```
Terminal 2:
```bash
pnpm --filter @skill-manager/web dev
```
Open `http://localhost:5173/skills`. Expected: list of skills grouped by source.

- [ ] **Step 7: Commit**

```bash
git add packages/web
git commit -m "feat(web): add skills browse page with search and grouping"
```

---

## Phase C — Projects + Link engine + Manifest

### Task 10: ProjectService + /api/projects CRUD

**Files:**
- Create: `packages/server/src/services/project.ts`
- Create: `packages/server/src/routes/projects.ts`
- Modify: `packages/server/src/app.ts`
- Create: `packages/server/test/project.test.ts`

- [ ] **Step 1: Create `packages/server/src/services/project.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { access, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { ProjectSchema, type Project } from '@skill-manager/shared';
import type { CenterDbStore } from '../storage/center-db.js';

export interface ProjectStatus extends Project {
  status: 'ok' | 'broken';
}

export async function pathExistsDir(p: string): Promise<boolean> {
  try { const s = await stat(p); return s.isDirectory(); } catch { return false; }
}

export class ProjectService {
  constructor(private db: CenterDbStore) {}

  async list(): Promise<ProjectStatus[]> {
    const out: ProjectStatus[] = [];
    for (const p of this.db.data.projects) {
      const status = (await pathExistsDir(p.path)) ? 'ok' : 'broken';
      out.push({ ...p, status });
    }
    return out;
  }

  async get(id: string): Promise<ProjectStatus | null> {
    const found = this.db.data.projects.find(p => p.id === id);
    if (!found) return null;
    const status = (await pathExistsDir(found.path)) ? 'ok' : 'broken';
    return { ...found, status };
  }

  async add(input: { path: string; name?: string; notes?: string }): Promise<Project> {
    const absPath = resolve(input.path);
    if (!(await pathExistsDir(absPath))) {
      throw Object.assign(new Error(`Path does not exist or is not a directory: ${absPath}`), { statusCode: 400, code: 'INVALID_PATH' });
    }
    if (this.db.data.projects.some(p => p.path === absPath)) {
      throw Object.assign(new Error(`Project already registered: ${absPath}`), { statusCode: 409, code: 'DUPLICATE' });
    }
    const project: Project = ProjectSchema.parse({
      id: randomUUID(),
      name: input.name?.trim() || basename(absPath),
      path: absPath,
      addedAt: new Date().toISOString(),
      notes: input.notes,
    });
    this.db.data.projects.push(project);
    await this.db.write();
    return project;
  }

  async update(id: string, patch: Partial<Pick<Project, 'name' | 'path' | 'notes'>>): Promise<Project> {
    const idx = this.db.data.projects.findIndex(p => p.id === id);
    if (idx < 0) throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
    const current = this.db.data.projects[idx]!;
    const next = { ...current, ...patch };
    if (patch.path && !(await pathExistsDir(patch.path))) {
      throw Object.assign(new Error(`Path does not exist: ${patch.path}`), { statusCode: 400, code: 'INVALID_PATH' });
    }
    this.db.data.projects[idx] = ProjectSchema.parse(next);
    await this.db.write();
    return this.db.data.projects[idx]!;
  }

  async remove(id: string): Promise<void> {
    const before = this.db.data.projects.length;
    this.db.data.projects = this.db.data.projects.filter(p => p.id !== id);
    if (this.db.data.projects.length === before) {
      throw Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    await this.db.write();
  }
}
```

- [ ] **Step 2: Create `packages/server/src/routes/projects.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';

const AddBody = z.object({ path: z.string().min(1), name: z.string().optional(), notes: z.string().optional() });
const PatchBody = z.object({ name: z.string().optional(), path: z.string().optional(), notes: z.string().optional() });

export const projectsRoutes = (deps: { db: CenterDbStore }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.get('/api/projects', async () => ({ ok: true as const, data: await svc.list() }));

  app.post('/api/projects', async (req) => {
    const body = AddBody.parse(req.body);
    const project = await svc.add(body);
    return { ok: true as const, data: project };
  });

  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    const body = PatchBody.parse(req.body);
    const project = await svc.update(req.params.id, body);
    return { ok: true as const, data: project };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    await svc.remove(req.params.id);
    return { ok: true as const, data: { id: req.params.id } };
  });
};
```

- [ ] **Step 3: Update `packages/server/src/app.ts`** — add `projectsRoutes` registration

Change the register block to:

```ts
await app.register(healthRoutes);
await app.register(skillsRoutes({ db, cachePath: opts.cachePath }));
await app.register(projectsRoutes({ db }));
```

And add the import:

```ts
import { projectsRoutes } from './routes/projects.js';
```

- [ ] **Step 4: Write failing test `packages/server/test/project.test.ts`**

```ts
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
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: all previous + 2 new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server
git commit -m "feat(server): add project service and CRUD endpoints"
```

---

### Task 11: LinkService — symlink/junction/copy with tryLink

**Files:**
- Create: `packages/server/src/services/link.ts`
- Create: `packages/server/src/utils/fs-safe.ts`
- Create: `packages/server/test/link.test.ts`
- Modify: `packages/server/package.json` (add `fs-extra`)

- [ ] **Step 1: Add dependency `fs-extra`**

Edit `packages/server/package.json` dependencies:

```json
"fs-extra": "11.2.0"
```

And devDependencies:
```json
"@types/fs-extra": "11.0.4"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/utils/fs-safe.ts`**

```ts
import { access, lstat, readlink, rm, rename, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function isSymlinkOrJunction(p: string): Promise<boolean> {
  try {
    const s = await lstat(p);
    return s.isSymbolicLink();
  } catch { return false; }
}

export async function readlinkSafe(p: string): Promise<string | null> {
  try { return await readlink(p); } catch { return null; }
}

export async function removePath(p: string): Promise<void> {
  await rm(p, { recursive: true, force: true });
}

export async function atomicWriteFile(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tmp, contents, 'utf8');
  await rename(tmp, filePath);
}
```

- [ ] **Step 3: Create `packages/server/src/services/link.ts`**

```ts
import { symlink, mkdir } from 'node:fs/promises';
import { copy } from 'fs-extra';
import { join } from 'node:path';
import {
  IS_WINDOWS,
  PROJECT_SKILLS_DIR,
  MANIFEST_FILENAME,
  PROJECT_CLAUDE_DIR,
  ManifestSchema,
  type Skill,
  type Manifest,
  type ManifestEntry,
} from '@skill-manager/shared';
import { atomicWriteFile, exists, isSymlinkOrJunction, removePath } from '../utils/fs-safe.js';

export type LinkMethod = 'symlink' | 'junction' | 'copy';

export interface LinkOneResult {
  method: LinkMethod;
  target: string;
}

async function tryLink(source: string, target: string): Promise<LinkOneResult> {
  await mkdir(join(target, '..'), { recursive: true });
  try {
    await symlink(source, target, 'junction');
    return { method: IS_WINDOWS ? 'junction' : 'symlink', target };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') throw err;
    try {
      await copy(source, target, { dereference: true, errorOnExist: false });
      return { method: 'copy', target };
    } catch (copyErr) {
      throw copyErr;
    }
  }
}

interface JournalEntry {
  kind: 'created' | 'removed';
  path: string;
  backup?: string;
}

export interface ApplyInput {
  projectPath: string;
  desiredSkills: Skill[];
  currentManifest: Manifest | null;
}

export interface ApplyResult {
  manifest: Manifest;
  method: LinkMethod;
  toAdd: Skill[];
  toKeep: Skill[];
  toRemove: ManifestEntry[];
}

export async function applySkills(input: ApplyInput): Promise<ApplyResult> {
  const skillsDir = join(input.projectPath, PROJECT_SKILLS_DIR);
  await mkdir(skillsDir, { recursive: true });

  const currentIds = new Set((input.currentManifest?.skills ?? []).map(s => s.id));
  const desiredIds = new Set(input.desiredSkills.map(s => s.id));

  const toAdd = input.desiredSkills.filter(s => !currentIds.has(s.id));
  const toKeep = input.desiredSkills.filter(s => currentIds.has(s.id));
  const toRemove = (input.currentManifest?.skills ?? []).filter(e => !desiredIds.has(e.id));

  const journal: JournalEntry[] = [];
  let chosenMethod: LinkMethod = 'symlink';

  try {
    // Removals first (move to backup location so rollback can restore)
    for (const entry of toRemove) {
      const abs = join(input.projectPath, entry.linkedAs);
      const backup = `${abs}.sm-backup-${Date.now()}`;
      if (await exists(abs)) {
        if (await isSymlinkOrJunction(abs)) {
          await removePath(abs);
          journal.push({ kind: 'removed', path: abs });
        } else {
          const { rename } = await import('node:fs/promises');
          await rename(abs, backup);
          journal.push({ kind: 'removed', path: abs, backup });
        }
      }
    }

    // Additions
    for (const skill of toAdd) {
      const target = join(skillsDir, skill.name);
      if (await exists(target)) {
        const managed = (input.currentManifest?.skills ?? []).some(e => join(input.projectPath, e.linkedAs) === target);
        if (managed) {
          await removePath(target);
        } else {
          const err = new Error(`Target exists and is not managed by skill-manager: ${target}`);
          (err as any).code = 'CONFLICT';
          (err as any).statusCode = 409;
          throw err;
        }
      }
      const result = await tryLink(skill.skillDir, target);
      if (result.method === 'copy') chosenMethod = 'copy';
      else if (chosenMethod !== 'copy' && result.method === 'junction') chosenMethod = 'junction';
      journal.push({ kind: 'created', path: target });
    }

    // Build new manifest
    const finalEntries: ManifestEntry[] = input.desiredSkills.map(s => ({
      id: s.id,
      name: s.name,
      sourceDir: s.skillDir,
      linkedAs: join(PROJECT_SKILLS_DIR, s.name).replace(/\\/g, '/'),
    }));
    const manifest: Manifest = ManifestSchema.parse({
      version: 1,
      tool: 'skill-manager',
      appliedAt: new Date().toISOString(),
      method: chosenMethod,
      skills: finalEntries,
    });
    const manifestPath = join(input.projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
    await atomicWriteFile(manifestPath, JSON.stringify(manifest, null, 2));

    // Clean up backups from removals
    for (const op of journal) {
      if (op.kind === 'removed' && op.backup) await removePath(op.backup);
    }

    return { manifest, method: chosenMethod, toAdd, toKeep, toRemove };
  } catch (err) {
    // Rollback in reverse order
    for (const op of [...journal].reverse()) {
      try {
        if (op.kind === 'created') {
          await removePath(op.path);
        } else if (op.kind === 'removed' && op.backup) {
          const { rename } = await import('node:fs/promises');
          await rename(op.backup, op.path);
        }
      } catch { /* best-effort rollback */ }
    }
    throw err;
  }
}

export async function unapplySkills(opts: {
  projectPath: string;
  manifest: Manifest;
  skillIds?: string[];
}): Promise<{ removed: ManifestEntry[]; remaining: Manifest }> {
  const targetIds = opts.skillIds ? new Set(opts.skillIds) : null;
  const removed: ManifestEntry[] = [];
  const remaining: ManifestEntry[] = [];

  for (const entry of opts.manifest.skills) {
    if (!targetIds || targetIds.has(entry.id)) {
      const abs = join(opts.projectPath, entry.linkedAs);
      if (await exists(abs)) await removePath(abs);
      removed.push(entry);
    } else {
      remaining.push(entry);
    }
  }

  const manifestPath = join(opts.projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
  if (remaining.length === 0) {
    await removePath(manifestPath);
  } else {
    const newManifest: Manifest = ManifestSchema.parse({
      version: 1,
      tool: 'skill-manager',
      appliedAt: new Date().toISOString(),
      method: opts.manifest.method,
      skills: remaining,
    });
    await atomicWriteFile(manifestPath, JSON.stringify(newManifest, null, 2));
    return { removed, remaining: newManifest };
  }

  return {
    removed,
    remaining: { ...opts.manifest, skills: [] },
  };
}
```

- [ ] **Step 4: Write failing test `packages/server/test/link.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySkills, unapplySkills } from '../src/services/link.js';
import type { Skill, Manifest } from '@skill-manager/shared';

function makeSkill(id: string, name: string, skillDir: string): Skill {
  return {
    id, name, description: `${name} desc`,
    source: 'user',
    sourceRoot: join(skillDir, '..'),
    absolutePath: join(skillDir, 'SKILL.md'),
    skillDir,
    fingerprint: '1-1',
  };
}

describe('link engine', () => {
  let work: string;
  let skillRoot: string;

  beforeEach(() => {
    work = mkdtempSync(join(tmpdir(), 'sm-work-'));
    skillRoot = join(work, 'fake-skills');
    mkdirSync(skillRoot, { recursive: true });
  });

  afterEach(() => { rmSync(work, { recursive: true, force: true }); });

  it('applies a single skill and writes manifest', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');

    const projectPath = join(work, 'proj');
    mkdirSync(projectPath);
    const result = await applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    });

    expect(result.manifest.skills).toHaveLength(1);
    expect(['symlink', 'junction', 'copy']).toContain(result.method);
    const linked = join(projectPath, '.claude', 'skills', 'alpha');
    const linkedStat = await stat(linked);
    expect(linkedStat.isDirectory()).toBe(true);
    const readManifest = JSON.parse(await readFile(join(projectPath, '.claude', 'skill-manager.json'), 'utf8')) as Manifest;
    expect(readManifest.skills[0]!.id).toBe('id1');
  });

  it('unapplies removes link and updates manifest', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');

    const projectPath = join(work, 'proj');
    mkdirSync(projectPath);
    const applied = await applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    });

    await unapplySkills({ projectPath, manifest: applied.manifest });
    const linked = join(projectPath, '.claude', 'skills', 'alpha');
    await expect(stat(linked)).rejects.toThrow();
  });

  it('refuses to overwrite non-managed existing target', async () => {
    const skillDir = join(skillRoot, 'alpha');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: d\n---\n');
    const projectPath = join(work, 'proj');
    mkdirSync(join(projectPath, '.claude', 'skills', 'alpha'), { recursive: true });
    writeFileSync(join(projectPath, '.claude', 'skills', 'alpha', 'HAND-WRITTEN.md'), 'do not delete');

    await expect(applySkills({
      projectPath,
      desiredSkills: [makeSkill('id1', 'alpha', skillDir)],
      currentManifest: null,
    })).rejects.toThrow(/not managed/);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm install
pnpm --filter @skill-manager/server test
```
Expected: 3 new link tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server
git commit -m "feat(server): add link engine with junction/copy fallback and transaction rollback"
```

---

### Task 12: Manifest + Rules read endpoints

**Files:**
- Create: `packages/server/src/services/manifest.ts`
- Modify: `packages/server/src/routes/projects.ts` (add manifest read endpoint)
- Create: `packages/server/test/manifest.test.ts`

- [ ] **Step 1: Create `packages/server/src/services/manifest.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MANIFEST_FILENAME,
  PROJECT_CLAUDE_DIR,
  ManifestSchema,
  type Manifest,
} from '@skill-manager/shared';

export async function readManifest(projectPath: string): Promise<Manifest | null> {
  const file = join(projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
  try {
    const raw = await readFile(file, 'utf8');
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
```

- [ ] **Step 2: Extend `packages/server/src/routes/projects.ts`** to add manifest read

Append to the file, before the closing of `projectsRoutes`:

```ts
  app.get<{ Params: { id: string } }>('/api/projects/:id/manifest', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const manifest = await (await import('../services/manifest.js')).readManifest(project.path);
    return { ok: true as const, data: { manifest } };
  });
```

- [ ] **Step 3: Write failing test `packages/server/test/manifest.test.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: 2 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add manifest reader service and /manifest endpoint"
```

---

### Task 13: Apply / Unapply / Diff-preview endpoints

**Files:**
- Modify: `packages/server/src/routes/projects.ts`
- Create: `packages/server/src/services/apply-helpers.ts`
- Modify: `packages/server/package.json` (add `async-mutex`)
- Create: `packages/server/test/apply-route.test.ts`

- [ ] **Step 1: Add dependency `async-mutex`**

Edit `packages/server/package.json` dependencies:

```json
"async-mutex": "0.5.0"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/services/apply-helpers.ts`**

```ts
import { Mutex } from 'async-mutex';
import { scanSkills } from './scanner.js';
import { readManifest } from './manifest.js';
import { applySkills, unapplySkills } from './link.js';
import type { CenterDbStore } from '../storage/center-db.js';
import type { Skill, DiffPreview, ManifestEntry } from '@skill-manager/shared';

const locks = new Map<string, Mutex>();

export function getLock(projectId: string): Mutex {
  let m = locks.get(projectId);
  if (!m) { m = new Mutex(); locks.set(projectId, m); }
  return m;
}

export async function resolveSkills(db: CenterDbStore, cachePath: string | undefined, ids: string[]): Promise<{ found: Skill[]; missing: string[] }> {
  const { skills } = await scanSkills({ scanPaths: db.data.scanPaths, cachePath });
  const byId = new Map(skills.map(s => [s.id, s]));
  const found: Skill[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const s = byId.get(id);
    if (s) found.push(s); else missing.push(id);
  }
  return { found, missing };
}

export async function computeDiff(opts: {
  db: CenterDbStore;
  cachePath?: string;
  projectPath: string;
  desiredIds: string[];
}): Promise<DiffPreview & { missing: string[] }> {
  const { found, missing } = await resolveSkills(opts.db, opts.cachePath, opts.desiredIds);
  const manifest = await readManifest(opts.projectPath);
  const currentIds = new Set((manifest?.skills ?? []).map(s => s.id));
  const desiredIds = new Set(found.map(s => s.id));
  return {
    toAdd: found.filter(s => !currentIds.has(s.id)),
    toKeep: found.filter(s => currentIds.has(s.id)),
    toRemove: (manifest?.skills ?? []).filter(e => !desiredIds.has(e.id)) as ManifestEntry[],
    missing,
  };
}

export { applySkills, unapplySkills };
```

- [ ] **Step 3: Extend `packages/server/src/routes/projects.ts`**

Replace the export block so the whole file becomes:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';
import { applySkills, unapplySkills, computeDiff, resolveSkills, getLock } from '../services/apply-helpers.js';
import { readManifest } from '../services/manifest.js';

const AddBody = z.object({ path: z.string().min(1), name: z.string().optional(), notes: z.string().optional() });
const PatchBody = z.object({ name: z.string().optional(), path: z.string().optional(), notes: z.string().optional() });
const ApplyBody = z.object({ skillIds: z.array(z.string()).min(1) });
const UnapplyBody = z.object({ skillIds: z.array(z.string()).optional() });
const DiffBody = z.object({ skillIds: z.array(z.string()) });

export const projectsRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.get('/api/projects', async () => ({ ok: true as const, data: await svc.list() }));

  app.post('/api/projects', async (req) => {
    const body = AddBody.parse(req.body);
    const project = await svc.add(body);
    return { ok: true as const, data: project };
  });

  app.patch<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    const body = PatchBody.parse(req.body);
    return { ok: true as const, data: await svc.update(req.params.id, body) };
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (req) => {
    await svc.remove(req.params.id);
    return { ok: true as const, data: { id: req.params.id } };
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/manifest', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    return { ok: true as const, data: { manifest: await readManifest(project.path) } };
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/diff-preview', async (req, reply) => {
    const body = DiffBody.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const diff = await computeDiff({ db: deps.db, cachePath: deps.cachePath, projectPath: project.path, desiredIds: body.skillIds });
    return { ok: true as const, data: diff };
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/apply', async (req, reply) => {
    const body = ApplyBody.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const lock = getLock(project.id);
    return lock.runExclusive(async () => {
      const { found, missing } = await resolveSkills(deps.db, deps.cachePath, body.skillIds);
      if (missing.length > 0) {
        reply.status(400);
        return { ok: false as const, error: { code: 'UNKNOWN_SKILLS', message: `Unknown skill IDs: ${missing.join(', ')}` } };
      }
      const current = await readManifest(project.path);
      const result = await applySkills({ projectPath: project.path, desiredSkills: found, currentManifest: current });
      await svc.update(project.id, {});
      deps.db.data.projects = deps.db.data.projects.map(p => p.id === project.id ? { ...p, lastSyncedAt: new Date().toISOString() } : p);
      await deps.db.write();
      return { ok: true as const, data: result };
    });
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/unapply', async (req, reply) => {
    const body = UnapplyBody.parse(req.body ?? {});
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const manifest = await readManifest(project.path);
    if (!manifest) return { ok: true as const, data: { removed: [], remaining: null } };
    const lock = getLock(project.id);
    return lock.runExclusive(async () => {
      const result = await unapplySkills({ projectPath: project.path, manifest, skillIds: body.skillIds });
      return { ok: true as const, data: result };
    });
  });
};
```

- [ ] **Step 4: Write failing test `packages/server/test/apply-route.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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
```

- [ ] **Step 5: Update `packages/server/src/app.ts`** to pass `cachePath` to `projectsRoutes`

Find:
```ts
await app.register(projectsRoutes({ db }));
```
Replace with:
```ts
await app.register(projectsRoutes({ db, cachePath: opts.cachePath }));
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/server
git commit -m "feat(server): add apply/unapply/diff-preview endpoints with per-project lock"
```

---

## Phase D — Explicit selection UI (MVP end)

### Task 14: Projects API client hooks

**Files:**
- Create: `packages/web/src/api/projects.ts`
- Create: `packages/web/src/components/DiffPreview.tsx`

- [ ] **Step 1: Create `packages/web/src/api/projects.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Project, Manifest, DiffPreview } from '@skill-manager/shared';

export type ProjectWithStatus = Project & { status: 'ok' | 'broken' };

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<ProjectWithStatus[]>('/api/projects'),
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { path: string; name?: string; notes?: string }) =>
      apiFetch<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
}

export function useRemoveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); },
  });
}

export function useManifest(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ['manifest', projectId],
    queryFn: () => apiFetch<{ manifest: Manifest | null }>(`/api/projects/${projectId}/manifest`),
  });
}

export function useDiffPreview() {
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds: string[] }) =>
      apiFetch<DiffPreview & { missing: string[] }>(`/api/projects/${input.projectId}/diff-preview`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
  });
}

export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds: string[] }) =>
      apiFetch<{ manifest: Manifest; method: string }>(`/api/projects/${input.projectId}/apply`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['manifest', v.projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUnapply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; skillIds?: string[] }) =>
      apiFetch<{ removed: unknown[] }>(`/api/projects/${input.projectId}/unapply`, {
        method: 'POST', body: JSON.stringify({ skillIds: input.skillIds }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['manifest', v.projectId] });
    },
  });
}
```

- [ ] **Step 2: Create `packages/web/src/components/DiffPreview.tsx`**

```tsx
import type { DiffPreview as DP, ManifestEntry, Skill } from '@skill-manager/shared';
import { Badge } from '@/components/ui/badge';

export function DiffPreview({ diff }: { diff: DP & { missing?: string[] } }) {
  const Section = ({ title, color, items, render }: {
    title: string; color: 'success' | 'destructive' | 'secondary';
    items: Array<Skill | ManifestEntry>;
    render: (x: Skill | ManifestEntry) => string;
  }) => (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Badge variant={color}>{title}</Badge>
        <span className="text-xs text-neutral-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-400 italic">none</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map(x => <li key={(x as { id: string }).id}>{render(x)}</li>)}
        </ul>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Section title="Add" color="success" items={diff.toAdd} render={(s) => (s as Skill).name} />
      <Section title="Keep" color="secondary" items={diff.toKeep} render={(s) => (s as Skill).name} />
      <Section title="Remove" color="destructive" items={diff.toRemove} render={(e) => (e as ManifestEntry).name} />
    </div>
  );
}
```

- [ ] **Step 3: Smoke typecheck**

```bash
pnpm --filter @skill-manager/web typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web
git commit -m "feat(web): add project api hooks and diff preview component"
```

---

### Task 15: Projects list page + Add-project dialog

**Files:**
- Create: `packages/web/src/components/ui/dialog.tsx`
- Create: `packages/web/src/pages/ProjectsPage.tsx`
- Modify: `packages/web/src/App.tsx` (wire route)
- Modify: `packages/web/package.json` (add `@radix-ui/react-dialog`)

- [ ] **Step 1: Add dependency**

Edit `packages/web/package.json` dependencies:
```json
"@radix-ui/react-dialog": "1.1.2"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/web/src/components/ui/dialog.tsx`**

```tsx
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex flex-col space-y-1.5', className)} {...props} />;
}
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
```

- [ ] **Step 3: Create `packages/web/src/pages/ProjectsPage.tsx`**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAddProject, useProjects, useRemoveProject } from '@/api/projects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';

export function ProjectsPage() {
  const { data, isLoading } = useProjects();
  const addMut = useAddProject();
  const removeMut = useRemoveProject();
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleAdd() {
    try {
      setErr(null);
      await addMut.mutateAsync({ path: path.trim(), name: name.trim() || undefined });
      setPath(''); setName(''); setOpen(false);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projects ({data?.length ?? 0})</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a project</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <label className="block text-sm">
                <span>Path (absolute)</span>
                <Input value={path} onChange={e => setPath(e.target.value)} placeholder="C:/path/to/project" />
              </label>
              <label className="block text-sm">
                <span>Name (optional)</span>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to directory name" />
              </label>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex justify-end gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleAdd} disabled={addMut.isPending || path.trim().length === 0}>
                  {addMut.isPending ? 'Adding...' : 'Add'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
      {data?.length === 0 && !isLoading && (
        <p className="text-sm text-neutral-500">No projects yet. Click "+ Add Project" to get started.</p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>
                  <Link to={`/projects/${p.id}`} className="hover:underline">{p.name}</Link>
                </CardTitle>
                <Badge variant={p.status === 'ok' ? 'success' : 'destructive'}>{p.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-neutral-500">
              <p className="truncate" title={p.path}>{p.path}</p>
              {p.lastSyncedAt && <p>Last synced: {new Date(p.lastSyncedAt).toLocaleString()}</p>}
              <div className="pt-2">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm(`Remove "${p.name}" from the list? Files in the project directory are not deleted.`)) removeMut.mutate(p.id); }}
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `packages/web/src/App.tsx`** — replace the Projects placeholder

Replace:
```tsx
<Route path="/" element={<div>Projects (Task 15)</div>} />
```
With:
```tsx
<Route path="/" element={<ProjectsPage />} />
```

And add the import at the top:
```tsx
import { ProjectsPage } from './pages/ProjectsPage';
```

- [ ] **Step 5: Smoke test**

Start server + web in two terminals; visit `/`. Create a project pointing at some temp directory. Verify the card shows up with status=ok. Remove it.

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(web): add projects list page with add dialog and remove action"
```

---

### Task 16: Project detail page — Applied + Add tabs

**Files:**
- Create: `packages/web/src/components/ui/tabs.tsx`
- Create: `packages/web/src/pages/ProjectDetailPage.tsx`
- Modify: `packages/web/src/App.tsx` (add route)
- Modify: `packages/web/package.json` (add `@radix-ui/react-tabs`)

- [ ] **Step 1: Add dependency `@radix-ui/react-tabs`**

```json
"@radix-ui/react-tabs": "1.1.1"
```
Then: `pnpm install`

- [ ] **Step 2: Create `packages/web/src/components/ui/tabs.tsx`**

```tsx
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex items-center justify-center rounded-md bg-neutral-100 p-1 text-neutral-500 dark:bg-neutral-800', className)}
      {...props}
    />
  );
}
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-neutral-900 dark:data-[state=active]:bg-neutral-950 dark:data-[state=active]:text-neutral-100',
        className,
      )}
      {...props}
    />
  );
}
export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4', className)} {...props} />;
}
```

- [ ] **Step 3: Create `packages/web/src/pages/ProjectDetailPage.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import { useSkills } from '@/api/skills';
import { useProjects, useManifest, useDiffPreview, useApply, useUnapply } from '@/api/projects';
import type { Skill } from '@skill-manager/shared';

function group(skills: Skill[]): Record<string, Skill[]> {
  const out: Record<string, Skill[]> = {};
  for (const s of skills) {
    const k = s.source === 'plugin' ? `plugin · ${s.pluginName ?? '(unknown)'}` : s.source;
    (out[k] ??= []).push(s);
  }
  return out;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: projects } = useProjects();
  const project = projects?.find(p => p.id === id);
  const { data: manifestRes } = useManifest(id);
  const { data: skillsRes } = useSkills();
  const diffMut = useDiffPreview();
  const applyMut = useApply();
  const unapplyMut = useUnapply();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [diffOpen, setDiffOpen] = useState(false);

  const manifest = manifestRes?.manifest ?? null;
  const appliedIds = new Set((manifest?.skills ?? []).map(s => s.id));

  const filteredSkills = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (skillsRes?.skills ?? []).filter(s =>
      !needle || s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle),
    );
  }, [skillsRes, q]);

  const groups = useMemo(() => group(filteredSkills), [filteredSkills]);

  function toggle(idS: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idS)) next.delete(idS); else next.add(idS);
      return next;
    });
  }

  async function previewApply() {
    if (!id) return;
    // Combine already-applied with newly selected; user can also uncheck applied to remove
    const desiredIds = Array.from(new Set([
      ...selected,
      ...Array.from(appliedIds).filter(aid => !selected.has(`__remove__${aid}`)),
    ]));
    await diffMut.mutateAsync({ projectId: id, skillIds: desiredIds });
    setDiffOpen(true);
  }

  async function confirmApply() {
    if (!id || !diffMut.data) return;
    const desired = new Set<string>();
    for (const s of diffMut.data.toAdd) desired.add(s.id);
    for (const s of diffMut.data.toKeep) desired.add(s.id);
    await applyMut.mutateAsync({ projectId: id, skillIds: Array.from(desired) });
    setDiffOpen(false);
    setSelected(new Set());
  }

  if (!project) return <p className="text-sm text-neutral-500">Loading project...</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/" className="text-xs text-neutral-500 hover:underline">← Back to projects</Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{project.name}</h2>
            <p className="text-xs text-neutral-500">{project.path}</p>
          </div>
          <Badge variant={manifest?.method === 'copy' ? 'outline' : 'secondary'}>
            {manifest ? `method: ${manifest.method}` : 'not initialized'}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="applied">
        <TabsList>
          <TabsTrigger value="applied">Applied ({manifest?.skills.length ?? 0})</TabsTrigger>
          <TabsTrigger value="add">Add skills</TabsTrigger>
        </TabsList>

        <TabsContent value="applied">
          {manifest?.skills.length ? (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500 dark:bg-neutral-800">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Linked as</th>
                      <th className="p-3">Source dir</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.skills.map(s => (
                      <tr key={s.id} className="border-t dark:border-neutral-800">
                        <td className="p-3 font-medium">{s.name}</td>
                        <td className="p-3 font-mono text-xs text-neutral-500">{s.linkedAs}</td>
                        <td className="p-3 font-mono text-xs text-neutral-500" title={s.sourceDir}>{s.sourceDir}</td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { if (confirm(`Remove "${s.name}"?`) && id) unapplyMut.mutate({ projectId: id, skillIds: [s.id] }); }}
                          >Remove</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-neutral-500">No skills applied yet. Use the "Add skills" tab.</p>
          )}
        </TabsContent>

        <TabsContent value="add">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Input placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} className="w-80" />
              <Button onClick={previewApply} disabled={selected.size === 0 || diffMut.isPending}>
                {diffMut.isPending ? 'Computing diff...' : `Preview (${selected.size})`}
              </Button>
            </div>
            {Object.entries(groups).map(([key, skills]) => (
              <section key={key} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{key} ({skills.length})</h3>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {skills.map(s => {
                    const applied = appliedIds.has(s.id);
                    const checked = selected.has(s.id) || applied;
                    return (
                      <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm dark:border-neutral-800">
                        <input
                          type="checkbox" className="mt-1"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          disabled={applied}
                        />
                        <div>
                          <div className="font-medium">{s.name} {applied && <span className="text-xs text-neutral-400">(applied)</span>}</div>
                          <div className="line-clamp-2 text-xs text-neutral-500">{s.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review changes</DialogTitle>
          </DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          {diffMut.data?.missing && diffMut.data.missing.length > 0 && (
            <p className="mt-3 text-xs text-red-600">Unknown skill ids: {diffMut.data.missing.join(', ')}</p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Update `packages/web/src/App.tsx`** — add route

Add import:
```tsx
import { ProjectDetailPage } from './pages/ProjectDetailPage';
```

Add route inside `<Routes>`:
```tsx
<Route path="/projects/:id" element={<ProjectDetailPage />} />
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @skill-manager/web typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Manual smoke — full MVP loop**

Terminal 1: `NO_OPEN=1 pnpm --filter @skill-manager/server start`
Terminal 2: `pnpm --filter @skill-manager/web dev`

In browser:
1. Go to `/`, add a project pointing to an empty temp directory
2. Click into the project, switch to "Add skills"
3. Select 2-3 skills, click "Preview (N)"
4. In the diff dialog, click "Apply"
5. Switch to "Applied" tab, verify skills appear
6. In the temp directory, verify `.claude/skills/<name>/` exists as a link and `.claude/skill-manager.json` exists

- [ ] **Step 7: Commit**

```bash
git add packages/web
git commit -m "feat(web): add project detail page with applied + add-skills tabs and diff dialog"
```

**MVP checkpoint reached**: Display + manual selection mode is fully functional end-to-end.

---

## Phase E — Rules + AI recommendation

### Task 17: RuleService (yaml read/write)

**Files:**
- Create: `packages/server/src/services/rule.ts`
- Modify: `packages/server/src/routes/projects.ts` (add rules GET/PUT)
- Create: `packages/server/test/rule.test.ts`
- Modify: `packages/server/package.json` (add `js-yaml`)

- [ ] **Step 1: Add dependencies**

Edit `packages/server/package.json`:
```json
"js-yaml": "4.1.0"
```
devDependencies:
```json
"@types/js-yaml": "4.0.9"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/services/rule.ts`**

```ts
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  RULES_FILENAME,
  PROJECT_CLAUDE_DIR,
  RuleFileSchema,
  type RuleFile,
} from '@skill-manager/shared';
import { atomicWriteFile } from '../utils/fs-safe.js';

export async function readRules(projectPath: string): Promise<RuleFile | null> {
  const file = join(projectPath, PROJECT_CLAUDE_DIR, RULES_FILENAME);
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = yaml.load(raw);
    return RuleFileSchema.parse(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeRules(projectPath: string, rules: RuleFile): Promise<void> {
  const validated = RuleFileSchema.parse(rules);
  const file = join(projectPath, PROJECT_CLAUDE_DIR, RULES_FILENAME);
  const yml = yaml.dump(validated, { lineWidth: 120, noRefs: true });
  await atomicWriteFile(file, yml);
}
```

- [ ] **Step 3: Extend `packages/server/src/routes/projects.ts`** — add two endpoints

Add imports at top:
```ts
import { readRules, writeRules } from '../services/rule.js';
import { RuleFileSchema } from '@skill-manager/shared';
```

Inside the plugin function (before the closing brace), add:

```ts
  app.get<{ Params: { id: string } }>('/api/projects/:id/rules', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const rules = await readRules(project.path);
    return { ok: true as const, data: { rules } };
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id/rules', async (req, reply) => {
    const rules = RuleFileSchema.parse(req.body);
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    await writeRules(project.path, rules);
    return { ok: true as const, data: { rules } };
  });
```

- [ ] **Step 4: Write failing test `packages/server/test/rule.test.ts`**

```ts
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
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: 2 new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server
git commit -m "feat(server): add rules service with yaml read/write and zod validation"
```

---

### Task 18: AiService — OpenAI + Anthropic styles with retry

**Files:**
- Create: `packages/server/src/services/ai.ts`
- Create: `packages/server/test/ai.test.ts`
- Modify: `packages/server/package.json` (add `msw` devDep)

- [ ] **Step 1: Add `msw` devDependency**

Edit `packages/server/package.json` devDependencies:
```json
"msw": "2.4.9"
```

Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/services/ai.ts`**

```ts
import type { AiConfig, Skill } from '@skill-manager/shared';

export interface RecommendInput {
  projectHint: string;
  includes: string[];
  excludes: string[];
  keywords: string[];
  aiGuidance?: string;
  skills: Skill[];
}

export interface RecommendResult {
  picks: Array<{ skill: Skill; reason: string }>;
  warnings: string[];
  rawResponse: string;
}

export const DEFAULT_SYSTEM_PROMPT = `你是 Claude Code 技能选择顾问。给定候选技能清单和项目信息，
挑选最相关的技能子集。严格按 JSON 输出：
{ "picks": [ { "id": "<Skill.id>", "reason": "<为什么选它>" } ] }
必须遵守规则：
- includes 列出的技能必须全部返回
- excludes 列出的技能绝不返回
- 其它技能根据项目描述和 aiGuidance 评估相关性
- 只输出 JSON，不要任何额外文本`;

function buildUserPrompt(input: RecommendInput): string {
  const lines: string[] = [];
  lines.push(`项目描述：${input.projectHint}`);
  lines.push(`关键词：${input.keywords.join(', ') || '无'}`);
  lines.push(`AI 指引：${input.aiGuidance || '无'}`);
  lines.push(`强制包含：${input.includes.join(', ') || '无'}`);
  lines.push(`强制排除：${input.excludes.join(', ') || '无'}`);
  lines.push('');
  lines.push(`候选技能（共 ${input.skills.length} 条）：`);
  for (const s of input.skills) {
    const srcTag = s.source === 'plugin' && s.pluginName ? `plugin/${s.pluginName}` : s.source;
    lines.push(`- id: ${s.id} | source: ${srcTag} | name: ${s.name} | description: ${s.description}`);
  }
  return lines.join('\n');
}

function resolveApiKey(config: AiConfig): string | undefined {
  if (config.apiKeyEnv && process.env[config.apiKeyEnv]) return process.env[config.apiKeyEnv];
  return config.apiKey;
}

interface RawCall {
  endpoint: string;
  headers: Record<string, string>;
  body: string;
}

function buildRequest(config: AiConfig, systemPrompt: string, userPrompt: string): RawCall {
  const key = resolveApiKey(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(config.headers ?? {}) };
  let body: unknown;

  if (config.requestStyle === 'anthropic') {
    if (key) headers['x-api-key'] = key;
    headers['anthropic-version'] = headers['anthropic-version'] ?? '2023-06-01';
    body = {
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    };
  } else {
    if (key) headers['Authorization'] = `Bearer ${key}`;
    body = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    };
  }
  return { endpoint: config.endpoint, headers, body: JSON.stringify(body) };
}

function extractText(raw: unknown, style: 'openai' | 'anthropic'): string {
  if (style === 'anthropic') {
    const blocks = (raw as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    return blocks.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
  }
  const choices = (raw as { choices?: Array<{ message?: { content?: string } }> }).choices ?? [];
  return choices[0]?.message?.content ?? '';
}

function tryParsePicks(text: string): { picks: Array<{ id: string; reason: string }> } | null {
  try {
    const parsed = JSON.parse(text) as { picks?: Array<{ id: string; reason: string }> };
    if (Array.isArray(parsed.picks)) return { picks: parsed.picks };
  } catch { /* fall through */ }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]) as { picks?: Array<{ id: string; reason: string }> };
      if (Array.isArray(parsed.picks)) return { picks: parsed.picks };
    } catch { /* ignored */ }
  }
  return null;
}

export interface CallAiOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function recommendSkills(
  config: AiConfig,
  input: RecommendInput,
  options: CallAiOptions = {},
): Promise<RecommendResult> {
  const style = config.requestStyle ?? 'openai';
  const systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const warnings: string[] = [];

  async function callOnce(promptOverride?: string): Promise<{ text: string }> {
    const { endpoint, headers, body } = buildRequest(config, promptOverride ?? systemPrompt, userPrompt);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint, { method: 'POST', headers, body, signal: controller.signal });
      if (!res.ok) throw new Error(`AI endpoint responded ${res.status}: ${await res.text()}`);
      const raw = await res.json();
      return { text: extractText(raw, style) };
    } finally { clearTimeout(t); }
  }

  let attempt = await callOnce();
  let parsed = tryParsePicks(attempt.text);
  if (!parsed) {
    warnings.push('First response not parseable as JSON; retrying with stricter instruction.');
    attempt = await callOnce(`${systemPrompt}\n\n上次输出无法解析，必须严格只返回 JSON 对象，不要任何额外文本。`);
    parsed = tryParsePicks(attempt.text);
    if (!parsed) {
      return { picks: [], warnings: [...warnings, 'Second response also unparseable.'], rawResponse: attempt.text };
    }
  }

  const byId = new Map(input.skills.map(s => [s.id, s]));
  const result = new Map<string, { skill: Skill; reason: string }>();

  for (const pick of parsed.picks) {
    const skill = byId.get(pick.id);
    if (!skill) { warnings.push(`AI returned unknown id: ${pick.id}`); continue; }
    if (input.excludes.includes(pick.id) || input.excludes.includes(skill.name)) continue;
    result.set(skill.id, { skill, reason: pick.reason });
  }

  for (const inc of input.includes) {
    const skill = [...byId.values()].find(s => s.id === inc || s.name === inc);
    if (!skill) { warnings.push(`Included id/name not found in candidates: ${inc}`); continue; }
    if (!result.has(skill.id)) result.set(skill.id, { skill, reason: '(forced include)' });
  }

  return { picks: [...result.values()], warnings, rawResponse: attempt.text };
}

export async function testConnection(config: AiConfig, options: CallAiOptions = {}): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const start = Date.now();
  try {
    const { endpoint, headers, body } = buildRequest(
      config,
      'Reply with a single word: ok',
      'ping',
    );
    const res = await fetchImpl(endpoint, { method: 'POST', headers, body });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
    await res.json();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 3: Write failing test `packages/server/test/ai.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { recommendSkills } from '../src/services/ai.js';
import type { Skill, AiConfig } from '@skill-manager/shared';

function makeSkill(id: string, name: string): Skill {
  return {
    id, name, description: `${name} description`,
    source: 'user', sourceRoot: '/root', absolutePath: `/root/${name}/SKILL.md`,
    skillDir: `/root/${name}`, fingerprint: '1-1',
  };
}

const baseConfig: AiConfig = {
  endpoint: 'https://example.test/chat',
  model: 'test-model',
  requestStyle: 'openai',
};

describe('recommendSkills', () => {
  it('parses openai-style response and respects excludes/includes', async () => {
    const skills = [makeSkill('s1', 'alpha'), makeSkill('s2', 'beta'), makeSkill('s3', 'gamma')];
    const fake: typeof fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ picks: [
        { id: 's1', reason: 'useful' },
        { id: 's2', reason: 'also useful' },
      ] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });

    const result = await recommendSkills(baseConfig, {
      projectHint: 'demo', includes: ['s3'], excludes: ['s2'], keywords: [], skills,
    }, { fetchImpl: fake });

    const ids = result.picks.map(p => p.skill.id).sort();
    expect(ids).toEqual(['s1', 's3']);
  });

  it('retries on unparseable response', async () => {
    const skills = [makeSkill('s1', 'alpha')];
    let call = 0;
    const fake: typeof fetch = async () => {
      call++;
      const content = call === 1 ? 'definitely not json' : JSON.stringify({ picks: [{ id: 's1', reason: 'x' }] });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    };
    const result = await recommendSkills(baseConfig, {
      projectHint: 'demo', includes: [], excludes: [], keywords: [], skills,
    }, { fetchImpl: fake });
    expect(call).toBe(2);
    expect(result.picks).toHaveLength(1);
    expect(result.warnings[0]).toContain('not parseable');
  });

  it('handles anthropic-style response', async () => {
    const skills = [makeSkill('s1', 'alpha')];
    const fake: typeof fetch = async () => new Response(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ picks: [{ id: 's1', reason: 'good' }] }) }],
    }), { status: 200 });

    const result = await recommendSkills({ ...baseConfig, requestStyle: 'anthropic' }, {
      projectHint: 'demo', includes: [], excludes: [], keywords: [], skills,
    }, { fetchImpl: fake });
    expect(result.picks.map(p => p.skill.id)).toEqual(['s1']);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @skill-manager/server test
```
Expected: 3 new AI tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add ai service with openai/anthropic styles, retry, and validation"
```

---

### Task 19: AI + Settings endpoints

**Files:**
- Create: `packages/server/src/routes/ai.ts`
- Create: `packages/server/src/routes/settings.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create `packages/server/src/routes/ai.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { AiRecommendRequestSchema, AiConfigSchema } from '@skill-manager/shared';
import { recommendSkills, testConnection } from '../services/ai.js';
import { scanSkills } from '../services/scanner.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const aiRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  app.post('/api/ai/recommend', async (req, reply) => {
    const body = AiRecommendRequestSchema.parse(req.body);
    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI endpoint/model not configured in settings.' } };
    }
    const { skills } = await scanSkills({ scanPaths: deps.db.data.scanPaths, cachePath: deps.cachePath });
    const result = await recommendSkills(parsed.data, {
      projectHint: body.projectHint,
      includes: body.includes,
      excludes: body.excludes,
      keywords: body.keywords,
      aiGuidance: body.aiGuidance,
      skills,
    });
    return { ok: true as const, data: result };
  });

  app.post('/api/ai/test', async (req, reply) => {
    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI endpoint/model not configured.' } };
    }
    const result = await testConnection(parsed.data);
    return { ok: true as const, data: result };
  });
};
```

- [ ] **Step 2: Create `packages/server/src/routes/settings.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AiConfigSchema } from '@skill-manager/shared';
import type { CenterDbStore } from '../storage/center-db.js';

const SettingsBody = z.object({
  scanPaths: z.array(z.string()).optional(),
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
      ai: maskApiKey(deps.db.data.ai),
    },
  }));

  app.put('/api/settings', async (req) => {
    const body = SettingsBody.parse(req.body);
    if (body.scanPaths) deps.db.data.scanPaths = body.scanPaths;
    if (body.ai) deps.db.data.ai = { ...deps.db.data.ai, ...body.ai };
    await deps.db.write();
    return {
      ok: true as const,
      data: {
        scanPaths: deps.db.data.scanPaths,
        ai: maskApiKey(deps.db.data.ai),
      },
    };
  });
};
```

- [ ] **Step 3: Register routes in `packages/server/src/app.ts`**

Add imports:
```ts
import { aiRoutes } from './routes/ai.js';
import { settingsRoutes } from './routes/settings.js';
```

And register after the others:
```ts
await app.register(aiRoutes({ db, cachePath: opts.cachePath }));
await app.register(settingsRoutes({ db }));
```

- [ ] **Step 4: Manual smoke**

```bash
pnpm --filter @skill-manager/server typecheck
pnpm --filter @skill-manager/server test
```
Expected: compiles; existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add ai and settings endpoints"
```

---

### Task 20: AI Recommend tab in Project Detail

**Files:**
- Create: `packages/web/src/api/ai.ts`
- Create: `packages/web/src/api/rules.ts`
- Create: `packages/web/src/components/AiRecommendPanel.tsx`
- Modify: `packages/web/src/pages/ProjectDetailPage.tsx` (add tab)
- Modify: `packages/web/src/components/ui/tabs.tsx` (no change; reuse)

- [ ] **Step 1: Create `packages/web/src/api/ai.ts`**

```ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { Skill } from '@skill-manager/shared';

export interface AiRecommendResponse {
  picks: Array<{ skill: Skill; reason: string }>;
  warnings: string[];
  rawResponse: string;
}

export function useRecommend() {
  return useMutation({
    mutationFn: (input: {
      projectId: string; projectHint: string;
      includes: string[]; excludes: string[]; keywords: string[]; aiGuidance?: string;
    }) => apiFetch<AiRecommendResponse>('/api/ai/recommend', {
      method: 'POST', body: JSON.stringify(input),
    }),
  });
}
```

- [ ] **Step 2: Create `packages/web/src/api/rules.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { RuleFile } from '@skill-manager/shared';

export function useRules(projectId: string | undefined) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ['rules', projectId],
    queryFn: () => apiFetch<{ rules: RuleFile | null }>(`/api/projects/${projectId}/rules`),
  });
}

export function useSaveRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; rules: RuleFile }) =>
      apiFetch<{ rules: RuleFile }>(`/api/projects/${input.projectId}/rules`, {
        method: 'PUT', body: JSON.stringify(input.rules),
      }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['rules', v.projectId] }); },
  });
}
```

- [ ] **Step 3: Create `packages/web/src/components/AiRecommendPanel.tsx`**

```tsx
import { useState } from 'react';
import { useRecommend } from '@/api/ai';
import { useSaveRules } from '@/api/rules';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import type { RuleFile } from '@skill-manager/shared';

export function AiRecommendPanel({ projectId, initialRules }: { projectId: string; initialRules: RuleFile | null }) {
  const [projectHint, setProjectHint] = useState(initialRules?.projectHint ?? '');
  const [includesText, setIncludesText] = useState((initialRules?.includes ?? []).join(', '));
  const [excludesText, setExcludesText] = useState((initialRules?.excludes ?? []).join(', '));
  const [keywordsText, setKeywordsText] = useState((initialRules?.keywords ?? []).join(', '));
  const [aiGuidance, setAiGuidance] = useState(initialRules?.aiGuidance ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffOpen, setDiffOpen] = useState(false);

  const recommend = useRecommend();
  const saveRules = useSaveRules();
  const diffMut = useDiffPreview();
  const applyMut = useApply();

  const toList = (s: string): string[] => s.split(',').map(x => x.trim()).filter(Boolean);

  async function runRecommend() {
    const data = await recommend.mutateAsync({
      projectId,
      projectHint,
      includes: toList(includesText),
      excludes: toList(excludesText),
      keywords: toList(keywordsText),
      aiGuidance: aiGuidance || undefined,
    });
    setSelectedIds(new Set(data.picks.map(p => p.skill.id)));
  }

  function togglePick(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveAndPreview() {
    const rules: RuleFile = {
      version: 1,
      projectHint,
      includes: toList(includesText),
      excludes: toList(excludesText),
      keywords: toList(keywordsText),
      aiGuidance: aiGuidance || undefined,
      lastAppliedSkills: Array.from(selectedIds),
    };
    await saveRules.mutateAsync({ projectId, rules });
    await diffMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
    setDiffOpen(true);
  }

  async function confirmApply() {
    await applyMut.mutateAsync({ projectId, skillIds: Array.from(selectedIds) });
    setDiffOpen(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Project hint</span>
          <textarea
            className="mt-1 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            rows={3} value={projectHint} onChange={e => setProjectHint(e.target.value)}
            placeholder="Full-stack React + Supabase app with auth and billing."
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Keywords (comma-separated)</span>
          <Input value={keywordsText} onChange={e => setKeywordsText(e.target.value)} placeholder="react, supabase, auth" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Includes (skill ids or names)</span>
          <Input value={includesText} onChange={e => setIncludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Excludes</span>
          <Input value={excludesText} onChange={e => setExcludesText(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">AI guidance</span>
          <textarea
            className="mt-1 w-full rounded border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            rows={3} value={aiGuidance} onChange={e => setAiGuidance(e.target.value)}
            placeholder="Prefer skills focused on testing and debugging."
          />
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={runRecommend} disabled={recommend.isPending || projectHint.trim().length === 0}>
            {recommend.isPending ? 'Generating...' : 'Generate recommendations'}
          </Button>
          <Button variant="outline" onClick={saveAndPreview} disabled={selectedIds.size === 0}>
            Save rules & preview apply
          </Button>
        </div>
        {recommend.error && <p className="text-xs text-red-600">{(recommend.error as Error).message}</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recommendations ({recommend.data?.picks.length ?? 0})</h3>
        {recommend.data?.warnings.length ? (
          <div className="mb-2 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 dark:bg-yellow-950/40">
            {recommend.data.warnings.join(' · ')}
          </div>
        ) : null}
        <div className="space-y-2">
          {recommend.data?.picks.map(p => (
            <label key={p.skill.id} className="flex cursor-pointer items-start gap-2 rounded border p-2 text-sm dark:border-neutral-800">
              <input type="checkbox" className="mt-1" checked={selectedIds.has(p.skill.id)} onChange={() => togglePick(p.skill.id)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.skill.name}</span>
                  <Badge variant="outline">{p.skill.pluginName ?? p.skill.source}</Badge>
                </div>
                <p className="text-xs text-neutral-500">{p.skill.description}</p>
                <p className="mt-1 text-xs italic text-neutral-600 dark:text-neutral-400">Why: {p.reason}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review changes</DialogTitle></DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Update `packages/web/src/pages/ProjectDetailPage.tsx`** — add AI tab

Add imports at top:
```tsx
import { AiRecommendPanel } from '@/components/AiRecommendPanel';
import { useRules } from '@/api/rules';
```

Inside the component, get rules:
```tsx
const { data: rulesRes } = useRules(id);
```

In `<TabsList>`, add after "Add skills":
```tsx
<TabsTrigger value="ai">AI recommend</TabsTrigger>
```

Add a new `<TabsContent>` block after the existing ones:
```tsx
<TabsContent value="ai">
  {id && <AiRecommendPanel projectId={id} initialRules={rulesRes?.rules ?? null} />}
</TabsContent>
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @skill-manager/web typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(web): add ai recommend tab with rules persistence"
```

---

### Task 21: Rules & Sync tab (monaco editor + sync flow)

**Files:**
- Modify: `packages/web/package.json` (add `@monaco-editor/react`)
- Create: `packages/web/src/components/RulesEditor.tsx`
- Create: `packages/server/src/routes/sync.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/web/src/pages/ProjectDetailPage.tsx` (add tab)

- [ ] **Step 1: Add dependency `@monaco-editor/react`**

Edit `packages/web/package.json`:
```json
"@monaco-editor/react": "4.6.0"
```
Then: `pnpm install`

- [ ] **Step 2: Create `packages/server/src/routes/sync.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { readRules } from '../services/rule.js';
import { recommendSkills } from '../services/ai.js';
import { scanSkills } from '../services/scanner.js';
import { computeDiff } from '../services/apply-helpers.js';
import { AiConfigSchema } from '@skill-manager/shared';
import { ProjectService } from '../services/project.js';
import type { CenterDbStore } from '../storage/center-db.js';

export const syncRoutes = (deps: { db: CenterDbStore; cachePath?: string }): FastifyPluginAsync => async (app) => {
  const svc = new ProjectService(deps.db);

  app.post<{ Params: { id: string } }>('/api/projects/:id/sync', async (req, reply) => {
    const project = await svc.get(req.params.id);
    if (!project) { reply.status(404); return { ok: false as const, error: { code: 'NOT_FOUND', message: 'Project not found' } }; }
    const rules = await readRules(project.path);
    if (!rules) { reply.status(400); return { ok: false as const, error: { code: 'NO_RULES', message: 'rules.yaml not found' } }; }

    const parsed = AiConfigSchema.safeParse(deps.db.data.ai);
    if (!parsed.success) { reply.status(400); return { ok: false as const, error: { code: 'AI_NOT_CONFIGURED', message: 'AI config missing' } }; }

    const { skills } = await scanSkills({ scanPaths: deps.db.data.scanPaths, cachePath: deps.cachePath });
    const rec = await recommendSkills(parsed.data, {
      projectHint: rules.projectHint,
      includes: rules.includes,
      excludes: rules.excludes,
      keywords: rules.keywords,
      aiGuidance: rules.aiGuidance,
      skills,
    });
    const desiredIds = rec.picks.map(p => p.skill.id);
    const diff = await computeDiff({ db: deps.db, cachePath: deps.cachePath, projectPath: project.path, desiredIds });
    return { ok: true as const, data: { picks: rec.picks, diff, warnings: rec.warnings, desiredIds } };
  });
};
```

- [ ] **Step 3: Register route in `packages/server/src/app.ts`**

Add import:
```ts
import { syncRoutes } from './routes/sync.js';
```
Register:
```ts
await app.register(syncRoutes({ db, cachePath: opts.cachePath }));
```

- [ ] **Step 4: Create `packages/web/src/components/RulesEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useRules, useSaveRules } from '@/api/rules';
import { apiFetch } from '@/api/client';
import { useApply, useDiffPreview } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { DiffPreview } from '@/components/DiffPreview';
import type { RuleFile, Skill, DiffPreview as DP } from '@skill-manager/shared';

interface SyncResponse {
  picks: Array<{ skill: Skill; reason: string }>;
  diff: DP & { missing: string[] };
  warnings: string[];
  desiredIds: string[];
}

function toYaml(rules: RuleFile | null): string {
  if (!rules) {
    return `version: 1
projectHint: ""
includes: []
excludes: []
keywords: []
aiGuidance: ""
`;
  }
  const out: string[] = [];
  out.push(`version: 1`);
  out.push(`projectHint: ${JSON.stringify(rules.projectHint ?? '')}`);
  out.push(`includes:`);
  (rules.includes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  out.push(`excludes:`);
  (rules.excludes ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  out.push(`keywords:`);
  (rules.keywords ?? []).forEach(x => out.push(`  - ${JSON.stringify(x)}`));
  if (rules.aiGuidance) out.push(`aiGuidance: ${JSON.stringify(rules.aiGuidance)}`);
  return out.join('\n');
}

export function RulesEditor({ projectId }: { projectId: string }) {
  const { data: rulesRes } = useRules(projectId);
  const [text, setText] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const saveMut = useSaveRules();
  const diffMut = useDiffPreview();
  const applyMut = useApply();

  useEffect(() => { setText(toYaml(rulesRes?.rules ?? null)); }, [rulesRes]);

  async function save() {
    setErr(null);
    try {
      const yaml = (await import('js-yaml')).default;
      const parsed = yaml.load(text) as RuleFile;
      await saveMut.mutateAsync({ projectId, rules: parsed });
    } catch (e) { setErr((e as Error).message); }
  }

  async function runSync() {
    setErr(null);
    try {
      const data = await apiFetch<SyncResponse>(`/api/projects/${projectId}/sync`, { method: 'POST' });
      setSyncResult(data);
      await diffMut.mutateAsync({ projectId, skillIds: data.desiredIds });
      setDiffOpen(true);
    } catch (e) { setErr((e as Error).message); }
  }

  async function confirmApply() {
    if (!syncResult) return;
    await applyMut.mutateAsync({ projectId, skillIds: syncResult.desiredIds });
    setDiffOpen(false);
  }

  return (
    <div className="space-y-3">
      <div className="h-96 overflow-hidden rounded border dark:border-neutral-800">
        <Editor
          language="yaml"
          theme="vs-dark"
          value={text}
          onChange={(v) => setText(v ?? '')}
          options={{ minimap: { enabled: false }, fontSize: 13 }}
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Saving...' : 'Save rules'}
        </Button>
        <Button variant="outline" onClick={runSync}>
          Sync by rules
        </Button>
      </div>

      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sync preview</DialogTitle></DialogHeader>
          {diffMut.data && <DiffPreview diff={diffMut.data} />}
          {syncResult?.warnings.length ? (
            <div className="mt-2 rounded border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900 dark:bg-yellow-950/40">
              {syncResult.warnings.join(' · ')}
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={confirmApply} disabled={applyMut.isPending}>
              {applyMut.isPending ? 'Applying...' : 'Apply'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Update `packages/web/src/pages/ProjectDetailPage.tsx`** — add Rules tab

Add import:
```tsx
import { RulesEditor } from '@/components/RulesEditor';
```

In `<TabsList>`, add:
```tsx
<TabsTrigger value="rules">Rules & sync</TabsTrigger>
```

Add `<TabsContent>`:
```tsx
<TabsContent value="rules">
  {id && <RulesEditor projectId={id} />}
</TabsContent>
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @skill-manager/web typecheck
pnpm --filter @skill-manager/server test
```
Expected: 0 typecheck errors, all tests PASS.

```bash
git add packages/web packages/server
git commit -m "feat: add rules editor tab and rule-driven sync endpoint"
```

---

## Phase F — Settings + cross-cutting polish

### Task 22: Platform endpoint + link-method preview

**Files:**
- Create: `packages/server/src/routes/platform.ts`
- Create: `packages/server/src/utils/platform-probe.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Create `packages/server/src/utils/platform-probe.ts`**

```ts
import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { IS_WINDOWS } from '@skill-manager/shared';
import { copy } from 'fs-extra';

export type ProbeResult = 'symlink' | 'junction' | 'copy';

export async function probeLinkMethod(): Promise<ProbeResult> {
  const base = await mkdtemp(join(tmpdir(), 'sm-probe-'));
  const src = join(base, 'src');
  const dst = join(base, 'dst');
  await mkdir(src);
  try {
    try {
      await symlink(src, dst, 'junction');
      return IS_WINDOWS ? 'junction' : 'symlink';
    } catch {
      await copy(src, dst);
      return 'copy';
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
```

- [ ] **Step 2: Create `packages/server/src/routes/platform.ts`**

```ts
import type { FastifyPluginAsync } from 'fastify';
import { platform, release, arch } from 'node:os';
import { probeLinkMethod } from '../utils/platform-probe.js';

export const platformRoutes: FastifyPluginAsync = async (app) => {
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
      },
    };
  });
};
```

- [ ] **Step 3: Register in `packages/server/src/app.ts`**

```ts
import { platformRoutes } from './routes/platform.js';
```
```ts
await app.register(platformRoutes);
```

- [ ] **Step 4: Smoke**

```bash
pnpm --filter @skill-manager/server typecheck
```
Then manually:
```bash
NO_OPEN=1 pnpm start
curl http://127.0.0.1:4178/api/platform
```
Expected: JSON with `linkMethodPreview` = `symlink` / `junction` / `copy`.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add platform info endpoint with link-method probe"
```

---

### Task 23: Settings page (AI config + scan paths)

**Files:**
- Create: `packages/web/src/api/settings.ts`
- Create: `packages/web/src/api/platform.ts`
- Create: `packages/web/src/pages/SettingsPage.tsx`
- Modify: `packages/web/src/App.tsx` (wire route)

- [ ] **Step 1: Create `packages/web/src/api/settings.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { AiConfig } from '@skill-manager/shared';

interface SettingsResponse {
  scanPaths: string[];
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
    mutationFn: (input: { scanPaths?: string[]; ai?: Partial<AiConfig> }) =>
      apiFetch<SettingsResponse>('/api/settings', {
        method: 'PUT', body: JSON.stringify(input),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); },
  });
}

export function useTestAi() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; latencyMs: number } | { ok: false; error: string }>('/api/ai/test', { method: 'POST' }),
  });
}
```

- [ ] **Step 2: Create `packages/web/src/api/platform.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

export function usePlatform() {
  return useQuery({
    queryKey: ['platform'],
    queryFn: () => apiFetch<{
      os: string; release: string; arch: string; node: string;
      linkMethodPreview: 'symlink' | 'junction' | 'copy';
    }>('/api/platform'),
  });
}
```

- [ ] **Step 3: Create `packages/web/src/pages/SettingsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings, useTestAi } from '@/api/settings';
import { usePlatform } from '@/api/platform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export function SettingsPage() {
  const { data: settings } = useSettings();
  const { data: platform } = usePlatform();
  const save = useSaveSettings();
  const test = useTestAi();

  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [apiKeyEnv, setApiKeyEnv] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [requestStyle, setRequestStyle] = useState<'openai' | 'anthropic'>('openai');
  const [showKey, setShowKey] = useState(false);
  const [scanPathsText, setScanPathsText] = useState('');

  useEffect(() => {
    if (!settings) return;
    setEndpoint(settings.ai.endpoint ?? '');
    setModel(settings.ai.model ?? '');
    setApiKeyEnv(settings.ai.apiKeyEnv ?? '');
    setApiKey(settings.ai.apiKey ?? '');
    setSystemPrompt(settings.ai.systemPrompt ?? '');
    setRequestStyle((settings.ai.requestStyle as 'openai' | 'anthropic') ?? 'openai');
    setScanPathsText(settings.scanPaths.join('\n'));
  }, [settings]);

  async function handleSave() {
    await save.mutateAsync({
      scanPaths: scanPathsText.split('\n').map(s => s.trim()).filter(Boolean),
      ai: {
        endpoint: endpoint.trim(),
        model: model.trim(),
        apiKeyEnv: apiKeyEnv.trim() || undefined,
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        requestStyle,
      },
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>

      <Card>
        <CardHeader><CardTitle>AI configuration</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="block">
            <span className="font-medium">Request style</span>
            <select
              className="mt-1 w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              value={requestStyle} onChange={e => setRequestStyle(e.target.value as 'openai' | 'anthropic')}
            >
              <option value="openai">openai (chat/completions)</option>
              <option value="anthropic">anthropic (messages)</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium">Endpoint URL</span>
            <Input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://api.openai.com/v1/chat/completions" />
          </label>
          <label className="block">
            <span className="font-medium">Model</span>
            <Input value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini or claude-3-5-sonnet-latest" />
          </label>
          <label className="block">
            <span className="font-medium">API key env var (preferred)</span>
            <Input value={apiKeyEnv} onChange={e => setApiKeyEnv(e.target.value)} placeholder="OPENAI_API_KEY" />
          </label>
          <label className="block">
            <span className="font-medium">API key (fallback, stored in plaintext)</span>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Button variant="outline" onClick={() => setShowKey(s => !s)}>{showKey ? 'Hide' : 'Show'}</Button>
            </div>
            <p className="mt-1 text-xs text-red-600">⚠ Stored in ~/.skill-manager/db.json in plaintext. Prefer env vars.</p>
          </label>
          <label className="block">
            <span className="font-medium">Custom system prompt (optional)</span>
            <textarea
              className="mt-1 w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
              rows={4} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? 'Testing...' : 'Test connection'}
            </Button>
            {test.data && (
              test.data.ok
                ? <Badge variant="success">OK · {test.data.latencyMs}ms</Badge>
                : <Badge variant="destructive">FAIL</Badge>
            )}
          </div>
          {test.data && !test.data.ok && (
            <p className="text-xs text-red-600">{test.data.error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Scan paths</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-neutral-500">One path per line. Defaults cover ~/.claude skills and plugins.</p>
          <textarea
            className="w-full rounded border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
            rows={6} value={scanPathsText} onChange={e => setScanPathsText(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Platform</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {platform ? (
            <ul className="space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
              <li>OS: {platform.os} {platform.release} ({platform.arch})</li>
              <li>Node: {platform.node}</li>
              <li>Link method: <Badge variant="secondary">{platform.linkMethodPreview}</Badge></li>
            </ul>
          ) : <p className="text-xs text-neutral-500">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Wire route in `packages/web/src/App.tsx`**

Add import:
```tsx
import { SettingsPage } from './pages/SettingsPage';
```

Replace:
```tsx
<Route path="/settings" element={<div>Settings (Task 24)</div>} />
```
With:
```tsx
<Route path="/settings" element={<SettingsPage />} />
```

- [ ] **Step 5: Manual smoke**

Visit `/settings`:
- Save an endpoint/model/apiKeyEnv for a real provider
- Click "Test connection" — expect OK + latency, OR a clear error message
- Edit scan paths, save — verify `/api/settings` reflects changes

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(web): add settings page with ai config, scan paths, and platform info"
```

---

### Task 24: Static hosting in production build

**Files:**
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/package.json` (add `@fastify/static`)
- Create: `packages/server/src/utils/static.ts`
- Modify root `package.json` scripts

- [ ] **Step 1: `@fastify/static`** is already in server deps from Task 3.

- [ ] **Step 2: Create `packages/server/src/utils/static.ts`**

```ts
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export function resolveWebDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../web/dist'),
    resolve(here, '../../../web/dist'),
    resolve(here, '../../../../packages/web/dist'),
  ];
  return candidates.find(p => existsSync(join(p, 'index.html'))) ?? null;
}
```

- [ ] **Step 3: Update `packages/server/src/app.ts`** — register static hosting after all `/api/*` routes

Add imports:
```ts
import fastifyStatic from '@fastify/static';
import { resolveWebDist } from './utils/static.js';
```

At the end of `buildApp`, just before `return app;`:
```ts
const webDist = resolveWebDist();
if (webDist) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/', decorateReply: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    } else {
      reply.type('text/html').sendFile('index.html');
    }
  });
}
```

- [ ] **Step 4: Update root `package.json` scripts** — add a combined build + start

```json
"scripts": {
  "dev": "pnpm -r --parallel run dev",
  "build": "pnpm -r run build",
  "start": "pnpm --filter @skill-manager/server start",
  "start:prod": "pnpm -r run build && pnpm --filter @skill-manager/server start",
  "test": "pnpm -r run test",
  "typecheck": "pnpm -r run typecheck",
  "lint": "pnpm -r run lint"
}
```

- [ ] **Step 5: Smoke test production**

```bash
pnpm build
NO_OPEN=1 pnpm start
```
Open `http://127.0.0.1:4178/` in a browser. Expect the web app to load directly from the server (no Vite dev server needed). Navigate through pages — all routes must work (SPA fallback serves index.html).

- [ ] **Step 6: Commit**

```bash
git add packages/server package.json
git commit -m "feat(server): serve web dist in production with spa fallback"
```

---

### Task 25: CI configuration (GitHub Actions, Ubuntu + Windows)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github
git commit -m "ci: add github actions workflow for ubuntu + windows test matrix"
```

---

### Task 26: README with usage instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Skill Manager

Local multi-project manager for Claude Code skills. Browse installed skills from `~/.claude/`, apply per-project subsets via symlinks/junctions, and ask an AI to recommend skills for each project based on a rules file.

## Requirements

- Node.js >= 20.11
- pnpm 9.x (`npm install -g pnpm`)
- An API key for an OpenAI-compatible or Anthropic endpoint (optional; only needed for AI recommendations)

## Quick start

```bash
pnpm install
pnpm build
pnpm start
```

Opens `http://127.0.0.1:4178` in your default browser.

For development (hot reload front + back):

```bash
pnpm dev
```

## Data locations

- Central config / project registry: `~/.skill-manager/db.json`
- Scanner cache: `~/.skill-manager/skills-cache.json`
- Per-project applied manifest: `<project>/.claude/skill-manager.json`
- Per-project rules (committable): `<project>/.claude/skill-manager.rules.yaml`

## Workflow

1. **Add a project** on the Projects page (absolute path).
2. **Manual mode**: open the project, switch to "Add skills", select skills, preview and apply.
3. **AI mode**: fill project hint + rules, click "Generate recommendations", adjust picks, save rules + apply.
4. **Rule-driven sync**: later, edit `skill-manager.rules.yaml` and click "Sync by rules" to regenerate.

## Windows

The link engine uses directory junctions on Windows, which do NOT require administrator or Developer Mode privileges. If a junction fails, the engine falls back to a full directory copy and marks the manifest with `method: "copy"` — you'll need to use "Sync by rules" to refresh copies when the underlying skill changes.

## Security notes

- The server binds only to `127.0.0.1`; no LAN access.
- There is no auth — assume single-user local machine.
- API keys can be stored plaintext in `db.json` or loaded from an env var (preferred). The UI warns when using plaintext.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and workflow instructions"
```

---

## Self-Review

**Spec coverage check** (against `2026-04-20-skill-manager-design.md`):

| Spec section | Covered by task(s) |
|---|---|
| §2 Architecture (Fastify + Vite/React) | Task 1, 3, 7 |
| §3 Monorepo layout | Task 1, 2 |
| §4 Data model (zod schemas) | Task 2 |
| §5.1 ScannerService | Task 5 |
| §5.2 LinkService (junction + transaction rollback) | Task 11 |
| §5.3 ProjectService | Task 10 |
| §5.4 RuleService | Task 17 |
| §5.5 AiService | Task 18 |
| §5.6 API endpoints | Tasks 3, 6, 10, 12, 13, 17, 19, 21, 22 |
| §6.1 Routes | Task 7, 15, 16, 23 |
| §6.2 Projects list | Task 15 |
| §6.3 Project detail tabs | Task 16 (applied+add), 20 (AI), 21 (rules+sync) |
| §6.4 /skills browse | Task 9 |
| §6.5 /settings | Task 23 |
| §6.6 Cross components (SkillCard, DiffPreview, Badge) | Tasks 8, 9, 14 |
| §7 Error handling (404, validation, warnings) | Inline through all route tasks |
| §8 Testing (vitest + fixtures) | Tasks 2, 3, 5, 6, 10, 11, 12, 13, 17, 18 |
| §8.3 Windows CI | Task 25 |
| §9 Security (127.0.0.1 bind, masked apiKey) | Task 3 (bind), 19 (masking) |

**Placeholder scan:** no TBD/TODO found in the plan. Each task has concrete code and test content.

**Type consistency spot-check:**
- `Skill.id` is a string everywhere (Task 2 schema, Task 5 scanner, Task 11 link, Task 18 AI)
- `Manifest.method` enum `symlink | junction | copy` consistent across Tasks 2, 11, 22
- `DiffPreview` shape matches between server `computeDiff` (Task 13), UI `DiffPreview` component (Task 14), and consumers in Tasks 16, 20, 21
- `apiFetch` throws on `ok:false`; all hooks rely on that behavior consistently
- `getLock(projectId)` used identically in both `apply` and `unapply` routes

**Gaps / deferrals (explicit, not placeholders):**
- Frontend component unit tests with RTL — spec §8.1 mentions them; not added as separate tasks because the manual smoke steps in Tasks 9, 15, 16, 20, 21, 23 cover the interactive flows. Add them incrementally if flakes appear.
- E2E (Playwright) — spec §8.4 explicitly defers this; not in the plan.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-20-skill-manager-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**






