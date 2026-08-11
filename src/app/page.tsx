import Link from 'next/link';
import { ArrowRight, Globe2, Users, Zap } from 'lucide-react';
import { Countdown } from '@/components/Countdown';
import { FactionChip } from '@/components/FactionChip';
import { InstallPrompt } from '@/components/InstallPrompt';
import { StatCard } from '@/components/StatCard';
import { TeamCard } from '@/components/TeamCard';
import { TeamFilters } from '@/components/TeamFilters';
import { ALL_FACTIONS } from '@/lib/factions';
import { formatCount, formatDateRange } from '@/lib/format';
import {
  getActiveCampaign,
  getArchivedCampaigns,
  getCampaignStats,
  getCountryStats,
  getFactionStats,
  getTeams,
} from '@/lib/queries';
import type { FactionColour } from '@/types/database';

export const revalidate = 60;

/**
 * The homepage always shows the currently active campaign.
 *
 * Right now there is no active campaign — Stars for Peace is a draft awaiting
 * real dates and branding, because none were supplied with the handoff. That
 * case is handled explicitly rather than crashing or rendering an empty shell.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = await searchParams;
  const campaign = await getActiveCampaign();

  if (!campaign) return <NoActiveCampaign />;

  const [stats, factions, countries, teams] = await Promise.all([
    getCampaignStats(campaign.id),
    getFactionStats(campaign.id),
    getCountryStats(campaign.id),
    getTeams(campaign.id, {
      faction: filters.faction,
      status: filters.status,
      country: filters.country,
      sort: (filters.sort as 'links') ?? 'links',
    }),
  ]);

  const metric = campaign.config?.metric_label ?? 'links created';

  return (
    <div className="space-y-10">
      {/* ---- Hero ------------------------------------------------------- */}
      <section
        className="overflow-hidden rounded-2xl bg-ink px-6 py-10 text-white"
        style={campaign.brand_colour ? { backgroundColor: campaign.brand_colour } : undefined}
      >
        <p className="text-xs font-medium uppercase tracking-widest opacity-70">
          Active campaign
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{campaign.name}</h1>
        <p className="mt-1 text-sm opacity-80">
          {formatDateRange(campaign.start_date, campaign.end_date)}
        </p>
        {campaign.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90">
            {campaign.description}
          </p>
        )}

        <div className="mt-6">
          <Countdown endDate={campaign.end_date} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100 active:translate-y-px"
          >
            Join this campaign <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <InstallPrompt />
        </div>
      </section>

      {/* ---- Live statistics -------------------------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Live statistics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Countries"   value={stats?.countries ?? 0} />
          <StatCard label="Cities"      value={stats?.cities ?? 0} />
          <StatCard label="Teams"       value={stats?.total_teams ?? 0} />
          <StatCard label="Agents"      value={stats?.total_agents ?? 0} />
          <StatCard
            label={`Total ${metric}`}
            value={stats?.total_links_created ?? null}
            unknownCount={stats?.agents_with_unknown_links}
          />
          <StatCard label="Avg per team"    value={stats?.avg_links_per_team ?? null} confidence="computed" />
          <StatCard label="Largest team"    value={stats?.largest_team ?? '—'} />
          <StatCard label="Top contributor" value={stats?.top_contributor ?? '—'} />
        </div>
      </section>

      {/* ---- Faction breakdown ------------------------------------------ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">By faction</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ALL_FACTIONS.map((f) => {
            const row = factions.find((x) => x.faction_colour === f);
            return <FactionPanel key={f} faction={f} row={row} metric={metric} />;
          })}
        </div>
        <p className="mt-2 text-xs text-ink-faint">
          An agent is Blue or Green. The Crossfaction figure counts agents who worked on a
          team containing both.
        </p>
      </section>

      {/* ---- Team dashboard --------------------------------------------- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">
            Teams <span className="text-ink-faint">({teams.length})</span>
          </h2>
          <TeamFilters countries={countries} />
        </div>

        {teams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
            No teams match these filters yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((t) => <TeamCard key={t.id} team={t} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function FactionPanel({
  faction,
  row,
  metric,
}: {
  faction: FactionColour;
  row?: { agents_count: number; teams_count: number; links_created: number };
  metric: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <FactionChip faction={faction} size="md" showDescription />
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row icon={Users}  label="Agents"      value={row?.agents_count ?? 0} />
        <Row icon={Globe2} label="Teams"       value={row?.teams_count ?? 0} />
        <Row icon={Zap}    label={metric}      value={row?.links_created ?? 0} />
      </dl>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </dt>
      <dd className="font-semibold tabular-nums text-ink">{formatCount(value)}</dd>
    </div>
  );
}

/**
 * Shown when no campaign is active. Rather than a dead end, it points at the
 * Archive — which is fully populated from day one thanks to the 2020 import.
 */
async function NoActiveCampaign() {
  const archived = await getArchivedCampaigns();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-ink px-6 py-12 text-white">
        <h1 className="text-4xl font-semibold tracking-tight">Brill Ops</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-90">
          Campaign infrastructure for global community operations. There is no campaign
          running at the moment — the next one will appear here the day it opens.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/archive"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100 active:translate-y-px"
          >
            Browse the Archive <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <InstallPrompt />
        </div>
      </section>

      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-ink">Past campaigns</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {archived.map((c) => (
              <Link
                key={c.campaign_id}
                href={`/archive/${c.slug}`}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-faction-blue active:translate-y-0"
              >
                <h3 className="text-base font-semibold text-ink">{c.name}</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {formatDateRange(c.start_date, c.end_date)}
                </p>
                <p className="mt-3 text-sm text-ink-muted">
                  {formatCount(c.total_agents)} agents · {formatCount(c.countries)} countries ·{' '}
                  {formatCount(c.total_links_created)} links
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
