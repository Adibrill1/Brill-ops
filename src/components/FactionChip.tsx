import { FACTION_CLASSES, FACTION_DESCRIPTION, FACTION_LABEL } from '@/lib/factions';
import type { FactionColour } from '@/types/database';

/**
 * The only component that renders a faction name. Because Crossfaction is spelled
 * once, in lib/factions.ts, it cannot drift into "Mixed" or "XF" anywhere in the UI.
 */
export function FactionChip({
  faction,
  size = 'sm',
  showDescription = false,
}: {
  faction: FactionColour;
  size?: 'sm' | 'md';
  showDescription?: boolean;
}) {
  const cls = FACTION_CLASSES[faction];
  const pad = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      title={FACTION_DESCRIPTION[faction]}
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cls.chip} ${pad}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cls.bar}`} aria-hidden />
      {FACTION_LABEL[faction]}
      {showDescription && (
        <span className="font-normal opacity-70">· {FACTION_DESCRIPTION[faction]}</span>
      )}
    </span>
  );
}
