---
title: Skill Manager — 本地多项目 Claude 技能管理工具
date: 2026-04-20
status: approved
authors: [user, claude-opus-4-7]
---

# Skill Manager 设计文档

## 1. 背景与目标

### 1.1 背景

用户在 `~/.claude/` 下聚合了两类技能资产：

- **自定义技能**：`~/.claude/skills/`、`~/.claude/custom-skills/`
- **插件同步技能**：`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/**/SKILL.md`

当前共约 90 个 `SKILL.md` 条目，全部对 Claude Code **全局可见**。这带来两个问题：

1. **噪声大**：单个项目通常只需要少数几个技能，但全部技能都参与 discovery/触发判定
2. **无隔离**：不同项目（如 React 前端 vs. Python 数据科学）的技能需求差异大，无法按项目只暴露相关子集

### 1.2 目标

构建一个本地 Web 应用，支持两种互补的「项目级技能供给」方式：

1. **显式选择模式** — 用户在 UI 中浏览全部候选技能，手动勾选并一键应用到指定项目
2. **AI 筛选模式** — 用户填写项目描述 + 规则（includes/excludes/aiGuidance），调用自定义 AI API 推荐技能子集，确认后应用

两种模式共享：技能扫描、链接引擎、规则/产物持久化、项目级隔离机制。

### 1.3 非目标（明确不做）

- ❌ 多用户 / 云同步（纯本地单用户工具）
- ❌ 自动监听 `~/.claude` 变化（手动刷新即可）
- ❌ 技能创建/编辑器（只读展示；创建技能交给 `skill-creator`）
- ❌ 跨机远程管理（仅绑定 `localhost`，无鉴权）
- ❌ CLI 命令（Web UI 足够）

---

## 2. 架构总览

```
┌────────────────────────────────────────┐
│  浏览器  http://localhost:4178         │
│  React SPA（Vite + shadcn/ui）         │
└────────────────┬───────────────────────┘
                 │ HTTP（同源；开发期 Vite 代理 → Fastify）
┌────────────────▼───────────────────────┐
│  Fastify 后端                           │
│  ├─ ScannerService   扫描技能源         │
│  ├─ LinkService      junction/symlink/copy │
│  ├─ ProjectService   项目注册与状态     │
│  ├─ RuleService      规则文件 CRUD      │
│  └─ AiService        调用自定义 API     │
└────────────────┬───────────────────────┘
                 │
      ┌──────────┼───────────────────┐
      ▼          ▼                   ▼
  ~/.claude/  ~/.skill-manager/   <project>/.claude/
  （只读源）   （中心数据）       （写入产物）
```

**运行形态**：

- 单一 Node 进程（Fastify 同时提供 `/api/*` 与生产构建的静态前端）
- 启动命令：`pnpm start` → 监听 `127.0.0.1:4178` → 自动打开浏览器
- 开发命令：`pnpm dev`（Fastify + Vite dev server，通过代理解决 CORS）

**技术栈**：

| 层 | 选型 | 备注 |
|---|---|---|
| 语言 | TypeScript 5.x | 前后端共享类型 |
| 包管理 | pnpm workspaces | 单仓多包 |
| 后端 | Fastify 5 | 冷启 <200ms，文件系统操作轻量 |
| 前端框架 | React 19 + Vite 6 | SPA，无需 SSR |
| UI 组件 | shadcn/ui + Tailwind CSS | Radix 原语 + 常用组件 |
| 前端状态 | TanStack Query + Zustand（局部） | 查询缓存 + 少量客户端状态 |
| 表单 | react-hook-form + zod | schema 复用后端 |
| 编辑器 | Monaco（rules.yaml 编辑器） | 按需加载 |
| 数据存储 | lowdb（JSON 文件） | 简单、可读、无依赖 |
| 测试 | Vitest + React Testing Library | 前后端统一 |
| 工具 | gray-matter（frontmatter）、js-yaml、fs-extra、tiny-glob、zod | |

---

## 3. 仓库布局

