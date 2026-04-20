import { access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { Skill, SourceRef } from '@loom/shared';

async function pathExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export async function findGitRoot(skillDir: string, stopAt: string): Promise<string | null> {
  const normalizedStop = stopAt.replace(/[\\/]+$/, '');
  let p = skillDir;
  for (let i = 0; i < 32; i++) {
    // p must be inside (or equal to) the stop boundary to be considered
    if (!p.startsWith(normalizedStop)) return null;
    if (await pathExists(join(p, '.git'))) return p;
    // do not walk above the boundary
    if (p === normalizedStop) return null;
    const parent = dirname(p);
    if (parent === p) return null;
    p = parent;
  }
  return null;
}

export async function detectGitRoots(skills: Skill[]): Promise<SourceRef[]> {
  const byRoot = new Map<string, SourceRef>();
  for (const skill of skills) {
    const gitRoot = await findGitRoot(skill.skillDir, skill.sourceRoot);
    if (!gitRoot) continue;
    const existing = byRoot.get(gitRoot);
    if (existing) {
      existing.skillIds.push(skill.id);
      continue;
    }
    const isPlugin = skill.source === 'plugin';
    const ref: SourceRef = isPlugin
      ? {
          kind: 'plugin',
          gitRoot,
          displayName: skill.pluginName ?? basename(gitRoot),
          skillIds: [skill.id],
          marketplace: skill.pluginName?.split('/')[0],
          pluginName: skill.pluginName,
        }
      : {
          kind: 'git-source',
          gitRoot,
          displayName: basename(gitRoot),
          skillIds: [skill.id],
        };
    byRoot.set(gitRoot, ref);
  }
  return [...byRoot.values()];
}

export function formatPluginUpdateCmd(ref: SourceRef): string {
  if (ref.kind !== 'plugin' || !ref.pluginName) return '';
  return `claude plugins update ${ref.pluginName}`;
}

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { UpdateStatus, PullResult } from '@loom/shared';

const execFile = promisify(execFileCb);

export interface GitRunResult { stdout: string; stderr: string }

export async function runGit(args: string[], cwd: string, timeoutMs = 30_000): Promise<GitRunResult> {
  const { stdout, stderr } = await execFile('git', args, {
    cwd,
    timeout: timeoutMs,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

export interface CheckOptions {
  runner?: typeof runGit;
  skipFetch?: boolean;
}

export async function checkUpdate(ref: SourceRef, opts: CheckOptions = {}): Promise<UpdateStatus> {
  const runner = opts.runner ?? runGit;
  const status: UpdateStatus = { ref, ahead: 0, behind: 0, dirty: false };
  try {
    if (!opts.skipFetch) {
      await runner(['fetch', '--quiet'], ref.gitRoot);
      status.lastFetchAt = new Date().toISOString();
    }
    try {
      await runner(['rev-parse', '--abbrev-ref', '@{u}'], ref.gitRoot);
    } catch {
      return { ...status, error: 'no-remote' };
    }
    const ab = await runner(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], ref.gitRoot);
    const [aheadStr, behindStr] = ab.stdout.trim().split(/\s+/);
    status.ahead = Number(aheadStr ?? 0);
    status.behind = Number(behindStr ?? 0);
    const statusOut = await runner(['status', '--porcelain'], ref.gitRoot);
    status.dirty = statusOut.stdout.trim().length > 0;
    if (status.behind > 0) {
      const log = await runner(['log', '-1', '--pretty=format:%H%x00%s%x00%an%x00%cI', '@{u}'], ref.gitRoot);
      const [sha, subject, author, date] = log.stdout.split('\x00');
      if (sha && subject && author && date) {
        status.lastCommit = { sha, subject, author, date };
      }
    }
    return status;
  } catch (err) {
    return { ...status, error: (err as Error).message };
  }
}

export interface PullOptions {
  runner?: typeof runGit;
}

export async function pullRepo(ref: SourceRef, opts: PullOptions = {}): Promise<PullResult> {
  if (ref.kind !== 'git-source') {
    return { ok: false, output: '', error: 'Pull is only allowed for git-source refs. For plugins, use the claude CLI.' };
  }
  const runner = opts.runner ?? runGit;
  try {
    const { stdout, stderr } = await runner(['pull'], ref.gitRoot);
    return { ok: true, output: `${stdout}\n${stderr}`.trim() };
  } catch (err) {
    return { ok: false, output: '', error: (err as Error).message };
  }
}
