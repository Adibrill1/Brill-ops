/** ISO 3166-1 alpha-2 codes for country values currently present in production. */
const COUNTRY_CODES: Record<string, string> = {
  argentina: 'AR', australia: 'AU', belarus: 'BY', belgium: 'BE', bolivia: 'BO',
  brazil: 'BR', bulgaria: 'BG', canada: 'CA', china: 'CN', czechia: 'CZ',
  finland: 'FI', france: 'FR', germany: 'DE', greece: 'GR', india: 'IN',
  israel: 'IL', italy: 'IT', japan: 'JP', luxembourg: 'LU', mayotte: 'YT',
  mexico: 'MX', netherlands: 'NL', peru: 'PE', portugal: 'PT', romania: 'RO',
  russia: 'RU', spain: 'ES', sweden: 'SE', thailand: 'TH', ukraine: 'UA',
  'united kingdom': 'GB', 'united states': 'US',
};

const ALIASES: Record<string, string> = {
  uk: 'GB', 'u k': 'GB', 'great britain': 'GB',
  usa: 'US', 'u s a': 'US', 'united states of america': 'US',
  'czech republic': 'CZ',
};

function normalizeCountry(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

export function countryCodeForName(country: string | null | undefined): string | null {
  if (!country) return null;
  const normalized = normalizeCountry(country);
  return COUNTRY_CODES[normalized] ?? ALIASES[normalized] ?? null;
}

export function flagEmoji(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return [...code.toUpperCase()]
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
}
