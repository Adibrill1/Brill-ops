/**
 * Demo mode — the site running with no database.
 *
 * Everything here is reconstructed from the JSON files in
 * data/archive-imports/the-big-bang-2020/, which are committed to the repo and
 * are the output of scripts/import-big-bang.mjs. So the numbers below are not
 * fixtures or mock data: they are the real 2020 campaign, computed by the same
 * arithmetic the SQL views use.
 *
 * This exists so the platform can be seen and reviewed before a Supabase project
 * is set up. It is NOT a fallback for a broken database — it activates only when
 * NEXT_PUBLIC_SUPABASE_URL is absent or still a placeholder. If a real URL is
 * configured and the database is unreachable, the app fails loudly, as it should.
 *
 * Demo mode is read-only by definition: submissions, sign-in and uploads all
 * require the real backend.
 */

import campaignJson from '../../data/archive-imports/the-big-bang-2020/campaign.json';
import agentsJson from '../../data/archive-imports/the-big-bang-2020/agents.json';
import teamsJson from '../../data/archive-imports/the-big-bang-2020/teams.json';
import mediaJson from '../../data/archive-imports/the-big-bang-2020/media.json';
import reconJson from '../../data/archive-imports/the-big-bang-2020/reconciliation.json';
import reportedJson from '../../data/archive-imports/the-big-bang-2020/source-reported-country-stats.json';

import type {
  AgentCampaignStats,
  AgentFaction,
  AgentLifetimeStats,
  ArchiveSnapshot,
  Campaign,
  CampaignStats,
  CountryStats,
  FactionColour,
  ImportAnomaly,
  MediaItem,
  TeamWithStatus,
} from '@/types/database';

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

/**
 * True when there is no real Supabase project to talk to.
 *
 * Checked at call time rather than module scope so that adding .env.local and
 * restarting is all it takes to switch to the live backend.
 */
export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url.includes('placeholder') || url.includes('your-project');
}

// ---------------------------------------------------------------------------
// Source shapes
// ---------------------------------------------------------------------------

interface SourceAgent {
  handle: string;
  display_name: string;
  faction_colour: 'blue' | 'green' | null;
  country: string | null;
  city: string | null;
  links_created: number | null;
  links_confidence: string;
  notes: string[];
}

interface SourceTeam {
  slug: string;
  name: string;
  country: string;
  faction: FactionColour;
  inference_basis: string;
  links_created: number;
  participant_count: number;
  participants_with_unknown_links: number;
  top_agent: string | null;
  members: string[];
}

const AGENTS = agentsJson.agents as SourceAgent[];
const TEAMS = teamsJson.teams as unknown as SourceTeam[];
const MEDIA = mediaJson.media as Array<{
  source_path: string;
  role: string;
  kind: string;
  bytes: number;
  sha256: string;
  attributed_to: string | null;
  captured_at: string;
}>;

const CAMPAIGN_ID = 'demo-the-big-bang-2020';

/** In demo mode a team's slug doubles as its id, so /team/[id] links work. */
const teamId = (slug: string) => slug;

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

export function demoCampaign(): Campaign {
  return {
    id: CAMPAIGN_ID,
    slug: campaignJson.slug,
    name: campaignJson.name,
    short_name: campaignJson.short_name,
    description: campaignJson.description,
    status: 'archived',
    start_date: campaignJson.start_date,
    end_date: campaignJson.end_date,
    hero_image_url: null,
    brand_colour: null,
    config: {
      metric_label: 'links created',
      supports_teams: false,
      teams_are_inferred: true,
      original_submission_method: campaignJson.original_submission_method,
    },
    confidence: 'source',
  };
}

const knownLinkAgents = () => AGENTS.filter((a) => a.links_created !== null);

