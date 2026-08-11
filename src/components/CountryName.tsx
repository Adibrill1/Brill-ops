import { countryCodeForName, flagEmoji } from '@/lib/countries';

export function CountryName({
  country,
  code,
  className = '',
}: {
  country: string | null | undefined;
  code?: string | null;
  className?: string;
}) {
  if (!country) return <span className={className}>—</span>;
  const flag = flagEmoji(code ?? countryCodeForName(country));

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {flag && <span aria-hidden="true" className="shrink-0 text-sm leading-none">{flag}</span>}
      <span>{country}</span>
    </span>
  );
}
