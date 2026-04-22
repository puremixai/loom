# 更新日志

**Loom** 所有重要变更记录于此。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

English version: [CHANGELOG.md](CHANGELOG.md)

## [0.2.3-desktop] — 2026-04-22

### 新增

- **桌面应用（Tauri 2）首版发布**。Windows `.msi` 与 NSIS `.exe` 安装包，内嵌 Node 22 SEA 打包的 Fastify sidecar。核心体验与 Web 版完全一致；`packages/shared|server|web` **零代码修改**（仅在 [`packages/server/src/utils/static.ts`](packages/server/src/utils/static.ts) 新增了一条 `LOOM_WEB_DIST` 环境变量回退逻辑，让 Tauri 能把 SPA 资源路径下发给 sidecar）。桌面相关的源码全部位于 `apps/desktop/`。
- **系统托盘** 6 项菜单：Show Loom · Add Project… · Change user skills dir… · About · Quit。左键托盘在「显示/隐藏窗口」间切换；Add Project / Change user skills dir 调起 Windows 原生文件夹选择框，Rust 直接向 sidecar REST API 发请求（不给前端开 IPC 面，保留单源 HTTP 模型）。
- **关窗到托盘**：点窗口 X 只隐藏窗口，只有托盘 **Quit** 才退出进程。
- **退出时优雅清理 sidecar**：监听 `RunEvent::ExitRequested`，在 Tauri 拆除前先杀掉 `loom-server.exe`，避免孤儿 Node 进程残留在任务管理器里。

### CI

- 新增 [`.github/workflows/desktop-release.yml`](.github/workflows/desktop-release.yml)：推送 `v*-desktop` tag 时自动构建并挂载桌面 installer。v1 只跑 windows-2022 runner；macOS / Linux 的 matrix 项已预留，等那两个平台验证通过后开启。
- [`release.yml`](.github/workflows/release.yml) 对 `-desktop` 后缀 tag 直接跳过，避免两条 workflow 在同一个 release 上互相覆盖 prerelease flag。

### 架构说明

- sidecar 打包走 Node 22 SEA + `postject`（没用 `pkg`，`pkg` 不支持 Node 22 也不支持 ESM）。流水线：esbuild 打包 → CJS SEA wrapper → blob → 注入 Node.exe 副本。
- Tauri 把 `packages/web/dist` 作为 `web-dist/` 资源打包；Rust 侧通过 `app.path().resource_dir()` 解析路径，用 `LOOM_WEB_DIST` 环境变量传给 sidecar。
- 完整设计见 [`docs/superpowers/specs/2026-04-21-desktop-tauri-design.md`](docs/superpowers/specs/2026-04-21-desktop-tauri-design.md)。

## [0.2.3] — 2026-04-20

### 增强

- **Settings 页左侧导航**：新增 sticky 侧栏，列出 4 个分区（AI configuration / User skills directory / Scan paths / Platform）；点击平滑滚动到对应卡片，当前所在分区通过 `IntersectionObserver` 自动高亮。窄屏 `<768px` 时侧栏隐藏。

## [0.2.2] — 2026-04-20

### 修复

- `apiFetch` 在请求无 body 时不再强制设置 `Content-Type: application/json`。之前 Sources 抽屉打开时自动触发的 `POST /api/sources/check` 会撞上 Fastify 的 `FST_ERR_CTP_EMPTY_JSON_BODY`（默认 JSON parser 对"空 body + JSON content-type"直接拒绝）。现在点击 Sources 横幅的 **View** 能正常打开抽屉并检测上游状态。

### CI

- 新增 GitHub Actions `.github/workflows/release.yml`——push 任何 `v*` tag 时自动发布 GitHub Release，从 `CHANGELOG.md` + `CHANGELOG.zh.md` 抽取对应版本段落组合成双语 release notes；带 `-` 的 tag（如 `v0.3.0-beta.1`）自动标记为 pre-release。

## [0.2.1] — 2026-04-20

### 文档

- 新增中文更新日志 `CHANGELOG.zh.md`，与英文版保持同步
- 补齐 release-skills 流程要求的双语 changelog

## [0.2.0] — 2026-04-20

### 新增

**里程碑 1 — 用户技能目录**
- 一等公民配置字段 `userSkillsDir`（默认 `~/.loom/skills/`），首次启动自动创建、自动扫描
- 新增 `source: 'user-local'` 分类，用于识别用户目录下的技能
- `POST /api/user-skills-dir/open` —— 在系统文件管理器中打开该目录
- `GET /api/platform` 响应新增 `userSkillsDir` 字段
- 设置页新增独立的 **User skills directory** 卡片，集成 Claude Code `skill-creator` 命令一键复制
- 服务端新增 `UserDirService`（ensure / validate / resolve）

**里程碑 2 — 技能库树状导航**
- `/skills` 页新增左侧目录树侧栏，前端纯客户端从现有 `Skill[]` 数据派生——无需新 API
- 树节点选中状态同步到 URL（`/skills?path=plugin/claude-plugins-official/superpowers`），支持分享 + 浏览器前进/后退
- 折叠状态持久化到 `localStorage`
- 首次引入前端测试基础设施：Vitest + jsdom + `@testing-library/react`，配套 4 个 `buildTree` / `skillPath` 纯函数单元测试
- `useSkillTree` hook、`SkillTree` + `SkillTreeNode` 组件

