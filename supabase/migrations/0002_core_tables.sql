-- =============================================================================
-- 0002  Core tables
-- =============================================================================
-- Entity map:
--
--   auth.users (Supabase, Google OAuth)
--        |  1:1
--   profiles ................. the technical account
--        |  1:0..1
--   agents ................... the PUBLIC participant identity, campaign-independent
--        |                     (an agent may exist with NO profile - imported
--        |                      historical agents never signed in)
--        |  M:N via campaign_participation
--   campaigns ................ unlimited; status draft | active | archived
--        |  1:N
--   teams .................... a group working one portal in one campaign
--        |  M:N via team_membership
--   agents
--
--   media .................... polymorphic, attached to campaign | team | agent
--   campaign_archive_snapshots  frozen final numbers for archived campaigns
--   import_batches / import_anomalies  provenance for bulk historical imports
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles - technical authentication accounts
-- -----------------------------------------------------------------------------
-- Deliberately thin. Google is the only identity provider (see ADR 0003).
-- Everything the public sees lives on `agents`, so a participant can rename their
-- agent identity without touching their login.
-- -----------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         citext not null,
  google_sub    text unique,            -- Google's stable subject claim
  full_name     text,
  avatar_url    text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table profiles is
  'Authentication accounts, 1:1 with auth.users. Public identity lives on agents.';

