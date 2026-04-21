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
