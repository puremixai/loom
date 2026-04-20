# Loom

Local multi-project manager for Claude Code skills. Browse installed skills from `~/.claude/`, apply per-project subsets via symlinks/junctions, and ask an AI to recommend skills for each project based on a rules file.

## Requirements

- Node.js >= 20.11
- pnpm 9.x (`npm install -g pnpm`)
- An API key for an OpenAI-compatible or Anthropic endpoint (optional; only needed for AI recommendations)

## Quick start

```bash
pnpm install
pnpm build
pnpm start
```

Opens `http://127.0.0.1:4178` in your default browser.

For development (hot reload front + back):

```bash
pnpm dev
```

## Data locations

- Central config / project registry: `~/.loom/db.json`
- Scanner cache: `~/.loom/skills-cache.json`
- Per-project applied manifest: `<project>/.claude/loom.json`
- Per-project rules (committable): `<project>/.claude/loom.rules.yaml`

## Workflow

1. **Add a project** on the Projects page (absolute path).
2. **Manual mode**: open the project, switch to "Add skills", select skills, preview and apply.
3. **AI mode**: fill project hint + rules, click "Generate recommendations", adjust picks, save rules + apply.
4. **Rule-driven sync**: later, edit `loom.rules.yaml` and click "Sync by rules" to regenerate.

## Windows

The link engine uses directory junctions on Windows, which do NOT require administrator or Developer Mode privileges. If a junction fails, the engine falls back to a full directory copy and marks the manifest with `method: "copy"` — you'll need to use "Sync by rules" to refresh copies when the underlying skill changes.

## Security notes

- The server binds only to `127.0.0.1`; no LAN access.
- There is no auth — assume single-user local machine.
- API keys can be stored plaintext in `db.json` or loaded from an env var (preferred). The UI warns when using plaintext.
