# CLAUDE.md

Project guidance for Claude Code sessions working on this repo. Companion to — not replacement for — [README.md](README.md), [docs/superpowers/specs/](docs/superpowers/specs/), and [docs/DESIGN.md](docs/DESIGN.md).

## What this is

Local web app that manages Claude Code skills per project. Scans `~/.claude/**/SKILL.md`, creates per-project links at `<project>/.claude/skills/`, and supports both manual selection and AI-driven recommendation modes. Runs on `127.0.0.1:4178` (single Node process serving API + static SPA).

## Commands

```bash
# install (always pnpm — never npm, see Gotchas)
pnpm install

# full-stack dev with hot reload (server on :4178, vite on :5173 with /api proxy)
pnpm dev

# prod — build web dist + serve both via fastify static
pnpm build && pnpm start

# per-package
pnpm --filter @skill-manager/server dev       # backend only
pnpm --filter @skill-manager/web dev          # frontend only
pnpm --filter @skill-manager/server test      # 27 vitest cases
pnpm --filter @skill-manager/server typecheck

# everything
pnpm -r run typecheck
pnpm -r run test
```

## Architecture

pnpm monorepo with three workspace packages:

| Package | Role |
|---|---|
| `@skill-manager/shared` | Zod schemas + constants. Single source of truth for types across server+web. |
| `@skill-manager/server` | Fastify backend. Scanner, LinkService, RuleService, AiService, lowdb storage. |
| `@skill-manager/web` | React SPA. Vite + TanStack Query + shadcn-style primitives. |

Full architecture in [docs/superpowers/specs/2026-04-20-skill-manager-design.md](docs/superpowers/specs/2026-04-20-skill-manager-design.md). Implementation history in [docs/superpowers/plans/2026-04-20-skill-manager-implementation.md](docs/superpowers/plans/2026-04-20-skill-manager-implementation.md).

Data flows:

- `~/.skill-manager/db.json` — central project registry + AI config (lowdb)
- `~/.skill-manager/skills-cache.json` — scanner fingerprint cache
- `<project>/.claude/skill-manager.json` — applied manifest (environment fact)
- `<project>/.claude/skill-manager.rules.yaml` — rules (intent, committable)

## Conventions

### Backend

- All route handlers return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Never raw objects.
- Mutating project operations use a per-project `Mutex` from [apply-helpers.ts](packages/server/src/services/apply-helpers.ts:9). Don't add another lock mechanism.
- Errors use `Object.assign(new Error(...), { statusCode, code })` so the Fastify error handler propagates HTTP status correctly.
- File writes go through `atomicWriteFile` in [fs-safe.ts](packages/server/src/utils/fs-safe.ts). Don't call `writeFile` directly for config or manifest.
- Zod schemas in `@skill-manager/shared` — add to `schemas.ts` and re-export, never inline `z.object` in routes.

### Frontend

- **Tailwind palette**: use the custom `ink-*` scale (`ink-50/100/400/500/600/900`). Do not use Tailwind's default `neutral-*` or `gray-*` — they're not the Vercel tones.
- **No CSS borders**: use `shadow-border`, `shadow-ring-light`, `shadow-card`, or `shadow-card-elevated` utilities (defined in [index.css](packages/web/src/index.css)). This is the Vercel shadow-as-border technique.
- **Three font weights only**: `font-normal` (400), `font-medium` (500), `font-semibold` (600). No `font-bold`.
- **Light-only**: zero `dark:*` classes anywhere. If you're tempted to add dark mode, confirm with the user first — the current design is intentionally light-primary per [docs/DESIGN.md](docs/DESIGN.md).
- **Typography scale**: use the named sizes from [tailwind.config.ts](packages/web/tailwind.config.ts): `text-display`, `text-section`, `text-card-title`, `text-body`, `text-control`, `text-caption`, `text-mono-sm`. Avoid ad-hoc `text-[20px]` unless matching a design spec.
- **Technical labels**: Geist Mono, uppercase, tracking-tight, usually `text-[11px]` or `text-xs`. Used for table headers, grouping labels, metadata keys.
- **API envelope unwrapping**: always use [apiFetch](packages/web/src/api/client.ts) — don't call `fetch` directly. It throws on `{ ok: false }` so TanStack Query errors are meaningful.

### Both

