#!/usr/bin/env node
/**
 * Produces the public-media decisions for Operation "The Big Bang".
 *
 * The source folder is read-only and deliberately broader than the campaign:
 * Stars/IMG_7004 through IMG_7123 is a contiguous personal / IFS@HOME camera-roll
 * sequence. Contact-sheet review on 2026-08-11 confirmed that the campaign
 * planning material ends at IMG_7003 and campaign star submissions resume at
 * IMG_7125. Nothing is deleted; excluded rows remain in the source manifest and
 * database catalogue, but are not uploaded or rendered publicly.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data/archive-imports/the-big-bang-2020');
const INPUT = path.join(DATA_DIR, 'media.json');
const OUTPUT = path.join(DATA_DIR, 'media-curation.json');
const SOURCE_ROOT = 'source-data/historical-campaigns/2020-07-the-big-bang';

const heroSourcePath = `${SOURCE_ROOT}/Stars/image_2020-07-31_20-56-47 - E. Yuji.png`;

const featured = new Map(Object.entries({
  [heroSourcePath]: {
    order: 1,
    caption: 'A 500-link star by @edyuji in Brazil — tied for the largest recorded star of the operation.',
  },
  [`${SOURCE_ROOT}/Stars/@DoctorWho00 - Marc Tavares.jpeg`]: {
    order: 2,
    caption: 'The 427-link Luxembourg star by @DoctorWho00, second on the organisers’ biggest-stars podium.',
  },
  [`${SOURCE_ROOT}/Stars/2020-07-31-frame-508.png`]: {
    order: 3,
    caption: 'Blue and Green link stars visible together in a live IITC overview during the operation.',
  },
  [`${SOURCE_ROOT}/Stars/2020-08-01-frame-579.png`]: {
    order: 4,
    caption: 'The 225-link Resistance star by @eigood in Dallas, the highest US result in the source data.',
  },
  [`${SOURCE_ROOT}/Stars/IMG_6863.JPG`]: {
    order: 5,
    caption: 'Original timing instructions: agents built locally from Japan through Ecuador on 31 July 2020.',
  },
  [`${SOURCE_ROOT}/Photos/photo_2026-08-07 08.10.18.jpeg`]: {
    order: 6,
    caption: 'A close-up of the operation’s Crossfaction visual: Blue and Green stars meeting on the map.',
  },
  [`${SOURCE_ROOT}/Photos/photo_2026-08-07 08.10.20.jpeg`]: {
    order: 7,
    caption: 'Participants around the world documented a campaign completed largely from home in 2020.',
  },
  [`${SOURCE_ROOT}/AdiBrill.jpg`]: {
    order: 8,
    caption: 'Campaign organiser Adi Brill monitoring link stars appearing around the world.',
  },
  [`${SOURCE_ROOT}/Txt/countries1.jpg`]: {
    order: 9,
    caption: 'The organisers’ country totals, preserved separately from the later row-level CSV.',
  },
  [`${SOURCE_ROOT}/Txt/thebigbangcores.jpg`]: {
    order: 10,
    caption: 'The original agent sheet and published podium for biggest stars and most links per agent.',
  },
  [`${SOURCE_ROOT}/Videos/TheBigBang.mp4`]: {
    order: 11,
    caption: 'The finished Operation “The Big Bang” campaign film.',
  },
  [`${SOURCE_ROOT}/Videos/1min Story.mp4`]: {
    order: 12,
    caption: 'A one-minute edit telling the story of the global operation.',
  },
  [`${SOURCE_ROOT}/Videos/thebigbangISRAEL.mp4`]: {
    order: 13,
    caption: 'The Israel campaign edit from Operation “The Big Bang”.',
  },
}));

function unrelatedCameraRoll(pathname) {
  if (!pathname.includes('/Stars/')) return false;
  const filename = pathname.split('/').pop() ?? '';
  const match = filename.match(/^IMG_(\d+)/i);
  if (!match) return false;
  const imageNumber = Number(match[1]);
  return imageNumber >= 7004 && imageNumber <= 7123;
}

function publicCategory(item) {
  if (item.kind === 'video') return 'videos';
  if (item.role === 'statistics_screenshot' || item.kind === 'dataset') return 'source_records';
  return 'community_archive';
}

function preferredDuplicate(paths) {
  return [...paths].sort((a, b) => {
    const copyA = / \(\d+\)\.[^.]+$/i.test(a);
    const copyB = / \(\d+\)\.[^.]+$/i.test(b);
    if (copyA !== copyB) return copyA ? 1 : -1;
    return a.localeCompare(b, undefined, { numeric: true });
  })[0];
}

async function main() {
  const source = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const media = source.media;
  const initiallyIncluded = media.filter((item) => !unrelatedCameraRoll(item.source_path));

  const byHash = new Map();
  for (const item of initiallyIncluded) {
    if (!byHash.has(item.sha256)) byHash.set(item.sha256, []);
    byHash.get(item.sha256).push(item.source_path);
  }
  const canonicalByHash = new Map(
    [...byHash].map(([hash, paths]) => [hash, preferredDuplicate(paths)]),
  );

  const decisions = media.map((item) => {
    if (unrelatedCameraRoll(item.source_path)) {
      return {
        source_path: item.source_path,
        source_sha256: item.sha256,
        publish: false,
        reason: 'Excluded after contact-sheet review: contiguous personal / IFS@HOME camera-roll sequence, not Operation “The Big Bang”.',
      };
    }

    const canonical = canonicalByHash.get(item.sha256);
    if (canonical !== item.source_path) {
      return {
        source_path: item.source_path,
        source_sha256: item.sha256,
        publish: false,
        reason: 'Exact binary duplicate; the canonical copy remains published.',
        canonical_source_path: canonical,
      };
    }

    const highlight = featured.get(item.source_path);
    return {
      source_path: item.source_path,
      source_sha256: item.sha256,
      publish: true,
      category: publicCategory(item),
      featured: Boolean(highlight),
      featured_order: highlight?.order ?? null,
      caption: highlight?.caption ?? null,
    };
  });

  const published = decisions.filter((item) => item.publish);
  const excluded = decisions.filter((item) => !item.publish);
  const result = {
    campaign: source.campaign,
    reviewed_at: '2026-08-11',
    review_method: 'Filename, SHA-256 duplicate and seven contact-sheet visual review of all 242 sequential IMG files, plus a contact sheet of all 40 Photos files.',
    policy: 'Publish only material confidently attributable to Operation “The Big Bang”; preserve every excluded source file unchanged in the manifest and local archive.',
    hero_source_path: heroSourcePath,
    summary: {
      catalogued_source_rows: decisions.length,
      published_unique_assets: published.length,
      excluded_unrelated_assets: excluded.filter((item) => item.reason.startsWith('Excluded')).length,
      excluded_exact_duplicates: excluded.filter((item) => item.reason.startsWith('Exact')).length,
      featured_assets: published.filter((item) => item.featured).length,
      published_bytes: media
        .filter((item) => published.some((decision) => decision.source_path === item.source_path))
        .reduce((total, item) => total + item.bytes, 0),
    },
    decisions,
  };

  if (!featured.has(heroSourcePath) || !published.some((item) => item.source_path === heroSourcePath)) {
    throw new Error('The selected hero is not in the published set.');
  }
  if (featured.size !== result.summary.featured_assets) {
    throw new Error(`Expected ${featured.size} featured assets, found ${result.summary.featured_assets}.`);
  }

  await fs.writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result.summary, null, 2));
}

await main();
