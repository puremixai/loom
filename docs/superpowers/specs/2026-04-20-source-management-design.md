---
title: Source Management & Navigation (v0.2)
date: 2026-04-20
status: approved
authors: [user, claude-opus-4-7]
supersedes: none
depends-on: 2026-04-20-loom-design.md
---

# Loom v0.2 — Source Management & Navigation

## 1. 背景与目标

v0.1 完成了 MVP：扫描 `~/.claude/**/SKILL.md`、手动/AI 挑选、per-project 链接应用。实际使用中暴露三个缺口：

1. **更新闭环不完整** — 源目录（git-backed 自建技能、插件）有新版本时，用户只能手动进 shell 操作，Loom 看不见也推不动
2. **浏览体验在技能数 >50 时退化** — 当前 `/skills` 页按 source 平铺分组，视觉负担重、难以按路径导航
3. **"用户自建技能"缺少第一等公民地位** — 目前靠在 `scanPaths` 里手动加路径，没有默认位置、没有 UI 引导、没有与只读源（Claude Code 管辖区）的视觉区分

本 spec 覆盖以下三特性（代号按 v0.1 请求列表编号沿用）：

- **F4 用户自定义技能目录** — Loom 拥有独立的 `userSkillsDir`（默认 `~/.loom/skills/`），首次启动自动创建，单独的 Settings 卡片，独立扫描源 `source: 'user-local'`
- **F2 Skills Library 树状导航** — 左侧树侧栏按 `source → plugin marketplace → plugin` 分层，点节点过滤右侧
- **F1 源目录更新** — Loom 管辖区（`user` / `custom` / `user-local`）走 `git pull`；插件（`plugin`）走 "提示 + 复制命令"（A 级实现，不 shell-out 调 `claude plugins update`，未来可迭代）

## 2. 非目标

明确不做：

- ❌ 网络搜索技能（v0.1 请求 F3，推迟）
- ❌ Loom 内创建技能 UI（交给 Claude Code 的 `skill-creator`）
- ❌ 插件更新的 shell-out 执行（Q2 定为 A 级；未来 v0.3 可选）
- ❌ 自动定时检查更新（按需触发）
- ❌ 自动 pull / auto-merge（始终需用户确认）
- ❌ 移动端深度适配（v0.2 仅桌面优先，<768px 降级隐藏树）
- ❌ 键盘导航侧栏（v0.2 鼠标为主，键盘 v0.3）

## 3. 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│  Web UI                                                      │
│  ┌──────────┬──────────────────────────────────────────────┐ │
│  │ SkillTree│ Skills grid · 'Updates available' banner     │ │
│  │  (F2)    │ 'Check updates' → Drawer (F1)               │ │
│  └──────────┴──────────────────────────────────────────────┘ │
│  Settings: [User skills directory card] (F4)                 │
└───────────────────────┬──────────────────────────────────────┘
                        │ HTTP
┌───────────────────────▼──────────────────────────────────────┐
│  Server                                                       │
│  ┌────────────────┐  ┌─────────────────────────────────────┐ │
│  │ UserDirService │  │ SourceUpdateService                 │ │
│  │   (F4)         │  │   detectGitRoots()  (F1)            │ │
│  │ ensureUserSki- │  │   checkUpdate()     (F1)            │ │
│  │ llsDir()       │  │   pullRepo()        (F1)            │ │
│  └────────┬───────┘  └────────────┬────────────────────────┘ │
│           │                       │ child_process exec `git` │
│  ┌────────▼──────────────────────▼──────────────────────┐    │
│  │ ScannerService (extended: merge userSkillsDir,       │    │
│  │                 emit source='user-local')            │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

三特性独立性：F4 是基础设施（引入新 source 类型和第一等目录），F2 纯前端，F1 引入新服务。实施分 3 阶段落地，阶段间 commit 独立可回滚。

---

## 4. 特性 4 — 用户自定义技能目录

### 4.1 数据模型变化

扩展 `CenterDbSchema`（`@loom/shared`）：

```ts
export const CenterDbSchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  scanPaths: z.array(z.string()).default([]),
  userSkillsDir: z.string().optional(),   // 新增
  ai: AiConfigSchema.partial().default({}),
});
```

扩展 `SkillSchema.source` enum：

```ts
source: z.enum(['user', 'custom', 'plugin', 'user-local']),
```

