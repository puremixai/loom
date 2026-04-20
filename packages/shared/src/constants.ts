import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const APP_NAME = 'loom';
export const DEFAULT_PORT = 4178;

export const CENTER_DIR = join(homedir(), '.loom');
export const CENTER_DB_FILE = join(CENTER_DIR, 'db.json');
export const SKILLS_CACHE_FILE = join(CENTER_DIR, 'skills-cache.json');

export const DEFAULT_SCAN_PATHS = [
  join(homedir(), '.claude', 'skills'),
  join(homedir(), '.claude', 'custom-skills'),
  join(homedir(), '.claude', 'plugins', 'cache'),
];

export const PROJECT_CLAUDE_DIR = '.claude';
export const PROJECT_SKILLS_DIR = '.claude/skills';
export const MANIFEST_FILENAME = 'loom.json';
export const RULES_FILENAME = 'loom.rules.yaml';

export const IS_WINDOWS = platform() === 'win32';
