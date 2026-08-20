-- =============================================================================
-- 0009  Pin search_path on every function
-- =============================================================================
-- Clears Supabase's `function_search_path_mutable` warnings.
--
-- A function without a pinned search_path resolves unqualified names using
-- whatever search_path the CALLER happens to have. Postgres also puts `pg_temp`
-- first by default, so anyone able to create a temporary object can shadow a
-- table or function the body refers to and have their version run instead.
--
-- That is a genuine privilege-escalation route for the two SECURITY DEFINER
-- functions here, `is_admin()` and `handle_new_user()` — both already pinned
-- when they were written. The remaining eight run as the invoker, so the risk is
-- lower, but the fix costs nothing and "lower" is not "none": campaign_is_editable()
-- is called from inside RLS policies, and a shadowed `campaigns` table there
-- would decide whether a write is allowed.
--
-- ALTER FUNCTION is used rather than redefining, so the bodies stay in the
-- migrations that own them and this file cannot drift from them.
--
-- `public, pg_temp` with pg_temp LAST is the point: naming it explicitly demotes
-- it from its implicit first position, which is what closes the shadowing route.
-- =============================================================================

alter function set_updated_at()                              set search_path = public, pg_temp;
alter function slugify(text)                                 set search_path = public, pg_temp;
alter function team_status_of(uuid, date, date)              set search_path = public, pg_temp;
alter function refresh_team_participant_count()              set search_path = public, pg_temp;
alter function archive_finished_campaigns()                  set search_path = public, pg_temp;
alter function campaign_is_editable(uuid)                    set search_path = public, pg_temp;

-- Already pinned at definition; restated so this file is the single answer to
-- "is every function pinned?" rather than "every function except two".
alter function is_admin()                                    set search_path = public, pg_temp;
alter function handle_new_user()                             set search_path = public, pg_temp;

-- Added by migration 0007. Guarded because that migration arrived separately and
-- may not be present on every database.
do $$
begin
  if to_regprocedure('public.country_iso_code(text)') is not null then
    execute 'alter function country_iso_code(text) set search_path = public, pg_temp';
  end if;
end $$;

notify pgrst, 'reload schema';
