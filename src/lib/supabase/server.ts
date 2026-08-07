import { cookies } from 'next/headers';
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

/**
 * Server Supabase client for Server Components and Route Handlers.
 *
 * Still the anon key, still bound by RLS — the session travels in cookies. We
 * never use the service role key for page rendering; if a page can only be built
 * by bypassing RLS, the policy is wrong, not the page.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
