import { FlaskConical } from 'lucide-react';
import { isDemoMode } from '@/lib/demo';

/**
 * Demo mode has to announce itself.
 *
 * This project's whole posture is that data never quietly pretends to be
 * something it isn't — imported figures wear a confidence badge, blanks render
 * as blanks. A site reading static files while looking like a live platform
 * would break that rule at the top level, so it says so.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs text-amber-900">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <p>
          <strong>Demo mode — no database connected.</strong> The archive below is the real
          2020 campaign, read from the committed import files. Sign-in, submissions and
          uploads need a Supabase project; add <code className="font-mono">.env.local</code>{' '}
          and restart to switch to the live backend.
        </p>
      </div>
    </div>
  );
}
