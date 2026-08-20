#!/usr/bin/env node
/**
 * db-setup.mjs — apply migrations and seeds to a Supabase project.
 *
 *   npm run db:setup
 *
 * Deliberately does NOT require the Supabase CLI. The CLI route needs
 * `supabase login` (browser), `supabase link` (project ref + database password
 * at a prompt), `db push`, and then a separate seed step — five interactive
 * commands and a large binary download, to run seven SQL files. This does the
 * same thing with one command and one config value.
 *
 * Migrations are tracked in a `_brill_ops_migrations` ledger table, so this is
 * safe to re-run: already-applied files are skipped. The ledger also stores each
 * file's SHA-256, so an edit to a migration that has already run is reported
 * rather than silently ignored.
 *
 * Requires SUPABASE_DB_URL in .env.local — the Postgres URI from the Supabase
 * dashboard. It carries the database password, so it is gitignored, is read only
 * by this script, and never reaches the app, the browser or the repo.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const SEED_DIR = path.join(ROOT, 'supabase', 'seed');

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

async function loadEnvLocal() {
  try {
    const text = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      if (process.env[m[1]]) continue; // a real env var wins
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* fine — the variable may be exported another way */
  }
}

function explainConnectionFailure(err) {
  const msg = String(err?.message ?? err);
  if (msg.includes('ENETUNREACH') || msg.includes('ENOTFOUND')) {
    return (
      'Could not reach the database host.\n' +
      'Supabase direct connections are IPv6-only on newer projects. In the dashboard\n' +
      'under Connect, choose the "Session pooler" URI instead of "Direct connection"\n' +
      '— it works over IPv4 — and put that in SUPABASE_DB_URL.'
    );
  }
  if (msg.includes('password authentication failed')) {
    return (
      'The database password in SUPABASE_DB_URL was rejected.\n' +
      'If the password contains @ : / or ?, it must be percent-encoded in the URI.\n' +
      'You can reset it in the dashboard under Project Settings -> Database.'
    );
  }
  return msg;
}

async function ensureLedger(client) {
  // RLS is enabled with NO policy: deny-all except the table owner, which is the
  // role this script connects as. Nothing should ever read the ledger over the
  // API.
  //
  // This matters because Supabase's default privileges grant SELECT on every new
  // table in `public` to `anon`. A table created here without RLS is world-
  // readable the moment it exists — which is exactly what happened, and what
  // Supabase's security advisor flagged. Migration 0008 repairs databases where
  // the ledger was already created the unsafe way.
  await client.query(`
    create table if not exists _brill_ops_migrations (
      filename    text primary key,
      sha256      text not null,
      applied_at  timestamptz not null default now()
    );
    alter table _brill_ops_migrations enable row level security;
    revoke all on _brill_ops_migrations from anon, authenticated;
    comment on table _brill_ops_migrations is
      'Applied-migration ledger, written by scripts/db-setup.mjs. RLS enabled with no policies: deny-all except the owner.';
  `);
}

async function applyMigrations(client) {
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await client.query('select filename, sha256 from _brill_ops_migrations');
  const applied = new Map(rows.map((r) => [r.filename, r.sha256]));

  let ran = 0;
  for (const file of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const hash = sha256(sql);

    if (applied.has(file)) {
      if (applied.get(file) !== hash) {
        console.warn(
          `  ${file}  already applied, but the file has CHANGED since.\n` +
          `      Not re-running it. Write a new migration instead of editing this one.`,
        );
      } else {
        console.log(`  ${file}  already applied`);
      }
      continue;
    }

    process.stdout.write(`  ${file}  applying … `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query(
        'insert into _brill_ops_migrations (filename, sha256) values ($1, $2)',
        [file, hash],
      );
      await client.query('commit');
      console.log('ok');
      ran++;
    } catch (err) {
      await client.query('rollback');
      console.log('FAILED');
      throw new Error(`${file}: ${err.message}`);
    }
  }
  return { total: files.length, ran };
}

