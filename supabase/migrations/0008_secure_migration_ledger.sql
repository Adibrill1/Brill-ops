-- =============================================================================
-- 0008  Enable RLS on the migration ledger, and sweep anything else that lacks it
-- =============================================================================
-- Supabase's security advisor raised a critical `rls_disabled_in_public` finding.
--
-- The culprit is `_brill_ops_migrations`, the ledger created by
-- scripts/db-setup.mjs. Every table the migrations create has RLS enabled and a
-- policy (0004, 0007) — but the ledger is created by the setup tool, outside the
-- migration files, and so was never covered. Supabase's default privileges then
-- granted SELECT on it to `anon`, leaving it readable by anyone with the project
-- URL.
--
-- The exposure is mild in content: filenames, SHA-256 hashes and timestamps. No
-- campaign, agent or personal data. But it does advertise the schema's shape and
-- change history to anonymous callers, and "mild" is not a reason to leave a
-- table world-readable. Nothing needs to read it except the setup script, which
-- connects as the table owner and bypasses RLS.
--
-- The fix has two halves: close this specific hole, then make the same mistake
-- impossible to repeat quietly.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The ledger
-- -----------------------------------------------------------------------------
-- RLS with NO policy means: deny everything, to everyone except the table owner
-- and roles with BYPASSRLS. That is exactly right here — this table has no
-- legitimate API consumer.
--
-- Guarded by a to_regclass check so this migration is safe on a database where
-- the ledger does not exist, for example one set up through the Supabase CLI
-- rather than scripts/db-setup.mjs.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public._brill_ops_migrations') is not null then
    execute 'alter table public._brill_ops_migrations enable row level security';
    execute 'revoke all on public._brill_ops_migrations from anon, authenticated';

    comment on table public._brill_ops_migrations is
      'Applied-migration ledger, written by scripts/db-setup.mjs. RLS is enabled with '
      'no policies: deny-all except the owner. Nothing should read this over the API.';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. Sweep: any other table in `public` without RLS
-- -----------------------------------------------------------------------------
-- Defence against the general shape of this bug rather than the one instance.
-- Anything created in `public` outside the migration files — by tooling, by hand
-- in the SQL editor, by a future script — inherits Supabase's default grant to
-- `anon` and becomes world-readable unless someone remembers to enable RLS.
--
-- Deliberately additive: enabling RLS on a table that already has policies
-- changes nothing, and every application table already has both. In practice this
-- loop should find nothing. If it does, it RAISES A NOTICE naming the table,
-- because a table appearing here means something was created outside the
-- migrations and deserves a look, not a silent patch.
--
-- Note this makes such a table deny-all rather than merely private. That is the
-- safe direction: a missing policy is visible immediately as "no data", whereas a
-- missing RLS flag is invisible until an advisor email arrives.
-- -----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'              -- ordinary tables only, not views
       and c.relrowsecurity = false
     order by c.relname
  loop
    raise notice 'Enabling RLS on public.% (was missing)', t.relname;
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('revoke all on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;


-- -----------------------------------------------------------------------------
-- 3. Reload the PostgREST schema cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
