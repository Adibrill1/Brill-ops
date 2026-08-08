/**
 * Regression: an anonymous visitor when the only "current" campaign is a draft.
 *
 * This is the exact production state — Stars for Peace is a draft, The Big Bang is
 * archived — and it must produce a working homepage, not a crash and not a leak.
 * The test reproduces what the server render sees by reading as the `anon`
 * database role, so it exercises the real RLS policies (migration 0004) and the
 * security_invoker views (migration 0006) rather than trusting them.
 *
 * It asserts three things the homepage depends on:
 *   1. anon sees NO active campaign  → getActiveCampaign() returns null, so the
 *      page renders <NoActiveCampaign/> instead of dereferencing a current one.
 *   2. the draft is invisible to anon, both in `campaigns` and through the
 *      `campaign_stats` VIEW → RLS is intact and the draft does not leak (this is
 *      precisely what migration 0006's security_invoker fix protects; before it,
 *      the view exposed the draft).
 *   3. the archived campaign IS visible → the fallback page has content to show.
 *
 * Needs SUPABASE_DB_URL (the same value db:setup uses). Skipped without it, so it
 * never breaks a checkout that has no database configured.
 *
 * Run with:  node --test --experimental-strip-types
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

function resolveDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^SUPABASE_DB_URL=(.+)$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const dbUrl = resolveDbUrl();
const skip = dbUrl ? false : 'SUPABASE_DB_URL not set — skipping live RLS check';

let client;

before(async () => {
  if (skip) return;
  const { default: pg } = await import('pg');
  client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
});

after(async () => {
  if (client) await client.end();
});

/** Run a query with the caller downgraded to the anon role, as PostgREST does. */
async function asAnon(sql) {
  await client.query('begin');
  try {
    await client.query('set local role anon');
    const res = await client.query(sql);
    await client.query('commit');
    return res;
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

test('anon sees no active campaign, so the homepage takes the safe path', { skip }, async () => {
  const { rows } = await asAnon(`select slug from campaigns where status = 'active'`);
  assert.equal(rows.length, 0, 'there must be no active campaign for anon to render');
});

test('the draft campaign never leaks to anon — not the table, not the view', { skip }, async () => {
  const table = await asAnon(`select slug, status from campaigns`);
  assert.ok(
    !table.rows.some((r) => r.status === 'draft'),
    'anon must not see any draft row in campaigns',
  );
  assert.ok(
    !table.rows.some((r) => r.slug === 'stars-for-peace'),
    'the Stars for Peace draft must be invisible to anon',
  );

  // campaign_stats is a VIEW; migration 0006 made it security_invoker so RLS
  // applies through it too. Before that fix it exposed the draft.
  const view = await asAnon(`select slug, status from campaign_stats`);
  assert.ok(
    !view.rows.some((r) => r.status === 'draft' || r.slug === 'stars-for-peace'),
    'the draft must not leak through the campaign_stats view',
  );
});

test('the archived campaign is visible, so NoActiveCampaign has content', { skip }, async () => {
  const { rows } = await asAnon(
    `select slug from campaign_stats where status = 'archived'`,
  );
  assert.ok(rows.length >= 1, 'at least one archived campaign should be visible to anon');
});
