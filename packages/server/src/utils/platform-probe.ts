import { mkdtemp, mkdir, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { IS_WINDOWS } from '@loom/shared';
import { copy } from 'fs-extra';

export type ProbeResult = 'symlink' | 'junction' | 'copy';

export async function probeLinkMethod(): Promise<ProbeResult> {
  const base = await mkdtemp(join(tmpdir(), 'sm-probe-'));
  const src = join(base, 'src');
  const dst = join(base, 'dst');
  await mkdir(src);
  try {
    try {
      await symlink(src, dst, 'junction');
      return IS_WINDOWS ? 'junction' : 'symlink';
    } catch {
      await copy(src, dst);
      return 'copy';
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
