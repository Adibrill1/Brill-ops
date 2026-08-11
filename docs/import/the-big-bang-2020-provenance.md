# Provenance — Operation "The Big Bang" (31 July 2020)

This document records exactly what arrived in the handoff package, what was made of it,
and what could not be recovered. It is the reference for anyone who later wonders where
a number on the archived campaign page came from.

**Source directory:** `source-data/historical-campaigns/2020-07-the-big-bang/`
**Imported by:** `scripts/import-big-bang.mjs`
**Structured output:** `data/archive-imports/the-big-bang-2020/`
**Seed:** `supabase/seed/002_the_big_bang_2020.sql`

---

## 1. What the campaign was

The handoff package never states the campaign's name in prose. It was recovered from a
screenshot: `Txt/Screen Shot 2020-08-06 at 2.39.48.png` shows a Google Sheet titled
**`Operation "The Big Bang" - July 31st, 2020 (Responses)`**, with a second screenshot
showing the same workbook as `OP "The Big Bang" (Responses)` and its tabs:
`Form Responses 1`, `parsed Data`, `Country Stats1`, `Country stats`.

So: a global crossfaction Ingress operation on **31 July 2020**, in which agents built
link stars from a single portal and submitted results through a Google Form. The form
collected agent name, faction, location, links created, IITC portal info, a portal
screenshot, free-text feedback, and additional media.

This matters beyond trivia — it is the same shape as the Brill Ops submission system
described in the handoff, which is why the import maps onto the schema as cleanly as it
does.

---

## 2. What the package contained

| Folder | Files | Size | What it is |
| --- | ---: | ---: | --- |
| `Stars/` | 276 | 244 MB | Per-agent screenshots of completed link stars. Most filenames carry the contributor's real name after a ` - ` separator. |
| `Videos/` | 15 | 599 MB | Event videos, agent submissions, and finished edits (`TheBigBang.mp4`, `1min Story.mp4`, `thebigbangISRAEL.mp4`). |
| `Photos/` | 40 | 6.8 MB | Event photos. Filesystem timestamps are 2026 — these were re-exported recently, so their mtimes say nothing about capture date. |
| `Txt/` | 10 | 26 MB | Statistics: **one CSV** plus nine screenshots of the original spreadsheet. |
| *(root)* | 1 | 1.7 MB | `AdiBrill.jpg` |
| **Total** | **342** | **875 MB** | |

Full inventory with SHA-256 checksums: `source-data/MANIFEST.json`.

### The only machine-readable artefact

`Txt/TheBigBang - All agents.csv` — 141 data rows, columns `Agent Name`, `Faction`,
`Country`, `Links created`, `Max in country`. This is the row-level source of truth for
the import. Everything else in `Txt/` is a screenshot.

---

## 3. What was extracted from screenshots

Two screenshots were transcribed by hand because they contain figures that exist nowhere
else in machine-readable form.

**`Txt/countries1.jpg`** (dated 2020-08-04) — the `Country Stats1` tab: 31 countries with
participants, total links, highest single-agent link count, and top agent. Transcribed
into `data/archive-imports/the-big-bang-2020/source-reported-country-stats.json`.

**`Txt/thebigbangcores.jpg`** — carries two ranking columns, "The Biggest stars" and
"most links per agent", giving a podium:

| Rank | Biggest stars | Most links per agent |
| --- | --- | --- |
| 1 | @edyuji, @LindaFlor19 | @eigood |
| 2 | @Jepakazol, @DoctorWho00 | @Jepakazol |
| 3 | @aitj, @SergeFernanDes | @aitj |

Both are stored as `source_reported_stats` on the archive snapshot — the organiser's own
published result, kept distinct from anything Brill Ops calculates.

---

## 4. Import results

| Metric | Value |
| --- | ---: |
| Agents imported | 124 |
| — with a known link count | 120 |
| — with an **unknown** link count | 4 |
| Countries | 32 |
| Total links (computed from the CSV) | 9,449 |
| Total links (as the organiser published) | 8,962 |
| Teams (**all inferred**) | 32 — 15 blue, 5 green, **12 Crossfaction** |
| Media files catalogued | 342 |
| Anomalies logged | 16 |

