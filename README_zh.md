# Loom

**把 Claude 技能织进每一个项目。**

Loom 是一个本地优先的 Web 应用，用来对 [Claude Code](https://claude.com/product/claude-code) 的技能（skills）做**按项目隔离的管理**。它自动扫描 `~/.claude/` 下所有 `SKILL.md`，让你把精选子集通过软链接（Windows 上用 junction）挂到具体项目，还可以让 LLM 根据你写在 git 里的规则文件为每个项目推荐合适的技能组合。

[English](./README.md) · [中文](./README_zh.md)

> Claude Code 默认所有技能全局可见。Loom 让它们变成"每个项目有自己的技能清单"，且**零复制、零污染**。

---

## 为什么需要 Loom

当你从官方插件市场、第三方市场、自定义技能累积 50+ 个技能后，每次 Claude Code 会话都要面对**全量**候选——触发判定变慢、噪声变大、项目真正需要的技能淹没在无关条目里。Loom 的做法：

1. **扫描**：递归扫 `~/.claude/skills`、`~/.claude/custom-skills`、`~/.claude/plugins/cache` 三处的 `SKILL.md`
2. **链接**：把挑选的子集以软链接形式挂到 `<项目>/.claude/skills/`（Claude Code 原生识别）
3. **记录**：应用结果写入 manifest 文件，可审计、可回滚
4. **声明意图**：项目根目录的 `loom.rules.yaml` 记录 "这个项目应从技能库里拉什么"，入 git，团队共享

## 功能特性

- **本地 Web UI** — 一句 `pnpm start` 启动 Fastify + SPA，监听 `127.0.0.1:4178`，无云账号、无需登录
- **多项目中心** — 单个窗口管理 N 个项目目录
- **树状导航** *(v0.2)* — 技能库左侧侧栏按 source → marketplace → plugin 分层；选中状态同步 URL，支持分享链接 + 浏览器前进/后退
- **用户自定义技能目录** *(v0.2)* — 一等公民字段 `~/.loom/skills/`，天然适合做 Claude Code `skill-creator` 的落地位置；归类为 `user-local`，与只读的 Claude Code 源区分
- **源目录更新** *(v0.2)* — 识别 git 托管的技能源，用户仓库一键 `git pull`，插件则给出 `claude plugins update` 命令供复制（Loom 不接管 Claude Code 的插件簿记）
- **两种选择模式**
  - **手动**：浏览 / 搜索 / 过滤全量技能库，勾选、预览差异、应用
  - **AI 推荐**：输入项目描述和规则，让 LLM 给出带理由的推荐，你确认后再落盘
- **跨平台链接** — Windows 目录 junction（无需管理员权限）+ 失败时自动降级为 `fs-extra` 整目录复制
- **事务性 apply** — per-project 互斥锁 + 日志式回滚；中途失败永远不会留下半成品状态
- **安全 unapply** — 只删 manifest 登记过的条目；`.claude/skills/` 里未托管的文件永远不碰
- **可 commit 的规则** — `loom.rules.yaml` 放在项目 repo 里，表达"这个项目该要什么"
- **AI Provider 无关** — 可配置 endpoint，支持 OpenAI 兼容格式和 Anthropic Messages API；适配主流网关、代理、本地推理服务
- **交付期安全** — 服务只绑 loopback，API key 可从环境变量读取，写入范围严格限定在 `<项目>/.claude/` 与 `~/.loom/`

## 截图

> 截图待补。UI 采用 Vercel/Geist 极简设计——白底画布、shadow-as-border 原语、Geist Sans + Geist Mono 字体。详见 [`docs/DESIGN.md`](docs/DESIGN.md)。

---

## 快速开始

### 前置要求

- **Node.js** ≥ 20.11
- **pnpm** 9.x — `npm install -g pnpm` 或 Node 自带的 `corepack enable && corepack prepare pnpm@9.12.0 --activate`
- **（可选）** OpenAI / Anthropic / 任何兼容 endpoint 的 API key — 只有用 AI 推荐时才需要

### 安装与启动

```bash
git clone https://github.com/puremixai/loom.git
cd loom
pnpm install
pnpm build       # 构建前端 SPA 到 dist/
pnpm start       # Fastify 在 http://127.0.0.1:4178 同时提供 API 与静态文件
```

默认会自动打开浏览器。加 `NO_OPEN=1` 可抑制。

### 开发模式（热更新）

```bash
pnpm dev
# 后端 :4178，Vite dev server :5173，/api 自动代理到后端
```

浏览器打开 <http://localhost:5173>。

---

## 使用流程

### 1. 注册项目

在 **Projects** 页点 **Add Project**，输入项目的**绝对路径**。Loom 只把路径引用存进 `~/.loom/db.json`，**不会碰你的项目文件**。

### 2. 三种选技能方式

| 模式 | 适用场景 | 操作 |
|---|---|---|
| **手动** | 你清楚要什么 | 进 **Add skills** 标签，勾选，点 **Preview**，确认 diff，**Apply** |
| **AI 推荐** | 新项目、想找建议 | 进 **AI recommend**，填"项目描述"（一句话）+ 可选的 keywords / includes / excludes / guidance，点 **Generate**，审阅推荐卡片，调整，**Save rules & apply** |
| **规则驱动** | 有队友给的 / 历史保留的 `loom.rules.yaml` | 进 **Rules & sync**，编辑 YAML（如需），点 **Sync by rules** 重新跑推荐 |

### 3. Apply 会写两个文件

- `<项目>/.claude/skills/<技能名>/` — junction（Windows）/ symlink（POSIX）/ 目录复制（兜底），指向源技能目录
- `<项目>/.claude/loom.json` — manifest，记录这次应用了什么、用了哪种方式（`method: junction | symlink | copy`）

之后 Claude Code 原生识别 `<项目>/.claude/skills/` 里的技能，**Loom 不再需要运行**。

### 4. 移除技能

在 **Applied** 标签页点任一技能的 **Remove**，或整个项目从注册表删除。Loom 只会删 manifest 登记过的条目——**不会递归删除未托管路径**。

---

## 配置

### 扫描路径

默认扫描的根目录：

- `~/.claude/skills` — 标记为 `user`
- `~/.claude/custom-skills` — 标记为 `custom`
- `~/.claude/plugins/cache` — 标记为 `plugin`，marketplace/插件名自动提取
- `~/.loom/skills` *(v0.2, Loom 管辖)* — 标记为 `user-local`，首次启动自动创建；可在 **Settings → User skills directory** 修改位置

在 **Settings → Scan paths** 里可自由增删重排。用户技能目录**始终**被扫描——即使你把它从 scan paths 列表里删掉。

### AI 服务配置

**Settings → AI configuration** 支持两种请求格式：

**OpenAI 兼容**（默认）
```
POST <endpoint>
Authorization: Bearer <key>
Body: { "model", "messages": [...], "response_format": { "type": "json_object" } }
```

适用：`https://api.openai.com/v1/chat/completions`、OpenRouter、DeepSeek、Moonshot、自建 LiteLLM、带 OpenAI 适配层的 Ollama 等。

**Anthropic Messages API**
```
POST <endpoint>
x-api-key: <key>
anthropic-version: 2023-06-01
Body: { "model", "system", "messages": [...], "max_tokens" }
```

适用：`https://api.anthropic.com/v1/messages`。

### Key 存储

- **推荐**：在 `apiKeyEnv` 字段填环境变量名（如 `OPENAI_API_KEY`），Loom 在**运行时从后端进程**读取
- **兜底**：直接填 key；Loom 以明文存到 `~/.loom/db.json`，UI 会红字警示

---

## 数据与隐私

| 文件 | 位置 | 用途 | 入 git? |
|---|---|---|---|
| 中心注册表 | `~/.loom/db.json` | 项目列表 + AI 配置 + 扫描路径 + 用户技能目录 | 不适用（不在任何 repo 里） |
| 扫描缓存 | `~/.loom/skills-cache.json` | fingerprint 缓存，增量扫描 | 不适用 |
| 用户技能目录 | `~/.loom/skills/` *(默认)* | 你自己写的技能；作为 `source: 'user-local'` 自动扫描 | 不适用（如果你把它做成 git repo 才入 git） |
| 规则文件 | `<项目>/.claude/loom.rules.yaml` | 意图：projectHint、includes、excludes、keywords、aiGuidance | **是** — 团队共享 |
| Manifest | `<项目>/.claude/loom.json` | 本机实际应用了什么，含绝对源路径 | 否 — 环境快照 |
| 软链接 | `<项目>/.claude/skills/<名>/` | 指向源技能目录的 junction/symlink/复制 | 否 |

Loom **不会主动联网**——只有你明确触发 AI 推荐 / sync / 测试连接时才会调用你配置的 endpoint，不会向任何其他服务器发数据。

---

## 架构

pnpm monorepo，三个 workspace 包：

```
packages/
├─ shared/       @loom/shared  — zod schemas + 常量（类型单点真相）
├─ server/       @loom/server  — Fastify API、扫描、链接引擎、AI 服务
└─ web/          @loom/web     — React SPA、TanStack Query、shadcn 风格 UI
```

### 后端服务

| 服务 | 文件 | 职责 |
|---|---|---|
| `ScannerService` | [`packages/server/src/services/scanner.ts`](packages/server/src/services/scanner.ts) | 扫描、frontmatter 解析、fingerprint 缓存 |
| `LinkService` | [`packages/server/src/services/link.ts`](packages/server/src/services/link.ts) | `applySkills` / `unapplySkills`，事务日志 |
| `ProjectService` | [`packages/server/src/services/project.ts`](packages/server/src/services/project.ts) | 项目 CRUD、路径校验 |
| `RuleService` | [`packages/server/src/services/rule.ts`](packages/server/src/services/rule.ts) | YAML 读写 + zod 校验 |
| `AiService` | [`packages/server/src/services/ai.ts`](packages/server/src/services/ai.ts) | OpenAI + Anthropic 请求构造、重试、响应归一化 |
| `UserDirService` *(v0.2)* | [`packages/server/src/services/user-dir.ts`](packages/server/src/services/user-dir.ts) | 用户技能目录 resolve / ensure / validate |
| `SourceUpdateService` *(v0.2)* | [`packages/server/src/services/source-update.ts`](packages/server/src/services/source-update.ts) | `findGitRoot`、`detectGitRoots`、`checkUpdate`、`pullRepo`——git shell 封装（含超时 + `git-not-found` / `timeout` 错误归一化） |

完整架构详见 [`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md)；v0.2 特性 spec 见 [`docs/superpowers/specs/2026-04-20-source-management-design.md`](docs/superpowers/specs/2026-04-20-source-management-design.md)。

### API 列表

统一响应信封：`{ ok: true, data }` 或 `{ ok: false, error: { code, message } }`。

```
GET    /api/health
GET    /api/skills                       ?refresh=1 强制重扫
GET    /api/skills/:id                   返回完整 SKILL.md 内容
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
POST   /api/projects/:id/sync            读 rules.yaml + AI + 返回 diff
POST   /api/ai/recommend
POST   /api/ai/test                      连通性测试
GET    /api/settings                     响应含 userSkillsDir
PUT    /api/settings                     可更新 userSkillsDir 并做校验
GET    /api/platform                     响应含 userSkillsDir
POST   /api/user-skills-dir/open         (v0.2) 系统文件管理器打开该目录
GET    /api/sources                      (v0.2) 所有 git 托管的技能源
POST   /api/sources/check                (v0.2) 批量 ahead/behind 检测，5 并发
POST   /api/sources/pull                 (v0.2) git pull（仅 git-source 类型）
```

---

## Windows 说明

链接引擎首选 `fs.symlink(src, dst, 'junction')`——Windows 下创建**目录 junction**，**无需管理员权限或开发者模式**。失败兜底是 `fs-extra.copy` 整目录复制。

复制模式在 manifest 中记为 `method: "copy"`，UI 会显式提示"源技能更新后需重新同步"（软链接自动跟随、复制不会）。

某些 Windows 配置下 junction 与 symlink 的区分比较微妙——Loom 用了双阶段检测（`isSymbolicLink()` + `readlink` 兜底），已在 Windows 11 + Node 22 上验证。见 [`packages/server/src/utils/fs-safe.ts`](packages/server/src/utils/fs-safe.ts)。

---

## 开发

```bash
# 安装依赖（必须 pnpm，禁用 npm——用了 workspace:* 协议）
pnpm install

# 前后端并行热更新
pnpm dev

# 全量类型检查
pnpm -r run typecheck

# 跑所有测试（共 62 个：shared 5 + server 53 + web 4）
pnpm -r run test

# 生产构建：前端进 dist/，后端统一在 :4178 提供
pnpm build && pnpm start

# 按 workspace 过滤
pnpm --filter @loom/server dev
pnpm --filter @loom/web build
pnpm --filter @loom/server test
```

### 项目结构

```
loom/
├─ packages/
│  ├─ shared/              zod schemas、常量、类型
│  │  ├─ src/
│  │  └─ test/
│  ├─ server/              Fastify 后端
│  │  ├─ src/
│  │  │  ├─ routes/        projects, skills, ai, settings, sync, platform, health
│  │  │  ├─ services/      scanner, link, project, rule, ai, manifest, apply-helpers
│  │  │  ├─ storage/       lowdb 封装
│  │  │  └─ utils/         fs-safe, platform-probe, fingerprint, static
│  │  └─ test/             vitest + 真实文件系统 fixtures
│  └─ web/                 React SPA
│     ├─ src/
│     │  ├─ pages/         Projects、ProjectDetail、Skills、Settings
│     │  ├─ components/    SkillCard, SkillTree, DiffPreview, AiRecommendPanel, RulesEditor, UserSkillsDirCard, SourceUpdatesBanner, SourceUpdatesDrawer, ui/*
│     │  ├─ hooks/         useSkillTree
│     │  ├─ api/           TanStack Query hooks
│     │  └─ lib/           cn 工具函数
│     ├─ test/             useSkillTree 纯函数测试（Vitest + jsdom）
│     └─ index.html
├─ docs/
│  ├─ DESIGN.md            Vercel/Geist 视觉系统说明
│  └─ superpowers/
│     ├─ specs/            架构 spec（v0.1 MVP + v0.2 源管理）
│     └─ plans/            实施计划
├─ CHANGELOG.md            英文更新日志
├─ CHANGELOG.zh.md         中文更新日志
├─ CLAUDE.md               给 Claude Code 会话的工程指南（对人也适用）
└─ README.md / README_zh.md
```

详见 [`CLAUDE.md`](CLAUDE.md)——它是为 LLM Agent 写的，但也是个紧凑的工程速查表。

### 测试

后端测试全部走真实的 `os.tmpdir()` fixture，`try/finally` 清理——我们关心的 bug 是**文件系统行为**（尤其是 Windows junction 检测，以及 `git fetch` / `git pull` 集成），mock 掉就失去了测试意义。唯一例外：`checkUpdate` / `pullRepo` 支持注入 `runner`，大多数单测不触发真实 `git`；仅一个集成测试会用真实 `git init` 构造本地仓库验证端到端路径。CI 跑 Ubuntu + Windows × Node 20 / 22 矩阵。

v0.2 落地了首批前端测试：4 个 `useSkillTree` 纯函数单测 + Vitest/jsdom/testing-library 基础设施。欢迎贡献组件级测试。

---

## Roadmap

- [ ] 移动端 `<768px` 侧栏降级（扁平 `<select>`）
- [ ] 抽屉内「Up to date」/「Errors」分组可折叠
- [ ] 组件级前端测试（React Testing Library）
- [ ] CLI 陪伴工具，用于 CI / 自动化规则同步
- [ ] 文件系统监听模式（可选；用于快速迭代技能时）
- [ ] 技能预览：渲染 Markdown + frontmatter 表格
- [ ] 技能树键盘导航
- [ ] 从 Sources 抽屉 shell-out 调用 `claude plugins update <name>`（从复制命令升级）
- [ ] 团队模式：通过轻量同步协议跨 repo 共享规则
- [ ] 项目配置导入/导出
- [ ] 技能集合 / 标签 / 保存过的筛选

---

## 贡献

欢迎贡献！请：

1. 任何非平凡改动前先开 issue 讨论
2. 遵循 [`CLAUDE.md`](CLAUDE.md) 里的工程约定（代码风格、文件结构、设计 tokens）
3. 推送前跑过 `pnpm -r run typecheck` 和 `pnpm -r run test`
4. commit 聚焦，使用约定式提交消息（`feat:` / `fix:` / `docs:` / `chore:`）

## 安全

Loom 只绑 `127.0.0.1` 且**没有鉴权**——面向单用户本地场景设计。**不要**在没加自己的鉴权层的情况下把端口暴露到局域网或公网。

安全问题请通过 GitHub security advisory 私下报告，不要发 public issue。

## License

[MIT](LICENSE)

## 致谢

- 构建于 [Fastify](https://fastify.dev/)、[React](https://react.dev/)、[Vite](https://vite.dev/)、[Tailwind CSS](https://tailwindcss.com/)、[Radix UI](https://www.radix-ui.com/)、[TanStack Query](https://tanstack.com/query)、[Zod](https://zod.dev/)
- UI 风格参考 [Vercel](https://vercel.com/) 的 [Geist](https://vercel.com/font) 设计系统
- 为 Anthropic 的 [Claude Code](https://claude.com/product/claude-code) 而设计

## Star History

<a href="https://www.star-history.com/?repos=puremixai%2Floom&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=puremixai/loom&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=puremixai/loom&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=puremixai/loom&type=date&legend=top-left" />
 </picture>
</a>
