---
title: Loom Desktop — Tauri + Node Sidecar
date: 2026-04-21
status: approved
authors: [user, claude-opus-4-7]
supersedes: none
depends-on: 2026-04-20-loom-design.md
---

# Loom Desktop (v1) — Tauri + Node Sidecar

## 1. 背景与目标

v0.1-v0.2 的 Loom 是"本地 Web 应用"，用户需 `pnpm install && pnpm start`，浏览器手动访问 localhost。这对开发者够用，但：

- **分发门槛**：非开发者 / 尚未装 Node 的用户无法直接使用
- **体验断层**：每次都要开终端启服务；关终端即断服务；没有系统托盘、图标、原生窗口感
- **"原生软件"观感缺失**：localhost 标签页不是一个能给人"装在电脑上"心智的产品形态

本 spec 设计**基于 Tauri 的跨平台桌面壳**，包装现有 Fastify + React SPA，产出 Windows `.msi`、macOS `.dmg`、Linux `.AppImage` 三端 installer。

### 硬约束

**`packages/shared/*`、`packages/server/*`、`packages/web/*` 全部零 diff**。所有新增代码落在：
- `apps/desktop/`（pnpm workspace 新成员 `@loom/desktop`）
- `.github/workflows/desktop-release.yml`
- 根 `package.json` 追加 3 个脚本（`desktop:dev` / `desktop:build` / `desktop:sidecar`）

技术可行性依据：`packages/server/src/index.ts` 已读 `process.env.PORT`，Tauri main 选好端口后传 env 即可。WebView 加载 sidecar 的 HTTP URL，现有 web 的相对 `/api` 路径原生可用。

## 2. 非目标

v1 明确不做：

- ❌ 页面内 `<Input>` 替换为原生目录选择器（要改 web 代码）—— 通过托盘菜单入口补足
- ❌ macOS / Linux 的 CI 构建（架构准备好，但 release workflow 只启 Windows matrix）
- ❌ Code signing（Windows EV 证书、Apple Notarization）
- ❌ Auto-updater
- ❌ 开机自启动
- ❌ 系统通知 / 全局热键 / 拖拽注册项目
- ❌ sidecar 异常自动重启（v1 报错并退出，留给用户手动重开）
- ❌ 把 SPA 打进 Tauri assets 用 `tauri://` scheme（走 HTTP 才能零 diff）

## 3. 架构概览

```
┌──────────────────────────────────────────────────────────────────┐
│  Loom.app (Tauri main process, Rust, ~15MB)                      │
│                                                                  │
│  启动流程：                                                       │
│   1. pick_port() → OS 随机端口 P                                 │
│   2. spawn sidecar 带 env PORT=P, NO_OPEN=1                      │
│   3. wait_for_ready 解析 stdout "running at http://...:P"        │
│   4. WebviewWindow.navigate("http://127.0.0.1:P/")               │
│   5. window.show() + install tray                                │
│                                                                  │
│  生命周期：                                                       │
│   - 关窗 → hide 到托盘（不退出）                                  │
│   - 托盘 "Quit" / macOS Cmd+Q → exit, sidecar.kill()             │
│   - sidecar 意外退出 → 报错 dialog，不自动重启（v1）              │
└───────────────┬──────────────────────────────────────────────────┘
                │ Tauri shell plugin (spawn/kill)
┌───────────────▼──────────────────────────────────────────────────┐
│  loom-server (Node sidecar, pkg-bundled, ~40MB)                  │
│   - 现有 Fastify 代码零改动                                       │
│   - 监听 127.0.0.1:$PORT                                         │
│   - 服务 API + 静态 SPA 一体                                      │
│   - stdout 首行含 "Skill Manager running at ..." 用于握手         │
└───────▲──────────────────────────────────────────────────────────┘
        │ HTTP
┌───────┴─────────┐
│   WebView       │  加载 http://127.0.0.1:P/ —— Fastify 的 static + SPA
│   Vite 产物     │  apiFetch 相对 /api/* —— 零改动
│   + __TAURI__   │  通过 CSP + capabilities 允许（仅本地可用）
└─────────────────┘
```