```
skill-manager/
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .gitignore
├─ README.md
├─ docs/
│  └─ superpowers/
│     ├─ specs/   # 本文档所在
│     └─ plans/   # 后续 writing-plans 产物
├─ packages/
│  ├─ shared/                 # 跨端共享的类型、schema、常量
│  │  ├─ package.json
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ schemas.ts        # zod schema（Skill, Project, RuleFile, Manifest, CenterConfig）
│  │     └─ constants.ts      # 默认扫描路径、端口、manifest 文件名等
│  ├─ server/
│  │  ├─ package.json
│  │  ├─ src/
│  │  │  ├─ index.ts          # 入口：启动 + 打开浏览器
│  │  │  ├─ app.ts            # Fastify 应用装配
│  │  │  ├─ routes/
│  │  │  │  ├─ projects.ts
│  │  │  │  ├─ skills.ts
│  │  │  │  ├─ ai.ts
│  │  │  │  └─ settings.ts
│  │  │  ├─ services/
│  │  │  │  ├─ scanner.ts
│  │  │  │  ├─ link.ts
│  │  │  │  ├─ project.ts
│  │  │  │  ├─ rule.ts
│  │  │  │  └─ ai.ts
│  │  │  ├─ storage/
│  │  │  │  └─ center-db.ts   # lowdb 封装 ~/.skill-manager/db.json
│  │  │  └─ utils/
│  │  │     ├─ fs-safe.ts     # 原子写、临时目录 rename
│  │  │     ├─ platform.ts    # Windows/POSIX 差异
│  │  │     └─ fingerprint.ts
│  │  └─ test/
│  │     ├─ services/         # 单元测试
│  │     └─ e2e/              # 集成测试（用临时目录）
│  └─ web/
│     ├─ package.json
│     ├─ vite.config.ts
│     ├─ index.html
│     └─ src/
│        ├─ main.tsx
│        ├─ App.tsx
│        ├─ pages/
│        │  ├─ ProjectsPage.tsx
│        │  ├─ ProjectDetailPage.tsx
│        │  ├─ SkillsPage.tsx
│        │  └─ SettingsPage.tsx
│        ├─ components/
│        │  ├─ ui/            # shadcn 生成的组件
│        │  ├─ SkillCard.tsx
│        │  ├─ DiffPreview.tsx
│        │  ├─ AiRecommendPanel.tsx
│        │  └─ RuleEditor.tsx
│        ├─ api/
│        │  └─ client.ts      # fetch + TanStack Query hooks
│        └─ hooks/
└─ ...
```

**说明**：

- `shared` 包不包含任何运行时依赖之外的逻辑，只定义类型与 zod schema，前后端都 import
- 生产构建：前端 `dist/` 被 server 以静态文件方式托管（`@fastify/static`）

---

## 4. 数据模型

所有类型以 zod schema 为单一事实来源，TypeScript 类型通过 `z.infer` 推导。

