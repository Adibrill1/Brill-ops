import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.mjs';

test('every route receives the conservative security header set', async () => {
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === '/:path*');
  assert.ok(globalRule, 'a global header rule must exist');

  const headers = Object.fromEntries(
    globalRule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
  assert.deepEqual(headers, {
    'content-security-policy': "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-permitted-cross-domain-policies': 'none',
  });
});

test('Next.js does not advertise its framework in production responses', () => {
  assert.equal(nextConfig.poweredByHeader, false);
});

test('the service worker keeps its explicit no-stale-cache policy', async () => {
  const rules = await nextConfig.headers();
  const workerRule = rules.find((rule) => rule.source === '/sw.js');
  assert.deepEqual(workerRule?.headers, [
    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
  ]);
});
