'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Uses the anon key, so every query is subject to the
 * RLS policies in supabase/migrations/0004_rls_policies.sql. Public campaign
 * data is readable without a session; writes require a Google sign-in.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
