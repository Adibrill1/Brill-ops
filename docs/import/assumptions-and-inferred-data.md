# Assumptions and inferred data

Every decision made during setup that was **not** stated in the handoff. Each entry says
what was assumed, why, how it is flagged in the system, and what would overturn it.

Nothing here is hidden in code. If a row in the database is affected, it carries
`confidence <> 'source'` and the reason travels with it.

---

## A. Stars for Peace

### A1 — The campaign was created as a `draft` with placeholder values

**Assumed:** Stars for Peace should exist as a record now, not be deferred.

**Why:** The handoff names it as the first active campaign, but the package contained no
material for it at all — `Assets/`, `Branding/` and `Ideas for Future/` were empty
directories containing only macOS `.DS_Store` files. Creating a `draft` record proves the
campaign machinery works end to end without asserting facts nobody supplied.

**Flagged as:** `campaigns.confidence = 'estimated'`, `config.is_placeholder = true`, and
a `config.todo` array listing exactly what must be filled in.

**To resolve:** edit `supabase/seed/001_stars_for_peace.sql` with real name, dates,
description and hero image, set `confidence = 'source'`, then flip `status` to `'active'`.

### A2 — Stars for Peace is not the active campaign yet

**Assumed:** the platform ships with **no** active campaign.

**Why:** the schema permits only one active campaign, and activating a placeholder would
put invented copy and a null countdown on the homepage. The homepage handles the
no-active-campaign case explicitly and points at the Archive.

---

## B. The Big Bang import

### B1 — Teams were inferred from countries

**Assumed:** 32 country groupings become 32 teams.

**Why:** the campaign had no teams; the organiser's own `Country Stats1` tab already
grouped agents by country with participants / total links / top agent, which is the shape
of a team card. Full reasoning in
[the provenance doc, §7](the-big-bang-2020-provenance.md#7-teams-the-one-substantial-inference).

**Flagged as:** `teams.confidence = 'inferred'` on all 32, each with an
`inference_basis`. Enforced by the `teams_inferred_needs_basis` constraint.

**To overturn:** if real team data surfaces, delete the inferred teams and re-import —
`campaign_participation` is independent of teams by design, so agent records survive.

### B2 — A team is Crossfaction when its members are not all one colour

**Assumed:** faction is derived from membership; all-blue → `blue`, all-green → `green`,
any mix → `crossfaction`.

**Why:** this is the definition the handoff uses, and it produced 12 Crossfaction, 15
blue and 5 green teams — a distribution consistent with a crossfaction operation.

### B3 — `end_date` is the event date, not the submission deadline

**Assumed:** `start_date = end_date = 2020-07-31`.

**Why:** the spreadsheet is titled *July 31st, 2020*. Submissions continued into August —
the latest statistics screenshot is 2020-08-06 — but that is an administrative tail, not
the campaign. The submission window end is recorded separately in
`campaigns.config.submission_window_end` and flagged `estimated`.

### B4 — A blank link count is `NULL`, never `0`

**Assumed:** four agents (`@CofBas`, `@SakuraaaN`, `@tristeele`, `@dakidali`) with an
empty `Links created` cell have an **unknown** count.

**Why:** treating blank as zero would understate the campaign and misrepresent four real
people as having contributed nothing. They are counted as participants and excluded from
link sums. Every statistics view reports
`agents_with_unknown_links` alongside its totals so the gap is visible rather than buried.

**Edge case:** `@DwF` (Romania) is blank in the CSV, but the organiser's country table
reports Romania as **0 links** — arguably a real zero. Left as `NULL`, because the CSV is
the row-level source and the two sources disagree elsewhere too.

### B5 — The duplicate `@CofBas` rows are one person

**Assumed:** line 15 and line 83 are the same agent; merged, with the numeric link count
winning.

**Why:** identical handle, identical faction, identical country. The discarded row is
retained in `duplicate_rows` in `agents.json`, so the merge is reversible.

### B6 — Contributor names in filenames are attribution

**Assumed:** the text after ` - ` in a media filename is the contributor's name.

**Why:** the convention is consistent across 276 star screenshots.

**Flagged as:** `media.attribution_confidence = 'inferred_from_filename'`. Note these are
real names while the CSV holds agent handles; **no mapping between the two was attempted**.

### B7 — `captured_at` is filesystem mtime and is not trustworthy

**Flagged as:** `media.captured_at_confidence = 'estimated'` on all 342 rows. For the
`Photos/` folder the mtimes are 2026 (a recent re-export) and are actively wrong. The UI
should not present these as capture dates.

### B8 — City data was left empty rather than partially transcribed

**Assumed:** `city IS NULL` for all 124 agents, despite city values being visible in a
screenshot.

**Why:** the screenshot covers roughly 55 of 141 rows and several entries are ambiguous
at that resolution. A half-populated city map looks complete and is not. The screenshot
is preserved in `source-data/`; the real fix is the original Google Sheet.

### B9 — Agents visible only in a screenshot were not imported

**Assumed:** `@MrMavni`, `@Destructor 1906`, `@Cementsuit`, `@alanka30`, `@TKYmike` and
others visible in the form-responses screenshot but absent from the CSV are **not**
created.

**Why:** a handle read off a low-resolution screenshot with no faction, country or link
count is not a record. Documented in the provenance doc so the loss is explicit rather
than silent.

### B10 — CSV figures are displayed; organiser figures are shown beside them

**Assumed:** where the two sources disagree (8 countries), the CSV-derived value is the
one the app renders.

**Why:** the CSV is row-level and independently verifiable; the country table is an
aggregate screenshot. Both are stored on the archive snapshot, and the archived campaign
page shows "as originally published" next to the computed figure. **Neither was edited to
match the other.**

---

## C. Platform-level

### C1 — Supabase over Firebase

The handoff states a preference; nothing in the requirements argues against it. See
[ADR 0001](../architecture/adr/0001-supabase-as-backend.md).

### C2 — Google is the only identity provider

**Assumed:** no email/password, no magic-link *login*.

**Why:** the handoff specifies Google Sign-In. Magic links are still used for *editing a
submission without an account*, via the `teams.edit_token` column, which is a different
concern. See [ADR 0003](../architecture/adr/0003-google-only-auth.md).

### C3 — Team status is computed, never stored

**Why:** the handoff defines status as a function of dates and uploaded media. A stored
copy would drift. Implemented as `team_status_of(teams)` and exposed through `teams_view`.

### C4 — Archived campaigns are immutable

**Assumed:** once `status = 'archived'`, nobody but an admin can write to the campaign,
its teams, its participation rows or its media.

**Why:** "the archive preserves the campaign" has to be enforced, not merely intended.
Implemented in RLS via `campaign_is_editable()`.

### C5 — Source media is excluded from Git

The largest single decision. See
[ADR 0002](../architecture/adr/0002-media-stays-out-of-git.md).
Nothing is deleted; `source-data/MANIFEST.json` makes the exclusion auditable.
