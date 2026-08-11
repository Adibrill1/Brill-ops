-- =============================================================================
-- 0007  Canonical ISO country codes for accessible, asset-free flags
-- =============================================================================
-- Historical imports store country names verbatim. Keep those names untouched,
-- and associate them with ISO 3166-1 alpha-2 codes in one RLS-protected lookup
-- table. Unknown future values deliberately resolve to NULL (no bogus flag).
-- =============================================================================

create table country_iso_codes (
  country_name text primary key,
  iso_alpha2   text not null check (iso_alpha2 ~ '^[A-Z]{2}$')
);

insert into country_iso_codes (country_name, iso_alpha2) values
  ('Argentina', 'AR'), ('Australia', 'AU'), ('Belarus', 'BY'),
  ('Belgium', 'BE'), ('Bolivia', 'BO'), ('Brazil', 'BR'),
  ('Bulgaria', 'BG'), ('Canada', 'CA'), ('China', 'CN'),
  ('Czechia', 'CZ'), ('Finland', 'FI'), ('France', 'FR'),
  ('Germany', 'DE'), ('Greece', 'GR'), ('India', 'IN'),
  ('Israel', 'IL'), ('Italy', 'IT'), ('Japan', 'JP'),
  ('Luxembourg', 'LU'), ('Mayotte', 'YT'), ('Mexico', 'MX'),
  ('Netherlands', 'NL'), ('Peru', 'PE'), ('Portugal', 'PT'),
  ('Romania', 'RO'), ('Russia', 'RU'), ('Spain', 'ES'),
  ('Sweden', 'SE'), ('Thailand', 'TH'), ('Ukraine', 'UA'),
  ('United Kingdom', 'GB'), ('United States', 'US'),
  -- Accepted aliases for future imports. Codes are intentionally not unique.
  ('Great Britain', 'GB'), ('United States of America', 'US'),
  ('Czech Republic', 'CZ');

alter table country_iso_codes enable row level security;

create policy country_iso_codes_public_read on country_iso_codes
  for select using (true);

grant select on country_iso_codes to anon, authenticated;

create or replace function country_iso_code(input_country text)
returns text
language sql
stable
as $$
  select c.iso_alpha2
  from country_iso_codes c
  where lower(c.country_name) = lower(trim(input_country))
  limit 1;
$$;

comment on function country_iso_code(text) is
  'ISO 3166-1 alpha-2 code for a stored country name; NULL when unknown.';

grant execute on function country_iso_code(text) to anon, authenticated;

-- Append country_code to public views. Existing column order remains intact.
create or replace view teams_view
with (security_invoker = true)
as
select
  t.id, t.campaign_id, t.slug, t.name, t.faction, t.country, t.city,
  t.portal_address, t.portal_lat, t.portal_lng,
  t.construction_start_date, t.construction_end_date,
  t.links_created, t.participant_count, t.submitted_by_profile_id,
  t.confidence, t.inference_basis, t.source_reference, t.import_batch_id,
  t.created_at, t.updated_at,
  team_status_of(t.id, t.construction_start_date, t.construction_end_date) as status,
  case
    when t.construction_start_date is not null and t.construction_end_date is not null
      then (t.construction_end_date - t.construction_start_date)
  end as construction_days,
  country_iso_code(t.country) as country_code
from teams t;

create or replace view agent_campaign_stats
with (security_invoker = true)
as
select
  cp.campaign_id,
  cp.agent_id,
  a.handle,
  a.display_name,
  a.avatar_url,
  coalesce(cp.faction, a.faction) as faction,
  coalesce(cp.country, a.country) as country,
  coalesce(cp.city, a.city) as city,
  cp.links_created,
  cp.links_confidence,
  exists (
    select 1
    from team_membership tm
    join teams t on t.id = tm.team_id
    where tm.agent_id = cp.agent_id
      and t.campaign_id = cp.campaign_id
      and t.faction = 'crossfaction'
  ) as is_crossfaction_participant,
  (select count(*) from team_membership tm
   join teams t on t.id = tm.team_id
   where tm.agent_id = cp.agent_id and t.campaign_id = cp.campaign_id) as teams_joined,
  country_iso_code(coalesce(cp.country, a.country)) as country_code
