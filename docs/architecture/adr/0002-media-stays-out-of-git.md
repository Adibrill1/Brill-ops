# ADR 0002 — Source media stays out of Git

**Status:** Accepted · **Date:** 2026-08-07

## Context

The handoff package is **875 MB across 342 files**: 276 star screenshots (244 MB), 15
videos (599 MB), 40 photos and 10 statistics images. One video, `IMG_6970.MOV`, is
**185 MB**.

Two hard facts:

- GitHub **rejects any blob over 100 MB**. `IMG_6970.MOV` cannot be pushed at all.
- Git LFS on the free tier gives **1 GB storage and 1 GB/month bandwidth**. At 875 MB, a
  single fresh clone would exhaust the monthly bandwidth quota.

And a standing instruction: *historical source materials must remain preserved in the
repository even after their data is imported.*

## Decision

The binaries are **not committed**. In their place, `source-data/MANIFEST.json` and
`MANIFEST.csv` are committed, recording every one of the 342 files with its path, byte
size, SHA-256, kind, and the attribution encoded in its filename.

The files themselves stay in `source-data/` on disk, gitignored, and are uploaded to the
Supabase `archive-media` bucket, at which point `media.is_uploaded` flips to `true`.

## Why this still counts as "preserved"

"Preserved" means the material remains available and provably intact — not that a
particular version-control system holds the bytes. The manifest is a stronger guarantee
than a naive commit in one respect: it makes tampering detectable. Run

```bash
npm run verify:source
```

and any missing or altered file is named. Every one of the 342 files also has a row in
the `media` table with its `source_path` and `source_sha256`, so the archive can point at
an asset even before it has been uploaded.

What we lose: someone cloning the repo does not automatically get the media. That is a
real cost, accepted knowingly — a 875 MB clone is a worse daily tax than a one-time
download, and the 185 MB video makes the alternative impossible anyway.

## Consequences

- `.gitignore` excludes media under `source-data/` by extension. The CSV, the manifests
  and all documentation **are** committed.
- Losing the local folder before the Storage upload means losing the media. **Keep a
  backup of `source-data/` until `media.is_uploaded` is true for all 342 rows.** This is
  the single largest risk in the project right now.
- Once uploaded, Supabase Storage is the durable copy and the manifest is the index.

## Alternatives

**Git LFS** — 875 MB against a 1 GB quota, with per-clone bandwidth cost, and every
contributor needing `git-lfs`. Rejected.
**Commit images, exclude videos** — still 277 MB of screenshots in history forever, for
files that are display assets belonging in object storage. Rejected.
**Commit everything** — impossible; GitHub rejects the 185 MB blob.
