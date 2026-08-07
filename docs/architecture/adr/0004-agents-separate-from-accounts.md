# ADR 0004 — Agents are separate from accounts

**Status:** Accepted · **Date:** 2026-08-07

## Context

The handoff models Users (technical accounts) and Agents (public identity) as separate
entities. The historical import made this concrete: **124 real people participated in
2020 and none of them has an account.**

## Decision

`agents` is a first-class table with a **nullable** `profile_id`. An agent can exist with
no account at all. `agents.is_claimed` records whether a real person has taken ownership.

## Why

If agent identity hung off `auth.users`, the 124 imported participants could not be
represented without fabricating 124 accounts with fake emails — inventing data, and
creating login-shaped records nobody can log into.

With the split, an imported agent is a complete public record from day one. When
`@edyuji` signs in with Google years later and claims the handle, we set `profile_id` and
`is_claimed`, and their 2020 participation, links and media are already attached to the
profile they just claimed. Nothing is migrated; a pointer is set.

It also matches how the community actually works. An agent name is a durable public
identity that outlives any particular email address, and one person may change Google
account without ceasing to be the same agent.

## Consequences

- Claiming a handle needs a verification flow (an admin approval step, or proof of
  in-game identity). **Not yet implemented** — `is_claimed` exists but nothing sets it.
  This is the main open item on the auth path.
- RLS on `agents` allows update only when `profile_id = auth.uid()`, so an unclaimed
  agent is immutable to normal users. Admins can correct imported records.
- `campaign_participation.faction`, `.country` and `.city` are per-campaign snapshots
  rather than a single value on the agent, because agents relocate and occasionally
  switch faction. `agent_lifetime_stats.faction_history` surfaces that.
