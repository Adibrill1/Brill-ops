#!/usr/bin/env node
/**
 * import-big-bang.mjs
 *
 * Turns the 2020 "Operation The Big Bang" handoff package into structured archive
 * data that Brill Ops can load, WITHOUT throwing away anything ambiguous.
 *
 * Inputs (all read-only, never modified):
 *   source-data/historical-campaigns/2020-07-the-big-bang/Txt/TheBigBang - All agents.csv
 *   data/archive-imports/the-big-bang-2020/source-reported-country-stats.json
 *   source-data/MANIFEST.json
 *
 * Outputs (all regenerable, all committed):
 *   data/archive-imports/the-big-bang-2020/campaign.json
 *   data/archive-imports/the-big-bang-2020/agents.json
 *   data/archive-imports/the-big-bang-2020/teams.json
 *   data/archive-imports/the-big-bang-2020/media.json
 *   data/archive-imports/the-big-bang-2020/reconciliation.json
 *
 * GUIDING RULE
 * ------------
 * Every value that did not come literally from a source file is tagged with
 * `confidence: "inferred"` or `"estimated"` and an `inference_basis` string.
 * Rows we could not fully parse are not dropped - they land in `anomalies`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAMPAIGN_SLUG = 'the-big-bang-2020';
const SOURCE_DIR = 'source-data/historical-campaigns/2020-07-the-big-bang';
const CSV_PATH = path.join(ROOT, SOURCE_DIR, 'Txt/TheBigBang - All agents.csv');
const OUT_DIR = path.join(ROOT, 'data/archive-imports', CAMPAIGN_SLUG);

/**
 * Ingress has two factions. Brill Ops speaks in colours because a team can be mixed,
 * and a mixed team is called Crossfaction throughout the platform - never "mixed",
 * never "both", never "XF".
 */
const FACTION_TO_COLOUR = { Resistance: 'blue', Enlightened: 'green' };

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/** Minimal RFC-4180 reader. The source file has no quoted fields, but be safe. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Blank spacer rows exist in the source sheet purely as visual separators. */
const isBlankRow = (row) => row.every((cell) => cell.trim() === '');

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