新增常量：

```ts
// @loom/shared constants.ts
export const DEFAULT_USER_SKILLS_DIR = join(homedir(), '.loom', 'skills');
```

### 4.2 UserDirService

新建 `packages/server/src/services/user-dir.ts`：

```ts
import { mkdir, stat } from 'node:fs/promises';
import { DEFAULT_USER_SKILLS_DIR } from '@loom/shared';
import type { CenterDbStore } from '../storage/center-db.js';

export async function resolveUserSkillsDir(db: CenterDbStore): Promise<string> {
  return db.data.userSkillsDir ?? DEFAULT_USER_SKILLS_DIR;
}

export async function ensureUserSkillsDir(db: CenterDbStore): Promise<string> {
  const dir = await resolveUserSkillsDir(db);
  await mkdir(dir, { recursive: true });
  if (!db.data.userSkillsDir) {
    db.data.userSkillsDir = dir;
    await db.write();
  }
  return dir;
}

export async function validateUserSkillsDir(candidate: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const s = await stat(candidate);
    if (!s.isDirectory()) return { ok: false, error: 'Path exists but is not a directory' };
    return { ok: true };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      // 会在保存时 mkdir -p，OK
      return { ok: true };
    }
    return { ok: false, error: (err as Error).message };
  }
}
```

**调用点**：`buildApp()` 启动时调 `ensureUserSkillsDir(db)` —— 首次运行自动创建目录并落库。

### 4.3 Scanner 集成

`scanSkills` 接受新选项 `userSkillsDir?: string`，逻辑：

1. 把 `userSkillsDir` 前置合并到 `scanPaths`（去重）后再扫
2. 识别该目录下的 `SKILL.md` 时，`classifySource` 优先判定为 `'user-local'`（在 `user` / `custom` 之前）

`classifySource` 调整：

```ts
function classifySource(sourceRoot: string, userSkillsDir?: string): SourceKind {
  const normalized = sourceRoot.replace(/[\\/]+$/, '');
  if (userSkillsDir && normalized === userSkillsDir.replace(/[\\/]+$/, '')) return 'user-local';
  if (/[\\/]plugins[\\/]cache$/.test(normalized)) return 'plugin';
  if (/[\\/]custom-skills$/.test(normalized)) return 'custom';
  return 'user';
}
```

调用方（`skillsRoutes` 等）从 DB 读 `userSkillsDir` 后传给 `scanSkills`。

### 4.4 Settings UI

在 `SettingsPage.tsx` 现有 Scan paths 卡片**之前**新增卡片：

```
┌─ User skills directory ─────────────────────────────┐
│ Loom-managed location for your own skills.         │
│ Auto-scanned. Skill-creator from Claude Code        │
│ writes new skills here.                             │
│                                                      │
│ [C:/Users/ausu/.loom/skills                  ]      │
│ [Open folder]                                        │
│                                                      │
│ ℹ Create a new skill:                               │
│   1. In Claude Code, run:                           │
│      claude "use skill-creator to create            │
│              <name> in <path above>"                │
│   2. Click 'Refresh' on Skills Library              │
│   [Copy command template]                           │
└──────────────────────────────────────────────────────┘
```

组件：`packages/web/src/components/UserSkillsDirCard.tsx`（新）。

### 4.5 API 变化

- `GET /api/settings` 响应增加 `userSkillsDir: string | undefined`
- `PUT /api/settings` body 支持 `userSkillsDir?: string`；变更时：
  - 先 `validateUserSkillsDir` —— 非目录直接 400
  - 若合法且不存在则 `mkdir -p`
  - 写 DB
- `GET /api/platform` 响应增加 `userSkillsDir: string`（便于 UI 拿路径拼示例命令）
- **新增** `POST /api/user-skills-dir/open` —— 在系统资源管理器里打开目录（调 `open` 包）

### 4.6 边界处理

| 场景 | 行为 |
|---|---|
| 目录不存在且无权限创建 | 启动日志 warn；UI 设置页错误提示；`userSkillsDir` 回落到 `undefined`（下次启动重试）|
| 用户把 `userSkillsDir` 指向非目录文件 | `PUT /api/settings` 返回 400 |
| 用户把 `userSkillsDir` 从 scanPaths 里显式删除 | scanner 仍合并（强制），UI 上的 scan paths 列表显式排除这个目录 |
| 用户改 `userSkillsDir` 指向新位置 | Loom 不迁移旧目录内容；scanner 立即扫新位置；旧目录的技能消失（除非用户手动加回 scanPaths）|
| 旧 v0.1 数据（无 `userSkillsDir` 字段）| 首次启动自动初始化为 `DEFAULT_USER_SKILLS_DIR` |

