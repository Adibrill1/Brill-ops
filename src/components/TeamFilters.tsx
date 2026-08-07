'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ALL_FACTIONS, FACTION_LABEL } from '@/lib/factions';

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

export function TeamFilters({ countries }: { countries: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-ink shadow-sm focus:border-faction-blue focus:outline-none focus:ring-1 focus:ring-faction-blue';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Faction. Note 'Crossfaction' sits alongside Blue and Green as a
          first-class option, not as an afterthought or a checkbox. */}
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {['all', ...ALL_FACTIONS].map((f) => {
          const active = (params.get('faction') ?? 'all') === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => set('faction', f)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                active ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {f === 'all' ? 'All teams' : FACTION_LABEL[f as keyof typeof FACTION_LABEL]}
            </button>
          );
        })}
      </div>

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
          <option key={c} value={c}>{c}</option>
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
