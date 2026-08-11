import Link from 'next/link';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { FactionChip } from '@/components/FactionChip';
import { CountryName } from '@/components/CountryName';
import { formatCount } from '@/lib/format';
import { getAgentDirectory } from '@/lib/queries';

export const metadata: Metadata = { title: 'Agent directory' };
export const revalidate = 300;

/**
 * Every participant across every campaign, searchable by name, country and city.
 *
 * Most of these agents have never signed in — the 124 imported from 2020 are real
 * people whose participation is recorded without an account. See ADR 0004.
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const pageSize = 48;
  const { agents, total } = await getAgentDirectory({
    search: params.q,
    country: params.country,
    faction: params.faction,
    sort: (params.sort as 'name') ?? 'name',
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Agent directory</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatCount(total)} agents across all campaigns.
        </p>
      </header>

      <form className="flex flex-wrap gap-2" action="/agents">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search by agent name, country or city…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-faction-blue focus:outline-none focus:ring-1 focus:ring-faction-blue"
          />
        </div>
        <select
          name="faction"
          defaultValue={params.faction ?? ''}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
          aria-label="Filter by faction"
        >
          <option value="">All factions</option>
          <option value="blue">Blue · Resistance</option>
          <option value="green">Green · Enlightened</option>
        </select>
        <select
          name="sort"
          defaultValue={params.sort ?? 'name'}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
          aria-label="Sort agents"
        >
          <option value="name">A–Z</option>
          <option value="contribution">By contribution</option>
          <option value="campaigns">By campaigns joined</option>
        </select>
        <button
          type="submit"
          className="min-h-11 cursor-pointer rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90 active:translate-y-px"
        >
          Search
        </button>
      </form>

      {agents.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
          No agents match that search.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <li key={a.agent_id}>
              <Link
                href={`/agent/${a.handle.replace('@', '')}`}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue active:translate-y-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-muted">
                  {a.display_name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{a.handle}</span>
                  <span className="flex items-center truncate text-xs text-ink-faint">
                    {a.city}{a.city && a.country ? ', ' : ''}
                    {a.country ? <CountryName country={a.country} /> : (!a.city && 'Location not recorded')}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {a.faction && <FactionChip faction={a.faction} />}
                  <span className="text-[11px] tabular-nums text-ink-faint">
                    {formatCount(a.total_links_created)} links
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav aria-label="Agent directory pages" className="flex items-center justify-center gap-3">
          <PageLink params={params} page={page - 1} disabled={page === 1}>Previous</PageLink>
          <span className="text-sm text-ink-muted">Page {page} of {pageCount}</span>
          <PageLink params={params} page={page + 1} disabled={page >= pageCount}>Next</PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== 'page') next.set(key, value);
  });
  if (page > 1) next.set('page', String(page));

  if (disabled) {
    return <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-ink-faint">{children}</span>;
  }

  return (
    <Link
      href={`/agents?${next.toString()}`}
      className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-ink transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue active:translate-y-px"
    >
      {children}
    </Link>
  );
}
