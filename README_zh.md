# 🧵 Loom

**把 Claude 技能织进每一个项目。**

[🇬🇧 English](./README.md) · [🇨🇳 中文](./README_zh.md) · [📋 更新日志](./CHANGELOG.zh.md) · [🎨 设计规范](./docs/DESIGN.md)

**按项目隔离**地管理 [Claude Code](https://claude.com/product/claude-code) 的技能（skills）——扫描 `~/.claude/**/SKILL.md`，把精选子集链接到各项目，可选地让 LLM 推荐。

> 💡 Claude Code 技能默认全局可见。Loom 让每个项目有自己的技能清单，零复制。

---

## ✨ 为什么

装了 50+ 技能后，每次会话都要面对**全量**候选——触发变慢、噪声变大，项目真正要的那几个被淹没。

**Loom 四步**：🔍 扫描 → 🔗 链接到 `<项目>/.claude/skills/` → 📝 记录到 `loom.json` → 📜 意图写进 `loom.rules.yaml`。

## 🚀 安装

| 形态 | 怎么用 |
|---|---|
| 🌐 **Web 版** | `pnpm install && pnpm start` → <http://127.0.0.1:4178> |
| 🖥️ **桌面版** *(v0.3.0 新增)* | 从 [Releases](https://github.com/puremixai/loom/releases) 下 MSI / NSIS 安装包（Windows x64）。托盘、关窗到托盘、原生选择框。 |

## 📦 快速开始（Web 版）

```bash
git clone https://github.com/puremixai/loom.git
cd loom
pnpm install
pnpm build && pnpm start    # :4178
# 或: pnpm dev   (后端 :4178 + Vite :5173，/api 代理)
```

需要 Node 20.11+ 和 pnpm 9.x（`corepack enable && corepack prepare pnpm@9.12.0 --activate`）。

## 🧭 用法

1. ➕ **Add Project** —— 输入项目绝对路径
2. 🎯 **选技能** —— ✋ 手动 · 🤖 AI 推荐 · 📋 规则驱动
3. ✅ **Apply** —— 写 junction/symlink 到 `.claude/skills/`，manifest 记到 `.claude/loom.json`
4. 🎉 Claude Code 自动识别，Loom 可以关了

Loom **只操作自己 manifest 里登记过的条目**，你手动放的其他文件永远不碰。

## ⚙️ 配置

- **扫描路径** —— 默认覆盖 `~/.claude/skills`、`~/.claude/custom-skills`、`~/.claude/plugins/cache`、`~/.loom/skills`
- **AI 服务** —— 任何 OpenAI 兼容或 Anthropic Messages 接口（OpenAI · Anthropic · DeepSeek · Moonshot · OpenRouter · LiteLLM · Ollama + OpenAI shim）

Key 解析顺序：环境变量名（推荐）→ 明文（UI 红字警示）。

## 🔒 隐私

- 🏠 只绑 `127.0.0.1`、不带鉴权 → **单用户本地使用**
- 📡 唯一出网请求 = 你主动触发的 AI 推荐，只打到你自己配的 endpoint

| 文件 | 入 git? |
|---|---|
| `<项目>/.claude/loom.rules.yaml` —— 意图声明 | ✅ 是 |
| `<项目>/.claude/loom.json` —— 应用 manifest | ❌ 否 |
| `<项目>/.claude/skills/*` —— 链接/复制 | ❌ 否 |
| `~/.loom/db.json` —— 注册表 + AI 配置 | ❌ 否 |

## 🏗️ 架构

pnpm monorepo：`@loom/shared`（zod 类型）· `@loom/server`（Fastify）· `@loom/web`（React SPA）· `@loom/desktop`（Tauri 壳）。

完整设计 → [`docs/superpowers/specs/2026-04-20-loom-design.md`](docs/superpowers/specs/2026-04-20-loom-design.md) · 后端内部约定 → [`CLAUDE.md`](CLAUDE.md)。

## 🧪 开发

```bash
pnpm dev                   # 前后端并行热更新
pnpm -r run typecheck      # 🔍
pnpm -r run test           # 🟢 62 个测试（shared 5 + server 53 + web 4）
```

🪟 **Windows**：用目录 junction（**无需** Developer Mode / 管理员），失败兜底到整目录复制。CI 跑 Ubuntu + Windows × Node 20 / 22。

## 🗺️ Roadmap

⏳ 移动端侧栏 · 前端组件级测试 · CLI 陪伴工具 · 文件系统监听 · 技能 Markdown 预览 · 键盘导航 · macOS/Linux 安装包 + 签名 · 团队模式 · 技能集合。

## 🤝 贡献

非平凡改动前先开 issue · 遵循 [`CLAUDE.md`](CLAUDE.md) 约定 · `pnpm -r run typecheck && pnpm -r run test` 必须过 · 约定式提交消息。

🔐 安全问题请走 GitHub Security Advisory（私下报告）。

## 📜 License

[MIT](LICENSE)

## 💖 致谢

构建于 [Fastify](https://fastify.dev/) · [React](https://react.dev/) · [Vite](https://vite.dev/) · [Tailwind](https://tailwindcss.com/) · [Radix](https://www.radix-ui.com/) · [TanStack Query](https://tanstack.com/query) · [Zod](https://zod.dev/) · [Tauri](https://tauri.app/) · UI 参考 [Vercel Geist](https://vercel.com/font)。为 Anthropic 的 [Claude Code](https://claude.com/product/claude-code) 而设计。

## ⭐ Star History

![Star History](https://api.star-history.com/chart?repos=puremixai/loom&type=date&logscale&legend=top-left)
