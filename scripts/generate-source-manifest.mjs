#!/usr/bin/env node
/**
 * generate-source-manifest.mjs
 *
 * Walks `source-data/` and writes a complete, checksummed inventory of every
 * original source file to `source-data/MANIFEST.json` and `source-data/MANIFEST.csv`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The historical campaign package is ~876 MB of photos and video, including one
 * 185 MB file. GitHub hard-rejects any blob over 100 MB, and committing the rest
 * would make the repository painful to clone forever. So the binaries are excluded
 * from Git (see .gitignore) and this manifest is committed in their place.
 *
 * The manifest is the contract: it proves exactly which files made up the original
 * handoff package, how big each one was, and what its SHA-256 was at import time.
 * Nothing is silently discarded - if a file ever goes missing from someone's working
 * copy, `npm run verify:source` will say so by name.
 *
 * Usage:
 *   node scripts/generate-source-manifest.mjs          # write the manifest
 *   node scripts/generate-source-manifest.mjs --verify # check working tree against it
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'source-data');
const JSON_OUT = path.join(SOURCE_DIR, 'MANIFEST.json');
const CSV_OUT = path.join(SOURCE_DIR, 'MANIFEST.csv');

/** Files that are macOS bookkeeping, not source material. Recorded but flagged. */
const NOISE = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** Never inventory the manifest itself. */
const SELF = new Set(['MANIFEST.json', 'MANIFEST.csv']);

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function classify(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (['.mp4', '.mov', '.m4v', '.avi'].includes(ext)) return 'video';
  if (['.jpg', '.jpeg', '.png', '.heic', '.gif', '.webp'].includes(ext)) return 'image';
  if (['.csv', '.tsv'].includes(ext)) return 'dataset';
  if (['.md', '.txt', '.pdf'].includes(ext)) return 'document';
  return 'other';
}

/**
 * The historical package encodes the contributor's real name in the filename,
 * e.g. "20200731_195252 - Adam Heath.jpg" or "@DoctorWho00 - Marc Tavares.jpeg".
 * We capture that verbatim rather than parsing it, so the attribution survives
 * even though we are not committing the file itself.
 */
function attributionHint(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const match = stem.match(/\s-\s(.+)$/);
  return match ? match[1].replace(/\s*\(\d+\)$/, '').trim() : null;
}

async function build() {
  const files = [];
  for await (const full of walk(SOURCE_DIR)) {
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    const base = path.basename(full);
    if (SELF.has(base) && path.dirname(full) === SOURCE_DIR) continue;

    const stat = await fs.stat(full);
    files.push({
      path: rel,
      bytes: stat.size,
      sha256: await sha256(full),
      kind: classify(rel),
      modified: stat.mtime.toISOString(),
      attribution_hint: attributionHint(base),
      is_os_noise: NOISE.has(base),
      exceeds_github_blob_limit: stat.size > 100 * 1024 * 1024,
    });
  }

  const real = files.filter((f) => !f.is_os_noise);
  const manifest = {
    generated_at: new Date().toISOString(),
    generator: 'scripts/generate-source-manifest.mjs',
    note:
      'Authoritative inventory of the original Brill Ops handoff package. Large binaries ' +
      'are intentionally not committed to Git; this manifest is their committed proof of existence. ' +
      'See docs/architecture/adr/0002-media-stays-out-of-git.md.',
    summary: {
      file_count: real.length,
      os_noise_count: files.length - real.length,
      total_bytes: real.reduce((n, f) => n + f.bytes, 0),
      by_kind: real.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {}),
      oversized_for_github: real.filter((f) => f.exceeds_github_blob_limit).map((f) => f.path),
    },
    files,
  };

  await fs.writeFile(JSON_OUT, JSON.stringify(manifest, null, 2) + '\n');

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    'path,bytes,sha256,kind,modified,attribution_hint,is_os_noise',
    ...files.map((f) =>
      [f.path, f.bytes, f.sha256, f.kind, f.modified, f.attribution_hint, f.is_os_noise]
        .map(esc)
        .join(','),
    ),
  ].join('\n');
  await fs.writeFile(CSV_OUT, csv + '\n');

  console.log(`Manifest written: ${manifest.summary.file_count} source files, ` +
    `${(manifest.summary.total_bytes / 1024 ** 2).toFixed(1)} MB`);
  console.log('By kind:', manifest.summary.by_kind);
  if (manifest.summary.oversized_for_github.length) {
    console.log('Over GitHub 100MB blob limit:', manifest.summary.oversized_for_github);
  }
}

async function verify() {
  const manifest = JSON.parse(await fs.readFile(JSON_OUT, 'utf8'));
  const problems = [];

  for (const entry of manifest.files) {
    if (entry.is_os_noise) continue;
    const full = path.join(ROOT, entry.path);
    try {
      const stat = await fs.stat(full);
      if (stat.size !== entry.bytes) {
        problems.push(`SIZE  ${entry.path} (expected ${entry.bytes}, got ${stat.size})`);
        continue;
      }
      const actual = await sha256(full);
      if (actual !== entry.sha256) problems.push(`HASH  ${entry.path}`);
    } catch {
      problems.push(`MISSING  ${entry.path}`);
    }
  }

  if (problems.length === 0) {
    console.log(`OK - all ${manifest.summary.file_count} source files present and unmodified.`);
    return;
  }
  console.error(`${problems.length} problem(s) found:`);
  problems.forEach((p) => console.error('  ' + p));
  process.exitCode = 1;
}

if (process.argv.includes('--verify')) await verify();
else await build();
