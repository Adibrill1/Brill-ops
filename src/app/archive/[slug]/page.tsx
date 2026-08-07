import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AlertTriangle, FileWarning } from 'lucide-react';
import { FactionChip } from '@/components/FactionChip';
import { StatCard } from '@/components/StatCard';
import { TeamCard } from '@/components/TeamCard';
import { ALL_FACTIONS } from '@/lib/factions';
import { formatCount, formatDateRange } from '@/lib/format';
import {
  getArchiveSnapshot,
  getCampaignBySlug,
  getCampaignLeaderboard,
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

  const [stats, factions, countries, teams, leaderboard, snapshot, anomalies] = await Promise.all([
    getCampaignStats(campaign.id),
    getFactionStats(campaign.id),
    getCountryStats(campaign.id),
    getTeams(campaign.id, { faction: filters.faction, sort: 'links' }),
    getCampaignLeaderboard(campaign.id, 10),
    getArchiveSnapshot(campaign.id),
    getImportAnomalies(campaign.id),
  ]);

  const metric = campaign.config?.metric_label ?? 'links created';
  const teamsInferred = campaign.config?.teams_are_inferred === true;
  const disagreements = anomalies.filter((a) => a.anomaly_type === 'source_disagreement');
  const rowLevel = anomalies.filter((a) => a.anomaly_type !== 'source_disagreement');

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-ink px-6 py-10 text-white">
        <p className="text-xs font-medium uppercase tracking-widest opacity-70">Archived campaign</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-1 text-sm opacity-80">
          {formatDateRange(campaign.start_date, campaign.end_date)}
        </p>
        {campaign.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90">{campaign.description}</p>
        )}
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
          <StatCard label="Top country"     value={stats?.top_country ?? '—'} />
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
              <li key={a.agent_id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-sm font-semibold tabular-nums text-ink-faint">{i + 1}</span>
                <a href={`/agent/${a.handle.replace('@', '')}`} className="flex-1 truncate text-sm font-medium text-ink hover:underline">
                  {a.handle}
                </a>
                {a.faction && <FactionChip faction={a.faction} />}
                <span className="text-sm tabular-nums text-ink-muted">{a.country ?? '—'}</span>
                <span className="w-16 text-right text-sm font-semibold tabular-nums text-ink">
                  {formatCount(a.links_created)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

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
                {countries.map((c) => (
                  <tr key={c.country}>
                    <td className="px-4 py-2 font-medium text-ink">{c.country}</td>
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
      {teams.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">
            Teams <span className="text-ink-faint">({teams.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => <TeamCard key={t.id} team={t} />)}
          </div>
        </section>
      )}

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
