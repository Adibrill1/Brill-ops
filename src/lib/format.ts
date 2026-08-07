/**
 * Formatting helpers with one opinion running through them: a missing value is
 * shown as missing, never as zero. The 2020 archive contains four agents whose
 * contribution the source never recorded, and rendering them as "0 links" would
 * misrepresent four real people.
 */

/** `null` means the source was silent. Say so. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en').format(value);
}

export function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat('en').format(value)}${suffix}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Dates not set';
  if (start && end && start === end) return formatDate(start);
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  return formatDate(start ?? end);
}

/** Days remaining until `end`. Negative means it is over. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
