-- =============================================================================
-- 0003  Live statistics
-- =============================================================================
-- "No manually maintained statistics should exist." Everything the homepage shows
-- is defined here as a view over the base tables.
--
-- One rule runs through all of it: a NULL links_created means "the source did not
-- say", and is never coerced to zero. Counts of contributors and sums of links are
-- therefore reported alongside `agents_with_unknown_links`, so a partially-known
-- campaign reads honestly instead of looking artificially small.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- teams_view - teams with their computed status
-- -----------------------------------------------------------------------------
create or replace view teams_view as
select
  t.*,
  team_status_of(t.*)                                          as status,
  case
    when t.construction_start_date is not null and t.construction_end_date is not null
      then (t.construction_end_date - t.construction_start_date)
  end                                                          as construction_days
from teams t;

-- -----------------------------------------------------------------------------
-- agent_campaign_stats - one row per agent per campaign
-- -----------------------------------------------------------------------------
create or replace view agent_campaign_stats as
select
  cp.campaign_id,
  cp.agent_id,
  a.handle,
  a.display_name,
  a.avatar_url,
  coalesce(cp.faction, a.faction)                              as faction,
  coalesce(cp.country, a.country)                              as country,
  coalesce(cp.city, a.city)                                    as city,
  cp.links_created,
  cp.links_confidence,
  -- An agent is "crossfaction" in a campaign when at least one team they were on
  -- in that campaign was itself crossfaction.
  exists (
    select 1
      from team_membership tm
      join teams t on t.id = tm.team_id
     where tm.agent_id = cp.agent_id
       and t.campaign_id = cp.campaign_id
       and t.faction = 'crossfaction'
  )                                                            as is_crossfaction_participant,
  (select count(*) from team_membership tm
     join teams t on t.id = tm.team_id
    where tm.agent_id = cp.agent_id and t.campaign_id = cp.campaign_id)
                                                               as teams_joined
from campaign_participation cp
join agents a on a.id = cp.agent_id;

-- -----------------------------------------------------------------------------
-- agent_lifetime_stats - powers /agent/[id] and the /agents directory
-- -----------------------------------------------------------------------------
create or replace view agent_lifetime_stats as
select
  a.id                                                         as agent_id,
  a.handle,
  a.display_name,
  a.avatar_url,
  a.faction,
  a.country,
  a.city,
  a.is_claimed,
  count(distinct cp.campaign_id)                               as campaigns_participated,
  count(distinct tm.team_id)                                   as teams_joined,
  sum(cp.links_created)                                        as total_links_created,
  count(*) filter (where cp.links_created is null)             as campaigns_with_unknown_links,
  count(distinct t.id) filter (where team_status_of(t.*) = 'completed')
                                                               as completed_projects,
  -- Faction history: every faction this agent has ever been recorded under.
  array_remove(array_agg(distinct cp.faction::text), null)     as faction_history,
  min(c.start_date)                                            as first_seen,
  max(c.end_date)                                              as last_seen
from agents a
left join campaign_participation cp on cp.agent_id = a.id
left join campaigns c               on c.id = cp.campaign_id
left join team_membership tm        on tm.agent_id = a.id
left join teams t                   on t.id = tm.team_id
group by a.id;

-- -----------------------------------------------------------------------------
-- campaign_faction_stats - the Blue / Green / Crossfaction breakdown
-- -----------------------------------------------------------------------------
-- Note the asymmetry, which is intentional and matches the handoff:
--   * blue / green agent counts come from the agent's own faction
--   * the CROSSFACTION row counts agents who worked on a crossfaction TEAM,
--     because no individual is themselves crossfaction.
-- -----------------------------------------------------------------------------
create or replace view campaign_faction_stats as
with agent_side as (
  select
    campaign_id,
    case when is_crossfaction_participant then 'crossfaction'
         else faction::text end                                as faction_colour,
    agent_id,
    links_created
  from agent_campaign_stats
  where faction is not null or is_crossfaction_participant
),
team_side as (
  select campaign_id, faction::text as faction_colour, id as team_id, links_created
  from teams
)
select
  coalesce(a.campaign_id, t.campaign_id)                       as campaign_id,
  coalesce(a.faction_colour, t.faction_colour)                 as faction_colour,
  coalesce(a.agents_count, 0)                                  as agents_count,
  coalesce(t.teams_count, 0)                                   as teams_count,
  coalesce(a.links_created, 0)                                 as links_created,
  coalesce(a.agents_with_unknown_links, 0)                     as agents_with_unknown_links
