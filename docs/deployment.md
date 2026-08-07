# Deployment

Canonical repository: **https://github.com/Adibrill1/Brill-ops**
Everything ships from `main`.

## Hosting: Vercel

Brill Ops is a Next.js App Router app with server components and middleware, so it needs
a Node runtime — not static hosting. Vercel is the natural fit and its free tier is
enough for this.

Connecting the GitHub repo gives automatic deploys: every push to `main` becomes
production, and every pull request gets its own preview URL.

### It deploys before the database exists

The build needs no environment variables. With none set, the app starts in **demo mode**
and serves the 2020 archive from the committed import files (see `src/lib/demo.ts`), so
the first deploy produces a working, browsable site immediately.

That is deliberate: it decouples "is it live?" from "is the backend ready?", so the
hosting and the database can be sorted out one at a time rather than both at once.

## Environment variables

Added in Vercel under **Settings → Environment Variables**. None are required for the
first deploy.

| Variable | When | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Once Supabase exists | Setting this turns demo mode **off**. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Once Supabase exists | Safe in the browser; RLS is what protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | Media upload script only | **Bypasses RLS.** Never expose to the browser. Not needed for rendering. |
| `NEXT_PUBLIC_SITE_URL` | Once the domain is known | Used for OAuth redirects. |

Demo mode switches off as soon as `NEXT_PUBLIC_SUPABASE_URL` holds a real value. It is
not a fallback for an unreachable database — a configured-but-broken backend fails loudly
rather than quietly serving stale files.

## Order of operations

1. **Vercel** → a live URL, running in demo mode.
2. **Supabase** → project, migrations, seeds. Add the two public env vars, redeploy.
3. **Google OAuth** → sign-in, so participants can submit and edit.
4. **Media upload** → push the 342 archive files to the `archive-media` bucket.
5. **Custom domain** → optional, whenever you want one.

Each step leaves the site working. Nothing here is all-or-nothing.

## After the Supabase step

Set the callback URL in Google Cloud and Supabase to:

```
https://<your-vercel-domain>/auth/callback
```

and set `NEXT_PUBLIC_SITE_URL` to the same origin, or OAuth will redirect to localhost.

## Build settings

Vercel detects everything from `package.json`; no `vercel.json` is needed.

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Build command | `npm run build` (default) |
| Output directory | `.next` (default) |
| Install command | `npm install` (default) |
| Node version | 20 or later (`engines` in `package.json`) |
