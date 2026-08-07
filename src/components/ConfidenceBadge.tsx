import type { DataConfidence } from '@/types/database';

const STYLES: Record<DataConfidence, { label: string; className: string; title: string }> = {
  source:    { label: 'Source',    className: 'hidden',                          title: '' },
  computed:  { label: 'Computed',  className: 'bg-slate-100 text-ink-muted',     title: 'Calculated from source values.' },
  inferred:  { label: 'Inferred',  className: 'bg-amber-100 text-amber-800',     title: 'Reasoned from context. The source never stated this directly.' },
  estimated: { label: 'Estimated', className: 'bg-orange-100 text-orange-800',   title: 'A placeholder, chosen so the record is usable.' },
  unknown:   { label: 'Unknown',   className: 'bg-slate-200 text-ink-muted',     title: 'The source is silent. This is not zero.' },
};

/**
 * Renders nothing for 'source' data, and a visible badge for everything else.
 *
 * This is the UI half of the promise made in the schema: imported data can never
 * quietly pass itself off as first-hand. All 32 teams in the 2020 archive carry
 * this badge, because that campaign had no teams and they were reconstructed.
 */
export function ConfidenceBadge({
  confidence,
  basis,
  className = '',
}: {
  confidence: DataConfidence;
  /** The `inference_basis` from the database — shown on hover. */
  basis?: string | null;
  className?: string;
}) {
  if (confidence === 'source') return null;
  const style = STYLES[confidence];

  return (
    <span
      title={basis ?? style.title}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.className} ${className}`}
    >
      {style.label}
    </span>
  );
}
