# ADR 0003 — Google is the only identity provider

**Status:** Accepted · **Date:** 2026-08-07

## Context

The handoff specifies Google Sign-In, and separately says participants must be able to
return and edit a submission, listing three possible mechanisms: an authenticated Google
account, a magic link, or a unique editing URL.

## Decision

**Google OAuth via Supabase Auth is the only way to log in.** No email/password, no
other providers.

Editing without an account is handled separately by `teams.edit_token`, a UUID generated
on submission, which yields a unique editing URL. That is a capability grant, not an
identity.

## Why

Sign-in and edit-access are different problems and conflating them produces a weak auth
system. Google gives verified email and a profile picture for free — and the handoff
wants agent avatars "from Google if available", so the provider is doing real work
beyond authentication.

Restricting to one provider also keeps account linking simple: `profiles.google_sub`
stores Google's stable subject claim, so an email change does not orphan an account.

## Consequences

- Anyone without a Google account cannot sign in. Acceptable for this community, and the
  edit-token path means they can still correct a submission.
- Requires a Google Cloud OAuth client and the provider enabled in Supabase.
- `on_auth_user_created` creates the `profiles` row automatically; the user then claims or
  creates an `agents` record (see ADR 0004).