```ts
// ===== 技能（扫描结果） =====
const SkillSchema = z.object({
  id: z.string(),                            // sha1(sourceRoot+relPath).slice(0,12)
  name: z.string(),                          // frontmatter.name
  description: z.string(),
  source: z.enum(['user', 'custom', 'plugin']),
  sourceRoot: z.string(),                    // 如 ~/.claude/plugins/cache
  absolutePath: z.string(),                  // SKILL.md 绝对路径
  skillDir: z.string(),                      // 技能目录绝对路径
  pluginName: z.string().optional(),         // 如 "claude-plugins-official/superpowers"
  fingerprint: z.string(),                   // `${mtime}-${size}` 用于增量扫描
});
type Skill = z.infer<typeof SkillSchema>;

// ===== 项目（中心注册表条目） =====
const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),                          // 默认取目录名
  path: z.string(),                          // 绝对路径
  addedAt: z.string().datetime(),
  lastSyncedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});
type Project = z.infer<typeof ProjectSchema>;

// ===== 规则文件（<project>/.claude/skill-manager.rules.yaml） =====
const RuleFileSchema = z.object({
  version: z.literal(1),
  projectHint: z.string(),                   // 一句话项目描述（AI 主输入）
  includes: z.array(z.string()).default([]), // 强制包含：Skill.id 或 name
  excludes: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  aiGuidance: z.string().optional(),         // 自由文本补充
  lastAppliedSkills: z.array(z.string()).optional(),  // 上次 apply 快照（可选冗余，方便 UI 不打开 manifest）
});
type RuleFile = z.infer<typeof RuleFileSchema>;

// ===== 应用产物清单（<project>/.claude/skill-manager.json） =====
const ManifestSchema = z.object({
  version: z.literal(1),
  tool: z.literal('skill-manager'),
  appliedAt: z.string().datetime(),
  method: z.enum(['symlink', 'junction', 'copy']),
  skills: z.array(z.object({
    id: z.string(),
    name: z.string(),
    sourceDir: z.string(),                   // 原绝对路径（软链接 target）
    linkedAs: z.string(),                    // 项目内相对路径（如 .claude/skills/foo）
  })),
});
type Manifest = z.infer<typeof ManifestSchema>;

// ===== 中心数据（~/.skill-manager/db.json） =====
const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema),
  scanPaths: z.array(z.string()),            // 默认三条，可扩展
  ai: z.object({
    endpoint: z.string().url(),
    model: z.string(),
    apiKeyEnv: z.string().optional(),        // 优先从该环境变量读
    apiKey: z.string().optional(),           // 回退（明文警告）
    headers: z.record(z.string()).optional(),
    systemPrompt: z.string().optional(),     // 覆盖默认
    requestStyle: z.enum(['openai', 'anthropic']).default('openai'),
  }),
});
```

**职责分离的关键决策**：

| 文件 | 位置 | 是否入 git | 含义 |
|---|---|---|---|
| `skill-manager.rules.yaml` | `<project>/.claude/` | **建议入** | 规则 = 意图，团队共享 |
| `skill-manager.json` | `<project>/.claude/` | 建议 ignore | manifest = 环境事实快照 |
| `db.json` | `~/.skill-manager/` | N/A | 中心注册表（不属于任何项目） |
| `skills-cache.json` | `~/.skill-manager/` | N/A | 扫描结果缓存 |

---

## 5. 核心服务

### 5.1 ScannerService

**职责**：扫描 `CenterConfig.scanPaths`，输出统一的 `Skill[]`，带增量缓存。

**默认扫描路径**：
1. `~/.claude/skills` → `source: 'user'`
2. `~/.claude/custom-skills` → `source: 'custom'`
3. `~/.claude/plugins/cache` → `source: 'plugin'`，`pluginName` 取路径第 1-2 段（如 `claude-plugins-official/superpowers`）

**扫描流程**：
1. 对每个 scanPath 用 `tiny-glob` 匹配 `**/SKILL.md`
2. 读 mtime + size 生成 fingerprint，与缓存比对；未变的条目直接沿用旧解析
3. 变化条目用 `gray-matter` 解析 frontmatter → 提取 `name` + `description`
4. `id = sha1(sourceRoot + relPath).slice(0, 12)`
5. 输出 `Skill[]` + warnings；写回 `skills-cache.json`

**边界处理**：
- frontmatter 缺失 `name` 或 `description` → 跳过 + warning（UI 顶部显示"N 个技能解析失败 [查看]"）
- 同名跨源 → 保留全部，UI 用 `source/pluginName` 前缀区分
- 不做文件系统 watcher（90+ 条目 + 插件更新容易抖动，UI 用「重新扫描」按钮触发）

### 5.2 LinkService

**职责**：把选中的 `Skill[]` 应用到项目 `<P>/.claude/skills/`，生成 `manifest.json`；负责 Windows 兼容性降级。

**单技能链接策略**（目标 `<P>/.claude/skills/<skillName>/`）：

```
tryLink(source, target):
  1. fs.symlink(source, target, 'junction')        // Windows：实际是 directory junction，无需管理员
                                                    // POSIX：参数被忽略，退化为普通 symlink
     成功 → method='symlink'（POSIX）或 'junction'（Windows）
  2. 失败（EPERM / ENOENT / EEXIST）→ catch 并：
     a. EEXIST 且是我们托管的 → 先删再重试
     b. EEXIST 非托管 → 拒绝整次 apply，在 UI 报错列出冲突
     c. 其他错 → 降级复制整个目录（fs-extra.copy），method='copy'
```

