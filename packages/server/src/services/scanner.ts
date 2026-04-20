import { readFile, access } from 'node:fs/promises';
import { dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import glob from 'tiny-glob';
import matter from 'gray-matter';
import { SKILLS_CACHE_FILE, type Skill } from '@skill-manager/shared';
import { computeFingerprint } from '../utils/fingerprint.js';
import { atomicWriteFile } from '../utils/fs-safe.js';

type SourceKind = 'user' | 'custom' | 'plugin';

function classifySource(sourceRoot: string): SourceKind {
  const normalized = sourceRoot.replace(/[\\/]+$/, '');
  if (/[\\/]plugins[\\/]cache$/.test(normalized)) return 'plugin';
  if (/[\\/]custom-skills$/.test(normalized)) return 'custom';
  return 'user';
}

function extractPluginName(sourceRoot: string, absPath: string): string | undefined {
  const rel = relative(sourceRoot, absPath);
  const parts = rel.split(/[\\/]/);
  if (parts.length < 2) return undefined;
  return `${parts[0]}/${parts[1]}`;
}

function makeSkillId(sourceRoot: string, relPath: string): string {
  return createHash('sha1').update(`${sourceRoot}::${relPath}`).digest('hex').slice(0, 12);
}

export interface ScanResult {
  skills: Skill[];
  warnings: string[];
}

export interface ScanOptions {
  scanPaths: string[];
  cachePath?: string;
  forceRefresh?: boolean;
}

type CacheFile = Record<string, Skill>;

async function loadCache(path: string): Promise<CacheFile> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as CacheFile;
  } catch {
    return {};
  }
}

async function saveCache(path: string, data: CacheFile): Promise<void> {
  await atomicWriteFile(path, JSON.stringify(data, null, 2));
}

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function scanSkills(opts: ScanOptions): Promise<ScanResult> {
  const cachePath = opts.cachePath ?? SKILLS_CACHE_FILE;
  const oldCache = opts.forceRefresh ? {} : await loadCache(cachePath);
  const newCache: CacheFile = {};
  const warnings: string[] = [];
  const skills: Skill[] = [];

  for (const sourceRoot of opts.scanPaths) {
    if (!(await pathExists(sourceRoot))) continue;
    const matches = await glob('**/SKILL.md', { cwd: sourceRoot, absolute: true, filesOnly: true });
    const source = classifySource(sourceRoot);

    for (const absPath of matches) {
      const fp = await computeFingerprint(absPath);
      const relPath = relative(sourceRoot, absPath);
      const id = makeSkillId(sourceRoot, relPath);
      const cached = oldCache[id];
      if (cached && cached.fingerprint === fp) {
        newCache[id] = cached;
        skills.push(cached);
        continue;
      }
      try {
        const raw = await readFile(absPath, 'utf8');
        const parsed = matter(raw);
        const name = typeof parsed.data.name === 'string' ? parsed.data.name : '';
        const desc = typeof parsed.data.description === 'string' ? parsed.data.description : '';
        if (!name || !desc) {
          warnings.push(`Missing name/description in frontmatter: ${absPath}`);
          continue;
        }
        const skill: Skill = {
          id,
          name,
          description: desc,
          source,
          sourceRoot,
          absolutePath: absPath,
          skillDir: dirname(absPath),
          pluginName: source === 'plugin' ? extractPluginName(sourceRoot, absPath) : undefined,
          fingerprint: fp,
        };
        newCache[id] = skill;
        skills.push(skill);
      } catch (err) {
        warnings.push(`Failed to parse ${absPath}: ${(err as Error).message}`);
      }
    }
  }

  await saveCache(cachePath, newCache);
  return { skills, warnings };
}