**里程碑 3 — 源目录更新**
- `GET /api/sources` —— 列出所有扫描到的 git 托管技能源
- `POST /api/sources/check` —— 批量 `git fetch` + ahead/behind 检测，5 并发上限，支持请求去重
- `POST /api/sources/pull` —— 对用户托管的仓库（`kind: 'git-source'`）执行 `git pull`；插件类型（`kind: 'plugin'`）以 400 拒绝（Loom 不接管 Claude Code 的插件簿记）
- `findGitRoot` 基于边界感知的目录上溯探测；多技能共享同一 gitRoot 时合并到一个 `SourceRef`
- `SourceUpdateService` 支持注入 runner，使单测完全不触发真实 `git` 进程；仅一个端到端集成测试会用真实 `git init` 构造本地仓库
- 技能库页面顶部 `Source updates` 横幅 + 右侧抽屉，按 Behind / Up to date / Errors 三段展示
- Pull 按钮在 dirty working tree 时自动禁用
- 插件条目不显示 Pull 按钮，而是展示可复制的 `claude plugins update <name>` 命令
- 错误分类归一化：git 不在 PATH → `git-not-found`；30s 超时 → `timeout`，便于 UI 统一呈现

### 变更

- `SkillSchema.source` 枚举扩展加入 `'user-local'`
- `scanSkills` 自动将 `userSkillsDir` 合并进扫描路径（即使用户从 `scanPaths` 里删掉，Loom 也始终扫描）
- 所有 scanner 调用点（`/api/skills`、`/api/sync`、`/api/ai/*`、`apply-helpers`）统一透传 `userSkillsDir`
- `maskApiKey` 在设置响应中保持掩码；响应结构扩展包含 `userSkillsDir`

### 修复

- `findGitRoot` 边界处理：路径上溯正确停在 `stopAt`，不会逃逸到该范围之上的 `.git`
- `/api/sources/check` 请求去重不再暴露误导性的 `body.refs` 参数——端点始终执行全量扫描，语义更简单

### 测试

- 共 57 个测试通过（shared 5 + server 53 + web 4），从 v0.1 的 32 个提升
- CI 矩阵维持：Ubuntu + Windows × Node 20 / 22

### 设计文档

- Spec: [docs/superpowers/specs/2026-04-20-source-management-design.md](docs/superpowers/specs/2026-04-20-source-management-design.md)
- 实施计划: [docs/superpowers/plans/2026-04-20-source-management-implementation.md](docs/superpowers/plans/2026-04-20-source-management-implementation.md)

### 已知限制（推迟到后续版本）

- 移动端 `<768px` 的侧栏降级（`<select>` 下拉）尚未实现——当前窄屏直接隐藏侧栏
- 抽屉内的「Up to date」/「Errors」分组始终展开，spec 原计划为可折叠
- Dirty 仓库的 Pull 按钮缺少 `title` 悬浮提示
- 技能树键盘导航
- 自动定时检查更新
- 插件更新走 shell-out 调用 `claude plugins update`（当前仅提供命令复制）

## [0.1.0] — 2026-04-20

初版 MVP 发布。

### 新增

- pnpm monorepo 三包结构：`@loom/shared`、`@loom/server`、`@loom/web`
- 本地优先架构：Fastify 在 `127.0.0.1:4178` 同时提供 REST API + SPA 静态资源
- 技能扫描器覆盖 `~/.claude/skills`、`~/.claude/custom-skills` 以及 `~/.claude/plugins/cache/**/SKILL.md`，基于 mtime fingerprint 做增量扫描缓存
- 跨平台的 per-project 技能链接：Windows 目录 junction（无需管理员权限），失败自动降级为 `fs-extra` 整目录复制
- 事务性 apply：per-project 互斥锁 + 反向回滚日志，中途失败永远不会留下半成品状态
- 安全 unapply：只删 manifest 登记过的路径，用户自建文件永远不碰
- Web UI 两种技能选择模式——手动浏览 + AI 驱动推荐（含 diff 预览）
- 项目级 `loom.rules.yaml`（意图，可入 git）+ `loom.json`（执行 manifest，环境快照）
- AI 服务支持 OpenAI 兼容格式 + Anthropic Messages API 请求风格，含 JSON 解析失败重试、强制 includes/excludes 处理
- 设置 UI：AI 端点与 key（推荐环境变量）、扫描路径、平台诊断
- Vercel / Geist 设计系统：shadow-as-border、`ink-*` 调色板、Geist Sans + Geist Mono 字体、三字重克制
- 服务端 27 测试 + shared 5 测试，文件系统集成风格
- Ubuntu + Windows × Node 20 / 22 的 CI 矩阵

[0.2.3]: https://github.com/puremixai/loom/releases/tag/v0.2.3
[0.2.2]: https://github.com/puremixai/loom/releases/tag/v0.2.2
[0.2.1]: https://github.com/puremixai/loom/releases/tag/v0.2.1
[0.2.0]: https://github.com/puremixai/loom/releases/tag/v0.2.0
[0.1.0]: https://github.com/puremixai/loom/releases/tag/v0.1.0