The CSV's 141 rows became 124 agents: 16 rows were blank spacers used as visual
separators in the original spreadsheet, and one handle (`@CofBas`) appeared twice.

---

## 5. Disagreements between the two sources

The agent CSV and the organiser's country table were exported on different dates
(`countries.jpg` is 2020-08-02, `countries1.jpg` is 2020-08-04, the CSV later still) and
they do not agree. **Neither was corrected to match the other.** Both are stored; the
differences are itemised in `reconciliation.json` and inserted into `import_anomalies`
with type `source_disagreement`.

| Country | Organiser reported | Computed from CSV |
| --- | --- | --- |
| Belgium | 2 participants, 90 links | 3 participants, 168 links |
| Brazil | 1,534 links | 1,571 links |
| Canada | 2 participants | 3 participants |
| Germany | 11 participants, 604 links | 12 participants, 639 links |
| Israel | 797 links | 863 links |
| Portugal | 2 participants | 3 participants |
| Ukraine | *absent* | 1 participant (@V1tharr, 41 links) |
| United States | 11 participants, 998 links | 13 participants, 1,202 links |

The pattern is consistent with the country table being an **earlier snapshot** — every
disagreement has the CSV higher, never lower, which is what late submissions look like.
That is a hypothesis, not a finding, and it is not encoded anywhere in the data.

**Which one the app shows:** the CSV-derived figure, because it is row-level and
verifiable. The organiser's figure is displayed alongside it as "as originally
published". Neither is deleted.

---

## 6. What could not be recovered

### City data — exists, but only as pixels

The original form collected `Location (City/State/Country)`, and
`Txt/Screen Shot 2020-08-06 at 2.39.48.png` shows real values: *Curitiba*, *Coimbra
Portugal*, *Bellingham Washington United States*, *Sapporo Hokkaido Japan*, *Petah-Tikva*,
*Ramat Gan Israel*, and more. The CSV does not carry the column, and the screenshot shows
only ~55 of the rows at a resolution where several entries are ambiguous.

**Decision:** `city` is `NULL` for all 124 agents. Transcribing part of a column would
produce a map that looks complete and is not. The screenshot remains in `source-data/`,
so the data can be recovered later — ideally from the original Google Sheet, which almost
certainly still exists in the organiser's Drive.

### Agents present in the form but not in the CSV

The same screenshot shows handles that never appear in the CSV — `@MrMavni`,
`@Destructor 1906`, `@Cementsuit`, `@alanka30`, `@TKYmike`. The form sheet ran to roughly
87 response rows while the CSV holds 141 rows / 124 agents, so the two artefacts were
built from different collations.

**Decision:** not imported. A handle read off a low-resolution screenshot, with no
faction, country or link count attached, is not a record — it is a rumour. Documented
here instead, with the screenshot preserved.

### Free-text feedback

The form's "What did you think of this event?" column is legible in the screenshots
("*I had a grand evening, thank You!*", "*Please create more events like this.*",
"*I walked 17 km in 3 hours*"). The schema has a `campaign_participation.feedback` column
ready for it. Not imported for the same reason as the cities: partial and
unattributable-at-scale from a screenshot.

### Campaign branding

None. No logo, no hero image, no colour. `hero_image_url` is `NULL`. The most likely
candidate is a poster frame from `Videos/TheBigBang.mp4`, noted in `campaign.json` as a
suggestion rather than applied.

### Portal data

The form collected IITC portal info and portal screenshots per agent, and one response
even contains a full intel URL (`portal=40.552539,-74.62901`). These are individual
star-building portals, not team portals. Because the inferred teams are country
groupings, there is no meaningful single `portal_address` to attach to any of them —
so the column is `NULL` for all 32.

---

## 7. Teams: the one substantial inference

The Big Bang had **no team structure**. It was an individual event: one agent, one star,
one row.

The handoff nonetheless requires archived campaigns to preserve team cards and team
galleries. Two options existed:

1. Import the campaign with zero teams — honest, but the archive renders as an empty
   dashboard, and the platform's first archived campaign fails to demonstrate the
   archive.
