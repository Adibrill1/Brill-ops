import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on every request.
 *
 * Server Components cannot write cookies, so without this a session would
 * silently expire mid-visit and RLS-protected writes would start failing with no
 * obvious cause.
 */
export async function middleware(request: NextRequest) {
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest).*)'],
};
