#!/usr/bin/env node
/**
 * Bundle the Loom server into a single executable using Node 22 SEA
 * (Single Executable Application) + postject.
 *
 * Pipeline:
 *   1. esbuild bundle `packages/server/dist/index.js` + all its workspace
 *      deps (incl. @loom/shared TS source) into ONE flat ESM file at
 *      `apps/desktop/.build/server-bundle.mjs`.
 *   2. Node 22 SEA: `node --experimental-sea-config` reads the bundle,
 *      produces a blob.
 *   3. Copy the currently-running Node executable to
 *      `apps/desktop/src-tauri/resources/loom-server-<triple>[.exe]`.
 *   4. `postject` injects the blob into the copy, turning it into a
 *      self-contained sidecar exe.
 *
 * Web dist is NOT packed into the exe — Tauri ships it as a separate
 * resource folder and tells the sidecar where to find it via the
 * LOOM_WEB_DIST env var (handled by packages/server/src/utils/static.ts).
 */

import { build } from 'esbuild';
import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, writeFileSync, copyFileSync, chmodSync } from 'node:fs';

const execFile = promisify(execFileCb);

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, '..');
const repoRoot = resolve(desktopRoot, '../..');

const serverDist = resolve(repoRoot, 'packages/server/dist/index.js');
if (!existsSync(serverDist)) {
  console.error(`[build-sidecar] missing: ${serverDist}`);
  console.error('[build-sidecar] run `pnpm build` first.');
  process.exit(1);
}

// Platform/arch → Rust triple mapping Tauri expects under resources/.
function defaultTarget() {
  const platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'macos' : 'linux';
  return `node22-${platform}-${process.arch === 'x64' ? 'x64' : 'arm64'}`;
}
const tripleMap = {
  'node22-win-x64':    { triple: 'x86_64-pc-windows-msvc',  ext: '.exe' },
  'node22-macos-x64':  { triple: 'x86_64-apple-darwin',     ext: '' },
  'node22-macos-arm64':{ triple: 'aarch64-apple-darwin',    ext: '' },
  'node22-linux-x64':  { triple: 'x86_64-unknown-linux-gnu',ext: '' },
  'node22-linux-arm64':{ triple: 'aarch64-unknown-linux-gnu',ext: '' },
};
const targetEnv = process.env.SIDECAR_TARGET ?? defaultTarget();
const target = tripleMap[targetEnv];
if (!target) {
  console.error(`[build-sidecar] unknown SIDECAR_TARGET: ${targetEnv}`);
  console.error(`[build-sidecar] valid: ${Object.keys(tripleMap).join(', ')}`);
  process.exit(1);
}

// ─── Step 1: esbuild bundle server as ESM ──────────────────────────
const buildDir = resolve(desktopRoot, '.build');
mkdirSync(buildDir, { recursive: true });
const bundlePath = resolve(buildDir, 'server-bundle.mjs');

console.log('[build-sidecar] esbuild bundling server (ESM)...');
console.log(`[build-sidecar]   entry:  ${serverDist}`);
console.log(`[build-sidecar]   output: ${bundlePath}`);

await build({
  entryPoints: [serverDist],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: bundlePath,
  banner: {
    // Provide CJS require() inside the ESM bundle for deps that reach
    // for it (fs-extra, js-yaml, etc.). Use process.execPath as base
    // because in SEA, the bundle is loaded via data-URL — createRequire
    // rejects data-URLs but accepts any absolute file path.
    js: `import { createRequire as __loomCreateRequire__ } from 'node:module';
const require = __loomCreateRequire__(process.execPath);
`,
  },
  // SEA loads the bundle from a data-URL, so `import.meta.url` becomes
  // a data-URL which fileURLToPath() refuses. Replace with a stable
  // placeholder file URL (Windows-compatible: must include a drive
  // letter for fileURLToPath to accept it). Code paths that walk
  // relative to this URL (resolveWebDist) are pre-empted by
  // LOOM_WEB_DIST env var at runtime.
  define: {
    'import.meta.url':
      process.platform === 'win32'
        ? '"file:///C:/loom-sidecar/server-bundle.mjs"'
        : '"file:///loom-sidecar/server-bundle.mjs"',
  },
  logLevel: 'warning',
});
console.log('[build-sidecar]   bundle OK');

