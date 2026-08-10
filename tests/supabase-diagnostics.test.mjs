/**
 * The connectivity classifier must name the five failure modes correctly and,
 * above all, never emit a secret. These are pure and need no network.
 *
 * Run with:  node --test --experimental-strip-types
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeUrlProblem,
  sanitizeFetchError,
  classifyPostgrestError,
} from '../src/lib/supabase/diagnostics.ts';

test('describeUrlProblem flags the classic paste mistakes (failure case 1)', () => {
  assert.equal(describeUrlProblem('https://ref.supabase.co'), null);
  assert.match(describeUrlProblem('https://ref.supabase.co '), /whitespace/);
  assert.match(describeUrlProblem('https://ref.supabase.co\n'), /whitespace|control character/);
  assert.match(describeUrlProblem('http://ref.supabase.co'), /https/);
  assert.match(describeUrlProblem('ref.supabase.co'), /valid absolute URL|https/);
  assert.match(describeUrlProblem(''), /empty/);
  assert.match(describeUrlProblem(undefined), /empty/);
});

test('a DNS failure is classified as dns-failure with safe fields (case 2)', () => {
  const err = new TypeError('fetch failed');
  err.cause = Object.assign(new Error('getaddrinfo ENOTFOUND ref.supabase.co'), {
    code: 'ENOTFOUND',
    errno: -3008,
    syscall: 'getaddrinfo',
    hostname: 'ref.supabase.co',
  });
  const d = sanitizeFetchError(err, 'https://ref.supabase.co/rest/v1/campaigns?select=*');
  assert.equal(d.classification, 'dns-failure');
  assert.equal(d.code, 'ENOTFOUND');
  assert.equal(d.errno, -3008);
  assert.equal(d.syscall, 'getaddrinfo');
  assert.equal(d.hostname, 'ref.supabase.co');
  assert.equal(d.host, 'ref.supabase.co');
  assert.equal(d.path, '/rest/v1/campaigns'); // query string dropped
});

test('a refused/reset/timeout is connectivity-failure (case 3)', () => {
  for (const code of ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH']) {
    const err = new TypeError('fetch failed');
    err.cause = Object.assign(new Error('connect'), { code, syscall: 'connect' });
    assert.equal(sanitizeFetchError(err, 'https://ref.supabase.co').classification, 'connectivity-failure');
  }
});

test('a certificate problem is tls-failure (case 3)', () => {
  const err = new TypeError('fetch failed');
  err.cause = Object.assign(new Error('unable to verify the first certificate'), {
    code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  });
  assert.equal(sanitizeFetchError(err, 'https://ref.supabase.co').classification, 'tls-failure');
});

test('PostgREST errors are distinguished from transport failures (cases 4/5)', () => {
  // supabase-js reports a transport failure as a normal error with this message.
  assert.equal(classifyPostgrestError({ message: 'TypeError: fetch failed' }).classification, 'connectivity-failure');
  // A real query error keeps its code and is tagged postgrest-error.
  const pg = classifyPostgrestError({ message: 'relation "campaigns" does not exist', code: '42P01' });
  assert.equal(pg.classification, 'postgrest-error');
  assert.equal(pg.code, '42P01');
});

test('never logs a token — JWT-shaped strings are scrubbed', () => {
  const leaky = `boom eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abcDEF-123_456 tail`;
  const err = new TypeError('fetch failed');
  err.cause = Object.assign(new Error(leaky), { code: 'ECONNRESET' });
  const d = sanitizeFetchError(err, 'https://ref.supabase.co');
  assert.doesNotMatch(d.causeMessage ?? '', /eyJ/);
  assert.match(d.causeMessage ?? '', /\[redacted-token\]/);
});
