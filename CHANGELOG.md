# Changelog

All notable changes to **Loom** are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

中文版: [CHANGELOG.zh.md](CHANGELOG.zh.md)

## [0.4.0] — 2026-04-22

### Features

- 🌐 **Internationalization (Chinese default + English)** for the web UI. New `react-i18next` setup under [`packages/web/src/i18n/`](packages/web/src/i18n/) with 11 namespaces × 222 keys across `en.json` / `zh.json`. UI defaults to Chinese (`zh`); users switch via **Settings → 界面语言**, preference persists in `localStorage` (`loom-lang`). Every user-facing string in the nav, Projects, Project Detail, Skills, Settings, rules editor, diff preview, AI recommend panel, source updates banner/drawer, and skill tree now routes through `t()`.

### Style

- 🧵 **Nav logo** upscaled from `sm` (icon 20px / wordmark 15px) to `md` (24px / 20px) — reads clearly at the 56px nav bar height without pushing layout.
- 📝 **Top-level READMEs** trimmed to roughly half their previous length (165 → ~90 lines). Emoji markers on every section + bullet, language/doc flags in the top links row, desktop-app callout surfaced. The "local-first" framing was dropped; substance preserved (quick start, usage, privacy table, architecture, dev, Windows notes).

### Chore

- 🧹 `packages/web/src/**/*.js` now gitignored. The `tsc -b && vite build` script was silently emitting compiled JS alongside the `.tsx` sources; a prior commit accidentally swept 38 of them in. Deleted them and added the pattern to [`.gitignore`](.gitignore) so future `pnpm build` runs can't re-pollute history.

## [0.3.0] — 2026-04-22

### Features

- **Desktop application (Tauri 2, `apps/desktop/`) — initial release.** Windows `.msi` and NSIS `.exe` installers that wrap the existing Fastify + React SPA via a Rust shell + Node 22 SEA-packaged sidecar. System tray (Show · Add Project… · Change user skills dir… · About · Quit), left-click toggles window, close-to-tray window behavior, graceful sidecar cleanup on `RunEvent::ExitRequested`. Zero code changes to `packages/shared|server|web` except one additive env-var fallback (`LOOM_WEB_DIST` in [`packages/server/src/utils/static.ts`](packages/server/src/utils/static.ts)) so Tauri can point the sidecar at its bundled SPA. Full design: [`docs/superpowers/specs/2026-04-21-desktop-tauri-design.md`](docs/superpowers/specs/2026-04-21-desktop-tauri-design.md).
- **LoomIcon + LoomLogo components** ([`packages/web/src/components/ui/loom-icon.tsx`](packages/web/src/components/ui/loom-icon.tsx)): shared loom-weave SVG glyph and wordmark, size prop narrowed to a literal union (`xs | sm | md | lg | xl`). Replaces the previous text-only nav logo, and renders in the Projects empty state.
- **SVG favicon** ([`packages/web/public/favicon.svg`](packages/web/public/favicon.svg)) matching the loom-weave icon.

### Fixes

- `LoomIconSize` type is now properly exported and narrowed via `as const` on the STROKE table (previously collapsed to `number`).
- Nav wordmark uses `font-semibold` (600) per the design system's 3-weight rule.

### Refactor

- LoomIcon colors extracted into a shared `STROKE` constant table; size type narrowed to a literal union.

### Documentation

- Loom logo & typography design spec ([`docs/superpowers/specs/2026-04-20-logo-design.md`](docs/superpowers/specs/2026-04-20-logo-design.md)) + implementation plan.
- Tauri desktop v1 spec + 17-task implementation plan at [`docs/superpowers/specs/2026-04-21-desktop-tauri-design.md`](docs/superpowers/specs/2026-04-21-desktop-tauri-design.md) / [`docs/superpowers/plans/2026-04-21-desktop-tauri-implementation.md`](docs/superpowers/plans/2026-04-21-desktop-tauri-implementation.md).
- [`apps/desktop/README.md`](apps/desktop/README.md) expanded with architecture diagram, SEA sidecar internals, dev/prod/release flow, known v1 limitations.

