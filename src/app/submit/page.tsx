import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { ALL_FACTIONS, FACTION_DESCRIPTION, FACTION_LABEL } from '@/lib/factions';
import { getActiveCampaign } from '@/lib/queries';

export const metadata: Metadata = { title: 'Submit a team' };

/**
 * Team submission.
 *
 * The form below is the complete field set the handoff specifies and is wired to
 * the schema, but it is **not yet connected to a write path** — the Google sign-in
 * step and the server action are the next piece of work. It renders read-only so
 * the required shape is visible and reviewable rather than described in a ticket.
 *
 * Note the faction control: Crossfaction is a first-class choice at submission
 * time, not something derived later, because a team knows what it is when it forms.
 */
export default async function SubmitPage() {
  const campaign = await getActiveCampaign();

  if (!campaign) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-ink">No campaign is open</h1>
        <p className="text-sm text-ink-muted">
          Submissions open when a campaign becomes active. In the meantime, the Archive has
          everything from previous operations.
        </p>
        <Link
          href="/archive"
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Go to the Archive
        </Link>
      </div>
    );
  }

  const field =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm ' +
    'focus:border-faction-blue focus:outline-none focus:ring-1 focus:ring-faction-blue';
  const label = 'block text-sm font-medium text-ink';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Submit your team</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Joining <span className="font-medium text-ink">{campaign.name}</span>. You can come
          back and update this at any time while the campaign is running.
        </p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Not yet live.</strong> Sign-in and saving are the next piece of work. The
        fields below are the final shape and match the database exactly.
      </div>

      <form className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <fieldset disabled className="space-y-5">
          <div>
            <label className={label} htmlFor="name">Team name</label>
            <input id="name" name="name" className={`mt-1 ${field}`} />
          </div>

          <div>
            <span className={label}>Faction</span>
            <div className="mt-2 space-y-2">
              {ALL_FACTIONS.map((f) => (
                <label key={f} className="flex items-start gap-2 text-sm">
                  <input type="radio" name="faction" value={f} className="mt-1" />
                  <span>
                    <span className="font-medium text-ink">{FACTION_LABEL[f]}</span>
                    <span className="ml-1 text-ink-muted">— {FACTION_DESCRIPTION[f]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="city">City</label>
              <input id="city" name="city" className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={label} htmlFor="country">Country</label>
              <input id="country" name="country" className={`mt-1 ${field}`} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="portal">Portal address</label>
            <input id="portal" name="portal_address" className={`mt-1 ${field}`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="start">Construction start date</label>
              <input id="start" name="construction_start_date" type="date" className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={label} htmlFor="end">Construction end date</label>
              <input id="end" name="construction_end_date" type="date" className={`mt-1 ${field}`} />
              <p className="mt-1 text-xs text-ink-faint">
                Leave blank while in progress — status is worked out from this.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="links">
                {campaign.config?.metric_label ?? 'Links created'}
              </label>
              <input id="links" name="links_created" type="number" min={0} className={`mt-1 ${field}`} />
            </div>
            <div>
              <label className={label} htmlFor="agents">Agent names</label>
              <input id="agents" name="agents" placeholder="@agent1, @agent2" className={`mt-1 ${field}`} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="start-photo">Start photo</label>
              <input id="start-photo" type="file" accept="image/*" className="mt-1 text-sm" />
            </div>
            <div>
              <label className={label} htmlFor="end-photos">End photos</label>
              <input id="end-photos" type="file" accept="image/*" multiple className="mt-1 text-sm" />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="media">Additional media</label>
            <input id="media" type="file" accept="image/*,video/*" multiple className="mt-1 text-sm" />
          </div>
        </fieldset>

        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-medium text-ink-faint"
        >
          Sign in with Google to submit
        </button>
      </form>
    </div>
  );
}
