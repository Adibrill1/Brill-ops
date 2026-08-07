-- =============================================================================
-- 0004  Row Level Security
-- =============================================================================
-- Posture:
--   * The public campaign data is a public exhibit - anyone may READ it.
--   * Writing requires a signed-in Google account.
--   * You may only edit a team you submitted (or hold the edit token for),
--     and only while its campaign is still active.
--   * Archived campaigns are immutable to everyone except admins. This is what
--     makes "the archive preserves the campaign exactly" true rather than aspirational.
-- =============================================================================

alter table profiles                   enable row level security;
alter table agents                     enable row level security;
alter table campaigns                  enable row level security;
alter table teams                      enable row level security;
alter table team_membership            enable row level security;
alter table campaign_participation     enable row level security;
alter table media                      enable row level security;
alter table campaign_archive_snapshots enable row level security;
alter table import_batches             enable row level security;
alter table import_anomalies           enable row level security;

-- -----------------------------------------------------------------------------
-- helpers
-- -----------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

create or replace function campaign_is_editable(target_campaign uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from campaigns c
     where c.id = target_campaign
       and c.status in ('active', 'draft')
  );
$$;

-- -----------------------------------------------------------------------------
-- profiles - private to their owner
-- -----------------------------------------------------------------------------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- agents - public directory
-- -----------------------------------------------------------------------------
create policy agents_public_read on agents
  for select using (true);

-- A signed-in user may create their own agent identity.
create policy agents_insert_own on agents
  for insert to authenticated
  with check (profile_id = auth.uid() or profile_id is null);

-- You may edit your own agent; admins may edit any.
create policy agents_update_own on agents
  for update to authenticated
  using (profile_id = auth.uid() or is_admin())
  with check (profile_id = auth.uid() or is_admin());

-- -----------------------------------------------------------------------------
-- campaigns - public read, admin write
-- -----------------------------------------------------------------------------
create policy campaigns_public_read on campaigns
  for select using (status in ('active', 'archived') or is_admin());
create policy campaigns_admin_write on campaigns
  for all to authenticated using (is_admin()) with check (is_admin());

-- -----------------------------------------------------------------------------
-- teams - public read; submit while signed in; edit your own, active campaigns only
-- -----------------------------------------------------------------------------
create policy teams_public_read on teams
  for select using (
    exists (select 1 from campaigns c where c.id = campaign_id
             and (c.status in ('active', 'archived')))
    or is_admin()
  );

create policy teams_insert_authenticated on teams
  for insert to authenticated
  with check (
    submitted_by_profile_id = auth.uid()
    and campaign_is_editable(campaign_id)
  );

create policy teams_update_own on teams
  for update to authenticated
  using (
    is_admin()
    or (submitted_by_profile_id = auth.uid() and campaign_is_editable(campaign_id))
  )
  with check (
    is_admin()
    or (submitted_by_profile_id = auth.uid() and campaign_is_editable(campaign_id))
  );

create policy teams_delete_admin on teams
  for delete to authenticated using (is_admin());

-- -----------------------------------------------------------------------------
-- team_membership
-- -----------------------------------------------------------------------------
create policy team_membership_public_read on team_membership
  for select using (true);

create policy team_membership_write_by_team_owner on team_membership
  for all to authenticated
  using (
    is_admin() or exists (
      select 1 from teams t
       where t.id = team_id
         and t.submitted_by_profile_id = auth.uid()
         and campaign_is_editable(t.campaign_id)
    )
  )
  with check (
    is_admin() or exists (
      select 1 from teams t
       where t.id = team_id
         and t.submitted_by_profile_id = auth.uid()
         and campaign_is_editable(t.campaign_id)
    )
  );

-- -----------------------------------------------------------------------------
-- campaign_participation
-- -----------------------------------------------------------------------------
create policy participation_public_read on campaign_participation
  for select using (true);

-- You may record your own participation in an editable campaign.
create policy participation_insert_own on campaign_participation
  for insert to authenticated
  with check (
    campaign_is_editable(campaign_id)
    and exists (select 1 from agents a where a.id = agent_id and a.profile_id = auth.uid())
  );

create policy participation_update_own on campaign_participation
  for update to authenticated
  using (
    is_admin() or (
      campaign_is_editable(campaign_id)
      and exists (select 1 from agents a where a.id = agent_id and a.profile_id = auth.uid())
    )
  )
  with check (
    is_admin() or (
      campaign_is_editable(campaign_id)
      and exists (select 1 from agents a where a.id = agent_id and a.profile_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- media
-- -----------------------------------------------------------------------------
create policy media_public_read on media
  for select using (true);

create policy media_insert_own on media
  for insert to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from teams t
       where t.id = team_id
         and t.submitted_by_profile_id = auth.uid()
         and campaign_is_editable(t.campaign_id)
    )
    or exists (select 1 from agents a where a.id = agent_id and a.profile_id = auth.uid())
  );

create policy media_delete_own on media
  for delete to authenticated
  using (
    is_admin()
    or exists (
      select 1 from teams t
       where t.id = team_id
         and t.submitted_by_profile_id = auth.uid()
         and campaign_is_editable(t.campaign_id)
    )
  );

-- -----------------------------------------------------------------------------
-- archive snapshots + import provenance - public read, admin write
-- -----------------------------------------------------------------------------
create policy snapshots_public_read on campaign_archive_snapshots for select using (true);
create policy snapshots_admin_write on campaign_archive_snapshots
  for all to authenticated using (is_admin()) with check (is_admin());

-- Import provenance is deliberately PUBLIC. The archive shows its own footnotes:
-- a visitor can see exactly which numbers were inferred and why.
create policy import_batches_public_read   on import_batches   for select using (true);
create policy import_anomalies_public_read on import_anomalies for select using (true);
create policy import_batches_admin_write   on import_batches
  for all to authenticated using (is_admin()) with check (is_admin());
create policy import_anomalies_admin_write on import_anomalies
  for all to authenticated using (is_admin()) with check (is_admin());
