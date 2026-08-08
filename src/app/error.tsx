'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Error boundary.
 *
 * Deliberately explicit rather than a generic "something went wrong". The most
 * likely failure by far is a Supabase project whose migrations have not been
 * applied yet, and telling someone the exact command beats making them read
 * Vercel's runtime logs.
 *
 * The alternative — swallowing the error and rendering an empty page — is worse
 * than a visible failure, because an empty archive looks like a true statement
 * about the data rather than a broken connection.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Brill Ops error boundary:', error);
  }, [error]);

  const schemaMissing = error.message.includes('the API cannot see');

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-amber-900">
              {schemaMissing ? 'The API cannot see the database schema' : 'Something went wrong'}
            </h1>

            {schemaMissing ? (
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-amber-900">
                <p>
                  Brill Ops is connected to Supabase, but its REST API cannot find the
                  tables. Usually this means the schema cache is stale after migrations
                  were applied directly to Postgres. No data is lost.
                </p>
                <p>From the project folder:</p>
                <pre className="overflow-x-auto rounded-lg bg-amber-900/10 px-3 py-2 font-mono text-xs">
                  npm run db:setup
                </pre>
                <p className="text-xs opacity-80">
                  That applies <code>supabase/migrations/</code> and then the archive seed.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                The page could not be built. The details are in the server logs.
              </p>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-amber-800">
                Technical detail
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-amber-900/10 px-3 py-2 font-mono text-[11px] text-amber-900">
                {error.message}
                {error.digest ? `\n\ndigest: ${error.digest}` : ''}
              </pre>
            </details>

            <button
              type="button"
              onClick={reset}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
