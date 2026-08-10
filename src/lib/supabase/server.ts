import { cookies } from 'next/headers';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';
import { supabaseCredentials } from './env';
import { createDiagnosticFetch } from './diagnostics';

/**
 * Server Supabase client for Server Components and Route Handlers.
 *
 * Still the anon key, still bound by RLS — the session travels in cookies. We
 * never use the service role key for page rendering; if a page can only be built
 * by bypassing RLS, the policy is wrong, not the page.
 *
 * Credentials come from supabaseCredentials(), which fails with a named error if
 * the anon key is missing rather than letting the client library throw an opaque
 * "supabaseKey is required." on every request. See src/lib/supabase/env.ts.
 */
export async function createClient() {
  const { url, anonKey } = supabaseCredentials();
  const cookieStore = await cookies();

  return createServerClient(
    url,
    anonKey,
    {
      // Transparent fetch wrapper: on a transport failure it logs the sanitized
      // nested cause (DNS / TLS / refused / bad host) before supabase-js
      // flattens it to "fetch failed". See src/lib/supabase/diagnostics.ts.
      global: { fetch: createDiagnosticFetch() },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: ((toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        }) satisfies CookieMethodsServer['setAll'],
      },
    },
  );
}
