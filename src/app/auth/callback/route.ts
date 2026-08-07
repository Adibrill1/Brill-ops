import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Google OAuth callback.
 *
 * Supabase redirects here with a one-time code; we exchange it for a session
 * cookie. The `profiles` row is created by the `on_auth_user_created` database
 * trigger, so there is nothing to insert from here.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