---

## 5. 特性 2 — Skills Library 树状导航

### 5.1 树数据结构（纯前端推导）

不改后端，复用 `GET /api/skills` 返回的 `Skill[]`。

```ts
type TreeNode = {
  key: string;                 // 完整路径 'plugin/claude-plugins-official/superpowers'
  label: string;               // 最后一段 'superpowers'
  depth: number;
  count: number;               // 该节点下（含子孙）的技能数
  directCount: number;         // 仅直接挂在此节点的技能数
  children: TreeNode[];
  skills: Skill[];             // 直接挂在此节点的技能
};

function skillPath(s: Skill): string[] {
  if (s.source === 'plugin') {
    const parts = (s.pluginName ?? 'unknown').split('/');
    return ['plugin', ...parts];
  }
  return [s.source];
}

function buildTree(skills: Skill[]): TreeNode;
```

根节点 key = `'__root__'`，label = `'All'`，包含所有 skill。

### 5.2 组件规划

```
packages/web/src/
├─ pages/SkillsPage.tsx                 # 改为双栏 layout
├─ components/
│  ├─ SkillTree.tsx           # 新：递归渲染 TreeNode
│  ├─ SkillTreeNode.tsx       # 新：单节点，折叠/展开状态
│  └─ useSkillTree.ts         # 新：hook，接收 Skill[] 返回 { tree, selectedKey, setSelectedKey, visibleSkills }
```

`useSkillTree` 负责：
- 从 `useSkills()` 数据构建 `TreeNode`
- 管理折叠状态（localStorage 持久化：`loom:skill-tree:collapsed` = Set<string>）
- 管理选中状态（与 URL `?path=...` 双向绑定）
- 给定选中 key 返回该节点及子孙的所有 skills（`visibleSkills`）

### 5.3 URL 状态

`/skills?path=plugin/claude-plugins-official/superpowers`

- 初次进入 `/skills`（无 query）→ 默认 `selectedKey = '__root__'`
- 点击节点 → 用 `pushState`（或 `react-router-dom` 的 `navigate`）更新 URL，**会产生历史条目** —— 代价是每次点节点都加一条浏览历史，但换来浏览器前进/后退可用。用户若感觉过于嘈杂可在 v0.3 改为 replaceState（牺牲前后退）。
- 浏览器前进/后退 → 反映到 `selectedKey`（通过监听 location 变化）

### 5.4 交互规则

| 动作 | 行为 |
|---|---|
| 点文件夹图标 | 折叠/展开（不改变选中）|
| 点节点标签文本 | 选中 + 自动展开（若处于折叠态）|
| 选中节点 | 右侧展示该节点及所有子孙的 skills；搜索框在此范围内 filter |
| 搜索框输入 | 右侧只显示匹配 skill；树侧不自动展开匹配节点（保持浏览上下文）|
| 双击节点（可选）| 清空搜索并仅选中 —— 首版不做 |

### 5.5 样式（遵循 Vercel/Geist）

- 侧栏：`w-60`（240px），sticky，`self-start`，顶部与主内容对齐
- 节点行：`h-8`，`px-2`，`rounded-md`，点击 `cursor-pointer`
- 字体：Geist 14px / font-medium；选中态 600
- 折叠箭头：lucide `ChevronRight`（折叠）/ `ChevronDown`（展开），`h-3.5 w-3.5`，`text-ink-400`
- 文件夹图标：lucide `Folder` / `FolderOpen`，`h-4 w-4`，`text-ink-500`
- 计数徽章：Geist Mono 12px，`text-ink-400 tabular-nums`
- Hover：`bg-ink-50`
- 选中：`bg-ink-50 shadow-ring-light`，text `text-ink-900 font-semibold`
- 空节点（count=0）：整行 `text-ink-400`，hover 不变亮

### 5.6 响应式

