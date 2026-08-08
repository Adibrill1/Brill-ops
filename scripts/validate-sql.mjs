#!/usr/bin/env node
/**
 * validate-sql.mjs — run every migration and seed against a throwaway Postgres.
 *
 *   npm run db:validate
 *
 * Catches SQL errors before they reach a real Supabase project. It exists because
 * a genuine bug slipped through review: team_status_of() was defined before the
 * `media` table it reads from, and Postgres validates the body of a `language sql`
 * function at CREATE time. Reading the file did not reveal it; running it did.
 *
 * Requires a local Postgres. The easiest way to get one without root:
 *
 *   npm i -D embedded-postgres
 *
 * then point PGVALIDATE_HOST/PGVALIDATE_PORT at it, or set PGVALIDATE_URL to any
 * disposable database. Nothing here ever touches a real project.
 *
 * Supabase supplies `auth` and `storage` schemas that plain Postgres does not, so
 * this creates minimal stand-ins first. They are stubs, deliberately: this proves
 * the SQL parses, type-checks and executes in order. It cannot prove that
 * Supabase's own RLS ownership rules will accept the storage policies — that is
 * called out in the output rather than glossed over.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Minimal stand-ins for the platform schemas Supabase provides.
 * Enough for the migrations to resolve their references.
 */
const SUPABASE_STUBS = `
-- Supabase creates these roles; plain Postgres does not.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin;          end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin;  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create table if not exists auth.users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text,
  raw_user_meta_data    jsonb default '{}'::jsonb,
  created_at            timestamptz default now()
);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

create table if not exists storage.buckets (
  id               text primary key,
  name             text not null,
  public           boolean default false,
  file_size_limit  bigint,
  created_at       timestamptz default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets(id),
  name        text,
  owner       uuid,
  created_at  timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
`;

async function readSqlFiles(dir) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (f) => ({ name: f, sql: await fs.readFile(path.join(dir, f), 'utf8') })),
  );
}

const EXPECTED = {
  campaigns: 2,
  agents: 124,
  teams: 32,
  crossfaction_teams: 12,
  blue_teams: 15,
  green_teams: 5,
  participation: 124,
  media: 342,
  anomalies: 16,
  total_links: 9449,
  unknown_links: 4,
  inferred_teams: 32,
  snapshots: 1,
  memberships: 122,
};

