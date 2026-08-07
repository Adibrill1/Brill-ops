import type { AgentFaction, FactionColour } from '@/types/database';

/**
 * The single place the Crossfaction vocabulary is defined.
 *
 * Blue = Resistance, Green = Enlightened, and anything combining the two is
 * CROSSFACTION — one word, spelled this way in the database enum, the URL query
 * parameters and every label the user sees. If you find yourself typing "mixed"
 * or "XF", come back here instead.
 */
export const FACTION_LABEL: Record<FactionColour, string> = {
  blue: 'Blue',
  green: 'Green',
  crossfaction: 'Crossfaction',
};

/** Long form, used in tooltips and the archive's explanatory copy. */
export const FACTION_DESCRIPTION: Record<FactionColour, string> = {
  blue: 'Resistance',
  green: 'Enlightened',
  crossfaction: 'Blue and Green working together',
};

export const FACTION_CLASSES: Record<FactionColour, { chip: string; bar: string; ring: string }> = {
  blue: {
    chip: 'bg-faction-blue-soft text-faction-blue',
    bar: 'bg-faction-blue',
    ring: 'ring-faction-blue/30',
  },
  green: {
    chip: 'bg-faction-green-soft text-faction-green',
    bar: 'bg-faction-green',
    ring: 'ring-faction-green/30',
  },
  crossfaction: {
    chip: 'bg-faction-crossfaction-soft text-faction-crossfaction',
    bar: 'bg-faction-crossfaction',
    ring: 'ring-faction-crossfaction/30',
  },
};

export const ALL_FACTIONS: FactionColour[] = ['blue', 'green', 'crossfaction'];

/**
 * Derive a group's faction from its members.
 *
 * Mirrors exactly what scripts/import-big-bang.mjs does for the 2020 archive, so
 * an imported team and a submitted team are classified by the same rule.
 * Twelve of the 32 Big Bang country teams come out crossfaction this way.
 */
export function deriveGroupFaction(
  memberFactions: Array<AgentFaction | null | undefined>,
): FactionColour {
  const present = new Set(memberFactions.filter(Boolean) as AgentFaction[]);
  if (present.size > 1) return 'crossfaction';
  return (present.values().next().value as FactionColour) ?? 'crossfaction';
}

/** An individual is never crossfaction — only the group they worked in is. */
export function agentFactionLabel(faction: AgentFaction | null): string {
  if (!faction) return 'Unrecorded';
  return `${FACTION_LABEL[faction]} · ${FACTION_DESCRIPTION[faction]}`;
}
