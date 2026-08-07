# Push to GitHub

Everything is committed locally on `main` — 3 commits, 72 files, ~780 KB. Two steps left,
and they need your GitHub account.

## 1. Create the empty repository

Go to **https://github.com/new** and set:

| Field | Value |
| --- | --- |
| Repository name | `brill-ops` |
| Visibility | **Private** |
| Initialize with README | **No** — leave every checkbox unticked |
| .gitignore / license | None |

The repository must be completely empty, otherwise the push below will be rejected for
having unrelated histories.

## 2. Push

Open Terminal and paste this **as one block**:

```bash
cd "/Users/adibrill/Desktop/Adi/Ai Vibe coding/Brill Ops Platform"
git remote add origin https://github.com/YOUR_USERNAME/brill-ops.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

If you have the GitHub CLI installed, steps 1 and 2 collapse into one command:

```bash
cd "/Users/adibrill/Desktop/Adi/Ai Vibe coding/Brill Ops Platform"
gh repo create brill-ops --private --source=. --remote=origin --push
```

## Why this step is manual

The sandbox I run commands in can reach `github.com` for git operations, but
`api.github.com` is blocked by its network allowlist, so repository creation is not
possible from here. There are also no GitHub credentials in that environment. Handing you
a command is faster than any workaround, and keeps your token out of the chat transcript.

## What will and will not be pushed

**Pushed** — 72 files: the application, the database schema and seeds, all documentation,
the original handoff, the agent CSV, and `source-data/MANIFEST.json`.

**Not pushed** — the 875 MB of photos and video under `source-data/`. GitHub rejects any
file over 100 MB and `Videos/IMG_6970.MOV` is 185 MB, so committing them is impossible,
not merely unwise. They stay on your Mac, catalogued with SHA-256 checksums in the
manifest, and are traceable from the `media` table. Reasoning:
[ADR 0002](docs/architecture/adr/0002-media-stays-out-of-git.md).

## ⚠ Before you do anything else

Until those files are uploaded to Supabase Storage, **your Mac holds the only copy of
875 MB of community history**. Back up
`source-data/historical-campaigns/2020-07-the-big-bang/` somewhere else today.

To confirm nothing has been lost or altered at any point:

```bash
npm run verify:source
```

Currently reports: `OK - all 342 source files present and unmodified.`

## After the push

Delete this file — it has served its purpose:

```bash
git rm PUSH-TO-GITHUB.md && git commit -m "Remove push instructions" && git push
```