-- -----------------------------------------------------------------------------
-- agents - the public participant identity
-- -----------------------------------------------------------------------------
-- An agent can exist WITHOUT a profile. Every one of the 124 agents imported from
-- The Big Bang is exactly that: a real person who participated in 2020 and has
-- never signed in. If they later sign in with Google and claim the handle, we set
-- profile_id and the history is already theirs.
-- -----------------------------------------------------------------------------
create table agents (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid unique references profiles(id) on delete set null,

  handle            citext not null unique,   -- '@edyuji' - the in-game agent name
  display_name      text not null,
  avatar_url        text,                     -- from Google when available

  faction           agent_faction,            -- an individual is blue OR green
  country           text,
  city              text,

  bio               text,
  is_claimed        boolean not null default false,

  -- provenance
  confidence        data_confidence not null default 'source',
  source_reference  jsonb,                    -- { file, line } into source-data/
  import_batch_id   uuid,                     -- set below via FK once table exists
  notes             text[] not null default '{}',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index agents_country_idx  on agents (country);
create index agents_city_idx     on agents (city);
create index agents_faction_idx  on agents (faction);
-- Directory search: name + handle + country + city, per the /agents requirements.
create index agents_search_idx on agents
  using gin (to_tsvector('simple',
    coalesce(display_name,'') || ' ' || coalesce(handle::text,'') || ' ' ||
    coalesce(country,'')      || ' ' || coalesce(city,'')));

comment on column agents.is_claimed is
  'True once a real person has signed in with Google and taken ownership of this handle.';

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
-- Adding a future campaign is INSERT INTO campaigns. No migration, no code change.
-- Exactly one campaign may be active at a time (partial unique index below).
-- -----------------------------------------------------------------------------
create table campaigns (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  short_name        text,
  description       text,

  status            campaign_status not null default 'draft',
  start_date        date,
  end_date          date,

  hero_image_url    text,
  brand_colour      text,                     -- hex, campaign-specific accent

  -- Free-form per-campaign configuration so new campaign shapes never need DDL:
  -- e.g. { "metric_label": "links created", "supports_teams": true }
  config            jsonb not null default '{}'::jsonb,

  -- provenance
  confidence        data_confidence not null default 'source',
  source_reference  jsonb,
  import_batch_id   uuid,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint campaigns_dates_ordered check (end_date is null or start_date is null or end_date >= start_date)
);

-- At most one active campaign. The homepage always shows "the" active campaign,
-- so this is a real business rule, not a convention.
create unique index campaigns_single_active_idx on campaigns (status) where status = 'active';
create index campaigns_status_idx on campaigns (status, start_date desc);

-- -----------------------------------------------------------------------------
-- teams
-- -----------------------------------------------------------------------------
create table teams (
  id                        uuid primary key default gen_random_uuid(),
  campaign_id               uuid not null references campaigns(id) on delete cascade,
  slug                      text not null,
  name                      text not null,

  faction                   faction_colour not null,  -- may be 'crossfaction'
  country                   text,
  city                      text,
  portal_address            text,
  portal_lat                double precision,
  portal_lng                double precision,

  construction_start_date   date,
  construction_end_date     date,

  links_created             integer check (links_created is null or links_created >= 0),

  -- Denormalised for cheap sorting; refreshed by trigger in 0003.
  participant_count         integer not null default 0,

  submitted_by_profile_id   uuid references profiles(id) on delete set null,
  edit_token                uuid not null default gen_random_uuid(),  -- magic-link editing

  -- provenance
  confidence                data_confidence not null default 'source',
  inference_basis           text,             -- required when confidence <> 'source'
  source_reference          jsonb,
  import_batch_id           uuid,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  unique (campaign_id, slug),
  constraint teams_dates_ordered check (
    construction_end_date is null or construction_start_date is null
    or construction_end_date >= construction_start_date
  ),
  -- Anything not straight from a source file must say why it exists.
  constraint teams_inferred_needs_basis check (
    confidence = 'source' or inference_basis is not null
  )
);

create index teams_campaign_idx  on teams (campaign_id);
create index teams_faction_idx   on teams (campaign_id, faction);
create index teams_country_idx   on teams (campaign_id, country);
create index teams_links_idx     on teams (campaign_id, links_created desc nulls last);
create index teams_updated_idx   on teams (campaign_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- team_membership - agents on a team (the handoff's "Participation")
-- -----------------------------------------------------------------------------
create table team_membership (
  team_id           uuid not null references teams(id) on delete cascade,
  agent_id          uuid not null references agents(id) on delete cascade,
  role              text not null default 'participant',  -- participant | lead | organiser
  confidence        data_confidence not null default 'source',
  source_reference  jsonb,
  created_at        timestamptz not null default now(),
  primary key (team_id, agent_id)
);

create index team_membership_agent_idx on team_membership (agent_id);

-- -----------------------------------------------------------------------------
-- campaign_participation - agent took part in a campaign
-- -----------------------------------------------------------------------------
-- Separate from team_membership on purpose. The Big Bang had NO teams: agents
-- participated in the campaign directly. Without this table that campaign could
-- only be represented by inventing teams, which would corrupt the archive.
-- -----------------------------------------------------------------------------
create table campaign_participation (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references campaigns(id) on delete cascade,
  agent_id          uuid not null references agents(id) on delete cascade,

  faction           agent_faction,   -- faction AT THE TIME of this campaign
  country           text,            -- location at the time; agents move
  city              text,

  links_created     integer check (links_created is null or links_created >= 0),
  -- NULL means "the source did not say". It does NOT mean zero, and the
  -- statistics views are careful to exclude nulls rather than coerce them.
  links_confidence  data_confidence not null default 'source',

  feedback          text,            -- "What did you think of this event?"

  confidence        data_confidence not null default 'source',
  source_reference  jsonb,
  import_batch_id   uuid,
  notes             text[] not null default '{}',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (campaign_id, agent_id)
);

create index campaign_participation_campaign_idx on campaign_participation (campaign_id);
create index campaign_participation_agent_idx    on campaign_participation (agent_id);
create index campaign_participation_country_idx  on campaign_participation (campaign_id, country);

-- -----------------------------------------------------------------------------
-- media - polymorphic, exactly one owner
-- -----------------------------------------------------------------------------
create table media (
  id                uuid primary key default gen_random_uuid(),

  campaign_id       uuid references campaigns(id) on delete cascade,
  team_id           uuid references teams(id)     on delete cascade,
  agent_id          uuid references agents(id)    on delete set null,

  role              media_role not null default 'other',
  storage_bucket    text,                 -- Supabase Storage bucket
  storage_path      text,                 -- object key within the bucket
  external_url      text,                 -- for media not yet uploaded

  -- Link back to the committed manifest so an archived asset is traceable to the
  -- original handoff package even before it has been uploaded.
  source_path       text,
  source_sha256     text,
  is_uploaded       boolean not null default false,

  mime_type         text,
  bytes             bigint,
  width             integer,
  height            integer,
  duration_seconds  numeric,

  caption           text,
  attributed_to     text,                 -- name as it appeared in the source filename
  captured_at       timestamptz,
  captured_at_confidence data_confidence not null default 'unknown',

  confidence        data_confidence not null default 'source',
  source_reference  jsonb,
  import_batch_id   uuid,

  created_at        timestamptz not null default now(),

  constraint media_has_exactly_one_owner check (
    (campaign_id is not null)::int + (team_id is not null)::int + (agent_id is not null)::int >= 1
  ),
  constraint media_has_a_location check (
    (storage_path is not null) or (external_url is not null) or (source_path is not null)
  ),

  -- Natural key for IMPORTED media, so re-running an import is a no-op rather
  -- than a duplicate. Postgres treats NULLs as distinct, so user-uploaded media
  -- (source_path is null) is unaffected and can repeat freely.
  unique (campaign_id, source_path)
);

create index media_campaign_idx on media (campaign_id, role);
create index media_team_idx     on media (team_id, role);
create index media_agent_idx    on media (agent_id);
create index media_pending_idx  on media (is_uploaded) where is_uploaded = false;

-- NOTE ON ORDERING: team_status_of() must be defined AFTER `media`, because it
-- reads from it. Postgres validates the body of a `language sql` function at
-- CREATE time, so defining it earlier fails with "relation media does not exist".

-- -----------------------------------------------------------------------------
-- team_status - COMPUTED, never stored
-- -----------------------------------------------------------------------------
-- The handoff specifies status as a function of dates and media, so it is a
-- generated value. Storing it would let it drift.
-- -----------------------------------------------------------------------------
create or replace function team_status_of(t teams)
returns team_status
language sql
stable
as $$
  select case
    when t.construction_end_date is not null and t.construction_end_date <= current_date
      then 'completed'::team_status
    when exists (
      select 1 from media m
      where m.team_id = t.id and m.role = 'construction_end'
    ) then 'completed'::team_status
    when t.construction_start_date is not null and t.construction_start_date <= current_date
      then 'in_progress'::team_status
    else 'planning'::team_status
  end;
$$;


-- -----------------------------------------------------------------------------
-- campaign_archive_snapshots
-- -----------------------------------------------------------------------------
-- Live statistics are always computed (the handoff forbids hand-maintained stats).
-- But an ARCHIVED campaign's final numbers must never change, even if we later
-- correct a row. A snapshot freezes the numbers as published, and records the
-- organiser's originally-reported figures next to ours when they disagree.
-- -----------------------------------------------------------------------------
create table campaign_archive_snapshots (
  id                     uuid primary key default gen_random_uuid(),
  campaign_id            uuid not null references campaigns(id) on delete cascade,
  taken_at               timestamptz not null default now(),
  is_current             boolean not null default true,

  computed_stats         jsonb not null,   -- what Brill Ops calculated
  source_reported_stats  jsonb,            -- what the organiser originally published
  discrepancies          jsonb,            -- itemised disagreements between the two
  notes                  text,

  created_at             timestamptz not null default now()
);

create unique index campaign_archive_current_idx
  on campaign_archive_snapshots (campaign_id) where is_current;

-- -----------------------------------------------------------------------------
-- import_batches / import_anomalies - provenance for bulk imports
-- -----------------------------------------------------------------------------
-- "Do not silently discard ambiguous or incomplete historical information."
-- Every anomaly the importer hits is written here and is queryable from the app,
-- so the archive can show its own footnotes.
-- -----------------------------------------------------------------------------
create table import_batches (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid references campaigns(id) on delete cascade,
  label             text not null,
  source_directory  text not null,
  script            text not null,
  imported_at       timestamptz not null default now(),
  summary           jsonb not null default '{}'::jsonb
);

create table import_anomalies (
  id                uuid primary key default gen_random_uuid(),
  import_batch_id   uuid not null references import_batches(id) on delete cascade,
  anomaly_type      text not null,     -- e.g. 'blank_links_created', 'duplicate_agent'
  severity          text not null default 'info',
  subject           text,              -- agent handle / country / filename
  source_file       text,
  source_line       integer,
  raw_value         text,
  resolution        text not null,     -- what we did about it, in plain language
  created_at        timestamptz not null default now()
);

create index import_anomalies_batch_idx on import_anomalies (import_batch_id, anomaly_type);

-- Late-bound FKs (import_batches is defined after the tables that reference it).
alter table agents                 add constraint agents_import_batch_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;
alter table campaigns              add constraint campaigns_import_batch_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;
alter table teams                  add constraint teams_import_batch_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;
alter table campaign_participation add constraint participation_import_batch_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;
alter table media                  add constraint media_import_batch_fk
  foreign key (import_batch_id) references import_batches(id) on delete set null;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at               before update on profiles
  for each row execute function set_updated_at();
create trigger agents_updated_at                 before update on agents
  for each row execute function set_updated_at();
create trigger campaigns_updated_at              before update on campaigns
  for each row execute function set_updated_at();
create trigger teams_updated_at                  before update on teams
  for each row execute function set_updated_at();
create trigger campaign_participation_updated_at before update on campaign_participation
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Keep teams.participant_count honest
-- -----------------------------------------------------------------------------
create or replace function refresh_team_participant_count()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.team_id, old.team_id);
begin
  update teams
     set participant_count = (select count(*) from team_membership where team_id = target)
   where id = target;
  return null;
end;
$$;

create trigger team_membership_count_sync
  after insert or delete on team_membership
  for each row execute function refresh_team_participant_count();

-- -----------------------------------------------------------------------------
-- New Google sign-in -> profile row
-- -----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, google_sub, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'sub',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
