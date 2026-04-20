import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  CENTER_DB_FILE,
  DEFAULT_SCAN_PATHS,
  CenterDbSchema,
  type CenterDb,
} from '@skill-manager/shared';

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
  await db.read();
  db.data = CenterDbSchema.parse(db.data);
  if (db.data.scanPaths.length === 0) db.data.scanPaths = [...DEFAULT_SCAN_PATHS];
  await db.write();
  return db;
}