- `>= 768px`：双栏 240px 侧栏 + flex-1 主区
- `< 768px`：隐藏侧栏，顶部加一个 `<select>` 选节点（内容同树，扁平化带缩进前缀）；主区全宽

---

## 6. 特性 1 — 源目录更新

### 6.1 SourceUpdateService

新建 `packages/server/src/services/source-update.ts`：

```ts
export type SourceKind = 'git-source' | 'plugin';

export interface SourceRef {
  kind: SourceKind;
  gitRoot: string;                    // 含 .git/ 的目录绝对路径
  displayName: string;                // 给 UI 用的可读名（见下方生成规则）
  skillIds: string[];                 // 覆盖的 Skill.id 数组
  marketplace?: string;               // kind='plugin' 时：pluginName 的第一段
  pluginName?: string;                // kind='plugin' 时：完整的 'marketplace/plugin' 标识
}
```

`displayName` 生成规则：
- `kind='plugin'`：用 `pluginName` 原值（如 `'claude-plugins-official/superpowers'`）
- `kind='git-source'`：用 `basename(gitRoot)`（如 `gitRoot = '/home/me/.loom/skills/my-custom-skills'` → `'my-custom-skills'`）

`marketplace` 字段解析：
- 从 `pluginName` split on `'/'`，取第一段（如 `'claude-plugins-official'`）
- 便于未来扩展（若要区分不同 marketplace 的更新策略）

```ts
export interface UpdateStatus {
  ref: SourceRef;
  ahead: number;                      // 本地领先远端的 commit 数
  behind: number;                     // 本地落后远端的 commit 数
  dirty: boolean;                     // 是否有未提交改动
  lastFetchAt?: string;               // ISO 时间戳
  lastCommit?: { sha: string; subject: string; author: string; date: string };
  error?: string;                     // 'no-remote' / 'timeout' / 'not-git' / raw stderr
}

export interface PullResult {
  ok: boolean;
  output: string;                     // stdout + stderr 拼接
  error?: string;
}

export async function detectGitRoots(skills: Skill[]): Promise<SourceRef[]>;
export async function checkUpdate(ref: SourceRef): Promise<UpdateStatus>;
export async function pullRepo(ref: SourceRef): Promise<PullResult>;
export function formatPluginUpdateCmd(ref: SourceRef): string;
```

### 6.2 Git 命令调用

