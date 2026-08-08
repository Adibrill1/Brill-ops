# Deployment

Canonical repository: **https://github.com/Adibrill1/Brill-ops**
Everything ships from `main`.

## Hosting: Vercel

Brill Ops is a Next.js App Router app with server components and middleware, so it needs
a Node runtime — not static hosting. Vercel is the natural fit and its free tier is
enough for this.

Connecting the GitHub repo gives automatic deploys: every push to `main` becomes
production, and every pull request gets its own preview URL.

### It deploys before the database exists

The build needs no environment variables. With none set, the app starts in **demo mode**
and serves the 2020 archive from the committed import files (see `src/lib/demo.ts`), so
the first deploy produces a working, browsable site immediately.

That is deliberate: it decouples "is it live?" from "is the backend ready?", so the
hosting and the database can be sorted out one at a time rather than both at once.

## Environment variables

Added in Vercel under **Settings → Environment Variables**. None are required for the
first deploy.

| Variable | When | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Once Supabase exists | Setting this turns demo mode **off**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Once Supabase exists | Safe in the browser; RLS is what protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | Media upload script only | **Bypasses RLS.** Never expose to the browser. Not needed for rendering. |
| `NEXT_PUBLIC_SITE_URL` | Once the domain is known | Used for OAuth redirects. |

Demo mode switches off as soon as `NEXT_PUBLIC_SUPABASE_URL` holds a real value. It is
not a fallback for an unreachable database — a configured-but-broken backend fails loudly
rather than quietly serving stale files.

## Setting up the database

One command, no Supabase CLI:

```bash
npm run db:setup
```

It needs `SUPABASE_DB_URL` in `.env.local` — the Postgres URI from the Supabase
dashboard (**Connect** → **Session pooler**, with `[YOUR-PASSWORD]` replaced). That value
carries the database password, so it is gitignored, is read by this one script, and never
reaches the app, the browser or the repo. Page rendering goes through the anon key and RLS.

Use the **Session pooler** URI rather than **Direct connection**: direct connections are
IPv6-only on newer Supabase projects and will fail with `ENETUNREACH` on most home
networks. The script detects that specific failure and says so.

The script:

- creates a `_brill_ops_migrations` ledger, so re-running skips what is already applied
- stores each migration's SHA-256, and warns if an applied migration has since been edited
- runs each migration in its own transaction — a failure leaves nothing half-applied
- applies both seed files, which are idempotent
- **verifies the result against the importer's figures** (124 agents, 32 teams, 12
  crossfaction, 9,449 links, 4 unknown, 342 media) and exits non-zero if any drift

The Supabase CLI is still supported for local development via `supabase/config.toml`
(`supabase start && supabase db reset`), but it is not needed to set up the hosted project.

## If the site shows empty data over a seeded database

Supabase's REST API caches the schema in memory. `npm run db:setup` talks to Postgres
directly, so the API does not learn about new tables on its own and keeps answering
PGRST205 ("Could not find the table in the schema cache"). The pages then render as if
there were simply no data.

`npm run db:setup` now ends with `notify pgrst, 'reload schema'` on every run, so this
should not recur. Re-running the command is the fix, and it is idempotent.

The app no longer hides this: query errors throw with the relation name, and the error
page names the command.

## The vercel.app subdomain is global

`brill-ops.vercel.app` belongs to a different account entirely — an unrelated product
called ChannelIQ. Vercel assigned this project `brill-ops-three.vercel.app` because the
shorter names were already taken worldwide.

Only the URL shown in your own Vercel dashboard is this project. If you want a name that
cannot be confused, add a custom domain.

## Order of operations

1. **Vercel** → a live URL, running in demo mode.
2. **Supabase** → project, migrations, seeds. Add the two public env vars, redeploy.
3. **Google OAuth** → sign-in, so participants can submit and edit.
4. **Media upload** → push the 342 archive files to the `archive-media` bucket.
5. **Custom domain** → optional, whenever you want one.

Each step leaves the site working. Nothing here is all-or-nothing.

## After the Supabase step

Set the callback URL in Google Cloud and Supabase to:

```
https://<your-vercel-domain>/auth/callback
```

and set `NEXT_PUBLIC_SITE_URL` to the same origin, or OAuth will redirect to localhost.

## Build settings

Vercel detects everything from `package.json`; no `vercel.json` is needed.

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Build command | `npm run build` (default) |
| Output directory | `.next` (default) |
| Install command | `npm install` (default) |
| Node version | 20 or later (`engines` in `package.json`) |
