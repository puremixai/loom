# Loom Desktop (Tauri) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the existing Loom Fastify + React SPA in a Tauri-based cross-platform desktop shell with Node sidecar, delivering Windows `.msi` / NSIS installer in v1 while preserving macOS/Linux build paths. **Zero diff to `packages/shared|server|web/*`**.

**Architecture:** Tauri main (Rust) launches a pkg-bundled Node sidecar on a random local port, injects env `PORT`, parses ready-line from stdout, then points a WebView at `http://127.0.0.1:<port>/`. Tray icon and native directory-picker dialogs provide OS-integration entry points that call the same HTTP API the WebView already uses.

**Tech Stack:** Rust 1.78+, Tauri 2.x (tauri, tauri-plugin-shell, tauri-plugin-dialog, tauri-plugin-log), `@yao-pkg/pkg` (Node 22-compatible fork of pkg) for sidecar bundling, existing Node 22 + pnpm 9.12 for the rest.

**Spec reference:** [docs/superpowers/specs/2026-04-21-desktop-tauri-design.md](../specs/2026-04-21-desktop-tauri-design.md)

**Milestones** (each ends on a verifiable state):

- **M1 — Hello-world shell** (Tasks 1–4): Tauri window loads `http://localhost:5173` (Vite dev server), manual smoke pass
- **M2 — Sidecar integration** (Tasks 5–9): Production `cargo tauri build` produces an installer that spawns Node sidecar and loads its URL
- **M3 — Tray + native dialogs** (Tasks 10–12): Tray icon with Show / Add Project / Change user skills dir / Quit menu
- **M4 — Polish** (Tasks 13–15): Close-to-tray, error dialogs, macOS Reopen
- **M5 — CI release** (Tasks 16–17): `desktop-release.yml` Windows matrix + README

---

## Task 0: Prerequisites (one-time per machine)

Not a code task — verify the dev machine has what's needed before Task 1.

- [ ] **Step 1: Install Rust toolchain**

Windows:
```powershell
winget install --id Rustlang.Rustup
rustup default stable
rustc --version  # should be >= 1.78
```

- [ ] **Step 2: Install Microsoft Visual Studio Build Tools** (Windows only, needed by Rust MSVC target)

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Restart shell after install.

- [ ] **Step 3: Install Tauri CLI**

```powershell
cargo install tauri-cli --version "^2.0"
cargo tauri --version  # should print "tauri-cli 2.x.x"
```

- [ ] **Step 4: Verify existing Loom dev still works** (sanity)

From `D:/VibeProjects/skill-manager`:
```bash
pnpm install
pnpm --filter @loom/server dev &
pnpm --filter @loom/web dev
```
Expected: `http://localhost:5173` shows Loom normally. Kill both before continuing.

---

## M1 — Hello-world shell