export function demoCampaignStats(): CampaignStats {
  const known = knownLinkAgents();
  // Matches campaign_stats exactly: the SQL averages over teams whose
  // links_created IS NOT NULL, which includes Romania's genuine 0. Excluding
  // zero-link teams here would make the demo teach a different number.
  const teamsWithLinks = TEAMS.filter((t) => t.links_created !== null);
  const countries = demoCountryStats();

  const largest = [...TEAMS].sort(
    (a, b) => b.participant_count - a.participant_count || b.links_created - a.links_created,
  )[0];
  const topCountry = [...countries].sort((a, b) => (b.total_links ?? 0) - (a.total_links ?? 0))[0];
  const topAgent = [...known].sort((a, b) => (b.links_created ?? 0) - (a.links_created ?? 0))[0];

  return {
    campaign_id: CAMPAIGN_ID,
    slug: campaignJson.slug,
    name: campaignJson.name,
    status: 'archived',
    start_date: campaignJson.start_date,
    end_date: campaignJson.end_date,

    total_agents: AGENTS.length,
    countries: new Set(AGENTS.map((a) => a.country).filter(Boolean)).size,
    // City data exists in the handoff only as pixels in a screenshot and was
    // deliberately not transcribed. See assumptions §B8.
    cities: 0,
    total_teams: TEAMS.length,

    total_links_created: known.reduce((n, a) => n + (a.links_created ?? 0), 0),
    agents_with_unknown_links: AGENTS.length - known.length,
    avg_links_per_team: teamsWithLinks.length
      ? Math.round(
          (teamsWithLinks.reduce((n, t) => n + t.links_created, 0) / teamsWithLinks.length) * 10,
        ) / 10
      : null,

    largest_team: largest?.name ?? null,
    top_country: topCountry?.country ?? null,
    top_contributor: topAgent?.handle ?? null,

    media_count: MEDIA.length,
    contains_inferred_data: true,
  };
}

// ---------------------------------------------------------------------------
// Factions
// ---------------------------------------------------------------------------

/** Handles belonging to at least one crossfaction team. */
function crossfactionHandles(): Set<string> {
  const set = new Set<string>();
  for (const t of TEAMS) {
    if (t.faction === 'crossfaction') t.members.forEach((h) => set.add(h));
  }
  return set;
}

/**
 * Mirrors campaign_faction_stats, including its deliberate asymmetry: blue and
 * green count agents by their own faction, while the crossfaction row counts
 * agents who worked on a crossfaction *team* — because no individual is
 * themselves crossfaction.
 */
