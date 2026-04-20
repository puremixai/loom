# Loom

**Weave Claude skills into every project.**

Loom is a local-first web app for managing [Claude Code](https://claude.com/product/claude-code) skills on a per-project basis. It discovers every `SKILL.md` under your `~/.claude/` tree, lets you apply curated subsets to individual projects via symlinks (or junctions on Windows), and can ask an LLM to recommend the right skills for each project based on rules you commit to git.

[English](./README.md) · [中文](./README_zh.md)

> Skills in Claude Code are global by default. Loom makes them project-scoped without duplicating files.

---

## Why Loom

Once you have 50+ skills installed across plugins and custom sources, every Claude Code session sees all of them — increasing noise, slowing triggers, and blurring which skills matter for the project at hand. Loom solves this by:

1. **Scanning** all `SKILL.md` under `~/.claude/skills`, `~/.claude/custom-skills`, and every plugin cache
2. **Linking** a selected subset into `<project>/.claude/skills/` (so Claude Code picks them up natively)
3. **Recording** the applied state in a manifest file the team can ignore or audit
4. **Declaring intent** in a committable `loom.rules.yaml` so the AI-assisted selection is reproducible across machines

## Features

- **Local web UI** — single `pnpm start` boots a Fastify API + SPA on `127.0.0.1:4178`, no cloud account, no sign-in
- **Multi-project center** — one hub that manages N project directories from a single window
- **Two selection modes**
  - **Manual** — browse / search / filter the full library, check boxes, preview diff, apply
  - **AI-driven** — describe your project + rules, let an LLM propose skills with reasoning, approve picks
- **Cross-platform linking** — Windows directory junctions (no admin needed) with an automatic `fs-extra` copy fallback
- **Transactional apply** — per-project mutex + journal-based rollback; a mid-way failure never leaves a half-applied state
- **Safe unapply** — only ever removes entries the manifest actually records; untracked files in `.claude/skills/` are never touched
- **Committable rules** — `loom.rules.yaml` sits in the project repo and captures "what this project should pull from the library"
- **Provider-agnostic AI** — configurable endpoint supporting OpenAI-compatible and Anthropic Messages API styles; works with gateways, proxies, and local inference servers
- **Shipping safety** — server binds only to loopback, API keys can be loaded from env vars, write surface strictly within `<project>/.claude/` and `~/.loom/`

## Screenshots

> Screenshots coming soon. The UI follows a minimal Vercel/Geist-inspired design — white canvas, shadow-as-border primitives, Geist Sans + Geist Mono typography. See [`docs/DESIGN.md`](docs/DESIGN.md).

---

## Quick start

### Prerequisites

- **Node.js** ≥ 20.11
- **pnpm** 9.x — install via `npm install -g pnpm` or Node's built-in `corepack enable && corepack prepare pnpm@9.12.0 --activate`
- *(Optional)* An API key for OpenAI, Anthropic, or any compatible endpoint — only needed for AI-assisted selection

### Install & run

```bash
git clone https://github.com/<your-username>/loom.git
cd loom
pnpm install
pnpm build       # compiles the web SPA into dist/
pnpm start       # Fastify serves API + SPA at http://127.0.0.1:4178
```

The default browser opens automatically. Add `NO_OPEN=1` to suppress that.

### Development (hot reload)

```bash
pnpm dev
# server on :4178, Vite dev server on :5173 with /api proxy
```

Open <http://localhost:5173>.

---

## Usage walkthrough

### 1. Register a project

On the **Projects** page, click **Add Project** and enter the absolute path to any local project. Loom stores only the path reference in `~/.loom/db.json`; your project files are untouched.

### 2. Pick skills — three ways

| Mode | When | How |
|---|---|---|
| **Manual** | You already know what you want | Go to the **Add skills** tab, check the boxes, click **Preview**, confirm the diff, **Apply** |
| **AI** | New project, want suggestions | Open **AI recommend**, fill "project hint" (one-sentence description) + optional keywords / includes / excludes / guidance, click **Generate**, review picks, adjust, **Save rules & apply** |
| **Rules-driven** | You have `loom.rules.yaml` from a teammate / past session | Open **Rules & sync**, edit YAML if needed, click **Sync by rules** to regenerate the recommended set |

### 3. Apply writes two things

- `<project>/.claude/skills/<skill-name>/` — a junction (Windows) / symlink (POSIX) / directory copy (fallback) pointing at the source skill
- `<project>/.claude/loom.json` — a manifest recording what was applied, with `method: junction | symlink | copy`

Claude Code picks up the skills from `<project>/.claude/skills/` natively — no Loom runtime needed thereafter.

### 4. Removing skills

Click **Remove** on any applied skill in the **Applied** tab, or delete the project entry entirely. Loom only removes entries the manifest registered — it never recursively deletes untracked paths.

---

## Configuration

### Scan paths

Default roots scanned for `**/SKILL.md`:

- `~/.claude/skills` — marked as `user` source
- `~/.claude/custom-skills` — marked as `custom`
- `~/.claude/plugins/cache` — marked as `plugin`, with the marketplace/plugin name extracted automatically

Configurable in **Settings → Scan paths**. Add, remove, or reorder freely.

### AI provider

**Settings → AI configuration** accepts any endpoint matching one of two request styles:

**OpenAI-compatible** (default)
```
POST <endpoint>
Authorization: Bearer <key>
Body: { "model", "messages": [...], "response_format": { "type": "json_object" } }
```

Examples: `https://api.openai.com/v1/chat/completions`, OpenRouter, DeepSeek, Moonshot, self-hosted LiteLLM, Ollama with OpenAI shim.

**Anthropic Messages API**
```
POST <endpoint>
x-api-key: <key>
anthropic-version: 2023-06-01
Body: { "model", "system", "messages": [...], "max_tokens" }
```

Example: `https://api.anthropic.com/v1/messages`.

### Key storage

- **Preferred** — set `apiKeyEnv` to the name of an environment variable (e.g. `OPENAI_API_KEY`); Loom reads it at call time from the server process
- **Fallback** — enter the key directly; Loom stores it in plaintext inside `~/.loom/db.json` and the UI warns you

---

## Data & privacy

| File | Location | Purpose | Commit? |
|---|---|---|---|
| Central registry | `~/.loom/db.json` | Registered projects + AI config + scan paths | n/a (not in any repo) |
| Scanner cache | `~/.loom/skills-cache.json` | Fingerprint cache for incremental rescans | n/a |
| Rules file | `<project>/.claude/loom.rules.yaml` | Your intent: projectHint, includes, excludes, keywords, aiGuidance | **Yes** — share with teammates |
| Applied manifest | `<project>/.claude/loom.json` | What Loom linked on this machine, with absolute source paths | No — environment snapshot |
| Linked skills | `<project>/.claude/skills/<name>/` | Junctions / symlinks / copies into the actual skill dirs | No |

Loom makes **no outbound network calls** except when you explicitly trigger AI recommend / sync / test connection — and those go only to the endpoint you configured.

---

## Architecture

pnpm monorepo with three workspace packages:

```
packages/
├─ shared/       @loom/shared  — zod schemas + constants (single source of truth)
├─ server/       @loom/server  — Fastify API, scanner, link engine, AI service
└─ web/          @loom/web     — React SPA, TanStack Query, shadcn-style UI
```

### Backend services

| Service | File | Role |
|---|---|---|
| `ScannerService` | [`packages/server/src/services/scanner.ts`](packages/server/src/services/scanner.ts) | Walks scan paths, parses frontmatter, fingerprint-cached |
| `LinkService` | [`packages/server/src/services/link.ts`](packages/server/src/services/link.ts) | `applySkills` / `unapplySkills` with transactional journal |
| `ProjectService` | [`packages/server/src/services/project.ts`](packages/server/src/services/project.ts) | CRUD on the project registry, path validation |
| `RuleService` | [`packages/server/src/services/rule.ts`](packages/server/src/services/rule.ts) | YAML read/write with zod validation |
| `AiService` | [`packages/server/src/services/ai.ts`](packages/server/src/services/ai.ts) | OpenAI + Anthropic request builders, retry, response validation |

Full architecture in [`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md).

### API surface

All routes return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

```
GET    /api/health
GET    /api/skills                       ?refresh=1 forces re-scan
GET    /api/skills/:id                   full SKILL.md content
GET    /api/projects
POST   /api/projects                     { path, name?, notes? }
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/manifest
GET    /api/projects/:id/rules
PUT    /api/projects/:id/rules
POST   /api/projects/:id/diff-preview    { skillIds }
POST   /api/projects/:id/apply           { skillIds }
POST   /api/projects/:id/unapply         { skillIds? }
POST   /api/projects/:id/sync            reads rules.yaml + AI + diff
POST   /api/ai/recommend
POST   /api/ai/test                      connectivity probe
GET    /api/settings
PUT    /api/settings
GET    /api/platform
```

---

## Windows notes

The link engine tries `fs.symlink(src, dst, 'junction')` first — on Windows this creates a **directory junction**, which does **not** require Administrator rights or Developer Mode. If that fails for any reason, it falls back to a full `fs-extra.copy`.

Copy mode is marked in the manifest as `method: "copy"`, and the UI will prompt you to re-sync when skill sources change (links auto-update; copies don't).

The junction-vs-symlink distinction can be subtle on some Windows configurations — Loom uses a two-stage detection helper (`isSymbolicLink()` + `readlink` fallback) that has been verified on Windows 11 + Node 22. See [`packages/server/src/utils/fs-safe.ts`](packages/server/src/utils/fs-safe.ts).

---

## Development

```bash
# install (always pnpm, never npm — workspace:* protocol)
pnpm install

# hot-reload both packages
pnpm dev

# typecheck everything
pnpm -r run typecheck

# run all tests (27 cases on the server, filesystem-integration style)
pnpm -r run test

# production build: web → dist/, server serves both on :4178
pnpm build && pnpm start

# per-package scripts
pnpm --filter @loom/server dev
pnpm --filter @loom/web build
pnpm --filter @loom/server test
```

### Project structure

```
loom/
├─ packages/
│  ├─ shared/              zod schemas, constants, types
│  │  ├─ src/
│  │  └─ test/
│  ├─ server/              Fastify backend
│  │  ├─ src/
│  │  │  ├─ routes/        projects, skills, ai, settings, sync, platform, health
│  │  │  ├─ services/      scanner, link, project, rule, ai, manifest, apply-helpers
│  │  │  ├─ storage/       center-db lowdb wrapper
│  │  │  └─ utils/         fs-safe, platform-probe, fingerprint, static
│  │  └─ test/             vitest + real filesystem fixtures
│  └─ web/                 React SPA
│     ├─ src/
│     │  ├─ pages/         Projects, ProjectDetail, Skills, Settings
│     │  ├─ components/    SkillCard, DiffPreview, AiRecommendPanel, RulesEditor, ui/*
│     │  ├─ api/           TanStack Query hooks
│     │  └─ lib/           cn utility
│     └─ index.html
├─ docs/
│  ├─ DESIGN.md            Vercel/Geist visual system
│  └─ superpowers/
│     ├─ specs/            architecture spec
│     └─ plans/            implementation plan
├─ CLAUDE.md               guidance for Claude Code sessions
└─ README.md               you are here
```

See [`CLAUDE.md`](CLAUDE.md) for the project's internal conventions — it's written for LLM agents but is also a concise engineering guide for humans.

### Tests

Backend tests use real `os.tmpdir()` fixtures with `try/finally` cleanup — filesystem behavior (especially Windows junction detection) is the main thing we verify, so mocks would defeat the purpose. CI runs on Ubuntu + Windows, Node 20 + 22.

Frontend tests are not yet written; the current release ships with UI verified manually. Contributions welcome.

---

## Roadmap

- [ ] Frontend test coverage (Vitest + React Testing Library)
- [ ] CLI companion for CI / automated rules-driven sync
- [ ] Filesystem watch mode (opt-in, for rapid skill iteration)
- [ ] Skill preview with rendered Markdown + frontmatter table
- [ ] Team mode: share rules across repos via a lightweight sync protocol
- [ ] Import/export project configurations
- [ ] Skill collections / tags / saved filters

---

## Contributing

Contributions welcome! Please:

1. Open an issue describing the change before starting work on anything non-trivial
2. Follow the conventions in [`CLAUDE.md`](CLAUDE.md) (coding style, file structure, design tokens)
3. Run `pnpm -r run typecheck` and `pnpm -r run test` before pushing
4. Keep commits focused and use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`)

## Security

Loom binds only to `127.0.0.1` with no authentication — it is designed for single-user local use. Do **not** expose the port to a LAN or the public internet without adding your own auth layer.

Report security issues privately by opening a GitHub security advisory rather than a public issue.

## License

[MIT](LICENSE)

## Credits

- Built with [Fastify](https://fastify.dev/), [React](https://react.dev/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [TanStack Query](https://tanstack.com/query), [Zod](https://zod.dev/)
- UI inspired by [Vercel](https://vercel.com/)'s [Geist](https://vercel.com/font) design system
- Designed for [Claude Code](https://claude.com/product/claude-code) by Anthropic