## 4. 文件结构

```
loom/
├─ apps/
│  └─ desktop/                              NEW @loom/desktop workspace 成员
│     ├─ package.json
│     ├─ src-tauri/
│     │  ├─ Cargo.toml
│     │  ├─ Cargo.lock
│     │  ├─ build.rs
│     │  ├─ tauri.conf.json
│     │  ├─ capabilities/
│     │  │  └─ default.json                 权限白名单（dialog, shell, window）
│     │  ├─ icons/                          平台图标（ico, icns, png）
│     │  ├─ resources/                      build 时注入 sidecar 产物
│     │  │  └─ .gitkeep
│     │  └─ src/
│     │     ├─ main.rs                      入口 + 窗口事件 + 退出清理
│     │     ├─ sidecar.rs                   端口选择 + spawn + ready 握手 + kill
│     │     ├─ tray.rs                      托盘菜单构造 + 点击处理
│     │     └─ dialog.rs                    Add Project / Change user skills dir
│     ├─ scripts/
│     │  └─ build-sidecar.mjs               @yao-pkg/pkg 打包 server → exe
│     ├─ .gitignore                         忽略 target/, resources/loom-server*
│     └─ README.md
├─ .github/workflows/
│  └─ desktop-release.yml                   NEW tag v*-desktop → Tauri matrix build
├─ package.json                             3 行 scripts 追加
└─ ... 其余不变
```

## 5. 构建系统

### 5.1 开发模式

```bash
# Terminal 1
pnpm --filter @loom/server dev               # tsx watch Fastify on :4178
# Terminal 2
pnpm --filter @loom/web dev                  # Vite dev server on :5173
# Terminal 3
pnpm desktop:dev                             # cargo tauri dev → 加载 http://localhost:5173
```

开发时 Tauri 不启 sidecar；它的 WebView 直接指向 Vite dev server，Vite 的 `/api` proxy 把请求转到 `:4178` 的已在运行的 Fastify。热更新、devtools、sourcemap 全部保留。

### 5.2 生产构建（单机）

```bash
pnpm desktop:build
```

背后：

1. **`pnpm build`**（现有）：
   - `@loom/shared` → tsc → `packages/shared/dist/`
   - `@loom/server` → tsc → `packages/server/dist/`
   - `@loom/web` → vite build → `packages/web/dist/`
2. **`pnpm desktop:sidecar`**（新）：跑 `apps/desktop/scripts/build-sidecar.mjs`
   - 用 `@yao-pkg/pkg` 把 `@loom/server` 的 `dist/index.js` + `node_modules/`（需要的）+ `@loom/shared/dist/` 打成单文件可执行
   - 产物：`apps/desktop/src-tauri/resources/loom-server-x86_64-pc-windows-msvc.exe`（或对应三元组）
3. **`cargo tauri build`**（由 `tauri.conf.json` 的 `beforeBuildCommand` 自动编排）：
   - 把 `resources/loom-server-*` 作为 externalBin 纳入 installer
   - 产出 `.msi` / `.dmg` / `.AppImage`

### 5.3 sidecar 打包策略（`scripts/build-sidecar.mjs`）

```js
// 使用 @yao-pkg/pkg（Node 22 兼容 fork，原 pkg 已不维护）
import { exec } from '@yao-pkg/pkg';
import { resolve } from 'node:path';

const target = process.env.SIDECAR_TARGET ?? 'node22-win-x64';
const outDir = resolve('src-tauri/resources');
const entry = resolve('../../packages/server/dist/index.js');

// 目标文件名按 Tauri externalBin 命名规范
const triple = {
  'node22-win-x64': 'x86_64-pc-windows-msvc',
  'node22-macos-x64': 'x86_64-apple-darwin',
  'node22-macos-arm64': 'aarch64-apple-darwin',
  'node22-linux-x64': 'x86_64-unknown-linux-gnu',
}[target];

await exec([
  entry,
  '--targets', target,
  '--output', resolve(outDir, `loom-server-${triple}`),
  '--compress', 'GZip',
]);
```

