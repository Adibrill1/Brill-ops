# ADR 0001 — Supabase as the backend

**Status:** Accepted · **Date:** 2026-08-07

## Context

The handoff names Supabase as preferred and Firebase as the alternative, and asks for a
PostgreSQL database, authentication, storage buckets and media management.

## Decision

Supabase, using Postgres directly rather than hiding it behind an ORM.

## Why

The requirements are relational and statistical in a way that suits Postgres and fights
Firestore. "Number of countries", "average links per team", "top contributor", "teams
count / agents count / links per faction" are aggregate queries across joins. In
Firestore each of those becomes a maintained counter document — which is precisely the
hand-maintained statistic the handoff forbids.

Concretely, Postgres gives us:

- **Views as the statistics engine.** Every number on the site is a view in
  `0003_statistics_views.sql`. There is no code path that writes a statistic.
- **Row Level Security as the archive guarantee.** "Archived campaigns are immutable" is
  a policy, enforced at the database, not a check someone can forget in a route handler.
- **Real constraints.** `teams_inferred_needs_basis` makes it impossible to insert
  inferred data without stating the basis. A document store cannot express that.
- **A single partial unique index** (`campaigns_single_active_idx`) enforces "exactly one
  active campaign", which is otherwise an application-level race.

Supabase adds Google OAuth, storage buckets with policies over the same auth context, and
generated TypeScript types.

## Consequences

- Statistics are computed per request. Views are cheap at this scale (hundreds of teams,
  thousands of agents). If a campaign ever gets large, the first move is a materialised
  view refreshed on write — not a hand-maintained counter.
- Vendor coupling is real but bounded: the data is ordinary Postgres and the migrations
  are plain SQL. Auth and Storage are the parts that would need replacing.
- Local development needs Docker (`supabase start`).

## Alternatives

**Firebase** — rejected for the counter problem above. **Plain Postgres + custom auth** —
rejected; it is the same schema plus an auth system we would have to write and secure.