### Task 1: Workspace skeleton for `@loom/desktop`

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/.gitignore`
- Create: `apps/desktop/README.md`
- Modify: `package.json` (root — add 3 scripts)
- Modify: `pnpm-workspace.yaml` (add `apps/*`)
- Modify: `.gitignore` (ignore Tauri target + sidecar build artefacts)

- [ ] **Step 1: Create `apps/desktop/package.json`**

```json
{
  "name": "@loom/desktop",
  "version": "0.2.3",
  "private": true,
  "type": "module",
  "scripts": {
    "tauri": "tauri",
    "desktop:build": "pnpm run sidecar:build && tauri build",
    "sidecar:build": "node scripts/build-sidecar.mjs"
  },
  "devDependencies": {
    "@tauri-apps/cli": "2.0.0",
    "@yao-pkg/pkg": "6.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/desktop/.gitignore`**

```gitignore
# Tauri build output
src-tauri/target/
src-tauri/gen/

# Bundled sidecar binaries (built by scripts/build-sidecar.mjs)
src-tauri/resources/loom-server-*
!src-tauri/resources/.gitkeep

# Rust incremental compile cache
src-tauri/Cargo.lock.bak
```

- [ ] **Step 3: Create `apps/desktop/README.md`**

```markdown
# @loom/desktop

Tauri-based cross-platform desktop shell for [Loom](../../README.md).

## Dev

```bash
# Terminal 1 — Loom server (Fastify :4178)
pnpm --filter @loom/server dev

# Terminal 2 — Loom web (Vite :5173 with /api proxy)
pnpm --filter @loom/web dev

# Terminal 3 — Tauri shell, loads http://localhost:5173
pnpm desktop:dev
```

## Production build (Windows only in v1)

```bash
pnpm desktop:build
# Output: src-tauri/target/release/bundle/{msi,nsis}/*
```

## Architecture

See [docs/superpowers/specs/2026-04-21-desktop-tauri-design.md](../../docs/superpowers/specs/2026-04-21-desktop-tauri-design.md).
```

- [ ] **Step 4: Extend root `pnpm-workspace.yaml`**

Read the current file. Current content should be:
```yaml
packages:
  - packages/*
```

Change to:
```yaml
packages:
  - packages/*
  - apps/*
```

- [ ] **Step 5: Add 3 scripts to root `package.json`**

Read the current `package.json`. Find the `"scripts"` block. Append these 3 entries (preserve existing ones):

```json
    "desktop:dev": "pnpm --filter @loom/desktop tauri dev",
    "desktop:build": "pnpm --filter @loom/desktop desktop:build",
    "desktop:sidecar": "pnpm --filter @loom/desktop sidecar:build"
```

Preserve trailing comma discipline. Final scripts block:

```json
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "start": "pnpm --filter @loom/server start",
    "start:prod": "pnpm -r run build && pnpm --filter @loom/server start",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint",
    "desktop:dev": "pnpm --filter @loom/desktop tauri dev",
    "desktop:build": "pnpm --filter @loom/desktop desktop:build",
    "desktop:sidecar": "pnpm --filter @loom/desktop sidecar:build"
  }
```

- [ ] **Step 6: Extend root `.gitignore`**

Append at the bottom:

```gitignore

# Tauri desktop build output
apps/desktop/src-tauri/target/
apps/desktop/src-tauri/gen/
apps/desktop/src-tauri/resources/loom-server-*
```

- [ ] **Step 7: Install the workspace**

```bash
cd D:/VibeProjects/skill-manager
pnpm install
```
Expected: pnpm installs 2 new devDeps (`@tauri-apps/cli`, `@yao-pkg/pkg`) into `apps/desktop/node_modules/`.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/ pnpm-workspace.yaml package.json pnpm-lock.yaml .gitignore
git commit -m "feat(desktop): scaffold @loom/desktop workspace (empty)"
```

---

### Task 2: Tauri Rust scaffold

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/capabilities/default.json`
- Create: `apps/desktop/src-tauri/src/main.rs` (minimal stub)
- Create: `apps/desktop/src-tauri/resources/.gitkeep`

- [ ] **Step 1: Create `apps/desktop/src-tauri/Cargo.toml`**

```toml
[package]
name = "loom-desktop"
version = "0.2.3"
description = "Loom — weave Claude Code skills into every project"
authors = ["puremixai"]
license = "MIT"
edition = "2021"
rust-version = "1.78"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-log = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
anyhow = "1"
regex = "1"
log = "0.4"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
incremental = false
opt-level = "s"
strip = true
```

- [ ] **Step 2: Create `apps/desktop/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Create `apps/desktop/src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Loom",
  "version": "0.2.3",
  "identifier": "dev.puremixai.loom",
  "build": {
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm run desktop:sidecar",
    "frontendDist": "../../packages/web/dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Loom",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "visible": false,
        "decorations": true,
        "resizable": true
      }
    ],
    "security": {
      "csp": "default-src 'self' http://127.0.0.1:* https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' http://127.0.0.1:*; style-src 'self' 'unsafe-inline' http://127.0.0.1:* https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' http://127.0.0.1:* data:; connect-src 'self' http://127.0.0.1:*"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "dmg", "appimage"],
    "externalBin": ["resources/loom-server"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installerIcon": "icons/icon.ico",
        "installMode": "currentUser"
      }
    },
    "category": "DeveloperTool",
    "shortDescription": "Per-project Claude Code skill manager",
    "longDescription": "Loom weaves Claude Code skills into every project via symlinks, with AI-assisted recommendations from committable rules."
  }
}
```

- [ ] **Step 4: Create `apps/desktop/src-tauri/capabilities/default.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "default",
  "description": "Loom desktop core capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-close",
    "core:window:allow-set-focus",
    "core:window:allow-is-visible",
    "core:webview:allow-navigate",
    "shell:default",
    "shell:allow-execute",
    "shell:allow-kill",
    "shell:allow-spawn",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-message",
    "log:default"
  ]
}
```

- [ ] **Step 5: Create `apps/desktop/src-tauri/src/main.rs` (stub)**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log::info!("Loom desktop starting (stub)");
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                window.show().ok();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
```

- [ ] **Step 6: Create placeholder `apps/desktop/src-tauri/resources/.gitkeep`** (empty file — keeps directory tracked)

```bash
touch apps/desktop/src-tauri/resources/.gitkeep
```

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src-tauri
git commit -m "feat(desktop): tauri rust scaffold (empty window stub)"
```

---

### Task 3: Application icons

**Files:**
- Create: `apps/desktop/src-tauri/icons/*` (5 platform variants)

- [ ] **Step 1: Provide a source icon**

Create a 1024×1024 PNG named `source-icon.png` somewhere on disk. For a quick test, you can download any placeholder (e.g., a solid-color 1024×1024 PNG). Real branding can be swapped in later.

Save it at `apps/desktop/src-tauri/icons/source-icon.png`.

- [ ] **Step 2: Generate all platform variants with Tauri CLI**

```bash
cd apps/desktop/src-tauri
cargo tauri icon icons/source-icon.png
```

Expected output directory after command:
```
icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns
├── icon.ico
├── Square30x30Logo.png
├── Square44x44Logo.png
├── Square71x71Logo.png
├── Square89x89Logo.png
├── Square107x107Logo.png
├── Square142x142Logo.png
├── Square150x150Logo.png
├── Square284x284Logo.png
├── Square310x310Logo.png
├── StoreLogo.png
└── source-icon.png
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/icons/
git commit -m "feat(desktop): add application icons (placeholder, 1024x1024 source)"
```

---

### Task 4: Verify dev mode loads Vite

**Files:** none changed in this task — manual verification only.

- [ ] **Step 1: Start backend + frontend in dev mode**

```bash
# Terminal 1
pnpm --filter @loom/server dev

# Terminal 2 (wait until Terminal 1 shows "Skill Manager running at http://127.0.0.1:4178")
pnpm --filter @loom/web dev
# Wait until it shows "Local: http://localhost:5173"
```

- [ ] **Step 2: Launch Tauri dev shell**

```bash
# Terminal 3
pnpm desktop:dev
```
Expected: Tauri compiles Rust (takes 2-5 minutes first time), then a native window titled "Loom" opens showing Loom's Projects page (identical to what Terminal 2's browser would show at `http://localhost:5173`).

- [ ] **Step 3: Manual smoke checklist**

- [ ] Window title bar says "Loom"
- [ ] Projects page renders
- [ ] Add a project via the web UI — should work (hits `/api` → Vite proxy → :4178)
- [ ] Open Settings, navigate via left-nav sidebar — works
- [ ] Open DevTools (right-click → Inspect Element, or `Ctrl+Shift+I`) — shows Loom's console, no CSP errors
- [ ] Close window → app quits (because no tray yet)

If any fails, report; do not proceed to M2.

- [ ] **Step 4: Commit (no code changes, but mark milestone)**

```bash
git commit --allow-empty -m "ci(desktop): M1 hello-world shell verified manually"
```

---

## M2 — Sidecar integration

### Task 5: Sidecar build script

**Files:**
- Create: `apps/desktop/scripts/build-sidecar.mjs`

- [ ] **Step 1: Create `apps/desktop/scripts/build-sidecar.mjs`**

```js
#!/usr/bin/env node
// Bundles the Loom server into a single executable via @yao-pkg/pkg.
// Invoked by `pnpm desktop:sidecar` (Tauri beforeBuildCommand).
import { exec } from '@yao-pkg/pkg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, '..');
const repoRoot = resolve(desktopRoot, '../..');
const serverDist = resolve(repoRoot, 'packages/server/dist/index.js');
const webDist = resolve(repoRoot, 'packages/web/dist');

if (!existsSync(serverDist)) {
  console.error(`[build-sidecar] missing server build: ${serverDist}`);
  console.error('[build-sidecar] run `pnpm build` first.');
  process.exit(1);
}
if (!existsSync(webDist)) {
  console.error(`[build-sidecar] missing web build: ${webDist}`);
  process.exit(1);
}

// Target triple mapping. pkg uses node<ver>-<os>-<arch>; Tauri expects
// <cmd>-<rust-triple>. We write files as <name>-<rust-triple>(.exe).
const targetEnv = process.env.SIDECAR_TARGET ?? 'node22-win-x64';
const tripleMap = {
  'node22-win-x64': { triple: 'x86_64-pc-windows-msvc', ext: '.exe' },
  'node22-macos-x64': { triple: 'x86_64-apple-darwin', ext: '' },
  'node22-macos-arm64': { triple: 'aarch64-apple-darwin', ext: '' },
  'node22-linux-x64': { triple: 'x86_64-unknown-linux-gnu', ext: '' },
  'node22-linux-arm64': { triple: 'aarch64-unknown-linux-gnu', ext: '' },
};
const target = tripleMap[targetEnv];
if (!target) {
  console.error(`[build-sidecar] unknown SIDECAR_TARGET: ${targetEnv}`);
  console.error(`[build-sidecar] valid: ${Object.keys(tripleMap).join(', ')}`);
  process.exit(1);
}

const resourcesDir = resolve(desktopRoot, 'src-tauri/resources');
mkdirSync(resourcesDir, { recursive: true });
const outFile = resolve(resourcesDir, `loom-server-${target.triple}${target.ext}`);

// pkg config embedded inline so we don't need a pkg section in server's package.json
// (would be a diff to packages/server). Assets include the web SPA so Fastify-static serves it.
const pkgConfig = {
  name: 'loom-server',
  bin: serverDist,
  pkg: {
    assets: [
      `${webDist.replace(/\\/g, '/')}/**/*`,
      `${resolve(repoRoot, 'packages/server/node_modules').replace(/\\/g, '/')}/**/*`,
      `${resolve(repoRoot, 'packages/shared/dist').replace(/\\/g, '/')}/**/*`,
    ],
    targets: [targetEnv],
    outputPath: resourcesDir,
  },
};

// Write a temporary manifest file (pkg reads from a json)
const tmpConfig = resolve(desktopRoot, '.pkg-config.json');
writeFileSync(tmpConfig, JSON.stringify(pkgConfig, null, 2));

console.log(`[build-sidecar] target: ${targetEnv} (${target.triple})`);
console.log(`[build-sidecar] entry:  ${serverDist}`);
console.log(`[build-sidecar] output: ${outFile}`);

try {
  await exec([
    serverDist,
    '--config', tmpConfig,
    '--targets', targetEnv,
    '--output', outFile,
    '--compress', 'GZip',
  ]);
  console.log(`[build-sidecar] done: ${outFile}`);
} catch (err) {
  console.error('[build-sidecar] pkg failed:', err);
  process.exit(1);
}
```