async function main() {
  const raw = await fs.readFile(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  const header = rows[0].map((h) => h.trim());

  const iName = header.indexOf('Agent Name');
  const iFaction = header.indexOf('Faction');
  const iCountry = header.indexOf('Country');
  const iLinks = header.indexOf('Links created');
  const iMax = header.indexOf('Max in country');
  if ([iName, iFaction, iCountry, iLinks].some((i) => i < 0)) {
    throw new Error(`Unexpected CSV header shape: ${JSON.stringify(header)}`);
  }

  const anomalies = [];
  const seen = new Map(); // handle -> agent
  const agents = [];
  let blankRows = 0;

  rows.slice(1).forEach((row, idx) => {
    const lineNo = idx + 2; // 1-based, +1 for header
    if (isBlankRow(row)) { blankRows++; return; }

    // The source has trailing-comma padding; guard short rows.
    const cell = (i) => (row[i] ?? '').trim();
    const handleRaw = cell(iName);
    if (!handleRaw) {
      anomalies.push({ line: lineNo, type: 'missing_agent_name', raw: row.join(','),
        resolution: 'row skipped - no identity to attach data to' });
      return;
    }

    // Several handles carry a trailing space in the source ("@Josske ", "@vastis ").
    const handle = handleRaw.replace(/\s+$/, '');
    const factionRaw = cell(iFaction);
    const country = cell(iCountry);
    const linksRaw = cell(iLinks);
    const maxRaw = cell(iMax);

    const notes = [];
    if (handleRaw !== handle) notes.push('trailing whitespace trimmed from handle');

    const colour = FACTION_TO_COLOUR[factionRaw] ?? null;
    if (!colour) {
      anomalies.push({ line: lineNo, type: 'unknown_faction', agent: handle, value: factionRaw,
        resolution: 'faction_colour left null; agent still imported' });
    }

    let links = null;
    let linksConfidence = 'source';
    if (linksRaw === '') {
      links = null;
      linksConfidence = 'unknown';
      anomalies.push({ line: lineNo, type: 'blank_links_created', agent: handle,
        resolution: 'links_created stored as null (unknown), NOT as zero' });
      notes.push('links_created was blank in source - recorded as unknown, not zero');
    } else if (!/^\d+$/.test(linksRaw)) {
      anomalies.push({ line: lineNo, type: 'non_numeric_links', agent: handle, value: linksRaw,
        resolution: 'links_created stored as null' });
      linksConfidence = 'unknown';
    } else {
      links = Number(linksRaw);
    }

    if (!country) {
      anomalies.push({ line: lineNo, type: 'missing_country', agent: handle,
        resolution: 'country stored as null; agent excluded from country rollups' });
      notes.push('country was blank in source');
    }

    const record = {
      handle,
      display_name: handle.replace(/^@/, ''),
      faction: factionRaw || null,
      faction_colour: colour,
      country: country || null,
      city: null, // see provenance doc: city data exists only inside screenshots
      links_created: links,
      links_confidence: linksConfidence,
      country_max_links: /^\d+$/.test(maxRaw) ? Number(maxRaw) : null,
      source: { file: `${SOURCE_DIR}/Txt/TheBigBang - All agents.csv`, line: lineNo },
      notes,
    };

    // The source lists @CofBas twice: once mid-Belgium with a blank link count,
    // once in the Israel block with 17. Merge rather than drop either.
    const key = handle.toLowerCase();
    if (seen.has(key)) {
      const first = seen.get(key);
      anomalies.push({
        line: lineNo, type: 'duplicate_agent', agent: handle,
        resolution: `merged into the row at line ${first.source.line}; ` +
          'the row carrying a numeric links_created wins, the other is kept in duplicate_rows',
      });
      first.duplicate_rows = first.duplicate_rows ?? [];
      first.duplicate_rows.push(record);
      if (first.links_created === null && links !== null) {
        first.links_created = links;
        first.links_confidence = 'source';
        first.notes.push(`links_created taken from duplicate row at line ${lineNo}`);
      }
      if (!first.country && country) first.country = country;
      return;
    }

    seen.set(key, record);
    agents.push(record);
  });

  // -------------------------------------------------------------------------
  // Teams - INFERRED. The Big Bang had no team entity; it was an individual
  // link-creation event. But the organiser's own "Country Stats" tab groups
  // agents by country with participants / total links / top agent, which is
  // exactly the shape of a Brill Ops team card. We therefore synthesise one
  // team per country and flag every one of them as inferred.
  // -------------------------------------------------------------------------
  const byCountry = new Map();
  for (const a of agents) {
    if (!a.country) continue;
    if (!byCountry.has(a.country)) byCountry.set(a.country, []);
    byCountry.get(a.country).push(a);
  }

  const teams = [...byCountry.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([country, members]) => {
      const colours = new Set(members.map((m) => m.faction_colour).filter(Boolean));
      // A team containing both Blue and Green agents is Crossfaction.
      const faction = colours.size > 1 ? 'crossfaction' : ([...colours][0] ?? 'crossfaction');
      const known = members.filter((m) => m.links_created !== null);
      const total = known.reduce((n, m) => n + m.links_created, 0);
      const top = known.slice().sort((x, y) => y.links_created - x.links_created)[0] ?? null;

      return {
        slug: `big-bang-2020-${country.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: `${country} — The Big Bang`,
        country,
        city: null,
        faction,
        confidence: 'inferred',
        inference_basis:
          'The Big Bang recorded no teams. Grouped by country to mirror the organiser\'s own ' +
          '"Country Stats" tab, which reported participants / total links / top agent per country.',
        links_created: total,
        links_created_confidence: known.length === members.length ? 'computed' : 'computed_partial',
        participant_count: members.length,
        participants_with_unknown_links: members.length - known.length,
        top_agent: top?.handle ?? null,
        faction_breakdown: {
          blue: members.filter((m) => m.faction_colour === 'blue').length,
          green: members.filter((m) => m.faction_colour === 'green').length,
          unknown: members.filter((m) => !m.faction_colour).length,
        },
        members: members.map((m) => m.handle),
        status: 'completed',
        status_confidence: 'inferred',
      };
    });

  // -------------------------------------------------------------------------
  // Media - derived from the committed manifest, since the binaries themselves
  // are not in Git. Each entry keeps the attribution encoded in the filename.
  // -------------------------------------------------------------------------
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'source-data/MANIFEST.json'), 'utf8'));
  const FOLDER_ROLE = {
    Stars: 'star_screenshot',
    Photos: 'event_photo',
    Videos: 'event_video',
    Txt: 'statistics_screenshot',
  };

  const media = manifest.files
    .filter((f) => !f.is_os_noise && f.path.startsWith(SOURCE_DIR))
    .map((f) => {
      const rel = f.path.slice(SOURCE_DIR.length + 1);
      const folder = rel.includes('/') ? rel.split('/')[0] : '(root)';
      return {
        source_path: f.path,
        folder,
        role: FOLDER_ROLE[folder] ?? 'unclassified',
        kind: f.kind,
        bytes: f.bytes,
        sha256: f.sha256,
        captured_at: f.modified,
        captured_at_confidence: 'estimated',
        captured_at_basis: 'filesystem mtime of the handoff package; not an authoritative capture time',
        attributed_to: f.attribution_hint,
        attribution_confidence: f.attribution_hint ? 'inferred_from_filename' : 'unknown',
        in_git: f.kind === 'dataset',
        storage_status: 'pending_upload_to_supabase_storage',
      };
    });

  // -------------------------------------------------------------------------
  // Reconciliation - compute from the CSV, diff against the organiser's own
  // published country table, and report disagreements. Do not pick a winner.
  // -------------------------------------------------------------------------
  const reported = JSON.parse(
    await fs.readFile(path.join(OUT_DIR, 'source-reported-country-stats.json'), 'utf8'),
  );
  const reportedByCountry = new Map(reported.rows.map((r) => [r.country, r]));
  const computedByCountry = new Map(teams.map((t) => [t.country, t]));

  const countryDiffs = [];
  for (const country of new Set([...reportedByCountry.keys(), ...computedByCountry.keys()])) {
    const r = reportedByCountry.get(country);
    const c = computedByCountry.get(country);
    const diff = { country };
    if (!r) diff.only_in = 'csv';
    else if (!c) diff.only_in = 'organiser_country_table';
    else {
      if (r.participants !== c.participant_count) {
        diff.participants = { organiser_reported: r.participants, computed_from_csv: c.participant_count };
      }
      if (r.total_links !== c.links_created) {
        diff.total_links = { organiser_reported: r.total_links, computed_from_csv: c.links_created };
      }
    }
    if (Object.keys(diff).length > 1) countryDiffs.push(diff);
  }
  countryDiffs.sort((a, b) => a.country.localeCompare(b.country));

  const knownLinks = agents.filter((a) => a.links_created !== null);
  const computedTotals = {
    agents: agents.length,
    agents_with_known_links: knownLinks.length,
    agents_with_unknown_links: agents.length - knownLinks.length,
    countries: byCountry.size,
    total_links: knownLinks.reduce((n, a) => n + a.links_created, 0),
    blue_agents: agents.filter((a) => a.faction_colour === 'blue').length,
    green_agents: agents.filter((a) => a.faction_colour === 'green').length,
    crossfaction_teams: teams.filter((t) => t.faction === 'crossfaction').length,
    blue_teams: teams.filter((t) => t.faction === 'blue').length,
    green_teams: teams.filter((t) => t.faction === 'green').length,
  };
  const reportedTotals = {
    participants: reported.rows.reduce((n, r) => n + r.participants, 0),
    total_links: reported.rows.reduce((n, r) => n + r.total_links, 0),
    countries: reported.rows.length,
  };

  // -------------------------------------------------------------------------
  const campaign = {
    slug: CAMPAIGN_SLUG,
    name: 'Operation "The Big Bang"',
    short_name: 'The Big Bang',
    description:
      'A global crossfaction Ingress operation held on 31 July 2020. Agents from both factions ' +
      'built link stars from a single portal and submitted their results, portal details and photos ' +
      'through a Google Form. Imported into Brill Ops as the platform\'s first archived campaign.',
    status: 'archived',
    start_date: '2020-07-31',
    end_date: '2020-07-31',
    date_confidence: 'source',
    date_basis:
      'Campaign name in the original spreadsheet is \'Operation "The Big Bang" - July 31st, 2020 ' +
      '(Responses)\' (visible in Txt/Screen Shot 2020-08-06 at 2.39.48.png). Submissions continued ' +
      'into early August; end_date reflects the event, not the submission window.',
    submission_window_end: '2020-08-06',
    submission_window_end_confidence: 'estimated',
    submission_window_end_basis: 'latest statistics screenshot in the handoff package is dated 2020-08-06',
    hero_image: null,
    hero_image_confidence: 'missing',
    hero_image_basis: 'No campaign branding was supplied. Candidate: Videos/TheBigBang.mp4 poster frame.',
    original_submission_method: 'Google Form -> Google Sheet ("OP \\"The Big Bang\\" (Responses)")',
    imported_at: new Date().toISOString(),
    import_script: 'scripts/import-big-bang.mjs',
    source_directory: SOURCE_DIR,
    totals: computedTotals,
  };

  const reconciliation = {
    generated_at: new Date().toISOString(),
    summary:
      'The row-level CSV and the organiser\'s country-summary tab were exported on different dates ' +
      'and do not fully agree. Both are preserved. Brill Ops treats the CSV as the row-level source ' +
      'of truth because it is the only machine-readable artefact, and surfaces the organiser figures ' +
      'alongside it as "as originally published".',
    computed_from_csv: computedTotals,
    organiser_reported: reportedTotals,
    country_disagreements: countryDiffs,
    parse_notes: {
      blank_spacer_rows_skipped: blankRows,
      duplicate_handles_merged: anomalies.filter((a) => a.type === 'duplicate_agent').length,
    },
    anomalies,
  };

  await fs.mkdir(OUT_DIR, { recursive: true });
  const write = (name, data) =>
    fs.writeFile(path.join(OUT_DIR, name), JSON.stringify(data, null, 2) + '\n');

  await Promise.all([
    write('campaign.json', campaign),
    write('agents.json', { campaign: CAMPAIGN_SLUG, count: agents.length, agents }),
    write('teams.json', { campaign: CAMPAIGN_SLUG, count: teams.length, note:
      'Every team in this file is INFERRED. See inference_basis on each record.', teams }),
    write('media.json', { campaign: CAMPAIGN_SLUG, count: media.length, media }),
    write('reconciliation.json', reconciliation),
  ]);

  console.log(`Imported "${campaign.name}"`);
  console.log(`  agents            ${computedTotals.agents} (${computedTotals.agents_with_unknown_links} with unknown link count)`);
  console.log(`  countries         ${computedTotals.countries}`);
  console.log(`  inferred teams    ${teams.length} (${computedTotals.crossfaction_teams} crossfaction, ${computedTotals.blue_teams} blue, ${computedTotals.green_teams} green)`);
  console.log(`  total links (CSV) ${computedTotals.total_links}   organiser reported ${reportedTotals.total_links}`);
  console.log(`  media files       ${media.length}`);
  console.log(`  anomalies logged  ${anomalies.length}`);
  console.log(`  country diffs     ${countryDiffs.length}`);
}

await main();
