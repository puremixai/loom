import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  RULES_FILENAME,
  PROJECT_CLAUDE_DIR,
  RuleFileSchema,
  type RuleFile,
} from '@loom/shared';
import { atomicWriteFile } from '../utils/fs-safe.js';

export async function readRules(projectPath: string): Promise<RuleFile | null> {
  const file = join(projectPath, PROJECT_CLAUDE_DIR, RULES_FILENAME);
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = yaml.load(raw);
    return RuleFileSchema.parse(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeRules(projectPath: string, rules: RuleFile): Promise<void> {
  const validated = RuleFileSchema.parse(rules);
  const file = join(projectPath, PROJECT_CLAUDE_DIR, RULES_FILENAME);
  const yml = yaml.dump(validated, { lineWidth: 120, noRefs: true });
  await atomicWriteFile(file, yml);
}