- [ ] **Step 2: Manual smoke — build server first**

```bash
cd D:/VibeProjects/skill-manager
pnpm build
```
Expected: `packages/server/dist/index.js` + `packages/web/dist/index.html` exist.

- [ ] **Step 3: Run the sidecar build**

```bash
pnpm desktop:sidecar
```
Expected: `apps/desktop/src-tauri/resources/loom-server-x86_64-pc-windows-msvc.exe` appears (~40MB). First run downloads Node runtime binary (one-time, ~50MB cache).

- [ ] **Step 4: Smoke the sidecar directly**

```bash
PORT=4180 NO_OPEN=1 ./apps/desktop/src-tauri/resources/loom-server-x86_64-pc-windows-msvc.exe
```
Expected stdout: `Skill Manager running at http://127.0.0.1:4180`

Open `http://127.0.0.1:4180/` in a browser → should show Loom UI. Kill with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/scripts/
git commit -m "feat(desktop): sidecar build script using @yao-pkg/pkg"
```

---

### Task 6: Rust sidecar module (port pick + spawn + ready handshake)

**Files:**
- Create: `apps/desktop/src-tauri/src/sidecar.rs`

- [ ] **Step 1: Create `apps/desktop/src-tauri/src/sidecar.rs`**

```rust
//! Node sidecar lifecycle — pick a free port, spawn the bundled Loom server,
//! wait for its "running at" line on stdout, and expose a kill handle.
//!
//! COUPLING NOTE: wait_for_ready parses `Skill Manager running at http://127.0.0.1:<port>`
//! from the server's stdout. If @loom/server ever changes that log line, this breaks.
//! See packages/server/src/index.ts.

use std::net::TcpListener;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use regex::Regex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::{process::{CommandChild, CommandEvent}, ShellExt};
use tokio::sync::Mutex;