async function main() {
  const client = new pg.Client(
    process.env.PGVALIDATE_URL
      ? { connectionString: process.env.PGVALIDATE_URL }
      : {
          host: process.env.PGVALIDATE_HOST ?? '/tmp/pgtest',
          port: Number(process.env.PGVALIDATE_PORT ?? 54399),
          user: 'postgres',
          database: 'postgres',
        },
  );

  await client.connect();
  console.log('Connected to the validation database.\n');

  await client.query('drop schema if exists public cascade; create schema public;');
  await client.query('create extension if not exists pgcrypto;');
  await client.query(SUPABASE_STUBS);
  console.log('Supabase stubs (auth, storage) in place.\n');

  console.log('Migrations:');
  for (const { name, sql } of await readSqlFiles(path.join(ROOT, 'supabase/migrations'))) {
    process.stdout.write(`  ${name}  … `);
    try {
      await client.query(sql);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n  ${err.message}`);
      if (err.position) {
        const upto = sql.slice(0, Number(err.position));
        console.error(`  at line ${upto.split('\n').length}: ${upto.split('\n').pop()?.trim()}`);
      }
      process.exit(1);
    }
  }

  console.log('\nSeeds:');
  for (const { name, sql } of await readSqlFiles(path.join(ROOT, 'supabase/seed'))) {
    process.stdout.write(`  ${name}  … `);
    try {
      await client.query(sql);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n  ${err.message}`);
      process.exit(1);
    }
  }

  // Re-running must be a no-op: the seeds are meant to be idempotent.
  console.log('\nRe-running seeds (must be idempotent):');
  for (const { name, sql } of await readSqlFiles(path.join(ROOT, 'supabase/seed'))) {
    process.stdout.write(`  ${name}  … `);
    await client.query(sql);
    console.log('ok');
  }

  const { rows } = await client.query(`
    select
      (select count(*) from campaigns)                                     ::int as campaigns,
      (select count(*) from agents)                                        ::int as agents,
      (select count(*) from teams)                                         ::int as teams,
      (select count(*) from teams where faction = 'crossfaction')          ::int as crossfaction_teams,
      (select count(*) from teams where faction = 'blue')                  ::int as blue_teams,
      (select count(*) from teams where faction = 'green')                 ::int as green_teams,
      (select count(*) from campaign_participation)                        ::int as participation,
      (select count(*) from media)                                         ::int as media,
      (select count(*) from import_anomalies)                              ::int as anomalies,
      (select coalesce(sum(links_created),0) from campaign_participation)  ::int as total_links,
      (select count(*) from campaign_participation where links_created is null) ::int as unknown_links,
      (select count(*) from teams where confidence <> 'source')            ::int as inferred_teams,
      (select count(*) from campaign_archive_snapshots)                     ::int as snapshots,
      (select count(*) from team_membership)                                ::int as memberships
  `);
  const r = rows[0];

  console.log('\nRow counts:');
  const bad = [];
  for (const [key, want] of Object.entries(EXPECTED)) {
    const got = r[key];
    const ok = got === want;
    if (!ok) bad.push(`${key}: expected ${want}, got ${got}`);
    console.log(`  ${ok ? 'ok  ' : 'BAD '} ${key.padEnd(20)} ${got}`);
  }

  // The statistics views are the part most likely to be quietly wrong, so query
  // them rather than trusting that they compiled.
  console.log('\nStatistics views:');
  const stats = (await client.query(
    `select * from campaign_stats where slug = 'the-big-bang-2020'`,
  )).rows[0];
  console.log(`  campaign_stats        agents=${stats.total_agents} countries=${stats.countries} ` +
    `teams=${stats.total_teams} links=${stats.total_links_created} ` +
    `unknown=${stats.agents_with_unknown_links} avg=${stats.avg_links_per_team}`);
  console.log(`  top_country=${stats.top_country}  top_contributor=${stats.top_contributor}  ` +
    `inferred=${stats.contains_inferred_data}`);

  const factions = (await client.query(
    `select faction_colour, agents_count, teams_count, links_created
       from campaign_faction_stats
      where campaign_id = (select id from campaigns where slug = 'the-big-bang-2020')
      order by faction_colour`,
  )).rows;
  factions.forEach((f) =>
    console.log(`  faction ${String(f.faction_colour).padEnd(13)} agents=${f.agents_count} ` +
      `teams=${f.teams_count} links=${f.links_created}`),
  );

  const countries = (await client.query(
    `select count(*)::int as n from campaign_country_stats`,
  )).rows[0].n;
  console.log(`  campaign_country_stats  ${countries} rows`);

  const lifetime = (await client.query(
    `select handle, total_links_created, teams_joined
       from agent_lifetime_stats where handle = '@edyuji'`,
  )).rows[0];
  console.log(`  agent_lifetime_stats    ${lifetime.handle} links=${lifetime.total_links_created} teams=${lifetime.teams_joined}`);

  const teamsView = (await client.query(
    `select count(*)::int as n, count(*) filter (where status = 'completed')::int as completed
       from teams_view`,
  )).rows[0];
  console.log(`  teams_view              ${teamsView.n} rows, ${teamsView.completed} completed`);

  // Cross-check: campaign_stats must agree with the raw tables it summarises.
  // node-pg returns bigint as a string, so coerce both sides before comparing —
  // an earlier version of this check compared '124' to 124 and reported a
  // failure that did not exist.
  if (
    Number(stats.total_agents) !== EXPECTED.agents ||
    Number(stats.total_links_created) !== EXPECTED.total_links ||
    Number(stats.total_teams) !== EXPECTED.teams ||
    Number(stats.agents_with_unknown_links) !== EXPECTED.unknown_links
  ) {
    bad.push('campaign_stats disagrees with the base tables');
  }

  // The faction split is the most subtle logic in the schema, so assert it too:
  // blue + green + crossfaction must account for every agent exactly once.
  const factionTotal = factions.reduce((n, f) => n + Number(f.agents_count), 0);
  if (factionTotal !== EXPECTED.agents) {
    bad.push(`faction buckets sum to ${factionTotal}, expected ${EXPECTED.agents}`);
  }
  const factionLinks = factions.reduce((n, f) => n + Number(f.links_created), 0);
  if (factionLinks !== EXPECTED.total_links) {
    bad.push(`faction links sum to ${factionLinks}, expected ${EXPECTED.total_links}`);
  }

  await client.end();

  console.log(
    '\nNote: auth.users and storage.objects here are stubs. This proves the SQL runs\n' +
    'and the views compute correctly; it cannot prove Supabase will accept the storage\n' +
    'policies, which depend on its own object ownership.',
  );

  if (bad.length) {
    console.error('\nFAILED:');
    bad.forEach((b) => console.error('  ' + b));
    process.exit(1);
  }
  console.log('\nAll migrations, seeds and views validated.');
}

await main();
