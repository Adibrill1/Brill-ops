import Link from 'next/link';
import type { Metadata } from 'next';
import { Archive, Info } from 'lucide-react';
import { formatCount, formatDateRange } from '@/lib/format';
import { getArchivedCampaigns } from '@/lib/queries';

export const metadata: Metadata = { title: 'Archive' };
export const revalidate = 300;

/**
 * Completed campaigns. This page is populated from the very first version of the
 * platform, because the 2020 Big Bang materials were imported as a real archived
 * campaign rather than kept as reference files.
 */
export default async function ArchivePage() {
  const campaigns = await getArchivedCampaigns();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink">
          <Archive className="h-6 w-6 text-ink-faint" aria-hidden /> Archive
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Completed campaigns, preserved with their dashboards, team cards, galleries and
          final results. A campaign moves here automatically once its end date passes.
        </p>
      </header>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
          No archived campaigns yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((c) => (
            <Link
              key={c.campaign_id}
              href={`/archive/${c.slug}`}
              className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue active:translate-y-0"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink group-hover:underline">{c.name}</h2>
                {c.contains_inferred_data && (
                  <span
                    title="Some figures in this campaign were inferred or estimated during import. The campaign page explains which."
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800"
                  >
                    <Info className="h-3 w-3" aria-hidden /> Has inferred data
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                {formatDateRange(c.start_date, c.end_date)}
              </p>

              <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  ['Agents',    c.total_agents],
                  ['Countries', c.countries],
                  ['Teams',     c.total_teams],
                  ['Links',     c.total_links_created],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg bg-slate-50 py-2">
                    <dd className="text-lg font-semibold tabular-nums text-ink">
                      {formatCount(value as number)}
                    </dd>
                    <dt className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</dt>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