pub struct Sidecar {
    port: u16,
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    /// Pick an OS-assigned free port on 127.0.0.1, release it, return the number.
    /// Small race window before the sidecar rebinds — acceptable for local tool.
    fn pick_port() -> Result<u16> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .context("bind 127.0.0.1:0 to pick a free port")?;
        let port = listener.local_addr()?.port();
        drop(listener);
        Ok(port)
    }

    /// Spawn the `loom-server` sidecar and block until it prints its ready line
    /// or the timeout elapses.
    pub async fn spawn(app: &AppHandle) -> Result<Self> {
        let port = Self::pick_port()?;
        log::info!("sidecar: allocating port {}", port);

        let sidecar = app
            .shell()
            .sidecar("loom-server")
            .context("construct sidecar command (did the binary get bundled?)")?
            .env("PORT", port.to_string())
            .env("NO_OPEN", "1")
            .env("LOOM_RUNTIME", "tauri-desktop");

        let (mut rx, child) = sidecar.spawn()
            .context("spawn sidecar process")?;

        let ready_port = wait_for_ready(&mut rx, Duration::from_secs(15))
            .await
            .context("sidecar did not report ready within timeout")?;

        if ready_port != port {
            return Err(anyhow!(
                "sidecar bound port {} but Tauri expected {}",
                ready_port, port
            ));
        }

        log::info!("sidecar: ready on http://127.0.0.1:{}", port);

        // Drain remaining events to /dev/null so the pipe buffer never fills
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(b) => log::debug!("sidecar: {}", String::from_utf8_lossy(&b).trim()),
                    CommandEvent::Stderr(b) => log::warn!("sidecar stderr: {}", String::from_utf8_lossy(&b).trim()),
                    CommandEvent::Error(e) => log::error!("sidecar error: {e}"),
                    CommandEvent::Terminated(p) => {
                        log::warn!("sidecar terminated: {:?}", p);
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(Self {
            port,
            child: Arc::new(Mutex::new(Some(child))),
        })
    }

    pub fn port(&self) -> u16 { self.port }
    pub fn url(&self) -> String { format!("http://127.0.0.1:{}", self.port) }

    pub async fn shutdown(&self) -> Result<()> {
        if let Some(child) = self.child.lock().await.take() {
            child.kill().context("kill sidecar")?;
            log::info!("sidecar: killed");
        }
        Ok(())
    }
}

async fn wait_for_ready(
    rx: &mut tauri::async_runtime::Receiver<CommandEvent>,
    timeout: Duration,
) -> Result<u16> {
    let pattern = Regex::new(r"running at http://127\.0\.0\.1:(\d+)").unwrap();
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        let remaining = deadline.checked_duration_since(tokio::time::Instant::now())
            .ok_or_else(|| anyhow!("timeout"))?;
        let event = tokio::time::timeout(remaining, rx.recv())
            .await
            .map_err(|_| anyhow!("timeout waiting for sidecar ready line"))?
            .ok_or_else(|| anyhow!("sidecar stdout pipe closed before ready"))?;
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                if let Some(cap) = pattern.captures(&text) {
                    return Ok(cap[1].parse()?);
                }
                log::debug!("sidecar (pre-ready): {}", text.trim());
            }
            CommandEvent::Stderr(b) => {
                log::warn!("sidecar stderr (pre-ready): {}", String::from_utf8_lossy(&b).trim());
            }
            CommandEvent::Terminated(payload) => {
                return Err(anyhow!("sidecar exited before ready: {:?}", payload));
            }
            CommandEvent::Error(e) => {
                return Err(anyhow!("sidecar process error: {e}"));
            }
            _ => {}
        }
    }
}
```

- [ ] **Step 2: Verify Rust compiles**

```bash
cd apps/desktop/src-tauri
cargo check
```
Expected: compiles with warnings at most (not referenced from main.rs yet).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/sidecar.rs
git commit -m "feat(desktop): sidecar module — port pick + spawn + ready handshake"
```

---

### Task 7: Wire sidecar into `main.rs` — navigate WebView to sidecar URL

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Replace `apps/desktop/src-tauri/src/main.rs` contents**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sidecar;

