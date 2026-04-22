# 🧵 Loom

**Weave Claude skills into every project.**

[🇬🇧 English](./README.md) · [🇨🇳 中文](./README_zh.md) · [📋 Changelog](./CHANGELOG.md) · [🎨 Design](./docs/DESIGN.md)

Manage [Claude Code](https://claude.com/product/claude-code) skills **per project** — scan `~/.claude/**/SKILL.md`, link a curated subset into each project, optionally let an LLM pick what fits.

> 💡 Claude Code skills are global by default. Loom makes them project-scoped with zero duplication.

---

## ✨ Why

Got 50+ skills installed? Every session sees them all — noisy triggers, slow matches, real needs buried.

**Loom's four moves**: 🔍 scan → 🔗 link into `<project>/.claude/skills/` → 📝 record in `loom.json` → 📜 commit intent in `loom.rules.yaml`.

## 🚀 Get it

| Form | How |
|---|---|
| 🌐 **Web** | `pnpm install && pnpm start` → <http://127.0.0.1:4178> |
| 🖥️ **Desktop** *(new in v0.3.0)* | MSI / NSIS from [Releases](https://github.com/puremixai/loom/releases) — Windows x64. Tray, close-to-tray, native pickers. |

## 📦 Quick start (web)

```bash
git clone https://github.com/puremixai/loom.git
cd loom
pnpm install
pnpm build && pnpm start    # :4178
# or: pnpm dev   (server :4178 + Vite :5173 with /api proxy)
```

Needs Node 20.11+ and pnpm 9.x (`corepack enable && corepack prepare pnpm@9.12.0 --activate`).

## 🧭 Usage

1. ➕ **Add Project** — paste an absolute path
2. 🎯 **Pick skills** — ✋ manual · 🤖 AI recommend · 📋 rules-driven
3. ✅ **Apply** — Loom writes junctions/symlinks into `.claude/skills/` and records them in `.claude/loom.json`
4. 🎉 Claude Code picks them up natively — Loom can quit

Loom only ever touches entries in its own manifest. Your untracked files are safe.

## ⚙️ Configure

- **Scan paths** — defaults cover `~/.claude/skills`, `~/.claude/custom-skills`, `~/.claude/plugins/cache`, `~/.loom/skills`
- **AI** — any OpenAI-compatible or Anthropic Messages endpoint (OpenAI · Anthropic · DeepSeek · Moonshot · OpenRouter · LiteLLM · Ollama with OpenAI shim)

Key resolution: env var (preferred) → plaintext (UI warns).

## 🔒 Privacy

- 🏠 Binds only to `127.0.0.1`, no auth → **single-user only**
- 📡 Only outbound traffic = AI requests to the endpoint **you** configured

| File | Commit? |
|---|---|
| `<project>/.claude/loom.rules.yaml` — intent | ✅ Yes |
| `<project>/.claude/loom.json` — applied manifest | ❌ No |
| `<project>/.claude/skills/*` — links/copies | ❌ No |
| `~/.loom/db.json` — registry + AI config | ❌ No |

## 🏗️ Architecture

pnpm monorepo: `@loom/shared` (zod types) · `@loom/server` (Fastify) · `@loom/web` (React SPA) · `@loom/desktop` (Tauri shell).

Deep-dive → [`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md) · backend internals → [`CLAUDE.md`](CLAUDE.md).

## 🧪 Dev

```bash
pnpm dev                   # hot reload
pnpm -r run typecheck      # 🔍
pnpm -r run test           # 🟢 62 tests (shared 5 + server 53 + web 4)
```

🪟 **Windows**: uses directory junctions (no admin/Developer Mode needed), auto-fallback to copy. CI runs Ubuntu + Windows × Node 20 / 22.

## 🗺️ Roadmap

⏳ Mobile sidebar · component-level frontend tests · CLI companion · filesystem watch · skill Markdown preview · keyboard nav · macOS/Linux installers + signing · team mode · skill collections.

## 🤝 Contributing

Open an issue before non-trivial changes · follow [`CLAUDE.md`](CLAUDE.md) conventions · `pnpm -r run typecheck && pnpm -r run test` must pass · conventional commits.

🔐 Security reports → GitHub Security Advisory (private).

## 📜 License

[MIT](LICENSE)

## 💖 Credits

[Fastify](https://fastify.dev/) · [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind](https://tailwindcss.com/) · [Radix](https://www.radix-ui.com/) · [TanStack Query](https://tanstack.com/query) · [Zod](https://zod.dev/) · [Tauri](https://tauri.app/) · UI inspired by [Vercel Geist](https://vercel.com/font). For Anthropic's [Claude Code](https://claude.com/product/claude-code).

## ⭐ Star History

![Star History](https://api.star-history.com/chart?repos=puremixai/loom&type=date&logscale&legend=top-left)