async function applySeeds(client) {
  const files = (await fs.readdir(SEED_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(SEED_DIR, file), 'utf8');
    process.stdout.write(`  ${file}  … `);
    // The seed files carry their own begin/commit and are idempotent.
    await client.query(sql);
    console.log('ok');
  }
  return files.length;
}

/** The importer's figures. If the database disagrees, something went wrong. */
const EXPECTED = {
  agents: 124,
  teams: 32,
  crossfaction_teams: 12,
  participation: 124,
  total_links: 9449,
  unknown_links: 4,
  media: 342,
};

async function verify(client) {
  const { rows } = await client.query(`
    select
      (select count(*) from campaigns)                                     ::int as campaigns,
      (select count(*) from agents)                                        ::int as agents,
      (select count(*) from teams)                                         ::int as teams,
      (select count(*) from teams where faction = 'crossfaction')          ::int as crossfaction_teams,
      (select count(*) from campaign_participation)                        ::int as participation,
      (select count(*) from media)                                         ::int as media,
      (select count(*) from import_anomalies)                              ::int as anomalies,
      (select coalesce(sum(links_created), 0) from campaign_participation) ::int as total_links,
      (select count(*) from campaign_participation where links_created is null) ::int as unknown_links,
      (select count(*) from teams where confidence <> 'source')            ::int as inferred_teams
  `);
  const r = rows[0];

  console.log('\nDatabase now contains:');
  console.log(`  campaigns            ${r.campaigns}    Stars for Peace (draft) + The Big Bang (archived)`);
  console.log(`  agents               ${r.agents}`);
  console.log(`  teams                ${r.teams}    ${r.crossfaction_teams} crossfaction, ${r.inferred_teams} flagged inferred`);
  console.log(`  participation rows   ${r.participation}`);
  console.log(`  media records        ${r.media}    catalogued, not yet uploaded to Storage`);
  console.log(`  import anomalies     ${r.anomalies}    footnotes shown on the archive page`);
  console.log(`  total links          ${r.total_links}    ${r.unknown_links} agents with an unknown figure (null, not zero)`);

  const bad = Object.entries(EXPECTED).filter(([k, v]) => r[k] !== v);
  if (bad.length) {
    console.error('\nThese do NOT match the import:');
    bad.forEach(([k, v]) => console.error(`  ${k}: expected ${v}, got ${r[k]}`));
    throw new Error('Verification failed.');
  }
  console.log('\nEvery figure matches the importer exactly.');
}

async function main() {
  await loadEnvLocal();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      '\nSUPABASE_DB_URL is not set.\n\n' +
        'Create a file called .env.local in the project root containing:\n\n' +
        '  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres\n\n' +
        'Get it from the Supabase dashboard: click Connect at the top, then copy the\n' +
        '"Session pooler" URI and replace [YOUR-PASSWORD] with your database password.\n\n' +
        '.env.local is gitignored. Do not paste this value anywhere else.\n',
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    // Supabase terminates TLS with its own CA. The connection is encrypted; the
    // chain just is not in Node's default trust store.
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120_000,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error('\nConnection failed.\n\n' + explainConnectionFailure(err) + '\n');
    process.exit(1);
  }

  const host = (() => {
    try { return new URL(connectionString).hostname; } catch { return 'the database'; }
  })();
  console.log(`Connected to ${host}\n`);

  try {
    await ensureLedger(client);

    console.log('Migrations:');
    const { total, ran } = await applyMigrations(client);
    console.log(`  -> ${ran} applied, ${total - ran} already present\n`);

    console.log('Seeds:');
    await applySeeds(client);

    await verify(client);

    // Supabase's REST API caches the schema in memory. Because this script talks
    // to Postgres directly, the API does not learn about new tables on its own and
    // keeps returning PGRST205 until told. Sent every run, not just when
    // migrations apply, because a stale cache can outlive the migration that
    // caused it. Harmless when already fresh.
    await client.query(`notify pgrst, 'reload schema'`);
    console.log('\nAsked the Supabase API to reload its schema cache.');

    console.log('Done. The live site should pick this up within a few seconds.');
  } catch (err) {
    console.error(`\nSetup failed: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

await main();