### CI

- [`.github/workflows/desktop-release.yml`](.github/workflows/desktop-release.yml) — builds and attaches Windows MSI + NSIS installers on `v*` tag pushes. Windows runner only in v1; macOS/Linux matrix entries ready to add when those platforms are validated. Rust + pnpm caches keep cold-run builds under ~10 min.
- [`release.yml`](.github/workflows/release.yml) continues handling changelog-based GitHub Release notes. Both workflows attach their own assets to the same release.

## [0.2.3] — 2026-04-20

### Enhancements

- **Settings page left-nav**: new sticky sidebar lists the four sections (AI configuration, User skills directory, Scan paths, Platform); clicking smoothly scrolls to the matching card, and the current section is auto-highlighted via `IntersectionObserver` as you scroll. Hidden on `<768px` viewports.

## [0.2.2] — 2026-04-20

### Fixes

- `apiFetch` no longer attaches `Content-Type: application/json` when the request has no body. The Sources drawer's auto-triggered `POST /api/sources/check` was hitting Fastify's `FST_ERR_CTP_EMPTY_JSON_BODY` (empty body + JSON content-type is rejected by the default parser). Clicking **View** on the Sources banner now opens the drawer and checks upstream status as intended.

### CI

- GitHub Actions `.github/workflows/release.yml` — auto-publishes a GitHub Release whenever a `v*` tag is pushed, extracting per-version sections from both `CHANGELOG.md` and `CHANGELOG.zh.md` to compose bilingual release notes; auto-detects pre-release tags (`v*-*`).

## [0.2.1] — 2026-04-20

### Documentation

- Add Chinese changelog (`CHANGELOG.zh.md`) mirroring the English version
- Satisfies the release-skills workflow requirement for dual-language changelogs

## [0.2.0] — 2026-04-20

### Added

