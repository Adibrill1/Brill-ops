import { createClient } from '@/lib/supabase/server';
import * as demo from '@/lib/demo';
import type {
  AgentCampaignStats,
  AgentLifetimeStats,
  ArchiveSnapshot,
  Campaign,
  CampaignStats,
  CountryStats,
  FactionStats,
  ImportAnomaly,
  MediaItem,
  TeamWithStatus,
} from '@/types/database';

/**
 * Every read the app performs. Two rules hold throughout:
 *
 *   1. Statistics come from VIEWS, never from application arithmetic. If a number
 *      needs computing, it belongs in supabase/migrations/0003_statistics_views.sql.
 *   2. Nothing here is campaign-specific. There is no `getStarsForPeace()`. A new
 *      campaign is a row, so every function takes a slug or an id.
 *
 * Each function opens with a demo-mode guard. When no Supabase project is
 * configured, reads are served from the committed archive JSON instead, so the
 * platform can be reviewed before a backend exists. The guard checks the env var
 * only — a configured-but-unreachable database still fails loudly. See lib/demo.ts.
 */

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Unwrap a Supabase result, throwing on error instead of returning empty data.
 *
 * This exists because the opposite was a real bug. Destructuring only `data` and
 * ignoring `error` means a missing table, a bad key or a broken RLS policy all
 * render as "no campaigns yet" - a confident, wrong answer. For a project whose
 * whole posture is that data never misrepresents itself, silently swallowing a
 * database failure is the worst possible default.
 *
 * The schema-missing case gets its own message because it is the one people will
 * actually hit, on a fresh Supabase project before migrations have run.
 */
function unwrap<T>(
  result: { data: T; error: { message: string; code?: string; hint?: string | null } | null },
  context: string,
): T {
  const { data, error } = result;
  if (!error) return data;

  // PGRST205: PostgREST cannot find the relation. Usually NOT a missing schema —
  // it is a stale API schema cache, because migrations applied over a direct
  // Postgres connection never reach the REST layer. 42P01 is the genuine
  // undefined-table case. Both are fixed by the same command, so they share a
  // message, but the wording names the likelier cause first.
  if (error.code === '42P01' || error.code === 'PGRST205') {
    throw new Error(
      `Brill Ops: the API cannot see "${context}". Either the Supabase schema cache ` +
        `is stale after a direct migration, or the schema was never applied. ` +
        `Run "npm run db:setup" — it applies migrations, seeds, and reloads the ` +
        `API cache. Original error: ${error.message}`,
    );
  }

  throw new Error(
    `Brill Ops: query failed (${context}): ${error.message}` +
      (error.hint ? ` - ${error.hint}` : ''),
  );
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/**
 * The campaign the homepage renders. Returns null when nothing is active — which
 * is the current state, since Stars for Peace is still a draft awaiting real
 * dates and branding.
 */
export async function getActiveCampaign(): Promise<Campaign | null> {
  // No campaign is active in demo mode: Stars for Peace is still a draft
  // awaiting real dates, so the homepage shows the Archive instead.
  if (demo.isDemoMode()) return null;
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .maybeSingle(), 'campaigns');
  return data as Campaign | null;
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  if (demo.isDemoMode()) {
    const c = demo.demoCampaign();
    return c.slug === slug ? c : null;
  }
  const supabase = await createClient();
  const data = unwrap(await supabase.from('campaigns').select('*').eq('slug', slug).maybeSingle(), 'campaigns');
  return data as Campaign | null;
}

export async function getArchivedCampaigns(): Promise<CampaignStats[]> {
  if (demo.isDemoMode()) return [demo.demoCampaignStats()];
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaign_stats')
    .select('*')
    .eq('status', 'archived')
    .order('end_date', { ascending: false }), 'campaign_stats');
  return (data ?? []) as CampaignStats[];
}

export async function getCampaignStats(campaignId: string): Promise<CampaignStats | null> {
  if (demo.isDemoMode()) return demo.demoCampaignStats();
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaign_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle(), 'campaign_stats');
  return data as CampaignStats | null;
}

