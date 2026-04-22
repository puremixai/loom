import { promises as fs, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, isAbsolute, join, sep } from 'node:path';

export interface FsBrowseEntry {
  name: string;
  path: string;
}

export interface FsBrowseResult {
  cwd: string;
  parent: string | null;
  entries: FsBrowseEntry[];
  separator: string;
  isRoot: boolean;
  home: string;
}

const IS_WIN = platform() === 'win32';

/**
 * Enumerate available drives on Windows by stat-checking each letter A-Z.
 * Much faster than spawning `wmic` and dependency-free. Returns roots with
 * trailing separator (e.g., `C:\`) so they can be used directly as paths.
 */
function listWindowsDrives(): FsBrowseEntry[] {
  const drives: FsBrowseEntry[] = [];
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    const root = `${letter}:\\`;
    try {
      const st = statSync(root);
      if (st.isDirectory()) {
        drives.push({ name: `${letter}:`, path: root });
      }
    } catch {
      // drive not present
    }
  }
  return drives;
}

/**
 * Decide whether `cwd` is a filesystem root (so parent === null).
 * - POSIX: cwd === '/'
 * - Windows: cwd matches drive root pattern like 'C:\' or 'C:/'
 */
function isFsRoot(cwd: string): boolean {
  if (IS_WIN) {
    return /^[A-Za-z]:[\\/]?$/.test(cwd);
  }
  return cwd === '/';
}

/**
 * Browse directory contents for a directory picker UI. Returns only
 * sub-directories (files are hidden — the picker chooses project folders).
 * Hidden entries (starting with `.`) are filtered by default.
 *
 * Special inputs:
 *   - `path` undefined or empty string: on Windows, return the "drive picker"
 *     (entries = available drives, cwd = '', parent = null, isRoot = true).
 *     On POSIX, return listing of `/`.
 *   - `path` === '~': expand to the server's home directory.
 */
export async function browseDirectory(
  rawPath: string | undefined,
): Promise<FsBrowseResult> {
  const home = homedir();

  // Entry point with no path → Windows drive picker / POSIX root.
  if (!rawPath || rawPath === '') {
    if (IS_WIN) {
      return {
        cwd: '',
        parent: null,
        entries: listWindowsDrives(),
        separator: '\\',
        isRoot: true,
        home,
      };
    }
    rawPath = '/';
  }

  // `~` shortcut → home.
  let target = rawPath === '~' || rawPath.startsWith('~/') || rawPath.startsWith('~\\')
    ? join(home, rawPath.slice(1))
    : rawPath;

  if (!isAbsolute(target)) {
    throw Object.assign(new Error(`path must be absolute: ${rawPath}`), {
      statusCode: 400,
      code: 'INVALID_PATH',
    });
  }

  let st;
  try {
    st = await fs.stat(target);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      throw Object.assign(new Error(`path not found: ${target}`), {
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    }
    if (e.code === 'EACCES' || e.code === 'EPERM') {
      throw Object.assign(new Error(`permission denied: ${target}`), {
        statusCode: 403,
        code: 'PERMISSION_DENIED',
      });
    }
    throw err;
  }

  if (!st.isDirectory()) {
    throw Object.assign(new Error(`not a directory: ${target}`), {
      statusCode: 400,
      code: 'NOT_A_DIRECTORY',
    });
  }

  const rawEntries = await fs.readdir(target, { withFileTypes: true });
  const entries: FsBrowseEntry[] = [];
  for (const ent of rawEntries) {
    if (ent.name.startsWith('.')) continue; // skip hidden
    // On Windows, junctions report as isSymbolicLink()/isDirectory() depending
    // on the fs; use statSync fallback for cross-platform safety.
    try {
      if (ent.isDirectory()) {
        entries.push({ name: ent.name, path: join(target, ent.name) });
        continue;
      }
      if (ent.isSymbolicLink()) {
        const follow = statSync(join(target, ent.name));
        if (follow.isDirectory()) {
          entries.push({ name: ent.name, path: join(target, ent.name) });
        }
      }
    } catch {
      // dangling symlink or permission issue on the child — skip
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  const parent = isFsRoot(target)
    ? (IS_WIN ? '' : null) // Windows: go up to drive picker; POSIX: already at root
    : dirname(target);

  return {
    cwd: target,
    parent,
    entries,
    separator: sep,
    isRoot: isFsRoot(target),
    home,
  };
}