**产物命名**：Tauri 的 `externalBin` 要求文件名为 `<name>-<target-triple>[.exe]`。上述映射确保自动识别。

### 5.4 `tauri.conf.json` 关键字段

```json
{
  "productName": "Loom",
  "identifier": "dev.puremixai.loom",
  "version": "0.2.3",
  "build": {
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "pnpm run desktop:sidecar",
    "frontendDist": "../../packages/web/dist"
  },
  "app": {
    "windows": [{
      "label": "main",
      "title": "Loom",
      "width": 1280, "height": 800,
      "minWidth": 960, "minHeight": 600,
      "visible": false
    }],
    "security": {
      "csp": "default-src 'self' http://127.0.0.1:* https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self' http://127.0.0.1:*; style-src 'self' 'unsafe-inline' http://127.0.0.1:* https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' http://127.0.0.1:* data:; connect-src 'self' http://127.0.0.1:*"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "dmg", "appimage"],
    "externalBin": ["resources/loom-server"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

> `frontendDist` 填静态路径是 Tauri 的硬性要求。实际运行时 Rust 用 `window.navigate(url)` 把 WebView 指向 sidecar 的 HTTP URL，该字段此时不起作用（仅供构建期 schema 校验）。CSP 允许 `http://127.0.0.1:*` 是关键——否则 WebView 会屏蔽 fetch。

### 5.5 `capabilities/default.json`

```json
{
  "identifier": "default",
  "description": "Loom desktop core capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "shell:allow-kill",
    "shell:allow-spawn-sidecar",
    "dialog:allow-open",
    "dialog:allow-message",
    "log:default"
  ]
}
```

## 6. Rust 主进程

### 6.1 `src/sidecar.rs` — 生命周期管理

见第 2 段设计正文。关键行为：

- `pick_port()`：`TcpListener::bind("127.0.0.1:0")` 拿 OS 分配，释放后传给 sidecar
- `spawn()`：通过 `tauri_plugin_shell::ShellExt` 启动 sidecar 并拿回 `CommandChild` + event 流
- `wait_for_ready()`：解析 stdout 正则 `running at http://127\.0\.0\.1:(\d+)`，10 秒超时
- `shutdown()`：`CommandChild::kill()` 发 SIGTERM / Windows `TerminateProcess`

### 6.2 `src/main.rs` — 应用入口

见第 2 段设计正文。关键行为：

- `#[tokio::main]` + `tauri::Builder::default()` 装配 3 个 plugin
- `.setup()` 异步任务启动 sidecar；ready 后 `window.navigate()` + `window.show()` + `tray::install()`
- `.on_window_event` 关窗口 → hide to tray
- `.run()` 回调处理 `Reopen`（macOS dock 点击）和 `ExitRequested`（sidecar cleanup）

### 6.3 `src/tray.rs` — 托盘菜单

菜单结构：

```
Loom 图标 (tooltip: "Loom")
├─ Show Loom                    → window.show() + set_focus()
├─ Add Project…                 → crate::dialog::add_project()
├─ Change user skills dir…      → crate::dialog::change_user_skills_dir()
├─ ──────────
├─ About Loom                   → MessageDialog 显示版本号
└─ Quit                         → app.exit(0)
```

左键点托盘图标 = toggle window visible。

### 6.4 `src/dialog.rs` — 原生目录选择器 → HTTP

每个原生入口遵循同一模式：

1. `app.dialog().file().blocking_pick_folder()` 弹原生目录对话框
2. 若用户取消（返回 None）→ 静默结束
3. 选中路径 → `reqwest::Client::post/put` 调 sidecar 的 `/api/*`
4. 成功 → `window.navigate(target_url)` 让 WebView 重载到对应页面（让用户看到变化）
5. 失败 → `app.dialog().message(...).kind(Error).show()`

两个入口：
- `add_project` → `POST /api/projects { path }` → 重载到 `/`（项目列表）
- `change_user_skills_dir` → `PUT /api/settings { userSkillsDir: path }` → 重载到 `/settings`

## 7. 交互设计