```ts
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
const execFile = promisify(execFileCb);

async function git(args: string[], cwd: string, timeoutMs = 30_000): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFile('git', args, { cwd, timeout: timeoutMs });
    return { stdout, stderr };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${e.stderr || e.message}`);
  }
}
```

- 使用 `execFile`（非 shell 解析）防止注入
- 超时默认 30s
- 不捕获交互输入（`GIT_TERMINAL_PROMPT=0` 环境变量设置，避免卡死）

### 6.3 `.git/` 探测

```ts
async function findGitRoot(skillDir: string, stopAt: string): Promise<string | null> {
  let p = skillDir;
  while (p.startsWith(stopAt) && p !== dirname(p)) {
    if (await exists(join(p, '.git'))) return p;
    p = dirname(p);
  }
  return null;
}
```

`stopAt` = 该技能的 `sourceRoot`，防止探测到用户 `$HOME` 之上。

一个 gitRoot 可能覆盖多个技能（典型：一个 plugin 仓库里有多个 `skills/*/SKILL.md`）→ `detectGitRoots` 按 gitRoot 去重，合并 `skillIds`。

### 6.4 检测逻辑

```ts
async function checkUpdate(ref: SourceRef): Promise<UpdateStatus> {
  const base: UpdateStatus = { ref, ahead: 0, behind: 0, dirty: false };
  try {
    // fetch 远端
    await git(['fetch', '--quiet'], ref.gitRoot);
    base.lastFetchAt = new Date().toISOString();

    // 有无 upstream
    const upstreamRes = await git(['rev-parse', '--abbrev-ref', '@{u}'], ref.gitRoot).catch(() => null);
    if (!upstreamRes) return { ...base, error: 'no-remote' };

    // ahead/behind 计数
    const { stdout: ab } = await git(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], ref.gitRoot);
    const [aheadStr, behindStr] = ab.trim().split(/\s+/);
    base.ahead = Number(aheadStr ?? 0);
    base.behind = Number(behindStr ?? 0);

    // dirty?
    const { stdout: statusOut } = await git(['status', '--porcelain'], ref.gitRoot);
    base.dirty = statusOut.trim().length > 0;

    // 最新远端 commit 信息
    if (base.behind > 0) {
      const { stdout: log } = await git(
        ['log', '-1', '--pretty=format:%H%x00%s%x00%an%x00%cI', '@{u}'],
        ref.gitRoot,
      );
      const [sha, subject, author, date] = log.split('\x00');
      base.lastCommit = { sha: sha!, subject: subject!, author: author!, date: date! };
    }
    return base;
  } catch (err) {
    return { ...base, error: (err as Error).message };
  }
}
```

### 6.5 Pull（仅 kind='git-source'）

```ts
async function pullRepo(ref: SourceRef): Promise<PullResult> {
  if (ref.kind !== 'git-source') {
    return { ok: false, output: '', error: 'Pull is only allowed for git-source refs. For plugins, use the Claude CLI command.' };
  }
  try {
    const { stdout, stderr } = await git(['pull'], ref.gitRoot);
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (err) {
    return { ok: false, output: '', error: (err as Error).message };
  }
}
```

默认 merge 策略（用户确认 Q2 时选定）。冲突/rejects 自然抛出到 stderr，原文呈现。

### 6.6 插件更新命令格式

```ts
function formatPluginUpdateCmd(ref: SourceRef): string {
  if (!ref.marketplace || !ref.pluginName) return '';
  // 从 pluginName 拼完整的 marketplace/plugin 标识
  // pluginName 格式: 'claude-plugins-official/superpowers' (来自 scanner.extractPluginName)
  return `claude plugins update ${ref.pluginName}`;
}
```

> 若 Claude Code 的实际命令语法不同（如需要 `@marketplace` 后缀），在 E2E 测试中调整。

### 6.7 新 API 端点

```
GET  /api/sources
     → { ok: true, data: { refs: SourceRef[] } }
     扫全量 skills，按 gitRoot 去重返回

POST /api/sources/check
     body: { refs?: SourceRef[] }   // 不给则 check 全量
     → { ok: true, data: { statuses: UpdateStatus[] } }

POST /api/sources/pull
     body: { gitRoot: string }
     → { ok: true, data: PullResult } | { ok: false, error: {...} }
     只允许 kind='git-source'；对 plugin 返回 400 CANNOT_PULL_PLUGIN
```

路由文件：`packages/server/src/routes/sources.ts`。注册于 `buildApp`。

### 6.8 前端 UI

#### 顶栏横幅（Skills Library 页）

放在 Skills 主区顶部（侧栏右侧），首次打开自动触发 `GET /api/sources` + `POST /api/sources/check`：

```
┌──────────────────────────────────────────────────────┐
│ 🔄 Sources   8 git-backed · 2 have updates    [View] │
└──────────────────────────────────────────────────────┘
```

样式：`shadow-ring-light bg-white rounded-lg`；点 `[View]` 打开抽屉。

#### 抽屉组件 `SourceUpdatesDrawer`

基于 Radix Dialog（已装）改造为 side-drawer（`right-0` 固定、`w-[420px]` 或 `max-w-[90vw]`）。内容分组：

```
┌─ Source updates ────────────────────────────────────┐
│ [Refresh now]            last checked 2 min ago     │
├──────────────────────────────────────────────────────┤
│ ⬆ Behind upstream (2)                                │
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │ my-custom-skills (git-source)                    ││
│ │ 1 commit behind                                  ││
│ │ Last: "new skill: sql-to-orm"                    ││
│ │   by alice, 5 hours ago                          ││
│ │ [Pull]  [Copy path]                              ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │ claude-plugins-official/superpowers (plugin)     ││
│ │ 3 commits behind                                 ││
│ │ Last: "fix: tighten SKILL.md schema"             ││
│ │ $ claude plugins update                          ││
│ │   claude-plugins-official/superpowers            ││
│ │ [Copy command]                                   ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ ✓ Up to date (6)  [expand]                          │
│ ⚠ Errors (1)  [expand]                              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

Pull 按钮点击 → 调 API → 按钮变 `Pulling…` → 完成后展示 output 或 error。

#### 组件文件

```
packages/web/src/
├─ components/
│  ├─ SourceUpdatesBanner.tsx      # 顶栏卡片
│  └─ SourceUpdatesDrawer.tsx      # 抽屉
├─ api/sources.ts                   # 新：useSources, useCheckSources, usePullSource
```

### 6.9 并发与缓存

- `checkUpdate` 并发上限 5（避免同时 git fetch 多个远端打爆网络）
- `POST /api/sources/check` 模块级互斥：同一时刻只允许一个 batch 跑；重入请求 join 当前 Promise
- `lastFetchAt` 存内存（进程 restart 清零），UI 显示"last checked X min ago"
- 不做定时刷新，抽屉打开时主动触发一次

### 6.10 边界处理

| 场景 | 行为 |
|---|---|
| Git 未安装 | 首次 ENOENT 时，所有 refs 返回 `error: 'git-not-found'`；UI 全局 banner 警告 |
| 某 repo 无 origin | `checkUpdate` 返回 `error: 'no-remote'` |
| 私有 repo 需认证 | `git fetch` 调 SSH agent / credential helper；Loom 不接管；错误原文显示 |
| Dirty working tree + pull | git 拒绝；UI 明确提示"commit or stash first" |
| Merge conflict | pull 失败，stderr 原文展示 |
| 超时（30s）| status 标记 `error: 'timeout'`；不阻塞其他 ref |
| `installed_plugins.json` 某字段缺失 | 仍用 git rev-list 比较；UI 不依赖该 JSON |

---

## 7. 测试策略

### 7.1 后端

新增 vitest 测试：

- `user-dir.test.ts`
  - `ensureUserSkillsDir` 初次创建 + 落库
  - `validateUserSkillsDir` 拒绝非目录
- `scanner.test.ts` 扩展
  - 识别 `userSkillsDir` 下的技能为 `source: 'user-local'`
- `source-update.test.ts`
  - `findGitRoot` 向上探测 + stopAt 限制
  - `detectGitRoots` 多技能合并到同一 gitRoot
  - `formatPluginUpdateCmd` 输出格式
  - `checkUpdate` 用 mock git 返回值覆盖 ahead/behind/dirty/no-remote
  - `pullRepo` 拒绝 plugin kind

避免：真实 `git fetch` 到公网仓库（测试会慢且不稳）。
方案：在 tmpdir 里 `git init` + `git init --bare` 构造本地 upstream，做端到端 git 行为验证。

### 7.2 前端

- `useSkillTree` 单测：给定 Skill[] 输出 TreeNode 结构
- `SkillTree` 组件交互测试：折叠/展开、URL 同步
- `SourceUpdatesDrawer` 渲染测试：各 status 分类展示

（注：现有前端测试仍为空，本 spec 借机补充基础设施）

---

## 8. 风险与待定事项

### 8.1 风险

| 风险 | 缓解 |
|---|---|
| Git CLI 不可用（罕见但存在） | 检测到 ENOENT 一次，全局禁用 Sources 功能并明确提示 |
| 插件更新命令实际语法与假设不同 | 在实际测试时调整 `formatPluginUpdateCmd`；UI 显示的是"建议命令"非保证 |
| 大仓库 `git fetch` 慢 | 30s 超时；未来可加 `--depth=1` shallow 选项 |
| 多个插件共享同一 gitRoot | 检测逻辑按 gitRoot 去重，一个 ref 对应多个 skillIds，UI 上一个条目列出所有覆盖的 skill 名 |

### 8.2 待定（v0.3+ 决定）

- 是否加卡片级小圆点标记有更新的技能（UX 增强）
- 键盘导航（Tab/↑↓/Enter）
- 自动定时检查（用户偏好开关）
- 插件更新升级到 B 级（shell-out `claude plugins update`）

---

## 9. 里程碑

| 阶段 | 内容 | 可独立 merge |
|---|---|---|
| **M1** | 特性 4：`userSkillsDir` 数据模型、UserDirService、Scanner 集成、Settings UI | ✅ |
| **M2** | 特性 2：SkillTree 组件、useSkillTree、双栏 SkillsPage、URL 状态 | ✅ |
| **M3** | 特性 1：SourceUpdateService、3 个新 API、Banner + Drawer、前端 hooks | ✅ |

每阶段末做一次冒烟测试（手动或 CI），全部绿后合并。

---

**文档终点**：v0.2 设计已锁。下一步由 `writing-plans` 技能把 M1/M2/M3 拆成可执行的 TDD 任务序列。
