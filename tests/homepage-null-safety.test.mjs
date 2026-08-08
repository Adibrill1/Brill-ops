/**
 * The homepage must render even when there is no public current campaign — the
 * live state, since Stars for Peace is an unpublished draft with no dates. These
 * are the formatting primitives the hero and countdown lean on; if any of them
 * threw on a null/absent value the Server Component render would 500.
 *
 * Run with:  node --test --experimental-strip-types
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateRange,
  formatDate,
  daysUntil,
  formatCount,
} from '../src/lib/format.ts';

test('a campaign with no dates renders as text, not a crash', () => {
  // Stars for Peace has null start_date and end_date.
  assert.equal(formatDateRange(null, null), 'Dates not set');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate(undefined), '—');
});

test('daysUntil tolerates a missing end date (drives the countdown)', () => {
  assert.equal(daysUntil(null), null);
  assert.equal(daysUntil(undefined), null);
});

test('an unknown count is shown as missing, never zero', () => {
  assert.equal(formatCount(null), '—');
  assert.equal(formatCount(undefined), '—');
  assert.equal(formatCount(0), '0');
});

test('a one-day campaign collapses to a single date', () => {
  assert.equal(formatDateRange('2020-07-31', '2020-07-31'), formatDate('2020-07-31'));
});
