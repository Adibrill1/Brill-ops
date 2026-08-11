import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createDiagnosticFetch } from '@/lib/supabase/diagnostics';
import { supabaseCredentials } from '@/lib/supabase/env';

/** Cookie-free anon client for public reads. RLS remains fully enforced. */
export function createPublicClient(revalidate: number) {
  const { url, anonKey } = supabaseCredentials();
  const diagnosticFetch = createDiagnosticFetch();

  const cachedFetch: typeof fetch = (input, init) =>
    diagnosticFetch(input, {
      ...init,
      cache: 'force-cache',
      next: { revalidate },
    } as RequestInit);

  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: cachedFetch },
  });
}
