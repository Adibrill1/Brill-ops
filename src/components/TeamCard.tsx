import Link from 'next/link';
import { MapPin, Users, Zap } from 'lucide-react';
import { FACTION_CLASSES } from '@/lib/factions';
import { formatCount } from '@/lib/format';
import { ConfidenceBadge } from './ConfidenceBadge';
import { FactionChip } from './FactionChip';
import type { TeamStatus, TeamWithStatus } from '@/types/database';

const STATUS_STYLE: Record<TeamStatus, { label: string; className: string }> = {
  planning:    { label: 'Planning',    className: 'bg-slate-100 text-ink-muted' },
  in_progress: { label: 'In Progress', className: 'bg-blue-50 text-blue-700' },
  completed:   { label: 'Completed',   className: 'bg-emerald-50 text-emerald-700' },
};

/** Responsive square team card for the campaign dashboard. */
export function TeamCard({ team }: { team: TeamWithStatus }) {
  const status = STATUS_STYLE[team.status];
  const accent = FACTION_CLASSES[team.faction];

  return (
    <Link
      href={`/team/${team.id}`}
      className={`group relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md hover:ring-2 ${accent.ring}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${accent.bar}`} aria-hidden />

      <div className="flex items-start justify-between gap-2">
        <FactionChip faction={team.faction} />
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-base font-semibold text-ink group-hover:underline">
          {team.name}
        </h3>
        {(team.city || team.country) && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {[team.city, team.country].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="flex items-center gap-1 text-2xl font-semibold tabular-nums text-ink">
            <Zap className="h-4 w-4 text-ink-faint" aria-hidden />
            {formatCount(team.links_created)}
          </p>
          <p className="text-[11px] text-ink-faint">links created</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1 text-sm font-medium tabular-nums text-ink-muted">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {team.participant_count}
          </p>
          <ConfidenceBadge confidence={team.confidence} basis={team.inference_basis} />
        </div>
      </div>
    </Link>
  );
}
