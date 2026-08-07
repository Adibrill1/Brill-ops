#!/usr/bin/env node
/**
 * generate-archive-seed.mjs
 *
 * Renders data/archive-imports/the-big-bang-2020/*.json into idempotent SQL at
 * supabase/seed/002_the_big_bang_2020.sql.
 *
 * The SQL is generated rather than hand-written so that the JSON stays the single
 * editable representation of the import. Fix a value in the importer, re-run both
 * scripts, and the seed follows. The generated file IS committed, so anyone can
 * `psql -f` it without a Node toolchain.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN = path.join(ROOT, 'data/archive-imports/the-big-bang-2020');
const OUT = path.join(ROOT, 'supabase/seed/002_the_big_bang_2020.sql');

const read = async (f) => JSON.parse(await fs.readFile(path.join(IN, f), 'utf8'));

/** SQL literal. null -> NULL, everything else single-quoted and escaped. */
const q = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || Number.isNaN(v) ? 'null' : String(v));
const j = (v) => (v === null || v === undefined ? 'null' : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`);
const arr = (a) =>
  !a || a.length === 0 ? `'{}'::text[]` : `array[${a.map((s) => q(s)).join(', ')}]::text[]`;

const main = async () => {
  const campaign = await read('campaign.json');
  const { agents } = await read('agents.json');
  const { teams } = await read('teams.json');
  const { media } = await read('media.json');
  const recon = await read('reconciliation.json');
  const reported = await read('source-reported-country-stats.json');

  const L = [];
  const w = (s = '') => L.push(s);

  w('-- =============================================================================');
  w('-- 002  Archive import: Operation "The Big Bang" (31 July 2020)');
  w('-- =============================================================================');
  w('-- GENERATED FILE - do not edit by hand.');
  w('--   source : data/archive-imports/the-big-bang-2020/*.json');
  w('--   script : scripts/generate-archive-seed.mjs');
  w('--   run    : node scripts/import-big-bang.mjs && node scripts/generate-archive-seed.mjs');
  w('--');
  w('-- Idempotent: safe to run repeatedly.');
  w('--');
  w('-- This campaign predates Brill Ops by six years. Values that could not be read');
  w("-- directly from the handoff package are marked confidence <> 'source' and carry");
  w('-- an inference_basis. See docs/import/the-big-bang-2020-provenance.md.');
  w('-- =============================================================================');
  w();
  w('begin;');
  w();

  // --- import batch -----------------------------------------------------------
  w('-- Provenance batch -----------------------------------------------------------');
  w(`insert into import_batches (id, label, source_directory, script, summary)`);
  w(`values (`);
  w(`  '00000000-0000-4000-a000-000000000001',`);
  w(`  'The Big Bang 2020 - historical import',`);
  w(`  ${q(campaign.source_directory)},`);
  w(`  'scripts/import-big-bang.mjs',`);
  w(`  ${j({ ...recon.parse_notes, computed_from_csv: recon.computed_from_csv, organiser_reported: recon.organiser_reported })}`);
  w(`)`);
  w(`on conflict (id) do update set summary = excluded.summary;`);
  w();

  // --- campaign ---------------------------------------------------------------
  w('-- Campaign -------------------------------------------------------------------');
  w(`insert into campaigns (id, slug, name, short_name, description, status,`);
  w(`                       start_date, end_date, config, confidence, source_reference, import_batch_id)`);
  w(`values (`);
  w(`  '00000000-0000-4000-b000-000000000001',`);
  w(`  ${q(campaign.slug)}, ${q(campaign.name)}, ${q(campaign.short_name)},`);
  w(`  ${q(campaign.description)},`);
  w(`  'archived', ${q(campaign.start_date)}, ${q(campaign.end_date)},`);
  w(`  ${j({
        metric_label: 'links created',
        supports_teams: false,
        teams_are_inferred: true,
        original_submission_method: campaign.original_submission_method,
        submission_window_end: campaign.submission_window_end,
      })},`);
  w(`  'source', ${j({ directory: campaign.source_directory, date_basis: campaign.date_basis })},`);
  w(`  '00000000-0000-4000-a000-000000000001'`);
  w(`)`);
  w(`on conflict (slug) do update set`);
  w(`  name = excluded.name, description = excluded.description, config = excluded.config;`);
  w();

  // --- agents -----------------------------------------------------------------
  w(`-- Agents (${agents.length}) ------------------------------------------------------------`);
  w(`insert into agents (handle, display_name, faction, country, city, confidence, source_reference, notes, import_batch_id)`);
  w('values');
  w(
    agents
      .map((a) => {
        const faction = a.faction_colour === 'blue' || a.faction_colour === 'green'
          ? `'${a.faction_colour}'::agent_faction` : 'null';
        return `  (${q(a.handle)}, ${q(a.display_name)}, ${faction}, ${q(a.country)}, null, ` +
          `'source', ${j(a.source)}, ${arr(a.notes)}, '00000000-0000-4000-a000-000000000001')`;
      })
      .join(',\n'),
  );
  w(`on conflict (handle) do update set`);
  w(`  faction = coalesce(agents.faction, excluded.faction),`);
  w(`  country = coalesce(agents.country, excluded.country);`);
  w();

  // --- participation ----------------------------------------------------------
  w(`-- Campaign participation (${agents.length}) -----------------------------------------------`);
  w(`-- links_created NULL means the source was silent. It is NOT zero.`);
  w(`insert into campaign_participation`);
  w(`  (campaign_id, agent_id, faction, country, links_created, links_confidence,`);
  w(`   confidence, source_reference, notes, import_batch_id)`);
  w('select');
  w(`  '00000000-0000-4000-b000-000000000001', a.id, v.faction, v.country,`);
  w(`  v.links_created, v.links_confidence::data_confidence, 'source', v.source_reference,`);
  w(`  v.notes, '00000000-0000-4000-a000-000000000001'`);
  w('from (values');
  w(
    agents
      .map((a) => {
        const faction = a.faction_colour === 'blue' || a.faction_colour === 'green'
          ? `'${a.faction_colour}'::agent_faction` : 'null::agent_faction';
        const conf = a.links_confidence === 'source' ? 'source' : 'unknown';
        return `  (${q(a.handle)}, ${faction}, ${q(a.country)}, ${n(a.links_created)}, ` +
          `${q(conf)}, ${j(a.source)}, ${arr(a.notes)})`;
      })
      .join(',\n'),
  );
  w(') as v(handle, faction, country, links_created, links_confidence, source_reference, notes)');
  w('join agents a on a.handle = v.handle');
  w('on conflict (campaign_id, agent_id) do update set');
  w('  links_created = excluded.links_created, links_confidence = excluded.links_confidence;');
  w();

  // --- teams ------------------------------------------------------------------
  w(`-- Teams (${teams.length}) - ALL INFERRED --------------------------------------------`);
  w('-- The Big Bang recorded no teams; it was an individual link-creation event.');
  w("-- These country groupings mirror the organiser's own 'Country Stats' tab so the");
  w('-- archive has team cards, and every one is flagged confidence = inferred.');
  w(`insert into teams (campaign_id, slug, name, faction, country,`);
  w(`                   construction_start_date, construction_end_date, links_created,`);
  w(`                   confidence, inference_basis, source_reference, import_batch_id)`);
  w('values');
  w(
    teams
      .map((t) =>
        `  ('00000000-0000-4000-b000-000000000001', ${q(t.slug)}, ${q(t.name)}, ` +
        `'${t.faction}'::faction_colour, ${q(t.country)}, ` +
        `${q(campaign.start_date)}, ${q(campaign.end_date)}, ${n(t.links_created)}, ` +
        `'inferred', ${q(t.inference_basis)}, ` +
        `${j({ top_agent: t.top_agent, faction_breakdown: t.faction_breakdown, links_created_confidence: t.links_created_confidence })}, ` +
        `'00000000-0000-4000-a000-000000000001')`,
      )
      .join(',\n'),
  );
  w('on conflict (campaign_id, slug) do update set');
  w('  links_created = excluded.links_created, faction = excluded.faction;');
  w();

  // --- team membership --------------------------------------------------------
  const memberships = teams.flatMap((t) => t.members.map((h) => [t.slug, h]));
  w(`-- Team membership (${memberships.length}) ------------------------------------------------`);
  w(`insert into team_membership (team_id, agent_id, role, confidence, source_reference)`);
  w(`select t.id, a.id, 'participant', 'inferred',`);
  w(`       ${j({ basis: 'country grouping of the agent CSV' })}`);
  w('from (values');
  w(memberships.map(([slug, handle]) => `  (${q(slug)}, ${q(handle)})`).join(',\n'));
  w(') as v(team_slug, handle)');
  w(`join teams  t on t.slug = v.team_slug and t.campaign_id = '00000000-0000-4000-b000-000000000001'`);
  w('join agents a on a.handle = v.handle');
  w('on conflict (team_id, agent_id) do nothing;');
  w();

  // --- media ------------------------------------------------------------------
  w(`-- Media (${media.length}) --------------------------------------------------------------`);
  w('-- The binaries are NOT in Git (ADR 0002). Each row records source_path + sha256');
  w('-- from source-data/MANIFEST.json so the asset stays traceable, and is_uploaded');
  w('-- flips to true once scripts/upload-archive-media.mjs pushes it to Storage.');
  w(`insert into media (campaign_id, role, source_path, source_sha256, bytes,`);
  w(`                   attributed_to, captured_at, captured_at_confidence,`);
  w(`                   is_uploaded, storage_bucket, confidence, import_batch_id)`);
  w('values');
  w(
    media
      .map((m) => {
        const role =
          m.role === 'star_screenshot' ? 'star_screenshot'
          : m.role === 'event_photo' ? 'event_photo'
          : m.role === 'event_video' ? 'event_video'
          : m.role === 'statistics_screenshot' ? 'statistics_screenshot'
          : 'other';
        return `  ('00000000-0000-4000-b000-000000000001', '${role}'::media_role, ` +
          `${q(m.source_path)}, ${q(m.sha256)}, ${n(m.bytes)}, ${q(m.attributed_to)}, ` +
          `${q(m.captured_at)}, 'estimated', false, 'archive-media', 'source', ` +
          `'00000000-0000-4000-a000-000000000001')`;
      })
      .join(',\n'),
  );
  w(';');
  w();

  // --- anomalies --------------------------------------------------------------
  w(`-- Import anomalies (${recon.anomalies.length}) -------------------------------------------------`);
  w('-- Nothing ambiguous was discarded. Each unresolved oddity is recorded here and');
  w('-- is rendered as a footnote on the archived campaign page.');
  w(`insert into import_anomalies (import_batch_id, anomaly_type, severity, subject,`);
  w(`                              source_file, source_line, raw_value, resolution)`);
  w('values');
  w(
    recon.anomalies
      .map((a) =>
        `  ('00000000-0000-4000-a000-000000000001', ${q(a.type)}, 'info', ${q(a.agent ?? a.subject ?? null)}, ` +
        `${q(campaign.source_directory + '/Txt/TheBigBang - All agents.csv')}, ${n(a.line)}, ` +
        `${q(a.value ?? a.raw ?? null)}, ${q(a.resolution)})`,
      )
      .join(',\n'),
  );
  w(';');
  w();

  // --- country-table disagreements as anomalies -------------------------------
  if (recon.country_disagreements.length) {
    w(`-- Disagreements between the CSV and the organiser's published country table (${recon.country_disagreements.length})`);
    w(`insert into import_anomalies (import_batch_id, anomaly_type, severity, subject, source_file, resolution)`);
    w('values');
    w(
      recon.country_disagreements
        .map((d) => {
          const parts = [];
          if (d.only_in) parts.push(`present only in ${d.only_in}`);
          if (d.participants) parts.push(`participants: organiser said ${d.participants.organiser_reported}, CSV gives ${d.participants.computed_from_csv}`);
          if (d.total_links) parts.push(`total links: organiser said ${d.total_links.organiser_reported}, CSV gives ${d.total_links.computed_from_csv}`);
          return `  ('00000000-0000-4000-a000-000000000001', 'source_disagreement', 'warning', ${q(d.country)}, ` +
            `${q(reported.source_file)}, ${q(parts.join('; ') + '. Both figures preserved; Brill Ops displays the CSV-derived value and shows the organiser figure as originally published.')})`;
        })
        .join(',\n'),
    );
    w(';');
    w();
  }

  // --- archive snapshot -------------------------------------------------------
  w('-- Archive snapshot -----------------------------------------------------------');
  w('-- Freezes the final numbers so a later data correction cannot silently rewrite');
  w('-- what this campaign was published as.');
  w(`insert into campaign_archive_snapshots`);
  w(`  (campaign_id, is_current, computed_stats, source_reported_stats, discrepancies, notes)`);
  w(`values (`);
  w(`  '00000000-0000-4000-b000-000000000001', true,`);
  w(`  ${j(recon.computed_from_csv)},`);
  w(`  ${j({ ...recon.organiser_reported, country_table: reported.rows, podium: reported.podium })},`);
  w(`  ${j(recon.country_disagreements)},`);
  w(`  ${q(recon.summary)}`);
  w(`)`);
  w(`on conflict (campaign_id) where is_current do nothing;`);
  w();
  w('commit;');
  w();

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, L.join('\n'));
  const bytes = (await fs.stat(OUT)).size;
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(`  agents ${agents.length} | teams ${teams.length} | memberships ${memberships.length} | media ${media.length} | anomalies ${recon.anomalies.length + recon.country_disagreements.length}`);
};

await main();