use sidecar::Sidecar;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match Sidecar::spawn(&handle).await {
                    Ok(sc) => {
                        let url = sc.url();
                        handle.manage(sc);

                        if let Some(window) = handle.get_webview_window("main") {
                            match url.parse() {
                                Ok(u) => { window.navigate(u).ok(); }
                                Err(e) => log::error!("url parse: {e}"),
                            }
                            window.show().ok();
                        }
                    }
                    Err(e) => {
                        log::error!("sidecar startup failed: {e:?}");
                        // Minimal fail fast: exit. Polish adds a dialog in Task 14.
                        handle.exit(1);
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
```

- [ ] **Step 2: Build + run in production mode (first real sidecar test)**

```bash
cd D:/VibeProjects/skill-manager
pnpm build                                 # ensure server/web dist are fresh
pnpm desktop:sidecar                       # rebuild sidecar exe
cd apps/desktop
pnpm tauri build --debug                   # faster than --release for first check
```
Expected: `src-tauri/target/debug/bundle/nsis/Loom_0.2.3_x64-setup.exe` (or similar).

- [ ] **Step 3: Install and verify**

Run the installer → launch Loom from Start menu or desktop shortcut.

Manual checklist:
- [ ] Window appears after ~1–3 seconds (sidecar warm-up)
- [ ] Window shows Loom Projects page (served by sidecar, not Vite)
- [ ] Add a project via UI — works
- [ ] DevTools shows `fetch` calls to `http://127.0.0.1:<random-port>/api/…`
- [ ] Task Manager shows both `Loom.exe` and `loom-server-….exe` processes
- [ ] Closing Loom window exits app; `loom-server` process is killed too

If sidecar doesn't start: check `%APPDATA%/dev.puremixai.loom/logs/` for Rust log output; check `stderr` for Node errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): spawn sidecar on setup and point WebView at its URL"
```

---

### Task 8: Capabilities tightening + CSP verification

**Files:**
- Modify: `apps/desktop/src-tauri/capabilities/default.json` (already created in Task 2 — this task validates it)

- [ ] **Step 1: Re-read capabilities**

Open `apps/desktop/src-tauri/capabilities/default.json` and verify it matches what was created in Task 2. If any permissions are missing (e.g., `core:webview:allow-navigate` is needed for `window.navigate()`), ensure they are listed.

Minimum required permissions for v1:
- `core:default`
- `core:window:allow-show`, `allow-hide`, `allow-close`, `allow-set-focus`, `allow-is-visible`
- `core:webview:allow-navigate`
- `shell:default`, `shell:allow-execute`, `shell:allow-kill`, `shell:allow-spawn`
- `dialog:default`, `dialog:allow-open`, `dialog:allow-message`
- `log:default`

- [ ] **Step 2: Verify CSP permits the sidecar**

Open `apps/desktop/src-tauri/tauri.conf.json` — the CSP string under `app.security.csp` must include `http://127.0.0.1:*` in `default-src`, `script-src`, `connect-src`, `style-src`, and `img-src`. Verify each is present.

- [ ] **Step 3: Rebuild and re-verify (no install needed if debug build still valid)**

```bash
cd apps/desktop/src-tauri
cargo tauri build --debug
```

Install the fresh installer, open app, open DevTools → Console. If any "Refused to connect to 'http://127.0.0.1:…' because it violates the following CSP directive" errors appear, that directive needs to include `http://127.0.0.1:*`.

- [ ] **Step 4: Commit (only if you changed anything)**

If no changes were needed:
```bash
git commit --allow-empty -m "ci(desktop): capabilities + CSP audit pass"
```

If edits were needed:
```bash
git add apps/desktop/src-tauri/capabilities/default.json apps/desktop/src-tauri/tauri.conf.json
git commit -m "fix(desktop): capabilities + CSP tightening"
```

---

### Task 9: Production build verification

**Files:** none changed — this is a gate task.

- [ ] **Step 1: Clean and rebuild everything from scratch**

```bash
cd D:/VibeProjects/skill-manager
rm -rf apps/desktop/src-tauri/target apps/desktop/src-tauri/resources/loom-server-*
pnpm build
pnpm desktop:build
```
Expected final output (Windows):
- `apps/desktop/src-tauri/target/release/bundle/msi/Loom_0.2.3_x64_en-US.msi`
- `apps/desktop/src-tauri/target/release/bundle/nsis/Loom_0.2.3_x64-setup.exe`

- [ ] **Step 2: Install the MSI on a clean user profile (optional, but recommended)**

This validates the installer works without the dev machine's caches. Right-click MSI → Install → Loom appears in Start menu.

- [ ] **Step 3: Full M2 smoke checklist**

Launch the installed Loom (not via `tauri dev`):
- [ ] Splash/empty window shows briefly, then main UI at ~1–3 s
- [ ] All four routes work: Projects, Project detail, Skills, Settings
- [ ] Add Project via UI — disk link gets created
- [ ] Settings → User skills directory — change path — saves
- [ ] Close Loom → `loom-server` process gone from Task Manager

**If any step fails: don't proceed to M3.**

- [ ] **Step 4: Mark milestone**

```bash
git commit --allow-empty -m "ci(desktop): M2 sidecar-backed installer verified"
```

---

## M3 — Tray icon + native dialogs

### Task 10: Tray icon module

**Files:**
- Create: `apps/desktop/src-tauri/src/tray.rs`

- [ ] **Step 1: Create `apps/desktop/src-tauri/src/tray.rs`**

```rust
//! System tray icon + menu. Entry points that call the sidecar via HTTP
//! live in `dialog.rs`; this module only wires menu events.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::dialog;

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Loom", true, None::<&str>)?;
    let add_project = MenuItem::with_id(app, "add_project", "Add Project…", true, None::<&str>)?;
    let change_usk = MenuItem::with_id(app, "change_user_skills_dir", "Change user skills dir…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let about = MenuItem::with_id(app, "about", "About Loom", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &add_project, &change_usk, &sep, &about, &quit])?;

    TrayIconBuilder::with_id("loom-tray")
        .tooltip("Loom")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let app_handle = app.clone();
            match event.id.as_ref() {
                "show" => reveal_window(&app_handle),
                "add_project" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move { dialog::add_project(&a).await.ok(); });
                }
                "change_user_skills_dir" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move { dialog::change_user_skills_dir(&a).await.ok(); });
                }
                "about" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move { dialog::show_about(&a).await.ok(); });
                }
                "quit" => app_handle.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                let app = tray.app_handle();
                toggle_window(app);
            }
        })
        .build(app)?;
    Ok(())
}

fn reveal_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        w.show().ok();
        w.set_focus().ok();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        if visible { w.hide().ok(); } else { w.show().ok(); w.set_focus().ok(); }
    }
}
```

- [ ] **Step 2: Don't wire into main.rs yet — still need dialog.rs**

```bash
cd apps/desktop/src-tauri
cargo check
```
Expected: may show "unused module `tray`" warning (it references `dialog` which doesn't exist yet — will fail to compile). That's OK — we fix in Task 11.

If `cargo check` errors on the import of `crate::dialog`, skip the check — we'll fix compilation in Task 12 after dialog.rs lands.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/tray.rs
git commit -m "feat(desktop): tray icon + menu (wiring pending)"
```

---

### Task 11: Dialog module — native directory picker → sidecar HTTP

**Files:**
- Create: `apps/desktop/src-tauri/src/dialog.rs`

- [ ] **Step 1: Create `apps/desktop/src-tauri/src/dialog.rs`**

```rust
//! Native dialog entry points invoked from the tray menu. Each picks a
//! directory via the OS dialog, then calls the sidecar's REST API to mutate
//! state, then navigates the WebView so the user sees the effect.

use anyhow::{anyhow, Result};
use serde_json::json;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

use crate::sidecar::Sidecar;

pub async fn add_project(app: &AppHandle) -> Result<()> {
    let sc = app.state::<Sidecar>();
    let sidecar_url = sc.url();

    let Some(folder) = app.dialog().file().blocking_pick_folder() else {
        return Ok(()); // user cancelled
    };
    let path = folder.to_string();

    let endpoint = format!("{}/api/projects", sidecar_url);
    let client = reqwest::Client::new();
    let resp = client
        .post(&endpoint)
        .json(&json!({ "path": path }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        app.dialog()
            .message(format!("Add Project failed:\n{body}"))
            .kind(MessageDialogKind::Error)
            .blocking_show();
        return Err(anyhow!("add project request failed"));
    }

    navigate_to(app, &format!("{}/", sidecar_url))
}

pub async fn change_user_skills_dir(app: &AppHandle) -> Result<()> {
    let sc = app.state::<Sidecar>();
    let sidecar_url = sc.url();

    let Some(folder) = app.dialog().file().blocking_pick_folder() else {
        return Ok(());
    };
    let path = folder.to_string();

    let endpoint = format!("{}/api/settings", sidecar_url);
    let resp = reqwest::Client::new()
        .put(&endpoint)
        .json(&json!({ "userSkillsDir": path }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        app.dialog()
            .message(format!("Change user skills directory failed:\n{body}"))
            .kind(MessageDialogKind::Error)
            .blocking_show();
        return Err(anyhow!("settings request failed"));
    }

    navigate_to(app, &format!("{}/settings", sidecar_url))
}

pub async fn show_about(app: &AppHandle) -> Result<()> {
    app.dialog()
        .message(format!(
            "Loom v{}\n\nWeave Claude Code skills into every project.\n\nhttps://github.com/puremixai/loom",
            env!("CARGO_PKG_VERSION")
        ))
        .kind(MessageDialogKind::Info)
        .blocking_show();
    Ok(())
}

/// Helper: navigate the main WebView to the given URL (no-op if window gone).
fn navigate_to(app: &AppHandle, url: &str) -> Result<()> {
    let parsed = url.parse().map_err(|e| anyhow!("url parse: {e}"))?;
    if let Some(w) = app.get_webview_window("main") {
        w.navigate(parsed).map_err(|e| anyhow!("navigate: {e}"))?;
        w.show().ok();
        w.set_focus().ok();
    }
    Ok(())
}

/// Show a fatal error dialog then exit. Used by startup failures.
pub fn show_fatal(app: &AppHandle, msg: &str) {
    app.dialog()
        .message(msg)
        .kind(MessageDialogKind::Error)
        .blocking_show();
    app.exit(1);
}
```

- [ ] **Step 2: Verify compiles (still not wired into main.rs)**

```bash
cd apps/desktop/src-tauri
cargo check
```
Expected: compiles successfully (tray.rs can now find `crate::dialog`).

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/dialog.rs
git commit -m "feat(desktop): native directory-picker dialogs + sidecar HTTP glue"
```

---

### Task 12: Wire tray + dialogs into `main.rs`

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Replace `apps/desktop/src-tauri/src/main.rs` contents**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dialog;
mod sidecar;
mod tray;

use sidecar::Sidecar;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match Sidecar::spawn(&handle).await {
                    Ok(sc) => {
                        let url = sc.url();
                        handle.manage(sc);

                        if let Some(window) = handle.get_webview_window("main") {
                            match url.parse() {
                                Ok(u) => { window.navigate(u).ok(); }
                                Err(e) => log::error!("url parse: {e}"),
                            }
                            window.show().ok();
                        }

                        if let Err(e) = tray::install(&handle) {
                            log::error!("tray install failed: {e}");
                        }
                    }
                    Err(e) => {
                        log::error!("sidecar startup failed: {e:?}");
                        dialog::show_fatal(&handle, &format!("Failed to start Loom server:\n\n{e}"));
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
```

- [ ] **Step 2: Rebuild + install + smoke**

```bash
cd D:/VibeProjects/skill-manager
pnpm desktop:build
```
Install latest installer, launch Loom.

Tray smoke checklist:
- [ ] Tray icon appears (near clock, Windows system tray)
- [ ] Hover shows tooltip "Loom"
- [ ] Left-click tray → if window hidden, shows; if visible, hides
- [ ] Right-click tray → menu with 6 items
- [ ] Show Loom → window appears
- [ ] Add Project… → native Windows directory picker → pick any folder → Loom reloads → project appears in list
- [ ] Change user skills dir… → picker → save → Settings page reloads
- [ ] About Loom → info dialog with version
- [ ] Quit → app exits, tray icon gone, `loom-server` process killed

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): wire tray + dialogs into main (M3 complete)"
```

---

## M4 — Polish

### Task 13: Close-to-tray window behavior

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add `on_window_event` handler**

Edit `apps/desktop/src-tauri/src/main.rs`. Find the `.setup(...)` block. AFTER its closing `)` and BEFORE `.run(...)`, insert `.on_window_event(...)`:

```rust
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().ok();
            }
        })
        .run(tauri::generate_context!())
```

Full updated `main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dialog;
mod sidecar;
mod tray;

use sidecar::Sidecar;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match Sidecar::spawn(&handle).await {
                    Ok(sc) => {
                        let url = sc.url();
                        handle.manage(sc);

                        if let Some(window) = handle.get_webview_window("main") {
                            match url.parse() {
                                Ok(u) => { window.navigate(u).ok(); }
                                Err(e) => log::error!("url parse: {e}"),
                            }
                            window.show().ok();
                        }

                        if let Err(e) = tray::install(&handle) {
                            log::error!("tray install failed: {e}");
                        }
                    }
                    Err(e) => {
                        log::error!("sidecar startup failed: {e:?}");
                        dialog::show_fatal(&handle, &format!("Failed to start Loom server:\n\n{e}"));
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().ok();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
```

- [ ] **Step 2: Smoke test — close behavior**

Rebuild and install:
```bash
cd D:/VibeProjects/skill-manager && pnpm desktop:build
```

Manual:
- [ ] Click the window close (X) button → window disappears
- [ ] Tray icon still present
- [ ] Tray → Show Loom → window returns
- [ ] Tray → Quit → app fully exits

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): close-to-tray (window close hides instead of exits)"
```

---

### Task 14: Sidecar cleanup on app exit

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [ ] **Step 1: Add `RunEvent::ExitRequested` handler**

Find the `.run(tauri::generate_context!())` line in `main.rs`. Replace the whole `.run(...).expect(...)` block with an explicit builder that hooks `run` with an event closure:

```rust
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } => {
                    if let Some(sc) = app_handle.try_state::<Sidecar>() {
                        tauri::async_runtime::block_on(async {
                            if let Err(e) = sc.shutdown().await {
                                log::error!("sidecar shutdown: {e}");
                            }
                        });
                    }
                }
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        w.show().ok();
                        w.set_focus().ok();
                    }
                }
                _ => {}
            }
        });