/**
 * Blue / Green / Crossfaction breakdown.
 *
 * Note the asymmetry, which is deliberate: blue and green counts come from each
 * agent's own faction, while the crossfaction row counts agents who worked on a
 * crossfaction *team* — because no individual is themselves crossfaction.
 */
export async function getFactionStats(campaignId: string): Promise<FactionStats[]> {
  if (demo.isDemoMode()) return demo.demoFactionStats();
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaign_faction_stats')
    .select('*')
    .eq('campaign_id', campaignId), 'campaign_faction_stats');
  return (data ?? []) as FactionStats[];
}

export async function getCountryStats(campaignId: string): Promise<CountryStats[]> {
  if (demo.isDemoMode()) return demo.demoCountryStats();
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaign_country_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('total_links', { ascending: false, nullsFirst: false }), 'campaign_country_stats');
  return (data ?? []) as CountryStats[];
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export interface TeamFilters {
  /** 'blue' | 'green' | 'crossfaction' — matched against the team's own faction. */
  faction?: string;
  status?: string;
  country?: string;
  city?: string;
  sort?: 'links' | 'participants' | 'recent' | 'name';
}

/**
 * The dashboard query. Sorting happens in SQL; status filtering happens in
 * TypeScript because status is a computed column and Postgres will not index it.
 * At a few hundred teams per campaign that is the right trade — revisit with a
 * generated column if a campaign ever gets large.
 */
export async function getTeams(
  campaignId: string,
  filters: TeamFilters = {},
): Promise<TeamWithStatus[]> {
  if (demo.isDemoMode()) return demo.demoTeams(filters);

  const supabase = await createClient();
  let query = supabase.from('teams_view').select('*').eq('campaign_id', campaignId);

  if (filters.faction && filters.faction !== 'all') query = query.eq('faction', filters.faction);
  if (filters.country) query = query.eq('country', filters.country);
  if (filters.city) query = query.eq('city', filters.city);

  switch (filters.sort) {
    case 'participants':
      query = query.order('participant_count', { ascending: false });
      break;
    case 'recent':
      query = query.order('updated_at', { ascending: false });
      break;
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    case 'links':
    default:
      query = query.order('links_created', { ascending: false, nullsFirst: false });
  }

  const data = unwrap(await query, 'teams_view');
  const teams = (data ?? []) as TeamWithStatus[];

  return filters.status && filters.status !== 'all'
    ? teams.filter((t) => t.status === filters.status)
    : teams;
}

export async function getTeam(teamId: string): Promise<TeamWithStatus | null> {
  if (demo.isDemoMode()) return demo.demoTeam(teamId);
  const supabase = await createClient();
  const data = unwrap(await supabase.from('teams_view').select('*').eq('id', teamId).maybeSingle(), 'teams_view');
  return data as TeamWithStatus | null;
}

export async function getTeamMembers(teamId: string): Promise<AgentLifetimeStats[]> {
  if (demo.isDemoMode()) return demo.demoTeamMembers(teamId);
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('team_membership')
    .select('agent_id, agents!inner(id, handle, display_name, avatar_url, faction, country, city)')
    .eq('team_id', teamId), 'team_membership');

  return ((data ?? []) as unknown as Array<{ agents: AgentLifetimeStats }>).map((r) => r.agents);
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export interface AgentDirectoryFilters {
  search?: string;
  country?: string;
  faction?: string;
  campaign?: string;
  sort?: 'name' | 'contribution' | 'campaigns';
  limit?: number;
}

export async function getAgentDirectory(
  filters: AgentDirectoryFilters = {},
): Promise<AgentLifetimeStats[]> {
  if (demo.isDemoMode()) return demo.demoAgentDirectory(filters);

  const supabase = await createClient();
  let query = supabase.from('agent_lifetime_stats').select('*');

  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(
      `handle.ilike.${term},display_name.ilike.${term},country.ilike.${term},city.ilike.${term}`,
    );
  }
  if (filters.country) query = query.eq('country', filters.country);
  // An individual is blue or green. 'crossfaction' is not a valid agent filter
  // here — to find crossfaction participants, filter teams instead.
  if (filters.faction && filters.faction !== 'all' && filters.faction !== 'crossfaction') {
    query = query.eq('faction', filters.faction);
  }

  switch (filters.sort) {
    case 'contribution':
      query = query.order('total_links_created', { ascending: false, nullsFirst: false });
      break;
    case 'campaigns':
      query = query.order('campaigns_participated', { ascending: false });
      break;
    case 'name':
    default:
      query = query.order('handle', { ascending: true });
  }

  const data = unwrap(await query.limit(filters.limit ?? 500), 'agent_lifetime_stats');
  return (data ?? []) as AgentLifetimeStats[];
}