**Milestone 1 — User skills directory**
- First-class `userSkillsDir` configuration (default `~/.loom/skills/`), auto-created on first launch and auto-scanned ([#M1](docs/superpowers/plans/2026-04-20-source-management-implementation.md))
- New `source: 'user-local'` classification for skills living under the user directory
- `POST /api/user-skills-dir/open` — reveals the directory in the OS file manager
- `GET /api/platform` now includes `userSkillsDir`
- Settings page gains a dedicated **User skills directory** card with a copy-command integration for Claude Code's `skill-creator`
- `UserDirService` (ensure / validate / resolve) in the server package

**Milestone 2 — Skills Library tree navigation**
- Left-sidebar directory tree on `/skills`, driven client-side from existing `Skill[]` data — no new API needed
- Tree selection synced to the URL (`/skills?path=plugin/claude-plugins-official/superpowers`) so paths are shareable + support browser back/forward
- Collapse state persisted to `localStorage`
- First frontend test infrastructure: Vitest + jsdom + `@testing-library/react` + 4 pure-helper tests for `buildTree` / `skillPath`
- `useSkillTree` hook, `SkillTree` + `SkillTreeNode` components

**Milestone 3 — Source updates**
- `GET /api/sources` — lists git-backed source refs detected across all scanned skills
- `POST /api/sources/check` — batch `git fetch` + ahead/behind detection with 5-way concurrency and in-flight request deduplication
- `POST /api/sources/pull` — runs `git pull` for user-managed repos (`kind: 'git-source'`); rejects plugin refs with a 400 (Loom does not manage Claude Code's plugin metadata)
- Detection uses `findGitRoot` boundary-aware traversal and groups multi-skill repos into one `SourceRef`
- `SourceUpdateService` supports runner injection so tests never spawn real `git` processes except in the one integration case that verifies end-to-end behaviour on a real `git init` repo
- `Source updates` banner on `/skills` + right-side drawer with Behind / Up to date / Errors sections
- Pull button disabled on dirty working trees
- Plugin rows surface a copy-command `claude plugins update <name>` instead of a Pull button
- Error taxonomy: `git-not-found` (git missing from PATH) and `timeout` (30s cap) are normalized to stable labels so the UI can render banners consistently

### Changed

- `SkillSchema.source` enum extended to include `'user-local'`
- `scanSkills` now merges `userSkillsDir` into its scan paths transparently (users can remove it from `scanPaths`; Loom always scans it)
- All scanner call sites (`/api/skills`, `/api/sync`, `/api/ai/*`, `apply-helpers`) propagate `userSkillsDir`
- `maskApiKey` preserves masking on settings responses and extends shape to include `userSkillsDir`

### Fixed

- `findGitRoot` boundary handling: path traversal correctly stops at `stopAt` instead of escaping to a `.git` above the intended scope
- `/api/sources/check` inflight dedup no longer exposes a misleading `body.refs` parameter — the endpoint always performs a full scan (simpler semantics)

### Tests

- 57 tests passing total (5 shared, 53 server, 4 web) — up from v0.1's 32
- CI matrix unchanged: Ubuntu + Windows × Node 20 / 22

### Design docs

- Spec: [docs/superpowers/specs/2026-04-20-source-management-design.md](docs/superpowers/specs/2026-04-20-source-management-design.md)
- Implementation plan: [docs/superpowers/plans/2026-04-20-source-management-implementation.md](docs/superpowers/plans/2026-04-20-source-management-implementation.md)

### Known limitations (deferred to future releases)

- Mobile `<768px` sidebar fallback (`<select>` dropdown) not yet implemented — sidebar is simply hidden on small viewports
- Drawer "Up to date" / "Errors" sections render always-expanded (spec originally had collapsible)
- Pull button on dirty repos lacks a `title` tooltip explaining why it's disabled
- Keyboard navigation on the skill tree
- Automatic periodic update checks
- Plugin updates via shelling out to `claude plugins update` (currently a copy-command prompt only)

## [0.1.0] — 2026-04-20

Initial MVP release.

### Added

- pnpm monorepo with three workspace packages: `@loom/shared`, `@loom/server`, `@loom/web`
- Local-first architecture: Fastify on `127.0.0.1:4178` serves both REST API and the built SPA
- Skill scanner covering `~/.claude/skills`, `~/.claude/custom-skills`, and every plugin cache under `~/.claude/plugins/cache/**/SKILL.md`, with mtime-based fingerprint cache for incremental re-scans
- Per-project skill linking via Windows directory junctions (no admin rights needed) with automatic `fs-extra` copy fallback
- Transactional apply: per-project mutex + reverse-order rollback journal so a mid-way failure never leaves a half-applied state
- Safe `unapply`: only removes paths registered in the manifest; never touches user-authored files
- Two skill selection modes in the Web UI — manual browse + AI-driven recommendation with diff preview
- `loom.rules.yaml` per project for committable "intent" + `loom.json` manifest for per-machine "applied state"
- AI service supports OpenAI-compatible and Anthropic Messages API request styles, with retry-on-unparseable-JSON and forced includes/excludes
- Settings UI: AI endpoint + key (env-var preferred), scan paths, platform diagnostics
- Vercel / Geist design system: shadow-as-border, `ink-*` palette, Geist Sans + Geist Mono typography, three-weight discipline
- 27 server tests + 5 shared-schema tests, filesystem-integration style
- CI on Ubuntu + Windows × Node 20 / 22

[0.2.3]: https://github.com/puremixai/loom/releases/tag/v0.2.3
[0.2.2]: https://github.com/puremixai/loom/releases/tag/v0.2.2
[0.2.1]: https://github.com/puremixai/loom/releases/tag/v0.2.1
[0.2.0]: https://github.com/puremixai/loom/releases/tag/v0.2.0
[0.1.0]: https://github.com/puremixai/loom/releases/tag/v0.1.0
