import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <WifiOff className="mx-auto h-10 w-10 text-ink-faint" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold text-ink">You’re offline</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Campaign statistics are not stored offline because an old result could be misleading.
        Reconnect to load the current data.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90 active:translate-y-px"
      >
        Try again
      </Link>
    </div>
  );
}
