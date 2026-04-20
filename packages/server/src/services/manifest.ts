import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  MANIFEST_FILENAME,
  PROJECT_CLAUDE_DIR,
  ManifestSchema,
  type Manifest,
} from '@loom/shared';

export async function readManifest(projectPath: string): Promise<Manifest | null> {
  const file = join(projectPath, PROJECT_CLAUDE_DIR, MANIFEST_FILENAME);
  try {
    const raw = await readFile(file, 'utf8');
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}
