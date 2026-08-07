# Brill Ops

**A reusable operating system for global community campaigns.**

Brill Ops is a long-term campaign management platform built for Ingress community
operations and crossfaction global events. It is deliberately *not* a website for one
event. Campaigns are rows in a table, not branches in the code — adding the next one
is an `INSERT`, never a migration.

- **Stars for Peace** is the first campaign to be run natively on the platform.
  It currently exists as a `draft` record with placeholder values, because no
  Stars for Peace material was supplied with the handoff.
- **Operation "The Big Bang"** (31 July 2020) is the first campaign in the Archive,
  imported from six-year-old source material that arrived with the project.

---

## What the platform does

| Area | Behaviour |
| --- | --- |
| **Homepage** | Always renders the single `active` campaign — hero, countdown, live stats, team dashboard, filters, rankings. |
| **Campaigns** | Unlimited. `draft` → `active` → `archived`. Exactly one may be active at a time. |
| **Archive** | A campaign whose `end_date` passes moves to the archive automatically, keeping its dashboard, team cards, galleries, media and final numbers. |
| **Agents** | Every participant has a permanent profile at `/agent/[handle]` spanning all campaigns, plus a searchable directory at `/agents`. |
| **Teams** | Square cards at `/team/[id]` with galleries and a status of Planning / In Progress / Completed, computed from dates and uploaded media — never stored. |
| **Statistics** | Every number on the site is a SQL view over the base tables. There are no hand-maintained statistics anywhere. |
| **Auth** | Google Sign-In via Supabase Auth. |
| **PWA** | Installable, with an "Add Brill Ops to your Home Screen" flow for iOS Safari and Android Chrome. |

### Crossfaction

Ingress has two factions: **Resistance (blue)** and **Enlightened (green)**. Wherever
blue and green participants or teams are combined, the platform uses one word —
**Crossfaction**. It is spelled that way in the database enum, the API, the URL query
parameters and the UI. Not "mixed", not "both", not "XF". An individual agent is blue
or green; only a *group* can be Crossfaction.

---

## Repository layout

```
.
├── src/                      Next.js application (App Router, TypeScript, Tailwind)
│   ├── app/                  routes
│   ├── components/           UI
│   ├── lib/                  Supabase clients, queries, filters
│   └── types/                generated + hand-written types
│
├── supabase/
│   ├── migrations/           schema, statistics views, RLS, storage buckets
│   └── seed/                 001 Stars for Peace (draft) · 002 The Big Bang (generated)
│
├── data/
│   └── archive-imports/      structured, reviewable output of historical imports
│       └── the-big-bang-2020/
│           ├── campaign.json / agents.json / teams.json / media.json
│           ├── source-reported-country-stats.json   organiser's own published figures
│           └── reconciliation.json                  where our numbers disagree with theirs
│
├── scripts/
│   ├── generate-source-manifest.mjs   inventory + checksum every source file
│   ├── import-big-bang.mjs            CSV + screenshots → structured JSON
│   └── generate-archive-seed.mjs      JSON → idempotent SQL
│
├── docs/
│   ├── handoff/              the original brief, preserved verbatim
│   ├── architecture/         data model + ADRs
│   ├── import/               provenance and the full list of assumptions
│   └── ideas-for-future/     (empty in the handoff)
│
└── source-data/              ORIGINAL MATERIALS — read-only, never edited
    ├── MANIFEST.json / .csv  342 files, sizes and SHA-256 checksums
    ├── historical-campaigns/2020-07-the-big-bang/
    └── brand/                (empty in the handoff)
```

### `source-data/` is read-only

Everything under `source-data/` is exactly as it arrived. Scripts read from it and
never write to it. Even after the data has been imported into the database, the
originals stay — the import is a derivative, not a replacement.

**The large binaries are not committed to Git.** The handoff package is ~875 MB and
contains a 185 MB video, which GitHub rejects outright. Instead,
`source-data/MANIFEST.json` — which *is* committed — records every one of the 342
files with its size and SHA-256. To confirm your working copy is intact:

```bash
npm run verify:source
```

That will name any file that is missing or altered. See
[ADR 0002](docs/architecture/adr/0002-media-stays-out-of-git.md) for the reasoning
and the plan for moving the media into Supabase Storage.

---

## Getting started

### See it running in one minute (no database)

```bash
npm install
npm run dev            # http://localhost:3000
```