- ES modules throughout (`"type": "module"`). Use `.js` extensions in relative imports under server (NodeNext), bare imports under web (Bundler resolution).
- TypeScript `strict: true` + `noUncheckedIndexedAccess: true`. Handle undefined from array indexing explicitly.
- Shared types live in [packages/shared/src/schemas.ts](packages/shared/src/schemas.ts). Inferred via `z.infer`, never hand-typed.

## Gotchas

### Package manager

- **Never `npm install`.** This is a pnpm workspace with `workspace:*` protocol — npm cannot resolve it and will break the lockfile. The repo enforces pnpm 9.12.0 via the root `packageManager` field.
- On Windows, if `pnpm` is not on PATH: `corepack enable && corepack prepare pnpm@9.12.0 --activate`.

### Ports

- Backend: `127.0.0.1:4178` — hardcoded in Vite proxy ([vite.config.ts](packages/web/vite.config.ts)). Changing it breaks dev mode.
- Vite dev: `localhost:5173`.
- If 4178 is occupied: find the zombie via `netstat -ano | grep :4178` and `taskkill //PID <pid> //F`. Ctrl+C in pnpm parallel mode sometimes leaves `tsx` children behind.
- Server binds only `127.0.0.1`, never `0.0.0.0`. This is a security invariant. See [packages/server/src/index.ts](packages/server/src/index.ts).

### Windows link strategy

[LinkService](packages/server/src/services/link.ts) tries `fs.symlink(..., 'junction')` first (Windows junction, no admin privileges needed), falls back to `fs-extra.copy` if that fails. Don't change to symlink type `'dir'` or `'file'` — those require Developer Mode on Windows.

[isSymlinkOrJunction](packages/server/src/utils/fs-safe.ts) uses a two-stage check (`isSymbolicLink()` then `readlink` fallback) because some Windows configs report junctions as not-symlinks from `lstat`. This was a real bug, not paranoia. Don't simplify it.

[unapplySkills](packages/server/src/services/link.ts) refuses to delete real directories at managed paths — it only removes junctions/symlinks, or real dirs only when `manifest.method === 'copy'`. This is a data-safety invariant; preserve it if refactoring.

### Fonts

Geist comes from **Google Fonts CDN** (`@import url(...)` in [index.css](packages/web/src/index.css)), not the `geist` npm package. The npm package is Next.js-only — it ships no usable `.woff2` files and pulls in the entire Next.js dependency tree. Do not re-add it.

### AI service

- Supports two request styles: `openai` (chat/completions format, `Authorization: Bearer`) and `anthropic` (messages format, `x-api-key`). Both go through the same `buildRequest` in [ai.ts](packages/server/src/services/ai.ts).
- API key resolution order: `config.apiKeyEnv` env var → `config.apiKey` plaintext. Env is preferred; UI warns when plaintext is used.
- Response must parse as JSON with `{ picks: [{ id, reason }] }`. On first parse failure, the service retries once with a stricter system prompt. Don't add more retries — the AI is either broken or misconfigured at that point.
- `includes` are force-included even if AI omits them; `excludes` are force-stripped even if AI returns them. The AI's output is advisory, not authoritative.

### Testing

- Backend: 27 vitest cases in [packages/server/test/](packages/server/test/). Use real filesystem via `os.tmpdir()` with `try/finally` cleanup. **Do not mock the filesystem** for link/manifest/scanner tests — the bugs we care about are Windows-specific filesystem behaviors (junction detection, atomic rename) that mocks hide.
- Frontend: no tests yet. `vitest run --passWithNoTests` on web passes trivially. When adding frontend tests, use Vitest + React Testing Library (already listed in spec §8.1).
- CI runs on Ubuntu + Windows matrix, Node 20 + 22. The Windows runner catches junction-detection regressions.

## Non-goals (intentionally excluded)

- Dark mode (light-only per design direction)
- Cloud sync / multi-machine (single-user local tool)
- Auth (binds to localhost only)
- File watching on `~/.claude/` (manual "Refresh" button instead — 90+ skills + plugin updates make watch noisy)
- CLI for scripted sync (Web UI only per user decision in spec)

## When in doubt

1. Read [docs/superpowers/specs/2026-04-20-skill-manager-design.md](docs/superpowers/specs/2026-04-20-skill-manager-design.md) — the architecture contract.
2. Read [docs/DESIGN.md](docs/DESIGN.md) — the Vercel/Geist visual system rules.
3. `git log --oneline docs/` — the design decisions are commit-preserved.
4. Ask the user before adding a new external dependency, changing the linking strategy, or introducing a new color outside the `ink-*` / workflow accent palette.
