-- =============================================================================
-- 0006  API exposure: close two leaks, make grants explicit, reload the cache
-- =============================================================================
-- All of this came out of diagnosing why the deployed site rendered an empty
-- archive against a database that had been seeded and verified row by row.
--
-- The empty page turned out to be a stale PostgREST cache (section 5). Looking
-- for it surfaced two genuine security holes (sections 1 and 3) and a latent
-- privilege bug (section 2) that had nothing to do with the symptom.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Views ran with the owner's rights, so they bypassed RLS entirely
-- -----------------------------------------------------------------------------
-- A Postgres view executes as its OWNER by default. These views are owned by
-- postgres, so every RLS policy written in migration 0004 was being skipped for
-- anything read through them — which is nearly everything the site reads.
--
-- Concretely: `campaigns` correctly showed anonymous visitors 1 row (the archived
-- campaign), because its policy filters to status in ('active','archived'). But
-- `campaign_stats`, a view over the same table, showed 2 — including the
-- unpublished Stars for Peace draft. Drafts are meant to be invisible until they
-- go live.
--
-- security_invoker makes a view run as the CALLER, so policies apply normally.
-- Requires Postgres 15+; Supabase is well past that.
-- -----------------------------------------------------------------------------
-- Views that do not depend on team_status_of can simply be switched over.
alter view campaign_stats          set (security_invoker = true);
alter view campaign_faction_stats  set (security_invoker = true);
alter view campaign_country_stats  set (security_invoker = true);
alter view agent_campaign_stats    set (security_invoker = true);
alter view active_campaign         set (security_invoker = true);


-- -----------------------------------------------------------------------------
-- 2. team_status_of() took a whole row, which forces whole-table access
-- -----------------------------------------------------------------------------
-- The function was declared as team_status_of(t teams) and called as
-- team_status_of(t.*). Passing `t.*` requires SELECT on EVERY column of teams —
-- including edit_token, the one column we must withhold (section 3).
--
-- Under the old owner-rights views this went unnoticed, because the view ran as
-- postgres and privileges never came into it. The moment the views became
-- security_invoker, every read failed with "permission denied for table teams".
--
-- So the signature takes just what it needs. Narrower arguments are also simply
-- more honest about the function's real dependencies.
-- -----------------------------------------------------------------------------
drop view if exists agent_lifetime_stats;
drop view if exists teams_view;
drop function if exists team_status_of(teams);

create or replace function team_status_of(
  p_team_id     uuid,
  p_start_date  date,
  p_end_date    date
)
returns team_status
language sql
stable
as $$
  select case
    when p_end_date is not null and p_end_date <= current_date
      then 'completed'::team_status
    when exists (
      select 1 from media m
      where m.team_id = p_team_id and m.role = 'construction_end'
    ) then 'completed'::team_status
    when p_start_date is not null and p_start_date <= current_date
      then 'in_progress'::team_status
    else 'planning'::team_status
  end;
$$;

comment on function team_status_of(uuid, date, date) is
  'Planning / In Progress / Completed, computed from dates and uploaded media. Never stored.';


-- -----------------------------------------------------------------------------
-- 3. teams_view leaked edit_token
-- -----------------------------------------------------------------------------
-- The view was `select t.*, ...`, which included teams.edit_token — the UUID that
-- grants edit access to a submission WITHOUT an account. Combined with the
-- owner-rights problem above, that published every team's edit capability to
-- anonymous callers.
--
-- Columns are now enumerated. `select *` in a view over a table holding a secret
-- is the bug; naming columns is the fix, because a sensitive column added later
-- cannot silently re-expose itself.
-- -----------------------------------------------------------------------------
create view teams_view
with (security_invoker = true)
as
select
  t.id,
  t.campaign_id,
  t.slug,
  t.name,
  t.faction,
  t.country,
  t.city,
  t.portal_address,
  t.portal_lat,
  t.portal_lng,
  t.construction_start_date,
  t.construction_end_date,
  t.links_created,
  t.participant_count,
  t.submitted_by_profile_id,
  -- t.edit_token is deliberately NOT exposed.
  t.confidence,
  t.inference_basis,
  t.source_reference,
  t.import_batch_id,
  t.created_at,
  t.updated_at,
  team_status_of(t.id, t.construction_start_date, t.construction_end_date) as status,
  case
    when t.construction_start_date is not null and t.construction_end_date is not null
      then (t.construction_end_date - t.construction_start_date)
  end                                                                     as construction_days
from teams t;

comment on view teams_view is
  'Teams plus computed status. Excludes edit_token, and runs as the caller so RLS applies. See migration 0006.';

-- Rebuilt against the new function signature and as security_invoker.
create view agent_lifetime_stats
with (security_invoker = true)
as
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
  count(distinct t.id) filter (
    where team_status_of(t.id, t.construction_start_date, t.construction_end_date) = 'completed'
  )                                                            as completed_projects,
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
-- 4. Explicit grants
-- -----------------------------------------------------------------------------
-- Supabase's default privileges usually grant these, but that depends on which
-- role ran the migration. Being explicit makes the schema self-contained.
--
-- Broad SELECT is safe because every base table has RLS enabled with its own
-- policy: grants decide who may ASK, policies decide what comes BACK. Now that
-- the views are security_invoker, that is true through the views too.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on
  campaigns, agents, team_membership, campaign_participation, media,
  campaign_archive_snapshots, import_batches, import_anomalies
to anon, authenticated;

grant select on
  teams_view, campaign_stats, campaign_faction_stats, campaign_country_stats,
  agent_campaign_stats, agent_lifetime_stats, active_campaign
to anon, authenticated;

-- `teams` is granted COLUMN BY COLUMN, deliberately.
--
-- A table-level GRANT SELECT covers every column and cannot be partially revoked
-- afterwards — `revoke select (edit_token)` against a table-level grant is a
-- no-op, which an earlier version of this migration got wrong and the validator
-- caught. The only way to withhold one column is to hold no table-level grant at
-- all, so the existing one is revoked first.
--
-- Supabase's default privileges grant SELECT on every new table in `public` to
-- anon and authenticated, so this revoke is doing real work, not tidying up.
revoke select on teams from anon, authenticated;

grant select (
  id, campaign_id, slug, name, faction, country, city,
  portal_address, portal_lat, portal_lng,
  construction_start_date, construction_end_date,
  links_created, participant_count, submitted_by_profile_id,
  confidence, inference_basis, source_reference, import_batch_id,
  created_at, updated_at
) on teams to anon, authenticated;

-- Nobody reads edit_token over the API. When the submission flow is built, the
-- server action returns the token to its creator once, at creation time, using
-- the service role. A capability secret that can be queried is not a secret.

grant insert, update on teams, team_membership, campaign_participation, agents, media
to authenticated;
grant delete on team_membership, media to authenticated;
grant select, update on profiles to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Reload the PostgREST schema cache
-- -----------------------------------------------------------------------------
-- Supabase's REST API keeps the schema in memory. Applying migrations over a
-- direct Postgres connection bypasses the API, so the cache still believes these
-- relations do not exist and every request fails with PGRST205 ("Could not find
-- the table in the schema cache").
--
-- That is what made the deployed site show an empty archive over a correctly
-- seeded database — and, because the app was discarding query errors at the time,
-- it surfaced as "No archived campaigns yet" rather than as a failure.
--
-- Harmless when the cache is already fresh.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
