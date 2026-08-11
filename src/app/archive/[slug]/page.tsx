import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle, FileWarning } from 'lucide-react';
import { CampaignMediaArchive } from '@/components/CampaignMediaArchive';
import { FactionChip } from '@/components/FactionChip';
import { CountryName } from '@/components/CountryName';
import { StatCard } from '@/components/StatCard';
import { TeamCard } from '@/components/TeamCard';
import { FactionFilter } from '@/components/TeamFilters';
import { ALL_FACTIONS } from '@/lib/factions';
import { formatCount, formatDateRange } from '@/lib/format';
import {
  getArchiveSnapshot,
  getCampaignBySlug,
  getCampaignLeaderboard,
  getCampaignMedia,
  getCampaignStats,
  getCountryStats,
  getFactionStats,
  getImportAnomalies,
  getTeams,
} from '@/lib/queries';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  return { title: campaign?.name ?? 'Archived campaign' };
}

/**
 * An archived campaign, rendered exactly like a live one — plus its footnotes.
 *
 * The footnotes are the point. This campaign's data is six years old and came
 * from two documents that disagree with each other, so the page states which
 * figures were inferred, which the source left blank, and where the sources
 * conflict. An archive that hides that is a nicer-looking lie.
 */
export default async function ArchivedCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const filters = await searchParams;

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) notFound();

  const [stats, factions, countries, teams, leaderboard, media, snapshot, anomalies] = await Promise.all([
    getCampaignStats(campaign.id),
    getFactionStats(campaign.id),
    getCountryStats(campaign.id),
    getTeams(campaign.id, { faction: filters.faction, sort: 'links' }),
    getCampaignLeaderboard(campaign.id, 10),
    getCampaignMedia(campaign.id),
    getArchiveSnapshot(campaign.id),
    getImportAnomalies(campaign.id),
  ]);

  const metric = campaign.config?.metric_label ?? 'links created';
  const teamsInferred = campaign.config?.teams_are_inferred === true;
  const disagreements = anomalies.filter((a) => a.anomaly_type === 'source_disagreement');
  const rowLevel = anomalies.filter((a) => a.anomaly_type !== 'source_disagreement');

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl bg-ink px-6 py-10 text-white">
        {campaign.hero_image_url && (
          <>
            <Image
              src={campaign.hero_image_url}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/45" aria-hidden />
          </>
        )}
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-widest opacity-70">Archived campaign</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="mt-1 text-sm opacity-80">
            {formatDateRange(campaign.start_date, campaign.end_date)}
          </p>
          {campaign.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90">{campaign.description}</p>
          )}
        </div>
      </section>

      {/* ---- Final results ---------------------------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Final results</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Agents"    value={stats?.total_agents ?? 0} />
          <StatCard label="Countries" value={stats?.countries ?? 0} />
          <StatCard label="Teams"     value={stats?.total_teams ?? 0}
                    confidence={teamsInferred ? 'inferred' : 'source'}
                    basis={teamsInferred ? 'This campaign recorded no teams. These are country groupings reconstructed during import.' : null} />
          <StatCard label={`Total ${metric}`}
                    value={stats?.total_links_created ?? null}
                    unknownCount={stats?.agents_with_unknown_links} />
          <StatCard label="Top country" value={<CountryName country={stats?.top_country} code={stats?.top_country_code} />} />
          <StatCard label="Top contributor" value={stats?.top_contributor ?? '—'} />
          <StatCard label="Avg per team"    value={stats?.avg_links_per_team ?? null} confidence="computed" />
          <StatCard label="Media items"     value={stats?.media_count ?? 0} />
        </div>
      </section>

      {/* ---- Inference banner ------------------------------------------- */}
      {teamsInferred && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">The teams below were reconstructed, not recorded.</p>
            <p className="mt-1 leading-relaxed">
              This campaign had no team structure — it was an individual event, one agent per
              submission. The {stats?.total_teams ?? 0} teams shown here group agents by country,
              mirroring the organisers&rsquo; own country statistics. Every one is flagged{' '}
              <em>Inferred</em>, and agent-level figures are untouched.
            </p>
          </div>
        </div>
      )}

      {/* ---- Faction breakdown ------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">By faction</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ALL_FACTIONS.map((f) => {
            const row = factions.find((x) => x.faction_colour === f);
            return (
              <div key={f} className="rounded-xl border border-slate-200 bg-white p-4">
                <FactionChip faction={f} size="md" showDescription />
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Agents</dt>
                    <dd className="font-semibold tabular-nums">{formatCount(row?.agents_count ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Teams</dt>
                    <dd className="font-semibold tabular-nums">{formatCount(row?.teams_count ?? 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">{metric}</dt>
                    <dd className="font-semibold tabular-nums">{formatCount(row?.links_created ?? 0)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Leaderboard ------------------------------------------------- */}
      {leaderboard.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Top contributors</h2>
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {leaderboard.map((a, i) => (
              <li key={a.agent_id} className={podiumRowClass(i)}>
                <Link
                  href={`/agent/${a.handle.replace('@', '')}`}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-faction-blue active:bg-slate-100"
                >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${podiumRankClass(i)}`}>
                  <span className="sr-only">Rank </span>{i + 1}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink">
                  {a.handle}
                </span>
                {a.faction && <FactionChip faction={a.faction} />}
                <CountryName country={a.country} code={a.country_code} className="text-sm text-ink-muted" />
                <span className="w-16 text-right text-sm font-semibold tabular-nums text-ink">
                  {formatCount(a.links_created)}
                </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <CampaignMediaArchive
        campaignSlug={campaign.slug}
        items={media}
        selectedCategory={filters.media}
        requestedPage={filters.mediaPage}
        faction={filters.faction}
      />

      {/* ---- Countries --------------------------------------------------- */}
      {countries.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">By country</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-medium">Country</th>
                  <th className="px-4 py-2 text-right font-medium">Participants</th>
                  <th className="px-4 py-2 text-right font-medium">{metric}</th>
                  <th className="px-4 py-2 text-right font-medium">Best single agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {countries.map((c, i) => (
                  <tr key={c.country} className={podiumRowClass(i)}>
                    <td className="px-4 py-2 font-medium text-ink"><CountryName country={c.country} code={c.country_code} /></td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink-muted">
                      {formatCount(c.participants)}
                      {c.participants_with_unknown_links > 0 && (
                        <span className="ml-1 text-xs text-ink-faint" title="Participants whose figure the source did not record">
                          ({c.participants_with_unknown_links} unrecorded)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink">{formatCount(c.total_links)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink-muted">{formatCount(c.max_links_by_one_agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- Teams ------------------------------------------------------- */}
      <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              Teams <span className="text-ink-faint">({teams.length})</span>
            </h2>
            <FactionFilter />
          </div>
        {teams.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => <TeamCard key={t.id} team={t} />)}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
            No teams match this faction.
          </p>
        )}
      </section>

      {/* ---- Footnotes --------------------------------------------------- */}
      {(disagreements.length > 0 || rowLevel.length > 0 || snapshot) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <FileWarning className="h-5 w-5 text-ink-faint" aria-hidden /> Source notes
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            This campaign was imported from material that predates Brill Ops. Nothing ambiguous
            was discarded — the unresolved points are listed here.
          </p>

          {disagreements.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-ink">
                Where the original sources disagree ({disagreements.length})
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-ink-muted">
                {disagreements.map((a) => (
                  <li key={a.id} className="rounded-lg bg-amber-50 px-3 py-2">
                    <span className="font-medium text-ink">{a.subject}</span> — {a.resolution}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rowLevel.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-ink">
                Incomplete records ({rowLevel.length})
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
                {rowLevel.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium text-ink">{a.subject ?? a.anomaly_type}</span>{' '}
                    <span className="text-ink-faint">({a.anomaly_type.replace(/_/g, ' ')})</span> — {a.resolution}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot?.source_reported_stats && (
            <p className="mt-5 text-xs text-ink-faint">
              The organisers&rsquo; own published figures are preserved alongside these
              calculated ones and were not edited to match.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function podiumRowClass(index: number): string {
  if (index === 0) return 'bg-amber-50/80';
  if (index === 1) return 'bg-slate-100/80';
  if (index === 2) return 'bg-orange-50/70';
  return '';
}

function podiumRankClass(index: number): string {
  if (index === 0) return 'bg-amber-200 text-amber-950 ring-1 ring-amber-300';
  if (index === 1) return 'bg-slate-200 text-slate-800 ring-1 ring-slate-300';
  if (index === 2) return 'bg-orange-200 text-orange-950 ring-1 ring-orange-300';
  return 'text-ink-faint';
}
