#!/usr/bin/env node
/**
 * apply-seed.mjs — apply the seed files to a REMOTE Supabase project.
 *
 * `supabase db push` applies supabase/migrations/ only; it does not run seeds.
 * This runs the same two files over a direct Postgres connection so a hosted
 * project ends up identical to a local `supabase db reset`.
 *
 *   npm run db:seed
 *
 * Reads the connection string from SUPABASE_DB_URL (in .env.local), which you
 * copy from the Supabase dashboard: Project Settings → Database → Connection
 * string → URI. It contains your database password, so .env.local is gitignored
 * and this value must never be committed or pasted into a chat.
 *
 * Both seed files are idempotent (ON CONFLICT DO NOTHING / DO UPDATE), so
 * re-running is safe. Each file runs inside its own transaction, so a failure
 * leaves nothing half-applied.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_DIR = path.join(ROOT, 'supabase', 'seed');

const FILES = ['001_stars_for_peace.sql', '002_the_big_bang_2020.sql'];

/** Minimal .env.local reader — avoids a dependency for four lines of work. */
async function loadEnvLocal() {
  try {
    const text = await fs.readFile(path.join(ROOT, '.env.local'), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue; // real env wins
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  } catch {
    // No .env.local is fine if the variable is exported another way.
  }
}

async function main() {
  await loadEnvLocal();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      'SUPABASE_DB_URL is not set.\n\n' +
        'Add it to .env.local. Find it in the Supabase dashboard under\n' +
        'Project Settings -> Database -> Connection string -> URI.\n\n' +
        '  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres\n',
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    // Supabase terminates TLS with its own CA; the connection is encrypted, but
    // the chain is not in Node's default trust store.
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected.\n');

  try {
    for (const file of FILES) {
      const sql = await fs.readFile(path.join(SEED_DIR, file), 'utf8');
      process.stdout.write(`  ${file} … `);
      await client.query(sql);
      console.log('ok');
    }

    // Report what actually landed, rather than assuming it worked.
    const { rows } = await client.query(`
      select
        (select count(*) from campaigns)                                as campaigns,
        (select count(*) from agents)                                   as agents,
        (select count(*) from teams)                                    as teams,
        (select count(*) from teams where faction = 'crossfaction')     as crossfaction_teams,
        (select count(*) from campaign_participation)                   as participation,
        (select count(*) from media)                                    as media,
        (select count(*) from import_anomalies)                         as anomalies,
        (select sum(links_created) from campaign_participation)         as total_links,
        (select count(*) from campaign_participation
          where links_created is null)                                  as unknown_links
    `);

    const r = rows[0];
    console.log('\nDatabase now contains:');
    console.log(`  campaigns           ${r.campaigns}   (Stars for Peace draft + The Big Bang archive)`);
    console.log(`  agents              ${r.agents}`);
    console.log(`  teams               ${r.teams}   (${r.crossfaction_teams} crossfaction)`);
    console.log(`  participation rows  ${r.participation}`);
    console.log(`  media records       ${r.media}   (not yet uploaded to Storage)`);
    console.log(`  import anomalies    ${r.anomalies}`);
    console.log(`  total links         ${r.total_links}   (${r.unknown_links} agents with an unknown figure)`);

    // These are the numbers the importer produced. If they drift, something is wrong.
    const expected = { agents: 124, teams: 32, crossfaction_teams: 12, total_links: 9449, unknown_links: 4 };
    const mismatches = Object.entries(expected).filter(([k, v]) => Number(r[k]) !== v);

    if (mismatches.length) {
      console.error('\nWARNING - these do not match the import:');
      mismatches.forEach(([k, v]) => console.error(`  ${k}: expected ${v}, got ${r[k]}`));
      process.exitCode = 1;
    } else {
      console.log('\nAll figures match the import exactly.');
    }
  } finally {
    await client.end();
  }
}

await main();