from (
  select campaign_id, faction_colour,
         count(distinct agent_id)                              as agents_count,
         sum(links_created)                                    as links_created,
         count(*) filter (where links_created is null)         as agents_with_unknown_links
    from agent_side group by 1, 2
) a
full outer join (
  select campaign_id, faction_colour,
         count(*)                                              as teams_count
    from team_side group by 1, 2
) t on t.campaign_id = a.campaign_id and t.faction_colour = a.faction_colour;

-- -----------------------------------------------------------------------------
-- campaign_country_stats - powers the country filter and the archive map
-- -----------------------------------------------------------------------------
create or replace view campaign_country_stats as
select
  cp.campaign_id,
  coalesce(cp.country, a.country)                              as country,
  count(distinct cp.agent_id)                                  as participants,
  sum(cp.links_created)                                        as total_links,
  max(cp.links_created)                                        as max_links_by_one_agent,
  count(*) filter (where cp.links_created is null)             as participants_with_unknown_links,
  count(distinct coalesce(cp.city, a.city))                    as cities
from campaign_participation cp
join agents a on a.id = cp.agent_id
where coalesce(cp.country, a.country) is not null
group by 1, 2;

-- -----------------------------------------------------------------------------
-- campaign_stats - the single row the homepage and archive cards read
-- -----------------------------------------------------------------------------
create or replace view campaign_stats as
select
  c.id                                                         as campaign_id,
  c.slug,
  c.name,
  c.status,
  c.start_date,
  c.end_date,

  -- participation
  (select count(distinct cp.agent_id)
     from campaign_participation cp where cp.campaign_id = c.id)          as total_agents,
  (select count(distinct coalesce(cp.country, a.country))
     from campaign_participation cp join agents a on a.id = cp.agent_id
    where cp.campaign_id = c.id)                                          as countries,
  (select count(distinct coalesce(cp.city, a.city))
     from campaign_participation cp join agents a on a.id = cp.agent_id
    where cp.campaign_id = c.id and coalesce(cp.city, a.city) is not null) as cities,
  (select count(*) from teams t where t.campaign_id = c.id)               as total_teams,

  -- global metrics
  (select sum(cp.links_created)
     from campaign_participation cp where cp.campaign_id = c.id)          as total_links_created,
  (select count(*) from campaign_participation cp
    where cp.campaign_id = c.id and cp.links_created is null)             as agents_with_unknown_links,
  (select round(avg(t.links_created)::numeric, 1)
     from teams t where t.campaign_id = c.id and t.links_created is not null) as avg_links_per_team,

  (select t.name from teams t
    where t.campaign_id = c.id
    order by t.participant_count desc nulls last, t.links_created desc nulls last
    limit 1)                                                              as largest_team,
  (select ccs.country from campaign_country_stats ccs
    where ccs.campaign_id = c.id
    order by ccs.total_links desc nulls last limit 1)                     as top_country,
  (select acs.handle from agent_campaign_stats acs
    where acs.campaign_id = c.id
    order by acs.links_created desc nulls last limit 1)                   as top_contributor,

  -- media
  (select count(*) from media m where m.campaign_id = c.id
      or m.team_id in (select id from teams where campaign_id = c.id))    as media_count,

  -- honesty flag: does this campaign contain any non-source data?
  exists (
    select 1 from teams t where t.campaign_id = c.id and t.confidence <> 'source'
    union all
    select 1 from campaign_participation cp
     where cp.campaign_id = c.id and cp.confidence <> 'source'
  )                                                                       as contains_inferred_data
from campaigns c;

comment on view campaign_stats is
  'Single source of truth for campaign headline numbers. Never write these values by hand.';

-- -----------------------------------------------------------------------------
-- active_campaign - the homepage
-- -----------------------------------------------------------------------------
create or replace view active_campaign as
select c.*, s.total_agents, s.total_teams, s.countries, s.cities, s.total_links_created
from campaigns c
join campaign_stats s on s.campaign_id = c.id
where c.status = 'active'
limit 1;

-- -----------------------------------------------------------------------------
-- auto-archive: a campaign whose end_date has passed moves to the archive
-- -----------------------------------------------------------------------------
-- Call from a Supabase scheduled function (pg_cron) once a day:
--   select archive_finished_campaigns();
-- -----------------------------------------------------------------------------
create or replace function archive_finished_campaigns()
returns integer
language plpgsql
as $$
declare
  moved integer;
begin
  with updated as (
    update campaigns
       set status = 'archived'
     where status = 'active'
       and end_date is not null
       and end_date < current_date
    returning id
  )
  select count(*) into moved from updated;
  return moved;
end;
$$;
