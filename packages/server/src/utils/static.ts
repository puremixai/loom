import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export function resolveWebDist(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../web/dist'),
    resolve(here, '../../../web/dist'),
    resolve(here, '../../../../packages/web/dist'),
  ];
  return candidates.find(p => existsSync(join(p, 'index.html'))) ?? null;
}