| 动作 | 结果 |
|---|---|
| 双击应用图标启动 | 显示系统默认窗口或最小化到托盘，若有旧实例则聚焦（后续版本） |
| Window Close 按钮 | 隐藏到托盘（不退出） |
| Tray 左键点击 | toggle window 可见性 |
| Tray 右键 / 菜单 | 弹出菜单 |
| Tray → Quit | 真正退出，清理 sidecar |
| macOS Dock 点击（app 已运行） | 显示 + 聚焦主窗口 |
| 系统重启后 | v1 **不自动启动**（未加 autostart plugin） |

## 8. 错误处理

| 场景 | 处理 |
|---|---|
| sidecar 10s 内未 ready | 错误 dialog（包含 stderr 摘要）+ `app.exit(1)` |
| sidecar 中途 crash | `CommandEvent::Terminated` 捕捉，状态栏提示"server stopped"。v1 不自动重启，用户需手动退出重启 app |
| sidecar exe 缺失（损坏包） | `spawn()` 立即失败 → 错误 dialog |
| 端口撞车（`pick_port` 和 sidecar bind 之间的窗口） | `wait_for_ready` 超时 → 错误 dialog + exit |
| `/api/projects` POST 失败（来自 tray 菜单） | 独立的错误 dialog，app 继续运行 |
| WebView 加载失败（sidecar 已 ready 但 HTTP 错误） | Chromium 默认错误页；用户可手动 Tray → Show 再试 |

## 9. CI / Release

### 9.1 `.github/workflows/desktop-release.yml`

```yaml
name: Desktop Release

on:
  push:
    tags: ['v*-desktop']

permissions:
  contents: write

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: windows-2022
            target: node22-win-x64
            artifacts: 'src-tauri/target/release/bundle/msi/*.msi,src-tauri/target/release/bundle/nsis/*.exe'
          # v1 仅 Windows；后续添加：
          # - platform: macos-14
          #   target: node22-macos-arm64
          # - platform: ubuntu-22.04
          #   target: node22-linux-x64
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: dtolnay/rust-toolchain@stable
      - name: Install Rust cache
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: 'apps/desktop/src-tauri -> target'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: SIDECAR_TARGET=${{ matrix.target }} pnpm desktop:sidecar
      - run: pnpm --filter @loom/desktop tauri build
      - name: Attach installers to Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          files: ${{ matrix.artifacts }}
          draft: false
          prerelease: ${{ contains(github.ref_name, '-') }}
```

### 9.2 版本与 tag 约定

- **主版本 tag**（`v0.2.4`）：触发现有 `release.yml`，出源码 Release
- **桌面 tag**（`v0.2.4-desktop`）：**独立 tag**，触发 `desktop-release.yml`，出 installer 附件
- 两个 tag 可指向同一 commit；这样就能保证"主版本发了才有对应桌面包"，但互不干扰

## 10. 测试策略

### 10.1 不新增自动化测试

Tauri 自身的集成测试（`tauri::test` 框架）可用，但 v1 为节约投入：
- **Rust 侧**：不写单测；靠 `cargo check` + `cargo clippy` 静态检查
- **E2E**：手动 smoke checklist（见下）
- **现有 57 个 tests 继续跑**（CI 未变）

### 10.2 手动 smoke checklist（每次 desktop tag 前跑）

- [ ] 双击安装完的 Loom → 窗口出现，首次打开 `~/.loom/db.json` 自动创建
- [ ] Projects 页加已有项目，diff preview + apply 正常
- [ ] 关窗口 → 窗口消失，托盘图标仍在
- [ ] Tray 左键 → 窗口恢复
- [ ] Tray → Add Project… → 原生目录选择 → 项目出现在列表
- [ ] Tray → Change user skills dir… → 原生选择 → Settings 页显示新路径
- [ ] Tray → Quit → 应用退出，Task Manager 里 Node sidecar 进程消失
- [ ] 拔网线打开 Settings，验证 AI test 连接失败有正确错误提示（证明 HTTP 栈完整）

## 11. 风险与 mitigation

