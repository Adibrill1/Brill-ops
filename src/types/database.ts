/**
 * Domain types for Brill Ops.
 *
 * These are hand-written and describe the shapes the app actually reads — mostly
 * the statistics VIEWS rather than the base tables. Once a Supabase project
 * exists, `npm run db:types` regenerates the full table typings; keep this file
 * as the curated surface the components consume.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Group faction. Blue = Resistance, Green = Enlightened.
 *
 * `crossfaction` is the single word used everywhere in this codebase for a
 * team or cohort containing both. Not "mixed", not "both", not "XF".
 */
export type FactionColour = 'blue' | 'green' | 'crossfaction';

/** An individual is blue or green. Only a *group* can be crossfaction. */
export type AgentFaction = 'blue' | 'green';

export type CampaignStatus = 'draft' | 'active' | 'archived';

export type TeamStatus = 'planning' | 'in_progress' | 'completed';

/**
 * How much a value can be trusted. Anything other than 'source' is rendered
 * with a visible badge — see components/ConfidenceBadge.
 *
 *   source    copied verbatim from a supplied file
 *   computed  derived arithmetically from source values
 *   inferred  reasoned from context; defensible, but never stated in the source
 *   estimated a placeholder chosen so the record is usable
 *   unknown   the source is silent — and deliberately NOT defaulted to zero
 */
export type DataConfidence = 'source' | 'computed' | 'inferred' | 'estimated' | 'unknown';

export type MediaRole =
  | 'hero'
  | 'construction_start'
  | 'construction_end'
  | 'star_screenshot'
  | 'event_photo'
  | 'event_video'
  | 'statistics_screenshot'
  | 'other';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  hero_image_url: string | null;
  brand_colour: string | null;
  config: CampaignConfig;
  confidence: DataConfidence;
}

/**
 * Per-campaign settings live here rather than as columns, which is what lets a
 * new campaign be an INSERT instead of a migration.
 */
export interface CampaignConfig {
  /** What this campaign counts, e.g. "links created". Shown on stat cards. */
  metric_label?: string;
  /** False for campaigns like The Big Bang that had no team structure. */
  supports_teams?: boolean;
  /** True when the campaign's teams were reconstructed during an import. */
  teams_are_inferred?: boolean;
  is_placeholder?: boolean;
  todo?: string[];
  original_submission_method?: string;
  submission_window_end?: string;
}

export interface Agent {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  faction: AgentFaction | null;
  country: string | null;
  city: string | null;
  is_claimed: boolean;
  confidence: DataConfidence;
}

export interface Team {
  id: string;
  campaign_id: string;
  slug: string;
  name: string;
  faction: FactionColour;
  country: string | null;
  country_code?: string | null;
  city: string | null;
  portal_address: string | null;
  construction_start_date: string | null;
  construction_end_date: string | null;
  links_created: number | null;
  participant_count: number;
  confidence: DataConfidence;
  inference_basis: string | null;
}

/** `teams_view` — a team plus its computed status. Status is never stored. */
export interface TeamWithStatus extends Team {
  status: TeamStatus;
  construction_days: number | null;
}

export interface MediaItem {
  id: string;
  campaign_id: string | null;
  team_id: string | null;
  agent_id: string | null;
  role: MediaRole;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  source_path: string | null;
  source_sha256: string | null;
  is_uploaded: boolean;
  mime_type: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  attributed_to: string | null;
  captured_at: string | null;
  captured_at_confidence: DataConfidence;
}

// ---------------------------------------------------------------------------
// Statistics views
// ---------------------------------------------------------------------------

/**
 * `campaign_stats`. Every one of these is computed by SQL on read. Nothing here
 * is ever written by application code — that is the handoff's "no manually
 * maintained statistics" made structural.
 */
export interface CampaignStats {
  campaign_id: string;
  slug: string;
  name: string;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;

  total_agents: number;
  countries: number;
  cities: number;
  total_teams: number;

  total_links_created: number | null;
  /**
   * Participants whose contribution the source never recorded. Displayed
   * alongside totals so a partially-known campaign reads honestly rather than
   * looking artificially small. These are NULL, never zero.
   */
  agents_with_unknown_links: number;
  avg_links_per_team: number | null;

  largest_team: string | null;
  top_country: string | null;
  top_country_code?: string | null;
  top_contributor: string | null;

  media_count: number;
  /** True if any team or participation row in this campaign is not 'source'. */
  contains_inferred_data: boolean;
}

export interface FactionStats {
  campaign_id: string;
  faction_colour: FactionColour;
  agents_count: number;
  teams_count: number;
  links_created: number;
  agents_with_unknown_links: number;
}

export interface CountryStats {
  campaign_id: string;
  country: string;
  country_code?: string | null;
  participants: number;
  total_links: number | null;
  max_links_by_one_agent: number | null;
  participants_with_unknown_links: number;
  cities: number;
}

export interface AgentLifetimeStats {
  agent_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  faction: AgentFaction | null;
  country: string | null;
  country_code?: string | null;
  city: string | null;
  is_claimed: boolean;
  campaigns_participated: number;
  teams_joined: number;
  total_links_created: number | null;
  campaigns_with_unknown_links: number;
  completed_projects: number;
  faction_history: string[];
  first_seen: string | null;
  last_seen: string | null;
}

export interface AgentCampaignStats {
  campaign_id: string;
  agent_id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  faction: AgentFaction | null;
  country: string | null;
  country_code?: string | null;
  city: string | null;
  links_created: number | null;
  links_confidence: DataConfidence;
  is_crossfaction_participant: boolean;
  teams_joined: number;
}

// ---------------------------------------------------------------------------
// Archive provenance
// ---------------------------------------------------------------------------

export interface ArchiveSnapshot {
  id: string;
  campaign_id: string;
  taken_at: string;
  computed_stats: Record<string, number | string | null>;
  /** What the organisers themselves published, kept distinct from our figures. */
  source_reported_stats: Record<string, unknown> | null;
  discrepancies: unknown[] | null;
  notes: string | null;
}

/**
 * A single unresolved oddity from a bulk import. Publicly readable on purpose —
 * the archive shows its own footnotes rather than presenting a tidied fiction.
 */
export interface ImportAnomaly {
  id: string;
  anomaly_type: string;
  severity: 'info' | 'warning' | 'error' | string;
  subject: string | null;
  source_file: string | null;
  source_line: number | null;
  raw_value: string | null;
  resolution: string;
}