```

Full final `main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dialog;
mod sidecar;
mod tray;

use sidecar::Sidecar;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match Sidecar::spawn(&handle).await {
                    Ok(sc) => {
                        let url = sc.url();
                        handle.manage(sc);

                        if let Some(window) = handle.get_webview_window("main") {
                            match url.parse() {
                                Ok(u) => { window.navigate(u).ok(); }
                                Err(e) => log::error!("url parse: {e}"),
                            }
                            window.show().ok();
                        }

                        if let Err(e) = tray::install(&handle) {
                            log::error!("tray install failed: {e}");
                        }
                    }
                    Err(e) => {
                        log::error!("sidecar startup failed: {e:?}");
                        dialog::show_fatal(&handle, &format!("Failed to start Loom server:\n\n{e}"));
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().ok();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } => {
                    if let Some(sc) = app_handle.try_state::<Sidecar>() {
                        tauri::async_runtime::block_on(async {
                            if let Err(e) = sc.shutdown().await {
                                log::error!("sidecar shutdown: {e}");
                            }
                        });
                    }
                }
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        w.show().ok();
                        w.set_focus().ok();
                    }
                }
                _ => {}
            }
        });
}
```

- [ ] **Step 2: Smoke — verify sidecar always gets cleaned up**

Rebuild and install. Test four exit paths:

1. Close window → tray still there → Quit menu → app gone, sidecar gone ✓
2. Close window → Task Manager "End Task" on Loom.exe → sidecar should also die (parent-child cleanup) or linger (test it)
3. Open Loom, then force-kill `loom-server.exe` directly → Loom shows error state but stays open (v1 leaves recovery to user)

Accept behaviors 1 and 2 as correct. Behavior 3 is known limitation per spec §11.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/src/main.rs
git commit -m "feat(desktop): sidecar cleanup on exit + macOS Reopen"
```