2. Group agents by country into synthetic teams.

Option 2 was chosen, on the grounds that the **organiser had already done exactly this**:
the `Country Stats1` tab reports participants, total links and a top agent per country,
which is precisely the shape of a Brill Ops team card. The inference reproduces the
original authors' own view of their data rather than imposing a new one.

Every one of the 32 teams carries:

```
confidence      = 'inferred'
inference_basis = 'The Big Bang recorded no teams. Grouped by country to mirror the
                   organiser''s own "Country Stats" tab, which reported participants /
                   total links / top agent per country.'
```

A database constraint (`teams_inferred_needs_basis`) makes it impossible to insert a
non-`source` team without a stated basis. The UI badges them, and the archived campaign
page carries a banner explaining it.

Team faction is derived, not invented: all-blue members → `blue`, all-green → `green`,
**both → `crossfaction`**. Twelve countries came out Crossfaction, which is a real and
rather nice fact about that operation.

---

## 8. Ambiguities preserved verbatim

All 16 are in `import_anomalies` and `reconciliation.json`. The row-level ones:

| Line | Agent | Issue | Resolution |
| ---: | --- | --- | --- |
| 15 | `@CofBas` | Blank link count, listed under Israel but positioned in the Belgium block | Stored `NULL`, not `0` |
| 83 | `@CofBas` | Duplicate row, Israel, 17 links | Merged into line 15; the numeric value wins, the discarded row is kept in `duplicate_rows` |
| 102 | `@SakuraaaN` | Blank link count | Stored `NULL` |
| 111 | `@DwF` | Blank link count (`Max in country` = 0) | Stored `NULL` — the organiser's table reports Romania as 0 links, but blank ≠ zero |
| 139 | `@tristeele` | Blank link count | Stored `NULL` |
| 140 | `@PsicopataInfame` | No country | Imported; excluded from country rollups |
| 141 | `@mikusan` | No country | Imported; excluded from country rollups |
| 142 | `@dakidali` | Blank link count (Portugal) | Stored `NULL`; explains the Portugal participant-count disagreement |

Four handles in the source carry trailing whitespace (`@Josske `, `@vastis `, `@Aartsengel `,
`@WeeFreeFang `, `@earthtraveler5 `, `@ShengDu `, `@Djfenyx `). These were trimmed, and the
trim is recorded in the agent's `notes` array rather than applied silently.

---

## 9. Media

All 342 files are catalogued in the `media` table with `source_path` and
`source_sha256`. The binaries themselves are not in Git — see
[ADR 0002](../architecture/adr/0002-media-stays-out-of-git.md).

A full contact-sheet review found that `Stars/IMG_7004` through `IMG_7123` is a
contiguous personal/IFS@HOME camera-roll sequence, not material from The Big Bang. The
public archive therefore contains 272 unique campaign assets: 246 community images, 16
videos and 10 source/statistics records. Sixty-four unrelated files and six exact
duplicates are preserved in the manifest and source folder but are not published.
Every include/exclude decision, caption, category and featured-image choice is recorded
in `data/archive-imports/the-big-bang-2020/media-curation.json`.

Run `npm run media:upload -- --dry-run` to verify the reviewed set, then
`npm run media:upload` with a server-only Supabase service-role key to upload it. The
uploader verifies every SHA-256 and uses resumable uploads for the large videos.

Attribution was taken from the filenames, which follow a ` - Name` convention:
`20200731_195252 - Adam Heath.jpg`, `@DoctorWho00 - Marc Tavares.jpeg`,
`Screenshot_20200731_222917_org.exarhteam.iitc_mobile - Ute Heikaemper.jpg`. That is
stored as `attributed_to` with `attribution_confidence = 'inferred_from_filename'`. Note
these are **real names**, while the CSV holds **agent handles** — the two are not linked,
and no attempt was made to guess a mapping.

`captured_at` uses filesystem mtime and is marked `estimated`. For the `Photos/` folder
it is actively wrong (2026 timestamps from a re-export) and should not be trusted or
displayed as a capture date.
