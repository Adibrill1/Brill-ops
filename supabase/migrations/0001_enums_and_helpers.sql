-- =============================================================================
-- 0001  Enums, extensions and shared helpers
-- =============================================================================
-- Brill Ops is a multi-campaign platform. Nothing in this schema names a specific
-- campaign; "Stars for Peace" and "The Big Bang" are rows, not tables.
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive agent handles

-- -----------------------------------------------------------------------------
-- Faction vocabulary
-- -----------------------------------------------------------------------------
-- Ingress has two factions: Resistance (blue) and Enlightened (green).
-- Brill Ops speaks in COLOURS, because a team may contain both.
--
-- A team containing both blue and green agents is called CROSSFACTION.
-- That word is used everywhere in this codebase - in the database, the API, the
-- URL query params and the UI. Never "mixed", never "both", never "XF".
-- -----------------------------------------------------------------------------
create type faction_colour as enum ('blue', 'green', 'crossfaction');

-- An individual agent is blue or green. Only a *group* can be crossfaction.
-- Enforced by check constraints on agents / campaign_participation below.
create type agent_faction as enum ('blue', 'green');

create type campaign_status as enum ('draft', 'active', 'archived');

create type team_status as enum ('planning', 'in_progress', 'completed');

create type media_role as enum (
  'hero',                  -- campaign or team hero image
  'construction_start',    -- "start photo" in the handoff
  'construction_end',      -- "end photos"
  'star_screenshot',       -- in-game screenshot of the completed link star
  'event_photo',
  'event_video',
  'statistics_screenshot', -- organiser's own stats exports
  'other'
);

-- -----------------------------------------------------------------------------
-- Provenance vocabulary
-- -----------------------------------------------------------------------------
-- The 2020 handoff package is incomplete and internally inconsistent. Rather than
-- guessing and forgetting that we guessed, every table that can hold imported data
-- carries a confidence marker. The UI renders anything that is not 'source' with a
-- visible "estimated" badge (see src/components/ConfidenceBadge.tsx).
-- -----------------------------------------------------------------------------
create type data_confidence as enum (
  'source',    -- copied verbatim from a supplied source file
  'computed',  -- derived arithmetically from 'source' values
  'inferred',  -- reasoned from context; defensible but not stated in the source
  'estimated', -- a placeholder chosen so the record is usable
  'unknown'    -- the source is silent; deliberately NOT defaulted to zero
);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- slugify - used for stable, human-readable public identifiers
-- -----------------------------------------------------------------------------
create or replace function slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;
