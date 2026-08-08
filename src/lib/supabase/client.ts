'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseCredentials } from './env';

/**
 * Browser Supabase client. Uses the anon key, so every query is subject to the
 * RLS policies in supabase/migrations/0004_rls_policies.sql. Public campaign
 * data is readable without a session; writes require a Google sign-in.
 *
 * Credentials come from supabaseCredentials() so a missing anon key fails with a
 * named error rather than an opaque library throw. See src/lib/supabase/env.ts.
 */
export function createClient() {
  const { url, anonKey } = supabaseCredentials();
  return createBrowserClient(url, anonKey);
}
