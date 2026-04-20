import { access, lstat, readlink, rm, rename, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function isSymlinkOrJunction(p: string): Promise<boolean> {
  try {
    const s = await lstat(p);
    return s.isSymbolicLink();
  } catch { return false; }
}

export async function readlinkSafe(p: string): Promise<string | null> {
  try { return await readlink(p); } catch { return null; }
}

export async function removePath(p: string): Promise<void> {
  await rm(p, { recursive: true, force: true });
}

export async function atomicWriteFile(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tmp, contents, 'utf8');
  await rename(tmp, filePath);
}
