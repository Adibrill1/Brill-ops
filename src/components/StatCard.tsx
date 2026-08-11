import { formatCount } from '@/lib/format';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { DataConfidence } from '@/types/database';
import type { ReactNode } from 'react';

/**
 * A single live statistic.
 *
 * `unknownCount` is the honesty valve. When a campaign has participants whose
 * contribution the source never recorded, the card says so under the number
 * instead of letting the total imply completeness. The 2020 archive has four.
 */
export function StatCard({
  label,
  value,
  suffix,
  unknownCount,
  confidence = 'source',
  basis,
}: {
  label: string;
  value: number | string | ReactNode | null;
  suffix?: string;
  unknownCount?: number;
  confidence?: DataConfidence;
  basis?: string | null;
}) {
  const display = typeof value === 'number' ? formatCount(value) : (value ?? '—');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        <ConfidenceBadge confidence={confidence} basis={basis} />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">
        {display}
        {suffix && <span className="ml-1 text-lg font-normal text-ink-faint">{suffix}</span>}
      </p>
      {!!unknownCount && unknownCount > 0 && (
        <p className="mt-1 text-xs text-ink-faint">
          {unknownCount} {unknownCount === 1 ? 'participant' : 'participants'} with no recorded
          figure — counted, not zeroed
        </p>
      )}
    </div>
  );
}