**整次 apply 的"逐技能 + 事务日志"策略**（不能整体 rename 替换 `.claude/skills/`，会误伤未托管条目）：
1. 读取当前 manifest（可能不存在），与新目标列表 diff 出 `{toAdd, toKeep, toRemove}`
2. 开启事务日志（内存数组 `ops: Array<{kind, path, backup?}>`）
3. **toRemove**：对每条校验确是 manifest 里登记过的（二次保险），删除链接/目录，记 `ops.push({kind:'removed', path, backup: <移到临时目录而非直接删>})`
4. **toAdd**：对每条逐个 `tryLink`；成功后 `ops.push({kind:'created', path})`；某条失败则停下进入回滚
5. **回滚**：按 ops 逆序撤销——已创建的删掉、已移除的从临时备份还原
6. 全部成功 → 原子写 `manifest.json`（通过"临时文件 + rename"实现单文件原子）、清理临时备份
7. **并发控制**：per-project 内存 `AsyncLock`，后发请求排队

**unapply**：仅删除 manifest 登记过的条目，**永不递归删除未登记路径**（安全兜底）。

**method='copy' 的特殊处理**：
- manifest 记 `method='copy'` + 每条 `copiedAt`
- UI 在项目详情页显著标识「此项目为复制模式，源技能更新后需点同步」
- 同步时按 fingerprint 比对，只重拷变化的条目

### 5.3 ProjectService

**职责**：`db.json` 中 `projects[]` 的 CRUD + 项目健康检查。

- `addProject(path)`：校验路径存在、未重复注册、是目录；默认 `name = basename(path)`
- `listProjects()`：每次调用对每个项目做 `fs.access`，附加 `status: 'ok' | 'broken'`
- `removeProject(id)`：只删中心注册，**不动** 项目目录内的文件
- `relocateProject(id, newPath)`：处理用户移动项目目录后的修复

### 5.4 RuleService

**职责**：读写 `<P>/.claude/skill-manager.rules.yaml`，zod 校验。

- `readRules(projectPath)`：不存在返回 `null`；存在但校验失败抛结构化错误（字段 + 路径）
- `writeRules(projectPath, rules)`：`.claude/` 不存在则创建；使用 `js-yaml` 序列化 + 原子写（临时文件 + rename）
- `applyDefaults()`：`includes/excludes/keywords` 缺省补空数组

### 5.5 AiService

**职责**：用 `CenterConfig.ai` 调用用户自定义 API，返回经校验的技能推荐。

**请求构造**（默认 OpenAI-compatible；`requestStyle='anthropic'` 时使用 Messages API 格式）：

```
POST {endpoint}
Headers:
  Authorization: Bearer {apiKey} | x-api-key: {apiKey}（取决于 requestStyle）
  Content-Type: application/json
  ...custom headers
Body (openai style):
  { model, messages: [{ role: 'system', content: <systemPrompt> },
                       { role: 'user',   content: <userPrompt> }],
    response_format: { type: 'json_object' } }   // 若目标兼容
Body (anthropic style):
  { model, system: <systemPrompt>, max_tokens: 4096,
    messages: [{ role: 'user', content: <userPrompt> }] }
```

**默认 system prompt**：

```
你是 Claude Code 技能选择顾问。给定候选技能清单和项目信息，
挑选最相关的技能子集。严格按 JSON 输出：
{ "picks": [ { "id": "<Skill.id>", "reason": "<为什么选它>" } ] }
必须遵守规则：
- includes 列出的技能必须全部返回
- excludes 列出的技能绝不返回
- 其它技能根据项目描述和 aiGuidance 评估相关性
- 只输出 JSON，不要任何额外文本
```

**user prompt 模板**：

