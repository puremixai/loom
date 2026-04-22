# 🧵 Loom

**把 Claude 技能织进每一个项目。**

Loom 是一个本地优先的应用，用来**按项目隔离**管理 [Claude Code](https://claude.com/product/claude-code) 的技能（skills）。它扫描 `~/.claude/` 下所有 `SKILL.md`，把精选子集链接到各项目，可选地让 LLM 推荐合适组合——完全不动 Claude Code 的全局技能库。

**[English](./README.md) · [中文](./README_zh.md)** · [更新日志](./CHANGELOG.zh.md) · [设计规范](./docs/DESIGN.md)

> Claude Code 默认所有技能全局可见。Loom 让它们变成「每个项目有自己的技能清单」，**零复制、零污染**。

---

## ✨ 为什么需要 Loom

当你累积了 50+ 技能，每次 Claude Code 会话都要面对**全量**候选——触发变慢、噪声变大，项目真正需要的那几个被淹没。

Loom 四步解决：

1. 🔍 **扫描** `~/.claude/skills`、`~/.claude/custom-skills`、`~/.claude/plugins/cache`、`~/.loom/skills` 下所有 `SKILL.md`
2. 🔗 **链接** 选中的子集到 `<项目>/.claude/skills/`（Windows 用 junction，其他平台用 symlink）
3. 📝 **记录** 应用状态到 `<项目>/.claude/loom.json`
4. 📜 **声明意图** 到 `<项目>/.claude/loom.rules.yaml`——入 git、团队共享、跨机复现

## 🚀 两种形态

同一套 Fastify + React，两种发布形态：

| 形态 | 适合 | 怎么用 |
|---|---|---|
| 🌐 **Web 版** | 会 `git clone` 的开发者 | `pnpm install && pnpm start` → <http://127.0.0.1:4178> |
| 🖥️ **桌面版** *(v0.3.0 新增)* | 其他用户 | 从 [Releases](https://github.com/puremixai/loom/releases) 下载 MSI 或 NSIS 安装包（Windows x64） |

桌面版用 Tauri 包装同一个 UI——系统托盘、关窗到托盘、原生文件夹选择、内置 Node sidecar。详见 [`apps/desktop/README.md`](apps/desktop/README.md)。

---

## 📦 快速开始（Web 版）

**前置要求**：Node 20.11+、pnpm 9.x（没装就 `corepack enable && corepack prepare pnpm@9.12.0 --activate`）。

```bash
git clone https://github.com/puremixai/loom.git
cd loom
pnpm install
pnpm build && pnpm start
```

默认浏览器打开 <http://127.0.0.1:4178>。加 `NO_OPEN=1` 抑制自动打开。

热更新模式：
```bash
pnpm dev    # 后端 :4178，Vite :5173，/api 自动代理到后端
```

## 🧭 怎么用

1. **注册项目** —— Projects 页 → **Add Project** → 输入**绝对路径**。只把路径引用存进 `~/.loom/db.json`，不会碰你的项目文件。
2. **选技能** —— 三种模式：
   - ✋ **手动** —— 浏览技能库、勾选、预览 diff、应用
   - 🤖 **AI 推荐** —— 描述项目，让 LLM 给出带理由的推荐
   - 📋 **规则驱动** —— 同步项目已有的 `loom.rules.yaml`
3. **Apply** —— Loom 写入：
   - `<项目>/.claude/skills/<名>/` —— junction / symlink / 目录复制（兜底）
   - `<项目>/.claude/loom.json` —— 审计用的 manifest（`method: junction | symlink | copy`）
4. **完事** —— Claude Code 原生识别这些技能，Loom 可以关了。

在 **Applied** 标签页点任一技能的 **Remove** 或整个项目删除。Loom **只会删 manifest 登记过的条目**——`.claude/skills/` 里未托管的文件永远不碰。

## ⚙️ 配置

**默认扫描路径**（在 **Settings → Scan paths**）：

- `~/.claude/skills` —— `user` 源
- `~/.claude/custom-skills` —— `custom` 源
- `~/.claude/plugins/cache` —— `plugin` 源，marketplace/插件名自动提取
- `~/.loom/skills` —— `user-local`，Loom 管辖，用户自创作技能目录，首次启动自动创建

**AI 服务**（在 **Settings → AI configuration**）—— 任何 OpenAI 兼容或 Anthropic Messages API 的 endpoint 都支持。Key 解析顺序：`apiKeyEnv`（环境变量名，推荐）→ 明文（兜底，UI 会红字警示）。

实测兼容：OpenAI · Anthropic · DeepSeek · Moonshot · OpenRouter · LiteLLM · Ollama（带 OpenAI shim）· 任意兼容网关。

## 🔒 数据与隐私

除了你主动触发的 AI 推荐，**任何数据都不会离开你的机器**——AI 请求只会打到你自己配的 endpoint。服务只绑 `127.0.0.1`、不带鉴权。

| 文件 | 用途 | 入 git? |
|---|---|---|
| `~/.loom/db.json` | 注册表 + AI 配置 | 否 |
| `~/.loom/skills/` | 用户自创作的技能 | 你说了算 |
| `<项目>/.claude/loom.rules.yaml` | 意图声明 | ✅ **是** |
| `<项目>/.claude/loom.json` | 应用 manifest（环境事实） | 否 |
| `<项目>/.claude/skills/<名>/` | 指向源技能的链接/复制 | 否 |

## 🏗️ 架构

pnpm monorepo，三个库包 + 一个 App：

```
packages/
├─ shared/   @loom/shared    zod schemas + 常量（类型单点真相）
├─ server/   @loom/server    Fastify API、扫描、链接引擎、AI 服务
└─ web/      @loom/web       React SPA（TanStack Query、shadcn 风格 UI）

apps/
└─ desktop/  @loom/desktop   Tauri 2 壳 + SEA 打包的 Node sidecar
```

完整设计：[`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md)。API 列表、后端服务、内部约定：[`CLAUDE.md`](CLAUDE.md)。

## 🪟 Windows 说明

Windows 用目录 **junction**（**无需** Developer Mode / 管理员权限）——失败兜底是 `fs-extra` 整目录复制。复制模式会在 manifest 中标记，UI 能在源技能更新后提示重新同步。Windows 11 + Node 22 实测通过；见 [`packages/server/src/utils/fs-safe.ts`](packages/server/src/utils/fs-safe.ts)。

## 🧪 开发

```bash
pnpm install
pnpm dev                   # 前后端并行热更新
pnpm -r run typecheck      # 全量类型检查
pnpm -r run test           # 62 个测试（shared 5 + server 53 + web 4）
```

按 workspace 过滤：
```bash
pnpm --filter @loom/server  test
pnpm --filter @loom/web     build
pnpm --filter @loom/desktop tauri dev
```

CI 跑 Ubuntu + Windows × Node 20 / 22 四种组合。文件系统 fixture 用真实 `os.tmpdir()`——我们关心的 junction / `git pull` 集成 bug 只在真实磁盘上才会暴露，mock 掉就没意义。

## 🗺️ Roadmap

- [ ] 移动端 `<768px` 侧栏降级
- [ ] Sources 抽屉分组可折叠
- [ ] 组件级前端测试
- [ ] CLI 陪伴工具（CI 自动化规则同步）
- [ ] 文件系统监听模式（可选）
- [ ] 技能预览：渲染 Markdown
- [ ] 技能树键盘导航
- [ ] 桌面：macOS / Linux 安装包 + 签名
- [ ] 团队模式：跨 repo 共享规则
- [ ] 技能集合 / 标签 / 保存过的筛选

## 🤝 贡献

1. 非平凡改动前先开 issue 讨论。
2. 遵循 [`CLAUDE.md`](CLAUDE.md) 的工程约定（代码风格、文件结构、设计 tokens）。
3. `pnpm -r run typecheck && pnpm -r run test` 必须过。
4. 约定式提交消息：`feat:` / `fix:` / `docs:` / `chore:`。

## 🔐 安全

只绑 `127.0.0.1`、**没有鉴权**——**仅限单用户本地使用**。没自己加鉴权层前，不要把端口暴露到局域网或公网。

安全问题请通过 GitHub Security Advisory 私下报告，不要发 public issue。

## 📜 License

[MIT](LICENSE)

## 💖 致谢

构建于 [Fastify](https://fastify.dev/) · [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind](https://tailwindcss.com/) · [Radix UI](https://www.radix-ui.com/) · [TanStack Query](https://tanstack.com/query) · [Zod](https://zod.dev/) · [Tauri](https://tauri.app/) · UI 参考 [Vercel Geist](https://vercel.com/font) · 为 Anthropic 的 [Claude Code](https://claude.com/product/claude-code) 而设计。

## ⭐ Star History

![Star History](https://api.star-history.com/chart?repos=puremixai/loom&type=date&logscale&legend=top-left)
