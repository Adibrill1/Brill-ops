import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { FactionChip } from '@/components/FactionChip';
import { StatCard } from '@/components/StatCard';
import { agentFactionLabel } from '@/lib/factions';
import { formatCount } from '@/lib/format';
import { getAgentByHandle, getAgentParticipation } from '@/lib/queries';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

/**
 * A permanent agent profile spanning every campaign.
 *
 * The profile exists whether or not the person has ever signed in. When they do,
 * `is_claimed` flips and this same page becomes theirs — no data migration,
 * because participation was never tied to an account.
 */
export default async function AgentPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const agent = await getAgentByHandle(handle);
  if (!agent) notFound();

  const participation = await getAgentParticipation(agent.agent_id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-ink-muted">
          {agent.display_name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-ink">{agent.handle}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            {agent.faction && <FactionChip faction={agent.faction} />}
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {[agent.city, agent.country].filter(Boolean).join(', ') || 'Location not recorded'}
            </span>
          </p>
          {!agent.is_claimed && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted">
              This profile was created from campaign records and has not been claimed. If this is
              you, sign in with Google to take ownership — your history is already here.
            </p>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Lifetime</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Campaigns"  value={agent.campaigns_participated} />
          <StatCard label="Teams joined" value={agent.teams_joined} />
          <StatCard
            label="Total links"
            value={agent.total_links_created}
            unknownCount={agent.campaigns_with_unknown_links}
          />
          <StatCard label="Completed projects" value={agent.completed_projects} />
        </div>
      </section>

      {agent.faction_history.length > 1 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-ink">Faction history</h2>
          <p className="text-sm text-ink-muted">
            Recorded under {agent.faction_history.map((f) => agentFactionLabel(f as 'blue')).join(', ')}.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Campaign participation</h2>
        {participation.length === 0 ? (
          <p className="text-sm text-ink-muted">No campaign participation recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {participation.map((p) => (
              <li key={p.campaign_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link
                  href={
                    p.campaign.status === 'archived'
                      ? `/archive/${p.campaign.slug}`
                      : '/'
                  }
                  className="flex-1 text-sm font-medium text-ink hover:underline"
                >
                  {p.campaign.name}
                </Link>
                {p.is_crossfaction_participant && <FactionChip faction="crossfaction" />}
                <span className="text-sm tabular-nums text-ink-muted">
                  {formatCount(p.links_created)} links
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