With no `.env.local`, Brill Ops starts in **demo mode** and serves the archive from the
committed import files in `data/archive-imports/`. That is the real 2020 campaign — 124
agents, 32 country teams, 9,449 links — computed by the same arithmetic the SQL views
use, so the pages show real numbers rather than fixtures.

A banner says so at the top of every page. Sign-in, submissions and uploads are inert in
demo mode; they need the real backend.

### With Supabase

```bash
cp .env.example .env.local        # fill in your Supabase project values
npm run dev
```

Demo mode switches off as soon as `NEXT_PUBLIC_SUPABASE_URL` holds a real value. It is
not a fallback for an unreachable database — a configured-but-broken backend fails
loudly, which is what you want.

### Database

```bash
supabase start                    # local Postgres + Auth + Storage
supabase db reset                 # applies migrations/ then seed/
```

Applied in order:

| File | Purpose |
| --- | --- |
| `0001_enums_and_helpers.sql` | Faction, status and **confidence** enums |
| `0002_core_tables.sql` | profiles, agents, campaigns, teams, membership, participation, media, archive snapshots, import provenance |
| `0003_statistics_views.sql` | every live statistic on the site |
| `0004_rls_policies.sql` | public read, authenticated write, archives immutable |
| `0005_storage_buckets.sql` | `campaign-media`, `archive-media`, `avatars` |

### Google Sign-In

In the Supabase dashboard, enable the Google provider under **Authentication →
Providers**, add your OAuth client ID and secret, and add your callback URL. A new
sign-in automatically creates a `profiles` row via the `on_auth_user_created` trigger;
the user then claims or creates an `agents` record, which is the public identity.

### Re-running the historical import

```bash
node scripts/generate-source-manifest.mjs   # re-inventory source-data/
node scripts/import-big-bang.mjs            # CSV → data/archive-imports/*.json
node scripts/generate-archive-seed.mjs      # JSON → supabase/seed/002_*.sql
```

The JSON files are the editable representation; the SQL is generated and committed so
the seed runs without a Node toolchain.

---

## Data honesty

The 2020 package is incomplete and internally inconsistent — the agent CSV and the
organiser's own country-summary tab were exported days apart and disagree in eight
countries. None of that was smoothed over.

Every table that can hold imported data carries a `confidence` column:

| Value | Meaning |
| --- | --- |
| `source` | copied verbatim from a supplied file |
| `computed` | derived arithmetically from `source` values |
| `inferred` | reasoned from context; defensible, but the source never said it |
| `estimated` | a placeholder chosen so the record is usable |
| `unknown` | the source is silent — and deliberately **not** defaulted to zero |

Anything not marked `source` must carry an `inference_basis` explaining itself; for
`teams` that is a database constraint, not a convention. Import oddities are written to
`import_anomalies`, which is publicly readable, so the archive can display its own
footnotes.

Two things worth knowing before you read any Big Bang number:

- **All 32 teams in that campaign are inferred.** The Big Bang had no teams — it was an
  individual link-creation event. The teams are country groupings that mirror the
  organiser's own "Country Stats" tab.
- **Four agents have an unknown link count**, stored as `NULL`. They are counted as
  participants and excluded from link sums, never counted as zero.

Full detail: [`docs/import/the-big-bang-2020-provenance.md`](docs/import/the-big-bang-2020-provenance.md)
and [`docs/import/assumptions-and-inferred-data.md`](docs/import/assumptions-and-inferred-data.md).

---

## Adding the next campaign

1. `INSERT INTO campaigns` with `status = 'draft'`.
2. Upload a hero image to the `campaign-media` bucket.
3. Set the current active campaign to `archived`, then flip the new one to `active`.

No schema change, no deploy, no code change. Per-campaign quirks (what the metric is
called, whether it uses teams at all) live in the `campaigns.config` JSONB column
rather than in new columns.

---

## Documentation

- [Original project handoff](docs/handoff/01-project-handoff.md)
- [Historical campaign import brief](docs/handoff/02-historical-campaign-import.md)
- [Data model](docs/architecture/data-model.md)
- [ADR 0001 — Supabase as the backend](docs/architecture/adr/0001-supabase-as-backend.md)
- [ADR 0002 — Source media stays out of Git](docs/architecture/adr/0002-media-stays-out-of-git.md)
- [ADR 0003 — Google as the only identity provider](docs/architecture/adr/0003-google-only-auth.md)
- [ADR 0004 — Agents are separate from accounts](docs/architecture/adr/0004-agents-separate-from-accounts.md)
