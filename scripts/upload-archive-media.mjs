#!/usr/bin/env node
/**
 * Upload the reviewed Big Bang archive to Supabase Storage using resumable TUS.
 *
 * Safe properties:
 * - source files are read-only and SHA-256 verified before upload;
 * - object names are content-addressed, so reruns never create duplicates;
 * - unrelated and duplicate files are excluded by committed media-curation.json;
 * - credentials are loaded from .env.local and are never printed;
 * - database rows are marked uploaded only after Storage confirms success.
 *
 * Usage:
 *   npm run media:upload -- --dry-run
 *   npm run media:upload
 *   npm run media:upload -- --category=videos
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { Upload } from 'tus-js-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'archive-media';
const CAMPAIGN_SLUG = 'the-big-bang-2020';
const MEDIA_PATH = path.join(ROOT, 'data/archive-imports/the-big-bang-2020/media.json');
const CURATION_PATH = path.join(ROOT, 'data/archive-imports/the-big-bang-2020/media-curation.json');
const CHUNK_SIZE = 6 * 1024 * 1024;

async function loadEnvLocal() {
  try {
    const text = await fsp.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // Environment variables may be exported by the caller instead.
  }
}

function deriveProjectUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl) return null;
  try {
    const parsed = new URL(databaseUrl);
    const projectRef =
      parsed.username.match(/^postgres[.:](.+)$/)?.[1]
      ?? parsed.hostname.match(/^db\.([^.]+)\./)?.[1];
    return projectRef ? `https://${projectRef}.supabase.co` : null;
  } catch {
    return null;
  }
}

function parseArguments(argv) {
  const dryRun = argv.includes('--dry-run');
  const category = argv.find((arg) => arg.startsWith('--category='))?.split('=')[1] ?? null;
  const limitRaw = argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1];
  const limit = limitRaw ? Number(limitRaw) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }
  if (category && !['community_archive', 'videos', 'source_records'].includes(category)) {
    throw new Error('--category must be community_archive, videos, or source_records.');
  }
  return { dryRun, category, limit };
}

function extensionOf(sourcePath) {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith('.heic.jpg')) return 'jpg';
  const extension = path.extname(lower).slice(1);
  if (extension === 'jpeg') return 'jpg';
  if (extension === 'mov') return 'mov';
  return extension || 'bin';
}

function mimeTypeOf(sourcePath) {
  const extension = extensionOf(sourcePath);
  return {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    csv: 'text/csv; charset=utf-8',
  }[extension] ?? 'application/octet-stream';
}

function storagePathOf(item) {
  return `${CAMPAIGN_SLUG}/${item.sha256.slice(0, 2)}/${item.sha256}.${extensionOf(item.source_path)}`;
}

function publicUrlFor(projectUrl, storagePath) {
  return `${projectUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function imageDimensions(filename, mimeType) {
  if (!mimeType.startsWith('image/')) return { width: null, height: null };
  try {
    const metadata = await sharp(filename, { failOn: 'none' }).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

function uploadWithTus({ endpoint, serviceRoleKey, filename, item, storagePath, mimeType }) {
  return new Promise((resolve, reject) => {
    let lastReported = -1;
    const upload = new Upload(fs.createReadStream(filename), {
      endpoint,
      uploadSize: item.bytes,
      chunkSize: CHUNK_SIZE,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: BUCKET,
        objectName: storagePath,
        contentType: mimeType,
        cacheControl: '31536000',
        metadata: JSON.stringify({ sourceSha256: item.sha256, campaign: CAMPAIGN_SLUG }),
      },
      onProgress(bytesUploaded, bytesTotal) {
        const percent = Math.floor((bytesUploaded / bytesTotal) * 100);
        const step = Math.floor(percent / 10) * 10;
        if (step !== lastReported) {
          lastReported = step;
          process.stdout.write(` ${step}%`);
        }
      },
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  });
}

async function markUploaded({ supabase, campaignId, item, decision, storagePath, mimeType, dimensions }) {
  const { error } = await supabase
    .from('media')
    .update({
      storage_bucket: BUCKET,
      storage_path: storagePath,
      is_uploaded: true,
      mime_type: mimeType,
      width: dimensions.width,
      height: dimensions.height,
      caption: decision.caption ?? null,
    })
    .eq('campaign_id', campaignId)
    .eq('source_path', item.source_path)
    .eq('source_sha256', item.sha256);
  if (error) throw new Error(`Database update failed for ${item.source_path}: ${error.message}`);
}

async function main() {
  await loadEnvLocal();
  const options = parseArguments(process.argv.slice(2));
  const mediaSource = JSON.parse(await fsp.readFile(MEDIA_PATH, 'utf8'));
  const curation = JSON.parse(await fsp.readFile(CURATION_PATH, 'utf8'));
  const decisions = new Map(curation.decisions.map((decision) => [decision.source_path, decision]));

  let selected = mediaSource.media.filter((item) => decisions.get(item.source_path)?.publish === true);
  if (options.category) {
    selected = selected.filter((item) => decisions.get(item.source_path).category === options.category);
  }
  if (options.limit) selected = selected.slice(0, options.limit);

  const totalBytes = selected.reduce((total, item) => total + item.bytes, 0);
  console.log(`Reviewed archive: ${selected.length} unique assets, ${(totalBytes / 1024 / 1024).toFixed(1)} MiB.`);
  console.log(`Excluded but preserved: ${curation.summary.excluded_unrelated_assets} unrelated assets and ${curation.summary.excluded_exact_duplicates} exact duplicates.`);
  if (options.dryRun) {
    const byCategory = selected.reduce((counts, item) => {
      const category = decisions.get(item.source_path).category;
      counts[category] = (counts[category] ?? 0) + 1;
      return counts;
    }, {});
    console.log(JSON.stringify({ dryRun: true, byCategory }, null, 2));
    return;
  }

  const projectUrl = deriveProjectUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing and could not be derived from SUPABASE_DB_URL.');
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local. Copy it from Supabase Dashboard → Project Settings → API Keys. Never commit it.');
  }

  const projectRef = new URL(projectUrl).hostname.split('.')[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('slug', CAMPAIGN_SLUG)
    .single();
  if (campaignError || !campaign) {
    throw new Error(`Could not find archived campaign ${CAMPAIGN_SLUG}: ${campaignError?.message ?? 'not found'}`);
  }

  let uploaded = 0;
  let reused = 0;
  for (const [index, item] of selected.entries()) {
    const decision = decisions.get(item.source_path);
    const filename = path.join(ROOT, item.source_path);
    const actualHash = await sha256File(filename);
    if (actualHash !== item.sha256) throw new Error(`SHA-256 mismatch: ${item.source_path}`);

    const storagePath = storagePathOf(item);
    const mimeType = mimeTypeOf(item.source_path);
    const dimensions = await imageDimensions(filename, mimeType);
    const publicUrl = publicUrlFor(projectUrl, storagePath);
    const existing = await fetch(publicUrl, { method: 'HEAD' });

    process.stdout.write(`[${index + 1}/${selected.length}] ${item.source_path}`);
    if (existing.ok) {
      reused++;
      process.stdout.write(' already stored');
    } else {
      await uploadWithTus({ endpoint, serviceRoleKey, filename, item, storagePath, mimeType });
      uploaded++;
    }
    await markUploaded({
      supabase,
      campaignId: campaign.id,
      item,
      decision,
      storagePath,
      mimeType,
      dimensions,
    });
    console.log(' ok');
  }

  const heroItem = mediaSource.media.find((item) => item.source_path === curation.hero_source_path);
  const heroUrl = publicUrlFor(projectUrl, storagePathOf(heroItem));
  const { error: heroError } = await supabase
    .from('campaigns')
    .update({ hero_image_url: heroUrl })
    .eq('id', campaign.id);
  if (heroError) throw new Error(`Hero update failed: ${heroError.message}`);

  console.log(`Complete: ${uploaded} uploaded, ${reused} reused, hero assigned.`);
}

await main().catch((error) => {
  console.error(`Archive media upload failed: ${error.message}`);
  process.exitCode = 1;
});
