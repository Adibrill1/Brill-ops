import test from 'node:test';
import assert from 'node:assert/strict';
import { countryCodeForName, flagEmoji } from '../src/lib/countries.ts';

const PRODUCTION_COUNTRIES = [
  'Argentina', 'Australia', 'Belarus', 'Belgium', 'Bolivia', 'Brazil', 'Bulgaria',
  'Canada', 'China', 'Czechia', 'Finland', 'France', 'Germany', 'Greece', 'India',
  'Israel', 'Italy', 'Japan', 'Luxembourg', 'Mayotte', 'Mexico', 'Netherlands',
  'Peru', 'Portugal', 'Romania', 'Russia', 'Spain', 'Sweden', 'Thailand', 'Ukraine',
  'United Kingdom', 'United States',
];

test('every country currently stored in production has an ISO code', () => {
  for (const country of PRODUCTION_COUNTRIES) {
    assert.match(countryCodeForName(country) ?? '', /^[A-Z]{2}$/, country);
  }
});

test('common aliases normalize to the canonical ISO code', () => {
  assert.equal(countryCodeForName('USA'), 'US');
  assert.equal(countryCodeForName('Great Britain'), 'GB');
  assert.equal(countryCodeForName('Czech Republic'), 'CZ');
});

test('unknown and missing countries render without a bogus flag', () => {
  assert.equal(countryCodeForName('Unknown place'), null);
  assert.equal(countryCodeForName(null), null);
  assert.equal(flagEmoji(null), null);
});