```
项目描述：{projectHint}
关键词：{keywords.join(', ')}
AI 指引：{aiGuidance || '无'}
强制包含：{includes.join(', ') || '无'}
强制排除：{excludes.join(', ') || '无'}

候选技能（共 {skills.length} 条）：
{skills.map(s => `- id: ${s.id} | source: ${s.source}${s.pluginName ? '/'+s.pluginName : ''} | name: ${s.name} | description: ${s.description}`).join('\n')}
```

**响应处理**：
1. 取文本响应，尝试 `JSON.parse`；若失败用「提取首个 `{...}` 块」兜底
2. 若仍失败，**重试 1 次**并在 system 里追加 "上次输出无法解析，必须严格返回 JSON"
3. 校验 `picks[i].id` 是否在候选集合内——不在则丢弃并记 warning
4. 强制包含 `includes` 中缺失的条目（即使 AI 没选）
5. 清除命中 `excludes` 的条目（即使 AI 选了）
6. 返回给 UI：`{ picks: [{ skill, reason }], warnings: string[] }`

**连通性测试**：设置页提供"测试"按钮，发送最小请求（如 `"用一个字回复: ok"`）并显示响应延时/错误码。

### 5.6 API 端点清单

所有响应用统一 envelope：`{ ok: true, data } | { ok: false, error: { code, message, details? } }`。

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查（端口占用探测用） |
| GET | `/api/skills` | 列出全量技能（可带 `?refresh=1` 强制重扫） |
| GET | `/api/skills/:id` | 单技能详情，含 SKILL.md 文本 |
| GET | `/api/projects` | 列出所有注册项目 + 状态 |
| POST | `/api/projects` | 注册新项目 `{ path, name? }` |
| PATCH | `/api/projects/:id` | 改名、relocate、备注 |
| DELETE | `/api/projects/:id` | 仅删中心注册；项目文件不动 |
| GET | `/api/projects/:id/manifest` | 当前 manifest 内容 |
| GET | `/api/projects/:id/rules` | 当前 rules.yaml 内容（可能 404） |
| PUT | `/api/projects/:id/rules` | 写 rules.yaml（zod 校验） |
| POST | `/api/projects/:id/apply` | `{ skillIds: string[] }` 显式选择模式 apply |
| POST | `/api/projects/:id/unapply` | `{ skillIds?: string[] }` 不带参数=移除全部 |
| POST | `/api/projects/:id/sync` | 按 rules.yaml 重新推荐 + 返回 diff（不直接执行） |
| POST | `/api/projects/:id/diff-preview` | `{ skillIds: string[] }` → `{ toAdd, toKeep, toRemove }` |
| POST | `/api/ai/recommend` | `{ projectId, projectHint, includes, excludes, keywords, aiGuidance }` |
| POST | `/api/ai/test` | 连通性测试 |
| GET | `/api/settings` | 读 `CenterConfig`（屏蔽 apiKey） |
| PUT | `/api/settings` | 写 `CenterConfig` |
| GET | `/api/platform` | OS / Node / linkMethodPreview |

---

## 6. UI 结构

### 6.1 页面路由

```
/                 项目列表首页
/projects/:id     项目详情（含 4 个标签页）
/skills           全量技能库浏览
/settings         全局配置
```

### 6.2 项目列表首页 (`/`)

- 卡片网格：每卡片显示 项目名、路径（ellipsis）、已应用技能数、上次同步时间、状态徽章
- 徽章：`正常` / `损坏（路径失效）` / `未初始化`（未写过 manifest）/ `复制模式`
- 右上角「+ 添加项目」 → 弹窗：输入路径 + 名称（路径可手填或通过系统原生拾取器，但浏览器无原生目录选择——首版只支持手填 + 粘贴）
- 点击卡片进入详情

### 6.3 项目详情 (`/projects/:id`)

**头部**：项目名、路径（可复制/在资源管理器打开）、状态徽章、lastSyncedAt

**四个标签页**：

1. **已应用技能**
   - 读 `manifest.json` 渲染表格：技能名、source、linkedAs、method
   - 单条「移除」按钮 → 二次确认 → 从 manifest 删 + 删对应链接/目录

