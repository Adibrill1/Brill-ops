/**
 * The single decision point for the Supabase credentials, shared by the server
 * and browser client factories so they cannot drift apart.
 *
 * WHY THIS EXISTS — production error digest 443172729
 * --------------------------------------------------------------------------
 * The homepage (and every other page) rendered "Something went wrong — the page
 * could not be built" on every route. It was NOT the null-campaign case: the
 * homepage already falls back to <NoActiveCampaign/>, and every anon query
 * succeeds against the live database. The real cause was configuration:
 *
 *   NEXT_PUBLIC_SUPABASE_URL was set, but NEXT_PUBLIC_SUPABASE_ANON_KEY was not.
 *
 * `isDemoMode()` only inspects the URL, so the app left demo mode and tried to
 * talk to the real backend. `createClient()` then called into
 * @supabase/supabase-js with an undefined key, which throws a bare
 * "supabaseKey is required." at construction — on every request, before any
 * query runs. That message says nothing about which variable is missing or
 * where to set it, so the outage looked like a code bug rather than a missing
 * environment variable.
 *
 * This helper turns that opaque library throw into a named, actionable error
 * that lands in the server logs, and removes the `!` non-null assertions that
 * hid the possibility in the first place.
 */

import { describeUrlProblem } from './diagnostics';

export interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * Credentials for a live backend. Only reached when NOT in demo mode (callers
 * short-circuit on `isDemoMode()` first). Fails loudly and specifically if the
 * URL is present but the anon key is missing — the exact state behind digest
 * 443172729 — instead of letting the client library throw an unnamed error.
 */
export function supabaseCredentials(): SupabaseCredentials {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    // Should be unreachable: demo-mode callers check the URL first.
    throw new Error(
      'Brill Ops: NEXT_PUBLIC_SUPABASE_URL is not set, so there is no backend to ' +
        'talk to. With no URL the app runs in demo mode from the committed archive; ' +
        'reaching here means a live client was requested without one.',
    );
  }

  if (!anonKey) {
    throw new Error(
      'Brill Ops: NEXT_PUBLIC_SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
        'is missing, so the app is in live mode with no key and every request to ' +
        'Supabase fails before it starts. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in this ' +
        'environment (Vercel → Settings → Environment Variables) and redeploy. The ' +
        'anon key is safe to expose in the browser; RLS is what protects the data.',
    );
  }

  // Failure case 1: a malformed URL (whitespace, missing scheme, http, a stray
  // newline from a paste) fails at fetch as an opaque "fetch failed". Catch it
  // here with a message that names the exact problem. The URL host is not a
  // secret, so it is safe to surface.
  const urlProblem = describeUrlProblem(url);
  if (urlProblem) {
    throw new Error(
      `Brill Ops: ${urlProblem}. It must be the project's REST URL, e.g. ` +
        'https://<project-ref>.supabase.co with no path, quotes or trailing whitespace.',
    );
  }

  return { url, anonKey };
}
