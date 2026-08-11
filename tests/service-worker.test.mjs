import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('public/sw.js', 'utf8');

test('the service worker never caches live navigation responses', () => {
  assert.doesNotMatch(worker, /put\(request/);
  assert.doesNotMatch(worker, /caches\.match\(['"]\/['"]\)/);
});

test('failed navigation shows a dedicated static offline page', () => {
  assert.match(worker, /OFFLINE_URL\s*=\s*['"]\/offline['"]/);
  assert.match(worker, /request\.mode\s*===\s*['"]navigate['"]/);
  assert.match(worker, /caches\.match\(OFFLINE_URL\)/);
});