2. **添加技能**
   - 调 `GET /api/skills` 取全量候选
   - 按 `source` 分组（user / custom / plugin），plugin 再二级按 pluginName 分组
   - 关键词搜索（匹配 name + description）
   - 行 checkbox + 批量「应用选中」 → 打开 DiffPreview 弹窗 → 确认 → 执行

3. **AI 推荐**
   - 左栏表单：`projectHint`（textarea，占比大）、`keywords`（tag input）、`includes/excludes`（Skill 多选下拉）、`aiGuidance`（textarea）
   - 右栏：点「生成推荐」→ loading → 显示推荐卡片列表（默认全勾选，显示 reason）→ 用户调整 → 点「保存规则并应用」
   - 保存动作：写 `rules.yaml` + 执行 apply + 更新 manifest（三件事用同一后端事务）

4. **规则 & 同步**
   - Monaco 编辑器显示 `rules.yaml` 内容，保存时后端做 zod 校验，失败高亮错误行
   - 「按规则同步」按钮：后端读 rules → 扫描 → 调 AI → 与当前 manifest 做 diff → 返回 DiffPreview → 用户确认 → 执行

### 6.4 全量技能库 (`/skills`)

- 跨项目浏览（不操作任何项目）
- 按 source 分组 + 搜索
- 点技能 → 右侧抽屉：元数据 + SKILL.md 渲染（用 `marked` 或 `react-markdown`）

### 6.5 设置 (`/settings`)

**AI 配置块**：
- `endpoint` / `model` / `requestStyle`（openai|anthropic 单选）
- `apiKeyEnv`（推荐）+ `apiKey`（明文，输入时星号遮掩，旁边红字提示「本地明文存储，不要提交到 git」）
- `headers`（key-value 动态列表）
- `systemPrompt`（textarea，空时使用默认）
- 「连通性测试」按钮

**扫描路径块**：
- 列出当前 `scanPaths`，可增/删，末尾显示默认三条无法删除

**平台信息块**：
- 当前 OS、Node 版本、`linkMethodPreview`（运行时试一次，显示 symlink / junction / copy）

### 6.6 跨页面组件

- **SkillCard**：统一的技能展示卡（列表/推荐/详情共用）
- **DiffPreview**：三色列表（绿=新增、灰=保留、红=移除）
- **StatusBadge**：项目状态徽章
- **ApiKeyInput**：带遮掩切换的密码输入

---

## 7. 错误处理与边界

| 场景 | 处理 |
|---|---|
| SKILL.md 解析失败 | 跳过 + warning 列表；UI 顶部 toast 提示 |
| junction 创建失败（EPERM 等） | 自动降级 copy，manifest 记 method='copy'，UI 显式提示 |
| 目标 `.claude/skills/<name>` 已存在且非托管 | 拒绝本条目，其它正常进行；UI 列出冲突详情 |
| 目标 `.claude/skills/<name>` 已存在且是我们托管 | 先删后重建 |
| AI 响应无效 JSON | 自动重试 1 次；仍失败显示原文 + 允许用户退回手动挑选 |
| AI 超时（默认 60s） | 抛具体错误到 UI；不静默 |
| rules.yaml 校验失败 | 返回字段级 + 行号错误；不覆盖服务端状态 |
| 项目路径失效 | 状态标「损坏」，写入类操作禁用，提供「重新定位 / 移除」 |
| 并发 apply 同一项目 | per-project async mutex |
| `~/.skill-manager/` 首次启动不存在 | 自动创建并写默认 `db.json` |
| AI API key 缺失且 apiKeyEnv 未设 | AI 标签页禁用 + 提示去设置页配置 |

---

## 8. 测试策略

### 8.1 单元测试（Vitest）

**server**：
- `ScannerService`：用 fixture 目录（含正常/缺字段/格式错的 SKILL.md）验证输出 + warnings + fingerprint 缓存命中
- `LinkService`：在临时目录内（`os.tmpdir()`）测试 symlink/junction/copy 三条路径；冲突检测；unapply 安全性
- `RuleService`：yaml 解析 + 校验错误格式
- `AiService`：用 `msw` mock endpoint，验证请求构造、响应解析、重试、includes/excludes 强制约束

