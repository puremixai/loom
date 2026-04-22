import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export function resolveWebDist(): string | null {
  // Explicit override — used by Tauri desktop wrapper (spawns the sidecar
  // with LOOM_WEB_DIST set to a Tauri resource path) and any deployment
  // that stages the web build at a non-default location.
  if (process.env.LOOM_WEB_DIST && existsSync(join(process.env.LOOM_WEB_DIST, 'index.html'))) {
    return process.env.LOOM_WEB_DIST;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../web/dist'),
    resolve(here, '../../../web/dist'),
    resolve(here, '../../../../packages/web/dist'),
  ];
  return candidates.find(p => existsSync(join(p, 'index.html'))) ?? null;
}
