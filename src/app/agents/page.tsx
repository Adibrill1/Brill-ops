import Link from 'next/link';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { FactionChip } from '@/components/FactionChip';
import { CountryName } from '@/components/CountryName';
import { formatCount } from '@/lib/format';
import { getAgentDirectory } from '@/lib/queries';

export const metadata: Metadata = { title: 'Agent directory' };
export const revalidate = 300;

const FACTION_OPTIONS = [
  { value: '', label: 'All factions' },
  { value: 'blue', label: 'Blue · Resistance' },
  { value: 'green', label: 'Green · Enlightened' },
] as const;

const SORT_OPTIONS = [
  { value: 'name', label: 'A–Z' },
  { value: 'contribution', label: 'By contribution' },
  { value: 'campaigns', label: 'By campaigns joined' },
] as const;

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
  const faction = params.faction === 'blue' || params.faction === 'green' ? params.faction : '';
  const sort = SORT_OPTIONS.some((option) => option.value === params.sort)
    ? params.sort as 'name' | 'contribution' | 'campaigns'
    : 'name';
  const { agents, total } = await getAgentDirectory({
    search: params.q,
    country: params.country,
    faction,
    sort,
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

      <div className="space-y-3">
        <form className="flex flex-wrap gap-2" action="/agents">
          {faction && <input type="hidden" name="faction" value={faction} />}
          {sort !== 'name' && <input type="hidden" name="sort" value={sort} />}
          {params.country && <input type="hidden" name="country" value={params.country} />}
          <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search by agent name, country or city…"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-faction-blue focus:outline-none focus:ring-1 focus:ring-faction-blue"
          />
          </div>
          <button
            type="submit"
            className="min-h-11 cursor-pointer rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue focus-visible:ring-offset-1 active:translate-y-px"
          >
            Search
          </button>
        </form>

        <div className="grid gap-3 lg:grid-cols-2">
          <AgentOptionGroup
            label="Filter by faction"
            param="faction"
            current={faction}
            defaultValue=""
            options={FACTION_OPTIONS}
            params={params}
          />
          <AgentOptionGroup
            label="Sort agents"
            param="sort"
            current={sort}
            defaultValue="name"
            options={SORT_OPTIONS}
            params={params}
          />
        </div>
      </div>

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
                    {a.country ? <CountryName country={a.country} code={a.country_code} /> : (!a.city && 'Location not recorded')}
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

function AgentOptionGroup({
  label,
  param,
  current,
  defaultValue,
  options,
  params,
}: {
  label: string;
  param: 'faction' | 'sort';
  current: string;
  defaultValue: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  params: Record<string, string | undefined>;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-ink-muted">{label}</p>
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const active = current === option.value;
          return (
            <Link
              key={option.value}
              href={agentOptionHref(params, param, option.value, defaultValue)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue focus-visible:ring-offset-1 active:translate-y-px ${
                active
                  ? 'bg-ink text-white shadow-sm'
                  : 'bg-slate-50 text-ink-muted hover:bg-slate-100 hover:text-ink'
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function agentOptionHref(
  params: Record<string, string | undefined>,
  key: 'faction' | 'sort',
  value: string,
  defaultValue: string,
): string {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([param, current]) => {
    if (current && param !== 'page') next.set(param, current);
  });
  if (value === defaultValue) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  return query ? `/agents?${query}` : '/agents';
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