**web**：
- 关键组件：`DiffPreview`、`AiRecommendPanel`、`RuleEditor` 的交互流
- API hooks（TanStack Query）用 `msw` 打桩

### 8.2 集成测试

- 一条 golden path：
  1. fixture `.claude` 源（含 3 条用户技能 + 2 条模拟插件技能）
  2. 临时项目目录
  3. 模拟 AI 响应
  4. 端到端调用：addProject → recommend → apply → 验证 manifest + 文件系统状态 → unapply → 验证清理

### 8.3 平台覆盖

- CI 含 Windows runner（关键：`LinkService` 的 junction 行为与 POSIX 差异极大）
- Ubuntu runner 覆盖 POSIX symlink 路径

### 8.4 暂不做

- 前端 E2E（Playwright）— 本地工具 UI 稳定后再加

---

## 9. 安全与隐私

- **仅绑定 `127.0.0.1`**：Fastify 启动时显式 `host: '127.0.0.1'`，拒绝局域网访问
- **无鉴权**：基于单用户本地使用假设
- **API key 存储**：优先 `apiKeyEnv`（环境变量），明文落盘的 `apiKey` 在 UI 多处警示
- **写入范围**：LinkService 只写 `<project>/.claude/` 内部；RuleService / ProjectService 只写 `<project>/.claude/` 和 `~/.skill-manager/`
- **unapply 的安全底线**：永远只删 manifest 登记过的路径，不做递归删除

---

## 10. 风险与待定事项

### 10.1 已知风险

| 风险 | 缓解 |
|---|---|
| Windows 非开发者模式、非管理员下 symlink 失败 | 默认用 `fs.symlink(..., 'junction')`（Node 内部使用 `CreateSymbolicLinkW` 或 junction API），junction 对目录免特权；最终兜底 copy |
| 插件更新后缓存陈旧 | fingerprint 基于 mtime+size，插件同步时机器 mtime 会变，缓存自然失效；UI「重新扫描」按钮可强制刷新 |
| AI 返回 token 过多超限 | 候选技能数量 90+，单条约 200 字符，user prompt 约 20KB。对常见模型上下文（128k+）无压力；若未来增长再做分批 |
| AI 错误选择 includes 中不存在的 id | 后端强制校验 + 补齐 includes 条目（即使 AI 遗漏） |
| Claude Code 对 `<project>/.claude/skills/` 的识别行为变化 | 产物格式（symlink 指向真实 SKILL.md 所在目录）与手动放置技能完全一致；若 Claude Code 更改 discovery 规则，Skill Manager 只需调整输出路径 |

### 10.2 待定事项（可在 writing-plans 阶段进一步细化）

- AI 响应的 `function_calling` 支持：首版走纯 JSON 文本，未来可按 `requestStyle` 扩展
- 项目路径拾取：浏览器无原生目录选择器，首版手填；是否做"拖拽文件夹到窗口提取路径"作为增强
- 技能预览抽屉：是否渲染完整 SKILL.md 还是仅 frontmatter + 前 N 行
- 规则文件是否支持 "include-by-source"（如 `sourceIncludes: ['user']`）这类快捷写法

---

## 11. 里程碑（粗略，细化交给 writing-plans）

1. **M1 基础骨架**：monorepo 初始化、server/web 最小跑通、shared 类型定义
2. **M2 Scanner + Skills 浏览**：能扫描并展示全量技能（UI `/skills` 页面）
3. **M3 Project + Link 引擎**：添加项目、显式选择模式的 apply/unapply 闭环
4. **M4 Rule + AI 推荐**：rules.yaml + AI 流程端到端
5. **M5 同步 & Diff 预览**：规则驱动的同步 + 差异确认
6. **M6 打磨**：错误处理、设置页、连通性测试、跨平台验证

---

**文档终点**：该设计已与用户确认。下一步由 `writing-plans` 技能产出逐任务的实施计划。
