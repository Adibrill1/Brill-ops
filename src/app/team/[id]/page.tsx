import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { CountryName } from '@/components/CountryName';
import { FactionChip } from '@/components/FactionChip';
import { StatCard } from '@/components/StatCard';
import { formatCount, formatDate } from '@/lib/format';
import { getTeam, getTeamMedia, getTeamMembers } from '@/lib/queries';

export const revalidate = 300;

const STATUS_LABEL = {
  planning: 'Planning',
  in_progress: 'In Progress',
  completed: 'Completed',
} as const;

/** A team's gallery, statistics and participating agents. */
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await getTeam(id);
  if (!team) notFound();

  const [members, media] = await Promise.all([getTeamMembers(id), getTeamMedia(id)]);

  const startPhoto = media.find((m) => m.role === 'construction_start');
  const endPhotos = media.filter((m) => m.role === 'construction_end');
  const others = media.filter(
    (m) => m.role !== 'construction_start' && m.role !== 'construction_end',
  );

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{team.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <FactionChip faction={team.faction} showDescription />
              {(team.city || team.country) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {team.city}{team.city && team.country ? ', ' : ''}
                  {team.country && <CountryName country={team.country} />}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink-muted">
              {STATUS_LABEL[team.status]}
            </span>
            <ConfidenceBadge confidence={team.confidence} basis={team.inference_basis} />
          </div>
        </div>

        {team.confidence !== 'source' && team.inference_basis && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <strong>How this team was derived:</strong> {team.inference_basis}
          </p>
        )}

        {team.portal_address && (
          <p className="mt-3 text-sm text-ink-muted">
            <span className="font-medium text-ink">Portal:</span> {team.portal_address}
          </p>
        )}
      </header>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Links created" value={team.links_created} />
          <StatCard label="Participants"  value={team.participant_count} />
          <StatCard
            label="Construction"
            value={team.construction_days}
            suffix={team.construction_days === 1 ? 'day' : 'days'}
            confidence="computed"
          />
          <StatCard label="Media" value={media.length} />
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          Started {formatDate(team.construction_start_date)} · Completed{' '}
          {formatDate(team.construction_end_date)}
        </p>
      </section>

      {(startPhoto || endPhotos.length > 0 || others.length > 0) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Gallery</h2>
          <Gallery title="Construction start" items={startPhoto ? [startPhoto] : []} />
          <Gallery title="Construction end" items={endPhotos} />
          <Gallery title="Additional media" items={others} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">
          Participating agents <span className="text-ink-faint">({members.length})</span>
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents recorded for this team.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {members.map((m) => (
              <li key={m.agent_id ?? m.handle}>
                <Link
                  href={`/agent/${m.handle.replace('@', '')}`}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-ink transition hover:bg-slate-50 hover:shadow-sm active:translate-y-px"
                >
                  {m.handle}
                  {m.faction && <FactionChip faction={m.faction} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Media not yet uploaded to Storage still renders — as a placeholder naming the
 * source file. All 342 archive assets are in this state until
 * scripts/upload-archive-media.mjs runs, and showing "342 items, none visible"
 * is more useful than showing nothing.
 */
function Gallery({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof getTeamMedia>>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-medium text-ink-muted">
        {title} <span className="text-ink-faint">({formatCount(items.length)})</span>
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((m) => {
          const src = m.external_url ?? (m.is_uploaded && m.storage_path ? m.storage_path : null);
          return (
            <figure
              key={m.id}
              className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              {src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={src} alt={m.caption ?? title} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center p-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    Not yet uploaded
                  </p>
                  <p className="mt-1 line-clamp-3 text-[10px] text-ink-faint">
                    {m.source_path?.split('/').pop()}
                  </p>
                </div>
              )}
              {m.attributed_to && (
                <figcaption className="px-2 py-1 text-[10px] text-ink-faint">
                  {m.attributed_to}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
