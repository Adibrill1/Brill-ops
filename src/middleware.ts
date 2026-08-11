import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on every request.
 *
 * Server Components cannot write cookies, so without this a session would
 * silently expire mid-visit and RLS-protected writes would start failing with no
 * obvious cause.
 *
 * The demo-mode check is duplicated here rather than imported from lib/demo.ts:
 * middleware runs in the Edge runtime, and importing that module would pull the
 * whole archive JSON into the edge bundle for a two-line env check.
 */
function hasSupabaseProject(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Both are required: a URL with no key is a misconfiguration, not a backend.
  // Constructing a client without the key throws "supabaseKey is required." and
  // would turn every request into an edge 500. The page renderer enforces the
  // same rule with a named error via supabaseCredentials(); see the note on
  // production digest 443172729 in src/lib/supabase/env.ts.
  if (!url || !key) return false;
  return !url.includes('placeholder') && !url.includes('your-project');
}

export async function middleware(request: NextRequest) {
  // Demo mode: there is no session to refresh, and constructing a client with
  // no credentials throws and turns every page into a 500.
  if (!hasSupabaseProject()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: ((toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }) satisfies CookieMethodsServer['setAll'],
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Public pages use a cookie-free anon client and can be cached. Refresh a
  // session only where authentication is actually involved.
  matcher: ['/submit/:path*', '/auth/:path*'],
};
