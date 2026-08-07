import { createClient } from '@/lib/supabase/server';
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
 */

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/**
 * The campaign the homepage renders. Returns null when nothing is active — which
 * is the current state, since Stars for Peace is still a draft awaiting real
 * dates and branding.
 */
export async function getActiveCampaign(): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();
  return data as Campaign | null;
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('campaigns').select('*').eq('slug', slug).maybeSingle();
  return data as Campaign | null;
}

export async function getArchivedCampaigns(): Promise<CampaignStats[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_stats')
    .select('*')
    .eq('status', 'archived')
    .order('end_date', { ascending: false });
  return (data ?? []) as CampaignStats[];
}

export async function getCampaignStats(campaignId: string): Promise<CampaignStats | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();
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
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_faction_stats')
    .select('*')
    .eq('campaign_id', campaignId);
  return (data ?? []) as FactionStats[];
}

export async function getCountryStats(campaignId: string): Promise<CountryStats[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_country_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('total_links', { ascending: false, nullsFirst: false });
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

  const { data } = await query;
  const teams = (data ?? []) as TeamWithStatus[];

  return filters.status && filters.status !== 'all'
    ? teams.filter((t) => t.status === filters.status)
    : teams;
}

export async function getTeam(teamId: string): Promise<TeamWithStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('teams_view').select('*').eq('id', teamId).maybeSingle();
  return data as TeamWithStatus | null;
}

export async function getTeamMembers(teamId: string): Promise<AgentLifetimeStats[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('team_membership')
    .select('agent_id, agents!inner(id, handle, display_name, avatar_url, faction, country, city)')
    .eq('team_id', teamId);

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

  const { data } = await query.limit(filters.limit ?? 500);
  return (data ?? []) as AgentLifetimeStats[];
}

export async function getAgentByHandle(handle: string): Promise<AgentLifetimeStats | null> {
  const supabase = await createClient();
  const withAt = handle.startsWith('@') ? handle : `@${handle}`;
  const { data } = await supabase
    .from('agent_lifetime_stats')
    .select('*')
    .eq('handle', withAt)
    .maybeSingle();
  return data as AgentLifetimeStats | null;
}

/** An agent's per-campaign history, newest first. Powers /agent/[handle]. */
export async function getAgentParticipation(agentId: string): Promise<
  Array<AgentCampaignStats & { campaign: Pick<Campaign, 'slug' | 'name' | 'status' | 'end_date'> }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_campaign_stats')
    .select('*, campaign:campaigns!inner(slug, name, status, end_date)')
    .eq('agent_id', agentId)
    .order('campaign(end_date)', { ascending: false });
  return (data ?? []) as never;
}

export async function getCampaignLeaderboard(
  campaignId: string,
  limit = 10,
): Promise<AgentCampaignStats[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('agent_campaign_stats')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('links_created', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []) as AgentCampaignStats[];
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export async function getTeamMedia(teamId: string): Promise<MediaItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('media')
    .select('*')
    .eq('team_id', teamId)
    .order('role', { ascending: true });
  return (data ?? []) as MediaItem[];
}

export async function getCampaignMedia(campaignId: string, limit = 60): Promise<MediaItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('media')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('captured_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as MediaItem[];
}

// ---------------------------------------------------------------------------
// Archive provenance
// ---------------------------------------------------------------------------

/** The frozen "as published" numbers for an archived campaign. */
export async function getArchiveSnapshot(campaignId: string): Promise<ArchiveSnapshot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaign_archive_snapshots')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('is_current', true)
    .maybeSingle();
  return data as ArchiveSnapshot | null;
}

/**
 * The import footnotes for a campaign. Publicly readable by design: a visitor can
 * see exactly which figures were inferred, which were blank in the source, and
 * where two source documents disagreed with each other.
 */
export async function getImportAnomalies(campaignId: string): Promise<ImportAnomaly[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('import_anomalies')
    .select('*, import_batches!inner(campaign_id)')
    .eq('import_batches.campaign_id', campaignId)
    .order('severity', { ascending: false });
  return (data ?? []) as ImportAnomaly[];
}