export function demoFactionStats() {
  const cross = crossfactionHandles();

  const bucketOf = (a: SourceAgent): FactionColour | null =>
    cross.has(a.handle) ? 'crossfaction' : a.faction_colour;

  return (['blue', 'green', 'crossfaction'] as FactionColour[]).map((colour) => {
    const members = AGENTS.filter((a) => bucketOf(a) === colour);
    return {
      campaign_id: CAMPAIGN_ID,
      faction_colour: colour,
      agents_count: members.length,
      teams_count: TEAMS.filter((t) => t.faction === colour).length,
      links_created: members.reduce((n, a) => n + (a.links_created ?? 0), 0),
      agents_with_unknown_links: members.filter((a) => a.links_created === null).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export function demoCountryStats(): CountryStats[] {
  const byCountry = new Map<string, SourceAgent[]>();
  for (const a of AGENTS) {
    if (!a.country) continue;
    if (!byCountry.has(a.country)) byCountry.set(a.country, []);
    byCountry.get(a.country)!.push(a);
  }

  return [...byCountry.entries()]
    .map(([country, members]) => {
      const known = members.filter((m) => m.links_created !== null);
      return {
        campaign_id: CAMPAIGN_ID,
        country,
        participants: members.length,
        total_links: known.reduce((n, m) => n + (m.links_created ?? 0), 0),
        max_links_by_one_agent: known.length
          ? Math.max(...known.map((m) => m.links_created ?? 0))
          : null,
        participants_with_unknown_links: members.length - known.length,
        cities: 0,
      };
    })
    .sort((a, b) => (b.total_links ?? 0) - (a.total_links ?? 0));
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

function toTeamWithStatus(t: SourceTeam): TeamWithStatus {
  return {
    id: teamId(t.slug),
    campaign_id: CAMPAIGN_ID,
    slug: t.slug,
    name: t.name,
    faction: t.faction,
    country: t.country,
    city: null,
    portal_address: null,
    construction_start_date: campaignJson.start_date,
    construction_end_date: campaignJson.end_date,
    links_created: t.links_created,
    participant_count: t.participant_count,
    // Every team in this campaign was reconstructed - the event had no teams.
    confidence: 'inferred',
    inference_basis: t.inference_basis,
    status: 'completed',
    construction_days: 0,
  };
}

export function demoTeams(filters: {
  faction?: string;
  status?: string;
  country?: string;
  sort?: string;
} = {}): TeamWithStatus[] {
  let teams = TEAMS.map(toTeamWithStatus);

  if (filters.faction && filters.faction !== 'all') {
    teams = teams.filter((t) => t.faction === filters.faction);
  }
  if (filters.country) teams = teams.filter((t) => t.country === filters.country);
  if (filters.status && filters.status !== 'all') {
    teams = teams.filter((t) => t.status === filters.status);
  }

  switch (filters.sort) {
    case 'participants':
      teams.sort((a, b) => b.participant_count - a.participant_count);
      break;
    case 'name':
    case 'recent':
      teams.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      teams.sort((a, b) => (b.links_created ?? 0) - (a.links_created ?? 0));
  }

  return teams;
}

export function demoTeam(id: string): TeamWithStatus | null {
  const found = TEAMS.find((t) => teamId(t.slug) === id);
  return found ? toTeamWithStatus(found) : null;
}

export function demoTeamMembers(id: string): AgentLifetimeStats[] {
  const team = TEAMS.find((t) => teamId(t.slug) === id);
  if (!team) return [];
  return team.members
    .map((h) => AGENTS.find((a) => a.handle === h))
    .filter(Boolean)
    .map((a) => demoAgentLifetime(a as SourceAgent));
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

function demoAgentLifetime(a: SourceAgent): AgentLifetimeStats {
  const teams = TEAMS.filter((t) => t.members.includes(a.handle));
  return {
    agent_id: a.handle,
    handle: a.handle,
    display_name: a.display_name,
    avatar_url: null,
    faction: a.faction_colour as AgentFaction | null,
    country: a.country,
    city: a.city,
    is_claimed: false,
    campaigns_participated: 1,
    teams_joined: teams.length,
    total_links_created: a.links_created,
    campaigns_with_unknown_links: a.links_created === null ? 1 : 0,
    completed_projects: teams.length,
    faction_history: a.faction_colour ? [a.faction_colour] : [],
    first_seen: campaignJson.start_date,
    last_seen: campaignJson.end_date,
  };
}

export function demoAgentDirectory(filters: {
  search?: string;
  country?: string;
  faction?: string;
  sort?: string;
} = {}): AgentLifetimeStats[] {
  let list = AGENTS.slice();

  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.handle.toLowerCase().includes(q) ||
        a.display_name.toLowerCase().includes(q) ||
        (a.country ?? '').toLowerCase().includes(q),
    );
  }
  if (filters.country) list = list.filter((a) => a.country === filters.country);
  if (filters.faction && filters.faction !== 'all' && filters.faction !== 'crossfaction') {
    list = list.filter((a) => a.faction_colour === filters.faction);
  }

  const mapped = list.map(demoAgentLifetime);

  switch (filters.sort) {
    case 'contribution':
      mapped.sort((a, b) => (b.total_links_created ?? -1) - (a.total_links_created ?? -1));
      break;
    case 'campaigns':
      mapped.sort((a, b) => b.teams_joined - a.teams_joined);
      break;
    default:
      mapped.sort((a, b) => a.handle.localeCompare(b.handle));
  }

  return mapped;
}

export function demoAgentByHandle(handle: string): AgentLifetimeStats | null {
  const withAt = handle.startsWith('@') ? handle : `@${handle}`;
  const found = AGENTS.find((a) => a.handle.toLowerCase() === withAt.toLowerCase());
  return found ? demoAgentLifetime(found) : null;
}

export function demoAgentParticipation(agentId: string) {
  const agent = AGENTS.find((a) => a.handle === agentId);
  if (!agent) return [];
  return [
    {
      campaign_id: CAMPAIGN_ID,
      agent_id: agent.handle,
      handle: agent.handle,
      display_name: agent.display_name,
      avatar_url: null,
      faction: agent.faction_colour as AgentFaction | null,
      country: agent.country,
      city: agent.city,
      links_created: agent.links_created,
      links_confidence: (agent.links_confidence === 'source' ? 'source' : 'unknown') as
        | 'source'
        | 'unknown',
      is_crossfaction_participant: crossfactionHandles().has(agent.handle),
      teams_joined: TEAMS.filter((t) => t.members.includes(agent.handle)).length,
      campaign: {
        slug: campaignJson.slug,
        name: campaignJson.name,
        status: 'archived' as const,
        end_date: campaignJson.end_date,
      },
    },
  ];
}

export function demoLeaderboard(limit = 10): AgentCampaignStats[] {
  const cross = crossfactionHandles();
  return knownLinkAgents()
    .sort((a, b) => (b.links_created ?? 0) - (a.links_created ?? 0))
    .slice(0, limit)
    .map((a) => ({
      campaign_id: CAMPAIGN_ID,
      agent_id: a.handle,
      handle: a.handle,
      display_name: a.display_name,
      avatar_url: null,
      faction: a.faction_colour as AgentFaction | null,
      country: a.country,
      city: a.city,
      links_created: a.links_created,
      links_confidence: 'source',
      is_crossfaction_participant: cross.has(a.handle),
      teams_joined: TEAMS.filter((t) => t.members.includes(a.handle)).length,
    }));
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/**
 * Campaign-level only. Team galleries are empty in this campaign and that is
 * correct, not a gap in the demo: media filenames carry contributors' REAL
 * names while the CSV carries agent handles, and no mapping between the two
 * exists. Inventing one would be fabrication. See provenance §9.
 */
export function demoCampaignMedia(limit = 60): MediaItem[] {
  return MEDIA.slice(0, limit).map((m, i) => ({
    id: `demo-media-${i}`,
    campaign_id: CAMPAIGN_ID,
    team_id: null,
    agent_id: null,
    role: (m.role === 'star_screenshot' ||
      m.role === 'event_photo' ||
      m.role === 'event_video' ||
      m.role === 'statistics_screenshot'
      ? m.role
      : 'other') as MediaItem['role'],
    storage_bucket: 'archive-media',
    storage_path: null,
    external_url: null,
    source_path: m.source_path,
    source_sha256: m.sha256,
    is_uploaded: false,
    mime_type: null,
    bytes: m.bytes,
    width: null,
    height: null,
    caption: null,
    attributed_to: m.attributed_to,
    captured_at: m.captured_at,
    captured_at_confidence: 'estimated',
  }));
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export function demoArchiveSnapshot(): ArchiveSnapshot {
  return {
    id: 'demo-snapshot',
    campaign_id: CAMPAIGN_ID,
    taken_at: campaignJson.imported_at,
    computed_stats: reconJson.computed_from_csv as unknown as ArchiveSnapshot['computed_stats'],
    source_reported_stats: {
      ...reconJson.organiser_reported,
      country_table: reportedJson.rows,
      podium: reportedJson.podium,
    },
    discrepancies: reconJson.country_disagreements,
    notes: reconJson.summary,
  };
}

/**
 * The archive's footnotes: row-level oddities first, then the eight countries
 * where the agent CSV and the organiser's own published table disagree.
 */
export function demoAnomalies(): ImportAnomaly[] {
  const rowLevel: ImportAnomaly[] = reconJson.anomalies.map((a, i) => ({
    id: `demo-anomaly-${i}`,
    anomaly_type: a.type,
    severity: 'info',
    subject: (a as { agent?: string }).agent ?? null,
    source_file: 'source-data/historical-campaigns/2020-07-the-big-bang/Txt/TheBigBang - All agents.csv',
    source_line: a.line ?? null,
    raw_value: null,
    resolution: a.resolution,
  }));

  const disagreements: ImportAnomaly[] = reconJson.country_disagreements.map((d, i) => {
    const parts: string[] = [];
    const rec = d as {
      country: string;
      only_in?: string;
      participants?: { organiser_reported: number; computed_from_csv: number };
      total_links?: { organiser_reported: number; computed_from_csv: number };
    };
    if (rec.only_in) parts.push(`present only in ${rec.only_in}`);
    if (rec.participants) {
      parts.push(
        `participants: organiser said ${rec.participants.organiser_reported}, ` +
          `CSV gives ${rec.participants.computed_from_csv}`,
      );
    }
    if (rec.total_links) {
      parts.push(
        `total links: organiser said ${rec.total_links.organiser_reported}, ` +
          `CSV gives ${rec.total_links.computed_from_csv}`,
      );
    }
    return {
      id: `demo-disagreement-${i}`,
      anomaly_type: 'source_disagreement',
      severity: 'warning',
      subject: rec.country,
      source_file: reportedJson.source_file,
      source_line: null,
      raw_value: null,
      resolution:
        parts.join('; ') +
        '. Both figures preserved; Brill Ops displays the CSV-derived value and shows the ' +
        'organiser figure as originally published.',
    };
  });

  return [...disagreements, ...rowLevel];
}
