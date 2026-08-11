# Data model

The schema is designed so that adding campaign number seven is an `INSERT`, and so that
imported historical data can never quietly pass itself off as first-hand.

```
                    auth.users  (Supabase, Google OAuth)
                         │ 1:1
                    profiles ──────────────── technical account
                         │ 0..1
                    agents ───────────────── PUBLIC identity, campaign-independent
                       │   │
        ┌──────────────┘   └──────────────┐
        │ M:N                             │ M:N
 team_membership              campaign_participation
        │                                 │
     teams ──────── N:1 ──────── campaigns ──── 1:N ──── campaign_archive_snapshots
        │                             │
        └────────── media ────────────┘
                      │
               import_batches ──── 1:N ──── import_anomalies
```

## The entities

**`profiles`** — authentication only: id (= `auth.users.id`), email, `google_sub`,
`is_admin`. Deliberately thin so a participant can rename their public identity without
touching their login.

**`agents`** — the public participant. `handle` (citext, unique — `@edyuji`),
display name, avatar, faction, country, city. `profile_id` is **nullable**: all 124
agents imported from 2020 have no account and may never have one. See
[ADR 0004](adr/0004-agents-separate-from-accounts.md).

**`campaigns`** — `draft` → `active` → `archived`. A partial unique index enforces at most
one `active` row, because the homepage renders "the" active campaign and that is a real
business rule. Per-campaign quirks live in the `config` JSONB column, not in new columns —
`metric_label`, `supports_teams`, `submission_window_end`. This is what makes "future
campaigns without restructuring" true rather than hopeful.

**`teams`** — a group working one portal in one campaign. `faction` is
`faction_colour`, so it may be **`crossfaction`**. Status is *not* stored — see below.
`edit_token` is a UUID minted on submission that backs the edit-without-an-account URL.

**`team_membership`** — agent ↔ team, with a role. A trigger keeps
`teams.participant_count` in sync so the dashboard can sort by it cheaply.

**`campaign_participation`** — agent ↔ campaign, carrying `links_created`, per-campaign
`faction`/`country`/`city`, and the form's free-text `feedback`.

This table is the reason The Big Bang could be imported honestly. That campaign had **no
teams** — agents participated directly. Without a campaign-level participation table, the
only way to represent it would have been to invent teams, and the invention would have
become indistinguishable from fact. Keeping participation independent of teams also means
the 32 inferred teams can be deleted and rebuilt without touching a single agent record.

**`country_iso_codes`** — the canonical mapping from stored country names to ISO 3166-1
alpha-2 codes. Historical names remain verbatim in their source tables; public views append
`country_code` through `country_iso_code(text)`. Unknown names return `NULL`, so the UI omits
the flag instead of guessing. The table is publicly readable under RLS and contains no
private data.

**`media`** — polymorphic across campaign / team / agent, with a `role`
(`construction_start`, `construction_end`, `star_screenshot`, `event_video`, …). Carries
`source_path` + `source_sha256` pointing into `source-data/MANIFEST.json`, and
`is_uploaded`, so an archived asset is traceable before it reaches Storage.

**`campaign_archive_snapshots`** — frozen final numbers for an archived campaign, holding
`computed_stats`, `source_reported_stats` and `discrepancies` side by side. Live stats are
always computed; a snapshot is what the campaign was *published* as, so a later data
correction cannot silently rewrite history.

**`import_batches` / `import_anomalies`** — provenance for bulk imports. Publicly
readable by design: the archive displays its own footnotes.

## Two things that are computed, not stored

**Statistics.** Every number on the site is a view in `0003_statistics_views.sql` —
`campaign_stats`, `campaign_faction_stats`, `campaign_country_stats`,
`agent_lifetime_stats`. There is no code path anywhere that writes a statistic. The
handoff's "no manually maintained statistics should exist" is structural.

**Team status.** `team_status_of(teams)` derives Planning / In Progress / Completed from
`construction_start_date`, `construction_end_date` and the presence of
`construction_end` media, exactly as the handoff defines it. Exposed via `teams_view`. A
stored copy would drift the moment someone backdates a photo.

## Crossfaction

`faction_colour` is `('blue', 'green', 'crossfaction')` and applies to **groups**.
`agent_faction` is `('blue', 'green')` and applies to **individuals** — nobody is
personally crossfaction.

The homepage's "Crossfaction agents" figure therefore means *agents who worked on a
crossfaction team*, computed in `campaign_faction_stats` via
`is_crossfaction_participant`. The word is spelled `crossfaction` in the enum, the query
params and the UI, everywhere, always.

## Confidence

Every table that can hold imported data carries `confidence data_confidence`:
`source` · `computed` · `inferred` · `estimated` · `unknown`.

Two rules give this teeth:

1. `teams_inferred_needs_basis` — a CHECK constraint making it **impossible** to insert a
   team with `confidence <> 'source'` and no `inference_basis`. Guessing is allowed;
   guessing silently is not.
2. `links_created` is nullable and `NULL` means *the source was silent*. It is never
   coerced to zero. Every view that sums links also reports
   `agents_with_unknown_links`, so a partially-known campaign reads honestly instead of
   looking small.

## Security posture

Public read on the exhibit; authenticated write; you may edit only what you submitted;
**archived campaigns are immutable to everyone but admins**, enforced by
`campaign_is_editable()` in RLS rather than by convention. Details in
`0004_rls_policies.sql`.

## Adding a campaign

```sql
insert into campaigns (slug, name, description, start_date, end_date, status, config)
values ('winter-lights-2027', 'Winter Lights', '…', '2027-01-15', '2027-01-31', 'draft',
        '{"metric_label": "links created", "supports_teams": true}'::jsonb);
```

Then upload a hero image, archive the outgoing campaign, and set this one to `active`.
No migration. No deploy. No code change.
