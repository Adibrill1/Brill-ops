# source-data — original materials, read-only

Everything in this directory arrived with the project handoff. It is the origin of the
Brill Ops archive.

## Rules

1. **Never edit, rename, or delete anything here.** Scripts read from this directory and
   never write to it.
2. **It stays even after import.** The database records in `campaigns`, `agents`, `teams`
   and `media` are derivatives. This is the original.
3. **The large binaries are not in Git.** See
   [ADR 0002](../docs/architecture/adr/0002-media-stays-out-of-git.md). They live here on
   disk and are catalogued in `MANIFEST.json`, which is committed.

## Verify integrity

```bash
npm run verify:source
```

Checks all 342 files against the SHA-256 checksums in `MANIFEST.json` and names anything
missing or altered.

## Contents

| Path | Files | Size | Notes |
| --- | ---: | ---: | --- |
| `historical-campaigns/2020-07-the-big-bang/` | 342 | 875 MB | Operation "The Big Bang", 31 July 2020 |
| ├ `Stars/` | 276 | 244 MB | Per-agent link-star screenshots |
| ├ `Videos/` | 15 | 599 MB | Includes `IMG_6970.MOV` at 185 MB |
| ├ `Photos/` | 40 | 6.8 MB | mtimes are from a 2026 re-export — not capture dates |
| ├ `Txt/` | 10 | 26 MB | **`TheBigBang - All agents.csv`** plus 9 spreadsheet screenshots |
| └ `AdiBrill.jpg` | 1 | 1.7 MB | |
| `brand/assets/`, `brand/branding/` | 0 | — | **Empty in the handoff.** No Stars for Peace material was supplied. |

The only machine-readable file in the whole package is
`historical-campaigns/2020-07-the-big-bang/Txt/TheBigBang - All agents.csv`. Everything
else about the 2020 statistics had to be read out of screenshots — see
[the provenance doc](../docs/import/the-big-bang-2020-provenance.md).

## ⚠ Backup warning

Until every row in the `media` table has `is_uploaded = true`, **this folder is the only
copy of 875 MB of community history.** Back it up.
