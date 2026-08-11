'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FactionColour } from '@/types/database';
import { countryCodeForName, flagEmoji } from '@/lib/countries';

/**
 * The dashboard filter bar.
 *
 * Filters live in the URL, so a filtered view is shareable and the back button
 * works. Adding a filter means adding an entry to one of the arrays below and a
 * matching clause in lib/queries.ts — the handoff asks for the filtering system
 * to be extensible, and this is the seam.
 */

const STATUSES = [
  { value: 'all',         label: 'All statuses' },
  { value: 'planning',    label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
];

const SORTS = [
  { value: 'links',        label: 'Most links' },
  { value: 'participants', label: 'Most participants' },
  { value: 'recent',       label: 'Recently updated' },
  { value: 'name',         label: 'Name (A–Z)' },
];

const FACTIONS: Array<{ value: 'all' | FactionColour; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'crossfaction', label: 'Crossfaction' },
  { value: 'blue', label: 'Blue · Resistance' },
  { value: 'green', label: 'Green · Enlightened' },
];

export function TeamFilters({ countries }: { countries: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink shadow-sm focus:border-faction-blue focus:outline-none focus:ring-1 focus:ring-faction-blue';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FactionFilter />

      <select
        className={selectClass}
        value={params.get('status') ?? 'all'}
        onChange={(e) => set('status', e.target.value)}
        aria-label="Filter by status"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={params.get('country') ?? ''}
        onChange={(e) => set('country', e.target.value)}
        aria-label="Filter by country"
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c} value={c}>{flagEmoji(countryCodeForName(c)) ?? ''} {c}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={params.get('sort') ?? 'links'}
        onChange={(e) => set('sort', e.target.value)}
        aria-label="Sort teams"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

/** Standalone faction control for pages that do not expose the other team filters. */
export function FactionFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const select = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete('faction');
    else next.set('faction', value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Filter teams by faction">
      {FACTIONS.map(({ value, label }) => {
        const active = (params.get('faction') ?? 'all') === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => select(value)}
            className={`min-h-11 min-w-11 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue focus-visible:ring-offset-1 active:translate-y-px ${
              active ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