---

### Task 15: M4 polish verification

**Files:** none changed — final M4 manual check.

- [ ] **Step 1: Full polish smoke checklist**

- [ ] Splash: no visible lag, window appears after 1–3 s
- [ ] All app routes render through sidecar
- [ ] Tray icon + full menu works (all 6 entries)
- [ ] Close window → hides to tray
- [ ] Tray Quit → fully exits
- [ ] sidecar process gone from Task Manager after Quit
- [ ] Task Manager lingering: none
- [ ] Logs: open `%APPDATA%/dev.puremixai.loom/logs/loom-desktop.log` → startup traces present

- [ ] **Step 2: Mark milestone**

```bash
git commit --allow-empty -m "ci(desktop): M4 polish verified"
```

---

## M5 — CI Release

### Task 16: Desktop release workflow

**Files:**
- Create: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Create `.github/workflows/desktop-release.yml`**

```yaml
name: Desktop Release

on:
  push:
    tags:
      - 'v*-desktop'

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-2022
            sidecar_target: node22-win-x64
            artifacts_glob: |
              apps/desktop/src-tauri/target/release/bundle/msi/*.msi
              apps/desktop/src-tauri/target/release/bundle/nsis/*.exe
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: 'apps/desktop/src-tauri -> target'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build shared/server/web
        run: pnpm build

      - name: Build sidecar binary
        env:
          SIDECAR_TARGET: ${{ matrix.sidecar_target }}
        run: pnpm desktop:sidecar

      - name: Build Tauri app
        run: pnpm --filter @loom/desktop tauri build

      - name: Attach installers to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          files: ${{ matrix.artifacts_glob }}
          draft: false
          prerelease: ${{ contains(github.ref_name, 'beta') || contains(github.ref_name, 'rc') }}
          fail_on_unmatched_files: false
```

- [ ] **Step 2: Verify YAML**

Open in a YAML linter (VSCode, yamllint, etc.) — no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci(desktop): add release workflow (Windows matrix for v1)"
```

- [ ] **Step 4: End-to-end CI dry run (optional, creates a real release)**

Tag + push (when ready to do a first public build):
```bash
git tag v0.2.3-desktop
git push origin v0.2.3-desktop
```

Then watch <https://github.com/puremixai/loom/actions> — the `Desktop Release` workflow should run (~15 min), and installers appear under <https://github.com/puremixai/loom/releases/tag/v0.2.3-desktop>.

---

### Task 17: Project-level README for desktop + changelog

**Files:**
- Modify: `apps/desktop/README.md` (expand the stub from Task 1)
- Modify: root `CHANGELOG.md` + `CHANGELOG.zh.md` (add [0.2.3-desktop] entry or equivalent)

- [ ] **Step 1: Expand `apps/desktop/README.md`**

Replace its contents with:

```markdown
# @loom/desktop

Tauri-based cross-platform desktop shell for [Loom](../../README.md). Wraps the existing Fastify + React SPA with zero modifications to the core packages.

## Architecture

```
Tauri main (Rust) ──spawn──► loom-server (Node sidecar, pkg-bundled)
      │                                │
      │                                │ 127.0.0.1:<random-port>
      ▼                                ▼
   WebView ──navigate──► http://127.0.0.1:<random-port>/
```

Full design: [`docs/superpowers/specs/2026-04-21-desktop-tauri-design.md`](../../docs/superpowers/specs/2026-04-21-desktop-tauri-design.md).

## Development

Requires Rust 1.78+, Node 22+, pnpm 9.12+.

```bash
# Terminal 1 — Loom server (Fastify :4178)
pnpm --filter @loom/server dev

# Terminal 2 — Loom web (Vite :5173 with /api proxy)
pnpm --filter @loom/web dev

# Terminal 3 — Tauri shell, loads http://localhost:5173
pnpm desktop:dev
```

