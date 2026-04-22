# 🧵 Loom

**Weave Claude skills into every project.**

Loom is a local-first app that manages [Claude Code](https://claude.com/product/claude-code) skills on a per-project basis. Scan every `SKILL.md` under `~/.claude/`, link a curated subset into each project, optionally let an LLM recommend what fits — all without touching Claude Code's global skill store.

**[English](./README.md) · [中文](./README_zh.md)** · [CHANGELOG](./CHANGELOG.md) · [Design](./docs/DESIGN.md)

> Skills in Claude Code are global by default. Loom makes them project-scoped with zero duplication.

---

## ✨ Why Loom

With 50+ skills installed, every Claude Code session sees them all — noisy, slow-to-trigger, and the project's real needs get buried.

Loom solves it in four steps:

1. 🔍 **Scan** every `SKILL.md` under `~/.claude/` + your own dir + plugin caches
2. 🔗 **Link** a subset into `<project>/.claude/skills/` (junctions on Windows, symlinks elsewhere)
3. 📝 **Record** the applied state in `<project>/.claude/loom.json`
4. 📜 **Commit** your intent in `<project>/.claude/loom.rules.yaml` — reproducible across machines

## 🚀 Shipping forms

The same Fastify + React app, two ways:

| Form | Who for | How to get it |
|---|---|---|
| 🌐 **Web app** | Devs who want to `git clone` and run | `pnpm install && pnpm start` → <http://127.0.0.1:4178> |
| 🖥️ **Desktop app** *(new in v0.3.0)* | Everyone else | MSI or NSIS installer from [Releases](https://github.com/puremixai/loom/releases) (Windows x64) |

The desktop version wraps the same UI in a Tauri shell — system tray, close-to-tray, native folder pickers, bundled Node sidecar. Details: [`apps/desktop/README.md`](apps/desktop/README.md).

---

## 📦 Quick start (web)

**Requirements**: Node 20.11+, pnpm 9.x (run `corepack enable && corepack prepare pnpm@9.12.0 --activate` if you don't have it).

```bash
git clone https://github.com/puremixai/loom.git
cd loom
pnpm install
pnpm build && pnpm start
```

Your browser opens to <http://127.0.0.1:4178>. Set `NO_OPEN=1` to suppress.

For hot reload:
```bash
pnpm dev    # server on :4178, Vite on :5173 with /api proxy
```

## 🧭 How it works

1. **Register a project** — Projects page → **Add Project** → paste an absolute path. Stored only as a path reference in `~/.loom/db.json`; your project files are untouched.
2. **Pick skills** — three modes:
   - ✋ **Manual** — browse the library, check boxes, preview diff, apply
   - 🤖 **AI recommend** — describe your project, let an LLM propose skills with reasons
   - 📋 **Rules-driven** — sync from a committed `loom.rules.yaml`
3. **Apply** — Loom writes:
   - `<project>/.claude/skills/<name>/` — a junction / symlink / copy to the source skill
   - `<project>/.claude/loom.json` — an audit manifest (`method: junction | symlink | copy`)
4. **Done** — Claude Code picks up the skills natively. Loom doesn't need to keep running.

Remove skills via the **Applied** tab or delete the project entry. Loom only removes entries the manifest recorded — untracked files in `.claude/skills/` are never touched.

## ⚙️ Configuration

**Default scan paths** (in **Settings → Scan paths**):

- `~/.claude/skills` — `user` source
- `~/.claude/custom-skills` — `custom` source
- `~/.claude/plugins/cache` — `plugin` source, marketplace/plugin name auto-extracted
- `~/.loom/skills` — `user-local`, Loom-managed, auto-created for your own authored skills

**AI provider** (in **Settings → AI configuration**) — any OpenAI-compatible or Anthropic Messages API endpoint. Key resolution: `apiKeyEnv` (env var, preferred) → plaintext (fallback, UI warns).

Compatible today: OpenAI · Anthropic · DeepSeek · Moonshot · OpenRouter · LiteLLM · Ollama (with OpenAI shim) · any compatible gateway.

## 🔒 Data & privacy

Nothing leaves your machine except AI requests you explicitly trigger — and those go only to the endpoint you configured. The server binds to `127.0.0.1` with no auth.

| File | Purpose | Commit? |
|---|---|---|
| `~/.loom/db.json` | Central registry + AI config | No |
| `~/.loom/skills/` | Your user-authored skills | Up to you |
| `<project>/.claude/loom.rules.yaml` | Intent — what this project needs | ✅ **Yes** |
| `<project>/.claude/loom.json` | Applied manifest (environment fact) | No |
| `<project>/.claude/skills/<name>/` | Links/copies to source skills | No |

## 🏗️ Architecture

pnpm monorepo with three library packages + one app:

```
packages/
├─ shared/   @loom/shared    zod schemas + constants (single source of truth)
├─ server/   @loom/server    Fastify API, scanner, link engine, AI service
└─ web/      @loom/web       React SPA (TanStack Query, shadcn-style UI)

apps/
└─ desktop/  @loom/desktop   Tauri 2 shell + SEA-bundled Node sidecar
```

Full design: [`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md). API surface, backend services, internal conventions: [`CLAUDE.md`](CLAUDE.md).

## 🪟 Windows notes

Windows directory **junctions** (no Developer Mode / no admin needed) — with automatic `fs-extra` copy fallback if junctions fail. Copy mode is marked in the manifest so the UI can prompt you to re-sync when source skills change. Verified on Windows 11 + Node 22; see [`packages/server/src/utils/fs-safe.ts`](packages/server/src/utils/fs-safe.ts).

## 🧪 Development

```bash
pnpm install
pnpm dev                   # hot-reload server + web
pnpm -r run typecheck      # everything
pnpm -r run test           # 62 tests (5 shared + 53 server + 4 web)
```

Per-workspace scripts:
```bash
pnpm --filter @loom/server  test
pnpm --filter @loom/web     build
pnpm --filter @loom/desktop tauri dev
```

CI runs on Ubuntu + Windows × Node 20 / 22. Filesystem fixtures use real `os.tmpdir()` — junction and `git pull` integration bugs only surface on real disks, not mocks.

## 🗺️ Roadmap

- [ ] Mobile `<768px` sidebar fallback
- [ ] Collapsible "Up to date" / "Errors" drawer sections
- [ ] Component-level frontend tests
- [ ] CLI companion for CI / automated rules-driven sync
- [ ] Filesystem watch mode (opt-in)
- [ ] Skill preview with rendered Markdown
- [ ] Keyboard navigation on the Skills tree
- [ ] Desktop: macOS / Linux installers + signing
- [ ] Team mode: share rules across repos
- [ ] Skill collections / tags / saved filters

## 🤝 Contributing

1. Open an issue before non-trivial changes.
2. Follow [`CLAUDE.md`](CLAUDE.md) conventions (style, file structure, design tokens).
3. `pnpm -r run typecheck && pnpm -r run test` must pass.
4. Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.

## 🔐 Security

Binds only to `127.0.0.1`, no auth — **single-user local use only**. Don't expose to LAN/WAN without your own auth layer.

Security reports → GitHub Security Advisory (private), not public issues.

## 📜 License

[MIT](LICENSE)

## 💖 Credits

Built with [Fastify](https://fastify.dev/) · [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind](https://tailwindcss.com/) · [Radix UI](https://www.radix-ui.com/) · [TanStack Query](https://tanstack.com/query) · [Zod](https://zod.dev/) · [Tauri](https://tauri.app/) · UI inspired by [Vercel Geist](https://vercel.com/font) · For Anthropic's [Claude Code](https://claude.com/product/claude-code).

## ⭐ Star History

![Star History](https://api.star-history.com/chart?repos=puremixai/loom&type=date&logscale&legend=top-left)