export async function getAgentByHandle(handle: string): Promise<AgentLifetimeStats | null> {
  if (demo.isDemoMode()) return demo.demoAgentByHandle(handle);
  const supabase = await createClient();
  const withAt = handle.startsWith('@') ? handle : `@${handle}`;
  const data = unwrap(await supabase
    .from('agent_lifetime_stats')
    .select('*')
    .eq('handle', withAt)
    .maybeSingle(), 'agent_lifetime_stats');
  return data as AgentLifetimeStats | null;
}

/** An agent's per-campaign history, newest first. Powers /agent/[handle]. */
export async function getAgentParticipation(agentId: string): Promise<
  Array<AgentCampaignStats & { campaign: Pick<Campaign, 'slug' | 'name' | 'status' | 'end_date'> }>
> {
  if (demo.isDemoMode()) return demo.demoAgentParticipation(agentId) as never;

  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('agent_campaign_stats')
    .select('*, campaign:campaigns!inner(slug, name, status, end_date)')
    .eq('agent_id', agentId)
    .order('campaign(end_date)', { ascending: false }), 'agent_campaign_stats');
  return (data ?? []) as never;
}

export async function getCampaignLeaderboard(
  campaignId: string,
  limit = 10,
): Promise<AgentCampaignStats[]> {
  if (demo.isDemoMode()) return demo.demoLeaderboard(limit);

  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('agent_campaign_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('links_created', { ascending: false, nullsFirst: false })
    .limit(limit), 'agent_campaign_stats');
  return (data ?? []) as AgentCampaignStats[];
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function getTeamMedia(teamId: string): Promise<MediaItem[]> {
  // Team galleries are genuinely empty for the 2020 archive - media filenames
  // carry real names while the CSV carries handles, and no mapping exists.
  if (demo.isDemoMode()) return [];

  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('media')
    .select('*')
    .eq('team_id', teamId)
    .order('role', { ascending: true }), 'media');
  return (data ?? []) as MediaItem[];
}

export async function getCampaignMedia(campaignId: string, limit = 60): Promise<MediaItem[]> {
  if (demo.isDemoMode()) return demo.demoCampaignMedia(limit);

  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('media')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('captured_at', { ascending: true })
    .limit(limit), 'media');
  return (data ?? []) as MediaItem[];
}

// ---------------------------------------------------------------------------
// Archive provenance
// ---------------------------------------------------------------------------

/** The frozen "as published" numbers for an archived campaign. */
export async function getArchiveSnapshot(campaignId: string): Promise<ArchiveSnapshot | null> {
  if (demo.isDemoMode()) return demo.demoArchiveSnapshot();
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('campaign_archive_snapshots')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_current', true)
    .maybeSingle(), 'campaign_archive_snapshots');
  return data as ArchiveSnapshot | null;
}

/**
 * The import footnotes for a campaign. Publicly readable by design: a visitor can
 * see exactly which figures were inferred, which were blank in the source, and
 * where two source documents disagreed with each other.
 */
export async function getImportAnomalies(campaignId: string): Promise<ImportAnomaly[]> {
  if (demo.isDemoMode()) return demo.demoAnomalies();
  const supabase = await createClient();
  const data = unwrap(await supabase
    .from('import_anomalies')
    .select('*, import_batches!inner(campaign_id)')
    .eq('import_batches.campaign_id', campaignId)
    .order('severity', { ascending: false }), 'import_anomalies');
  return (data ?? []) as ImportAnomaly[];
}