| 风险 | 可能性 | 影响 | Mitigation |
|---|---|---|---|
| `pkg` 打包 Node 依赖失败（某 native 模块不兼容）| 中 | 高 | 预先在 Phase 0 验证所有 server deps 能打；若 `lowdb` / `fs-extra` 不兼容，降级到 Node SEA |
| stdout 握手字符串匹配脆弱 | 低 | 中 | 正则明确 + 超时保护；若未来 server log 改版，这里需同步维护（加 TODO 注释）|
| CSP 屏蔽 Google Fonts | 低 | 低 | CSP 已明确允许 `fonts.googleapis.com` / `fonts.gstatic.com` |
| Windows Defender SmartScreen 警告（无签名）| 高 | 中 | README 注明"首次运行点更多信息→仍要运行"；v2 考虑购买证书 |
| Tauri v2 API 仍在演进 | 低 | 低 | 锁定 `tauri = "2"` 语义化版本；monorepo lockfile 管理 |
| macOS / Linux 构建未在 CI 验证 | — | — | v1 非目标；架构预留，工作延后 |

## 12. 里程碑

| 里程碑 | 交付 | 预估 |
|---|---|---|
| **M1 Phase 0** | Tauri 壳加载 `pnpm dev` 的 `:5173`，手动 smoke 三个主路径 | 0.5 天 |
| **M2 Sidecar 集成** | `sidecar.rs` 完整实现 + `build-sidecar.mjs` + 生产模式 WebView 指向 sidecar | 2-3 天 |
| **M3 托盘 + 原生对话框** | `tray.rs` + `dialog.rs` + Add/Change 两个入口工作 | 1-2 天 |
| **M4 CI 打包** | `desktop-release.yml` Windows matrix；tag `v0.2.3-desktop` 产出 `.msi` / NSIS `.exe` | 1 天 |
| **M5 Polish** | 窗口生命周期（hide to tray、exit cleanup）、错误 dialog、README、smoke checklist 走通 | 1 天 |

**总计 5-7 天单人工时**。

## 13. 与既有代码的关系

| 既有文件 | 关系 |
|---|---|
| `packages/server/src/index.ts` | 读取 `PORT` env（已有），`NO_OPEN=1`（已有 `process.env.NO_OPEN !== '1'` 检查）—— **零 diff** |
| `packages/server/src/app.ts` | CORS 允许 `/^http:\/\/(127\.0\.0\.1\|localhost):\d+$/`—— WebView 是 http://127.0.0.1:*，**已允许** |
| `packages/web/src/api/client.ts` | 相对 `/api` 路径，在 http://127.0.0.1:P/ 下运行等价于 `http://127.0.0.1:P/api/*`—— **零 diff** |
| `packages/server/src/utils/static.ts` | `resolveWebDist()` 找 `packages/web/dist/`—— sidecar 打包时 `pkg` 会把 web/dist 作为 asset 一并带上（`pkg.assets` 配置）。**零 diff**，配置在 desktop 侧 |
| `packages/web/src/index.css` | `@import` Google Fonts—— CSP 已显式允许，**零 diff** |
| `.github/workflows/ci.yml` | 现有 matrix 不动；desktop 是独立 workflow |
| `.github/workflows/release.yml` | 主版本 Release 不变；desktop 用独立 tag + 独立 workflow |

**结论：所有既有代码真·零改动**。

## 14. 待定事项（明示推迟）

| 项 | 推迟到 |
|---|---|
| 页面内原生 picker（改 web 代码） | v2 桌面迭代 |
| macOS / Linux CI 构建 | 有 Mac 设备或用户需求时 |
| Code signing | 用户需求驱动（个人用可无） |
| Auto-updater | v3 桌面迭代 |
| 开机自启 | v2 桌面迭代 |
| 系统通知（AI 推荐完成等）| v2 |
| 全局热键、拖拽项目 | 长期路线图 |
| Sidecar 自动重启 | 观察 v1 crash 频率决定 |

---

**文档终点**：v1 桌面化设计已锁，下一步由 `writing-plans` 技能拆成可执行的 TDD-ish 任务序列。