Tauri reloads automatically when its Rust sources change. The WebView hot-reloads via Vite when React sources change.

## Production build

```bash
pnpm desktop:build
```

Output (Windows):
- `src-tauri/target/release/bundle/msi/Loom_0.2.3_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Loom_0.2.3_x64-setup.exe`

Cross-platform sidecar target:
```bash
SIDECAR_TARGET=node22-macos-arm64 pnpm desktop:sidecar
# then build on the target platform:
# cargo tauri build
```

## Release

Push a `v*-desktop` tag (e.g. `v0.2.3-desktop`) — GitHub Actions
`.github/workflows/desktop-release.yml` matrix builds installers and attaches
them to the corresponding GitHub Release.

## Known limitations (v1)

- Unsigned installers (users click through SmartScreen warning)
- No auto-updater
- No autostart
- No in-page native file picker — use tray menu "Add Project…" and "Change user skills dir…"
- No sidecar auto-restart on crash
```

- [ ] **Step 2: Add CHANGELOG entry (English + Chinese)**

Edit `CHANGELOG.md`. Insert above the current top `[0.2.3]` section:

```markdown
## [0.2.3-desktop] — 2026-04-21

### Added

- **Desktop app (Tauri) — initial release**. Windows `.msi` and NSIS `.exe` installers that bundle the Fastify server as a Node sidecar. Core UX identical to the web version. Tray icon with Show / Add Project / Change user skills dir / Quit entries. Close-to-tray on window close. Zero changes to `packages/shared|server|web` — desktop code lives entirely in `apps/desktop/`. See [docs/superpowers/specs/2026-04-21-desktop-tauri-design.md](docs/superpowers/specs/2026-04-21-desktop-tauri-design.md).

### CI

- `.github/workflows/desktop-release.yml` — builds and attaches desktop installers on `v*-desktop` tags.
```

Add link at the bottom (link list):
```markdown
[0.2.3-desktop]: https://github.com/puremixai/loom/releases/tag/v0.2.3-desktop
```

Edit `CHANGELOG.zh.md` similarly:

```markdown
## [0.2.3-desktop] — 2026-04-21

### 新增

- **桌面应用（Tauri）首版发布**。Windows `.msi` 和 NSIS `.exe` 安装包，内嵌 Fastify 为 Node sidecar。核心体验与 Web 版一致。系统托盘含 Show / Add Project / Change user skills dir / Quit 菜单。关窗不退出、最小化到托盘。`packages/shared|server|web` 零改动——桌面相关代码全部位于 `apps/desktop/`。详见 [docs/superpowers/specs/2026-04-21-desktop-tauri-design.md](docs/superpowers/specs/2026-04-21-desktop-tauri-design.md)。

### CI

- `.github/workflows/desktop-release.yml` —— 推 `v*-desktop` tag 时自动构建并挂载桌面 installer。
```

Add link at bottom:
```markdown
[0.2.3-desktop]: https://github.com/puremixai/loom/releases/tag/v0.2.3-desktop
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/README.md CHANGELOG.md CHANGELOG.zh.md
git commit -m "docs(desktop): expand apps/desktop/README + changelog 0.2.3-desktop"
```

---

## Self-Review

**Spec coverage check** (against `2026-04-21-desktop-tauri-design.md`):

| Spec section | Task(s) |
|---|---|
| §1 Background + goals | Implicitly satisfied by all tasks |
| §2 Non-goals | Not implemented (that's the point) |
| §3 Architecture | Tasks 5–9, 10–12 |
| §4 File structure | Task 1 (skeleton), 2 (scaffold) |
| §5.1 Dev mode | Task 4 |
| §5.2 Prod build | Tasks 5, 7, 9 |
| §5.3 Sidecar packaging | Task 5 |
| §5.4 `tauri.conf.json` | Task 2 |
| §5.5 Capabilities | Task 2, 8 |
| §6.1 `sidecar.rs` | Task 6 |
| §6.2 `main.rs` | Tasks 2 (stub), 7 (sidecar), 12 (tray), 13 (close-to-tray), 14 (exit cleanup + reopen) |
| §6.3 `tray.rs` | Task 10 |
| §6.4 `dialog.rs` | Task 11 |
| §7 Interaction design | Tasks 12–14 manual smoke checklists |
| §8 Error handling | Task 14 (fatal + Terminated), Task 11 (per-dialog errors) |
| §9 CI / Release | Task 16 |
| §10 Testing strategy | Manual smoke embedded in each M's final task |
| §11 Risks | Mitigations embedded in tasks where applicable |
| §12 Milestones | 5 milestones match tasks 1–4, 5–9, 10–12, 13–15, 16–17 |
| §13 Zero-diff guarantee | Tasks 1 (workspace), 5 (sidecar), 6 (PORT env) — none touches packages/* |

**No gaps.**

**Placeholder scan:** searched for TBD / TODO / "similar to" / "handle edge cases" — none found. Every step has concrete code or commands.

**Type consistency spot-check:**
- `Sidecar` struct fields `port: u16`, `child: Arc<Mutex<Option<CommandChild>>>` used consistently across Tasks 6, 7, 11, 14.
- `sidecar_url` / `url()` method used consistently across Tasks 7, 11.
- Tauri v2 API calls (`get_webview_window`, `navigate`, `state`, `manage`) consistent across all main.rs versions.
- `tauri::RunEvent` variants `ExitRequested` and `Reopen` used only in Task 14, no other references.
- `CommandEvent` variants (`Stdout`, `Stderr`, `Terminated`, `Error`) used consistently in Task 6.

**Known intentional gaps (non-goals):** signing, auto-updater, autostart, notifications, in-page native picker, auto-restart, macOS/Linux CI — all explicitly deferred per spec §2.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-21-desktop-tauri-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Note: some tasks require a Windows dev machine with Rust toolchain (Tasks 4, 7, 9, 12, 13, 14 have manual smoke steps that only you can run); those will come back as DONE_WITH_CONCERNS awaiting human verification.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
