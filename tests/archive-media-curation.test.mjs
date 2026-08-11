import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const media = JSON.parse(await readFile(
  new URL('../data/archive-imports/the-big-bang-2020/media.json', import.meta.url),
  'utf8',
));
const curation = JSON.parse(await readFile(
  new URL('../data/archive-imports/the-big-bang-2020/media-curation.json', import.meta.url),
  'utf8',
));

test('every source media row has exactly one reviewed publication decision', () => {
  assert.equal(media.media.length, 342);
  assert.equal(curation.decisions.length, media.media.length);

  const sourcePaths = new Set(media.media.map((item) => item.source_path));
  const decisionPaths = new Set(curation.decisions.map((item) => item.source_path));
  assert.equal(decisionPaths.size, curation.decisions.length);
  assert.deepEqual(decisionPaths, sourcePaths);
});

test('the public archive excludes the unrelated IFS camera roll and binary duplicates', () => {
  assert.deepEqual(curation.summary, {
    catalogued_source_rows: 342,
    published_unique_assets: 272,
    excluded_unrelated_assets: 64,
    excluded_exact_duplicates: 6,
    featured_assets: 13,
    published_bytes: 791138061,
  });

  const excludedIfs = curation.decisions.find((item) => item.source_path.endsWith('/IMG_7009.JPG'));
  assert.equal(excludedIfs.publish, false);
  assert.match(excludedIfs.reason, /IFS@HOME/);

  const published = curation.decisions.filter((item) => item.publish);
  const publishedHashes = published.map((item) => item.source_sha256);
  assert.equal(new Set(publishedHashes).size, publishedHashes.length);
});

test('the selected hero and every highlight are public and captioned', () => {
  const hero = curation.decisions.find(
    (item) => item.source_path === curation.hero_source_path,
  );
  assert.equal(hero.publish, true);
  assert.equal(hero.featured, true);

  const highlights = curation.decisions.filter((item) => item.featured);
  assert.equal(highlights.length, 13);
  assert.ok(highlights.every((item) => item.publish && item.caption));
  assert.deepEqual(
    highlights.map((item) => item.featured_order).sort((a, b) => a - b),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
});
