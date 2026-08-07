-- Seed entrypoint for `supabase db reset` (local development).
--
-- psql \i is relative to the file being executed, so these resolve correctly
-- when the CLI runs this file.
--
-- For a REMOTE project, `supabase db push` applies migrations only. Use
-- `npm run db:seed` instead, which runs the same two files over a direct
-- connection. See scripts/apply-seed.mjs.

\i seed/001_stars_for_peace.sql
\i seed/002_the_big_bang_2020.sql