// ─── Step 2a: write a CJS wrapper that loads the ESM bundle ────────
// SEA embeds `main` without a file extension, so Node always parses
// it as CommonJS. To run ESM, we make main a tiny CJS wrapper that
// reads the ESM bundle from SEA assets and imports it via data URL.
const wrapperPath = resolve(buildDir, 'sea-entry.cjs');
writeFileSync(
  wrapperPath,
  `// SEA main: CJS wrapper that loads the ESM server bundle.
'use strict';
const sea = require('node:sea');
const source = sea.getAsset('server-bundle.mjs', 'utf8');
const dataUrl = 'data:text/javascript;base64,' +
  Buffer.from(source, 'utf8').toString('base64');
import(dataUrl).catch((err) => {
  console.error('[sidecar] failed to load server bundle:', err);
  process.exit(1);
});
`,
);

// ─── Step 2b: SEA config + blob ─────────────────────────────────────
const seaConfigPath = resolve(buildDir, 'sea-config.json');
const seaBlobPath = resolve(buildDir, 'sea-prep.blob');

writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: wrapperPath.replace(/\\/g, '/'),
      output: seaBlobPath.replace(/\\/g, '/'),
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      // useCodeCache: false; server-bundle is loaded via data-URL
      // dynamic import so caching the tiny wrapper is pointless.
      useCodeCache: false,
      assets: {
        'server-bundle.mjs': bundlePath.replace(/\\/g, '/'),
      },
    },
    null,
    2,
  ),
);

console.log('[build-sidecar] generating SEA blob...');
try {
  const { stdout, stderr } = await execFile(process.execPath, [
    '--experimental-sea-config',
    seaConfigPath,
  ]);
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.warn(stderr.trim());
} catch (err) {
  console.error('[build-sidecar] SEA blob generation failed:', err.stderr || err.stdout || err.message);
  process.exit(1);
}
console.log(`[build-sidecar]   blob OK: ${seaBlobPath}`);

// ─── Step 3: Copy Node binary → resources/loom-server-<triple> ─────
const resourcesDir = resolve(desktopRoot, 'src-tauri/resources');
mkdirSync(resourcesDir, { recursive: true });
const outFile = resolve(resourcesDir, `loom-server-${target.triple}${target.ext}`);

console.log('[build-sidecar] copying node binary → output...');
console.log(`[build-sidecar]   node:   ${process.execPath}`);
console.log(`[build-sidecar]   output: ${outFile}`);

copyFileSync(process.execPath, outFile);
chmodSync(outFile, 0o755);

// ─── Step 4: postject inject blob into the copied exe ───────────────
// pnpm hoists the postject bin into the workspace package's local
// node_modules/.bin rather than the root. Look there first, then
// fall back to the repo root.
const postjectBinName = process.platform === 'win32' ? 'postject.cmd' : 'postject';
const postjectCandidates = [
  resolve(desktopRoot, 'node_modules/.bin', postjectBinName),
  resolve(repoRoot, 'node_modules/.bin', postjectBinName),
];
const postjectBin = postjectCandidates.find(existsSync);
if (!postjectBin) {
  console.error('[build-sidecar] postject binary not found. Tried:');
  postjectCandidates.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

const postjectArgs = [
  outFile,
  'NODE_SEA_BLOB',
  seaBlobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];
if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}

console.log('[build-sidecar] injecting SEA blob via postject...');
await new Promise((res, rej) => {
  // spawn with shell: true works around the Windows .cmd EINVAL in
  // Node 18+ — the shell re-expands postject.cmd correctly.
  const child = spawn(postjectBin, postjectArgs, {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
  });
  child.on('error', rej);
  child.on('close', (code) =>
    code === 0 ? res(undefined) : rej(new Error(`postject exited ${code}`)),
  );
});
console.log(`[build-sidecar] done: ${outFile}`);