from campaign_participation cp
join agents a on a.id = cp.agent_id;

create or replace view agent_lifetime_stats
with (security_invoker = true)
as
select
  a.id as agent_id,
  a.handle,
  a.display_name,
  a.avatar_url,
  a.faction,
  a.country,
  a.city,
  a.is_claimed,
  count(distinct cp.campaign_id) as campaigns_participated,
  count(distinct tm.team_id) as teams_joined,
  sum(cp.links_created) as total_links_created,
  count(*) filter (where cp.links_created is null) as campaigns_with_unknown_links,
  count(distinct t.id) filter (
    where team_status_of(t.id, t.construction_start_date, t.construction_end_date) = 'completed'
  ) as completed_projects,
  array_remove(array_agg(distinct cp.faction::text), null) as faction_history,
  min(c.start_date) as first_seen,
  max(c.end_date) as last_seen,
  country_iso_code(a.country) as country_code
from agents a
left join campaign_participation cp on cp.agent_id = a.id
left join campaigns c on c.id = cp.campaign_id
left join team_membership tm on tm.agent_id = a.id
left join teams t on t.id = tm.team_id
group by a.id;

create or replace view campaign_country_stats
with (security_invoker = true)
as
select
  cp.campaign_id,
  coalesce(cp.country, a.country) as country,
  count(distinct cp.agent_id) as participants,
  sum(cp.links_created) as total_links,
  max(cp.links_created) as max_links_by_one_agent,
  count(*) filter (where cp.links_created is null) as participants_with_unknown_links,
  count(distinct coalesce(cp.city, a.city)) as cities,
  country_iso_code(coalesce(cp.country, a.country)) as country_code
from campaign_participation cp
join agents a on a.id = cp.agent_id
where coalesce(cp.country, a.country) is not null
group by 1, 2;

create or replace view campaign_stats
with (security_invoker = true)
as
select
  c.id as campaign_id,
  c.slug,
  c.name,
  c.status,
  c.start_date,
  c.end_date,
  (select count(distinct cp.agent_id) from campaign_participation cp
    where cp.campaign_id = c.id) as total_agents,
  (select count(distinct coalesce(cp.country, a.country))
    from campaign_participation cp join agents a on a.id = cp.agent_id
    where cp.campaign_id = c.id) as countries,
  (select count(distinct coalesce(cp.city, a.city))
    from campaign_participation cp join agents a on a.id = cp.agent_id
    where cp.campaign_id = c.id and coalesce(cp.city, a.city) is not null) as cities,
  (select count(*) from teams t where t.campaign_id = c.id) as total_teams,
  (select sum(cp.links_created) from campaign_participation cp
    where cp.campaign_id = c.id) as total_links_created,
  (select count(*) from campaign_participation cp
    where cp.campaign_id = c.id and cp.links_created is null) as agents_with_unknown_links,
  (select round(avg(t.links_created)::numeric, 1) from teams t
    where t.campaign_id = c.id and t.links_created is not null) as avg_links_per_team,
  (select t.name from teams t where t.campaign_id = c.id
    order by t.participant_count desc nulls last, t.links_created desc nulls last limit 1) as largest_team,
  (select ccs.country from campaign_country_stats ccs where ccs.campaign_id = c.id
    order by ccs.total_links desc nulls last limit 1) as top_country,
  (select acs.handle from agent_campaign_stats acs where acs.campaign_id = c.id
    order by acs.links_created desc nulls last limit 1) as top_contributor,
  (select count(*) from media m where m.campaign_id = c.id
    or m.team_id in (select id from teams where campaign_id = c.id)) as media_count,
  exists (
    select 1 from teams t where t.campaign_id = c.id and t.confidence <> 'source'
    union all
    select 1 from campaign_participation cp
      where cp.campaign_id = c.id and cp.confidence <> 'source'
  ) as contains_inferred_data,
  country_iso_code((select ccs.country from campaign_country_stats ccs
    where ccs.campaign_id = c.id
    order by ccs.total_links desc nulls last limit 1)) as top_country_code
from campaigns c;

notify pgrst, 'reload schema';
