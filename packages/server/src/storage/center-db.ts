import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  CENTER_DB_FILE,
  DEFAULT_SCAN_PATHS,
  CenterDbSchema,
  type CenterDb,
} from '@loom/shared';

const DEFAULTS: CenterDb = {
  projects: [],
  scanPaths: [...DEFAULT_SCAN_PATHS],
  ai: {},
};

export type CenterDbStore = Low<CenterDb>;

export async function openCenterDb(filePath = CENTER_DB_FILE): Promise<CenterDbStore> {
  await mkdir(dirname(filePath), { recursive: true });
  const adapter = new JSONFile<CenterDb>(filePath);
  const db = new Low<CenterDb>(adapter, DEFAULTS);
  try {
    await db.read();
  } catch (err) {
    throw new Error(`Failed to read center db at ${filePath}: ${(err as Error).message}`, { cause: err });
  }
  try {
    db.data = CenterDbSchema.parse(db.data);
  } catch (err) {
    throw new Error(`Center db at ${filePath} has invalid schema: ${(err as Error).message}`, { cause: err });
  }
  if (db.data.scanPaths.length === 0) db.data.scanPaths = [...DEFAULT_SCAN_PATHS];
  await db.write();
  return db;
}
