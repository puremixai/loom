# @loom/desktop

Tauri 2 desktop shell for [Loom](../../README.md). Wraps the existing Fastify + React SPA with zero code changes to `packages/shared|server|web`.

## Architecture

```
Tauri main (Rust)  ──spawn──▶  loom-server (Node 22 SEA sidecar, bundled exe)
      │                                 │
      │   picks a random local port     │ listens on http://127.0.0.1:<port>
      │   ──env PORT + LOOM_WEB_DIST──▶ │ serves /api/* + SPA from LOOM_WEB_DIST
      ▼                                 ▼
   WebView  ─────────navigate────▶  http://127.0.0.1:<port>/
      │
      ├── tray icon → Show / Add Project / Change user skills dir / About / Quit
      └── close-to-tray: X hides window; only tray Quit exits
```

Handshake: Rust reads `running at http://127.0.0.1:<port>` from the sidecar's stdout (regex) within 15 s, then navigates the WebView. Tray menu "Add Project" / "Change user skills dir" fire native OS folder pickers and call the sidecar REST API directly from Rust.

Full design: [`docs/superpowers/specs/2026-04-21-desktop-tauri-design.md`](../../docs/superpowers/specs/2026-04-21-desktop-tauri-design.md).

## Dev

Requires Rust 1.78+, Node 22+, pnpm 9.12+. On Windows, Visual Studio 2022 Build Tools + Rust MSVC target.

```bash
# Terminal 1 — Fastify server on :4178
pnpm --filter @loom/server dev

# Terminal 2 — Vite dev server on :5173 (with /api proxy to :4178)
pnpm --filter @loom/web dev

# Terminal 3 — Tauri shell, loads http://localhost:5173
pnpm desktop:dev
```

Tauri recompiles when Rust sources change; Vite HMR handles React. In dev mode the sidecar is **not** spawned — the Tauri window points at Vite and uses the already-running Fastify.

## Production build

```bash
pnpm build           # builds packages/shared, server, web
pnpm desktop:build   # SEA sidecar + tauri release + installers
```

Output (Windows):

- `src-tauri/target/release/bundle/msi/Loom_<version>_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Loom_<version>_x64-setup.exe`

Cross-platform sidecar build (on the target OS):

```bash
SIDECAR_TARGET=node22-macos-arm64 pnpm --filter @loom/desktop sidecar:build
cd apps/desktop && pnpm tauri build
```

Supported `SIDECAR_TARGET` values: `node22-win-x64`, `node22-macos-x64`, `node22-macos-arm64`, `node22-linux-x64`, `node22-linux-arm64`.

### How the sidecar is built

[`scripts/build-sidecar.mjs`](./scripts/build-sidecar.mjs) uses [Node 22 Single Executable Applications](https://nodejs.org/api/single-executable-applications.html) (not `pkg`, which lacks Node 22 + ESM support):

1. `esbuild` bundles `packages/server/dist/index.js` + all workspace deps (including `@loom/shared`) into one flat ESM file.
2. A CJS wrapper (required by SEA's single-entry rule) loads the ESM bundle from a SEA asset via a `data:` URL dynamic import.
3. `node --experimental-sea-config` produces a SEA blob.
4. A copy of the current Node executable is taken, and `postject` injects the blob.

Result: a self-contained `loom-server-<rust-triple>.exe` (~84 MB) with zero external Node dependency. Tauri's `bundle.externalBin` ships this alongside the app.

The web SPA is shipped separately as a Tauri resource (`bundle.resources` maps `packages/web/dist` → `web-dist/`). The Rust main resolves its path at runtime and forwards it to the sidecar via the `LOOM_WEB_DIST` env var, which [`packages/server/src/utils/static.ts`](../../packages/server/src/utils/static.ts) reads as the first-priority SPA root.

## Release

Push a `v*` tag (e.g. `v0.3.0`). Both workflows fire:

- [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml) runs on `windows-2022`, builds the MSI + NSIS installers, and attaches them to the GitHub Release.
- [`.github/workflows/release.yml`](../../.github/workflows/release.yml) runs on `ubuntu-latest`, extracts the matching `[VERSION]` section from both `CHANGELOG.md` and `CHANGELOG.zh.md`, and publishes bilingual release notes.

Because both actions target the same tag via `softprops/action-gh-release`, they contribute their own assets/notes to the same Release in GitHub. Run order doesn't matter.

## Known limitations (v1)

- **Windows-only installer** in CI. macOS / Linux sidecar builds work locally but CI matrix is Windows-only.
- **Unsigned installers** — Windows SmartScreen will show "unrecognized publisher". Users click **More info → Run anyway**.
- **No auto-updater** and no autostart.
- **No in-page native file picker** — files are picked only via the tray menu ("Add Project", "Change user skills dir"). Doing it from the web page would require wiring a `@tauri-apps/api`-style IPC surface, which breaks the zero-diff-to-web constraint.
- **No sidecar auto-restart on crash** — if `loom-server.exe` dies, the UI shows network errors. User restarts the app.
- **Force-killing Loom.exe** (Task Manager → End Task) may leave `loom-server.exe` lingering — the graceful cleanup hook only runs on `ExitRequested`.
- **macOS dock-reopen** (clicking the Dock icon while no windows are visible) not yet wired. `RunEvent::Reopen` was reshaped in Tauri 2 and needs the updated 2.x API.

## Troubleshooting

- **SmartScreen blocks install** → click **More info → Run anyway**.
- **"Failed to start Loom server" dialog** → the sidecar didn't signal ready within 15 s. Check `%APPDATA%\dev.puremixai.loom\logs\` for both the Tauri log and sidecar stderr. Common causes: the bundled `loom-server.exe` is missing (reinstall) or the port-probe lost the race to another process (restart the app).
- **CSP violations in DevTools console** → the CSP in [`tauri.conf.json`](./src-tauri/tauri.conf.json) permits `http://127.0.0.1:*` + Google Fonts. Anything else is a bug — open an issue.

## Source layout

```
apps/desktop/
├── package.json          # @loom/desktop workspace package
├── scripts/
│   └── build-sidecar.mjs # esbuild + SEA + postject pipeline
├── src-tauri/
│   ├── Cargo.toml        # Rust deps (tauri 2, plugin-dialog/shell/log, reqwest, …)
│   ├── tauri.conf.json   # identifier, bundle config, externalBin, resources, CSP
│   ├── capabilities/
│   │   └── default.json  # minimum plugin defaults (frontend has no IPC surface)
│   ├── icons/            # generated by `cargo tauri icon`
│   ├── resources/        # loom-server-<triple>.exe (built artifact, gitignored)
│   └── src/
│       ├── main.rs       # Tauri bootstrap + run-loop + ExitRequested cleanup
│       ├── sidecar.rs    # pick port + spawn + ready handshake + shutdown
│       ├── tray.rs       # system tray icon + menu wiring
│       └── dialog.rs     # native folder pickers + sidecar REST calls + fatal dialog
```
