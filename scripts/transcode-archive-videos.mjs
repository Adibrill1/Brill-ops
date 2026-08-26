#!/usr/bin/env node
/**
 * Create web-serving derivatives for archive videos that exceed Supabase's
 * Free-plan per-object limit. Originals under source-data remain untouched.
 *
 * Requires ffmpeg + ffprobe on PATH. Output binaries are local and gitignored;
 * the small integrity manifest is committed so uploads remain reproducible and
 * auditable.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data/archive-imports/the-big-bang-2020');
const MEDIA_PATH = path.join(DATA_DIR, 'media.json');
const CURATION_PATH = path.join(DATA_DIR, 'media-curation.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'video-derivatives.json');
const OUTPUT_DIR = path.join(ROOT, '.archive-derivatives/the-big-bang-2020');
const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024;
const SAFE_OUTPUT_BYTES = 48 * 1024 * 1024;

const profiles = new Map([
  ['gif star.mp4', { videoBitrate: '4000k', audioBitrate: '128k', filter: 'scale=1280:-2' }],
  ['IMG_6967.MP4', { videoBitrate: '3000k', audioBitrate: '64k', filter: 'scale=-2:1280,fps=30' }],
  ['IMG_6970.MOV', { videoBitrate: '3500k', audioBitrate: '64k', filter: 'scale=-2:1280,fps=30' }],
]);

async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function transcode(sourceFilename, outputFilename, profile, passlog) {
  const videoArgs = [
    '-map', '0:v:0',
    '-vf', profile.filter,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-b:v', profile.videoBitrate,
    '-maxrate', profile.videoBitrate,
    '-bufsize', '8M',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-movflags', '+faststart',
  ];

  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-y', '-i', sourceFilename,
    ...videoArgs,
    '-pass', '1', '-passlogfile', passlog, '-an', '-f', 'mp4', '/dev/null',
  ]);
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'warning', '-y', '-i', sourceFilename,
    ...videoArgs,
    '-pass', '2', '-passlogfile', passlog,
    '-map', '0:a?', '-c:a', 'aac', '-b:a', profile.audioBitrate,
    outputFilename,
  ]);
}

async function probe(filename) {
  const output = await capture('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json',
    filename,
  ]);
  const result = JSON.parse(output);
  return {
    width: result.streams?.[0]?.width ?? null,
    height: result.streams?.[0]?.height ?? null,
    duration_seconds: Number(result.format?.duration ?? 0),
  };
}

async function main() {
  const mediaSource = JSON.parse(await fsp.readFile(MEDIA_PATH, 'utf8'));
  const curation = JSON.parse(await fsp.readFile(CURATION_PATH, 'utf8'));
  const published = new Set(
    curation.decisions.filter((decision) => decision.publish).map((decision) => decision.source_path),
  );
  const oversizedVideos = mediaSource.media.filter((item) =>
    published.has(item.source_path)
    && item.kind === 'video'
    && item.bytes > STORAGE_LIMIT_BYTES,
  );

  if (oversizedVideos.length !== profiles.size) {
    throw new Error(`Expected ${profiles.size} oversized videos, found ${oversizedVideos.length}.`);
  }

  await fsp.mkdir(OUTPUT_DIR, { recursive: true });
  const derivatives = [];
  for (const item of oversizedVideos) {
    const basename = path.basename(item.source_path);
    const profile = profiles.get(basename);
    if (!profile) throw new Error(`No reviewed transcode profile for ${item.source_path}.`);

    const sourceFilename = path.join(ROOT, item.source_path);
    const sourceHash = await sha256File(sourceFilename);
    if (sourceHash !== item.sha256) throw new Error(`Source SHA-256 mismatch: ${item.source_path}`);

    const outputPath = `.archive-derivatives/the-big-bang-2020/${basename.replace(/\.[^.]+$/, '')}.web.mp4`;
    const outputFilename = path.join(ROOT, outputPath);
    const passlog = path.join(OUTPUT_DIR, `.ffmpeg-pass-${item.sha256.slice(0, 12)}`);
    console.log(`Transcoding ${basename}...`);
    try {
      await transcode(sourceFilename, outputFilename, profile, passlog);
    } finally {
      await Promise.all([
        fsp.rm(`${passlog}-0.log`, { force: true }),
        fsp.rm(`${passlog}-0.log.mbtree`, { force: true }),
      ]);
    }

    const stat = await fsp.stat(outputFilename);
    if (stat.size >= SAFE_OUTPUT_BYTES) {
      throw new Error(`${outputPath} is ${(stat.size / 1024 / 1024).toFixed(1)} MiB; expected under 48 MiB.`);
    }
    const metadata = await probe(outputFilename);
    derivatives.push({
      source_path: item.source_path,
      source_sha256: item.sha256,
      output_path: outputPath,
      output_sha256: await sha256File(outputFilename),
      bytes: stat.size,
      mime_type: 'video/mp4',
      width: metadata.width,
      height: metadata.height,
      duration_seconds: metadata.duration_seconds,
      encoding: {
        video_codec: 'h264',
        video_bitrate: profile.videoBitrate,
        audio_codec: 'aac',
        audio_bitrate: profile.audioBitrate,
        filter: profile.filter,
      },
    });
    console.log(`  ${(stat.size / 1024 / 1024).toFixed(1)} MiB, ${metadata.width}×${metadata.height}`);
  }

  const manifest = {
    campaign_slug: 'the-big-bang-2020',
    generated_at: new Date().toISOString(),
    policy: 'Web derivatives only. Original archive videos remain unchanged and authoritative.',
    storage_limit_bytes: STORAGE_LIMIT_BYTES,
    derivatives,
  };
  await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT, MANIFEST_PATH)} with ${derivatives.length} derivatives.`);
}

await main().catch((error) => {
  console.error(`Archive video transcode failed: ${error.message}`);
  process.exitCode = 1;
});
