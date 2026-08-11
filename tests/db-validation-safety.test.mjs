import test from 'node:test';
import assert from 'node:assert/strict';
import { validationConnection } from '../scripts/validate-sql.mjs';

test('SQL validation accepts only the named local throwaway database', () => {
  const url = 'postgresql://postgres:local-only@127.0.0.1:5432/brill_ops_validate';
  assert.deepEqual(validationConnection({ PGVALIDATE_URL: url }), { connectionString: url });

  assert.deepEqual(validationConnection({}), {
    host: '/tmp/pgtest',
    port: 54399,
    user: 'postgres',
    database: 'brill_ops_validate',
  });
});

test('SQL validation refuses a remote host even when the database name looks safe', () => {
  assert.throws(
    () => validationConnection({
      PGVALIDATE_URL:
        'postgresql://postgres:secret@db.example.supabase.co:5432/brill_ops_validate',
    }),
    /Refusing destructive SQL validation/,
  );
});

test('SQL validation refuses a local database with a non-disposable name', () => {
  assert.throws(
    () => validationConnection({
      PGVALIDATE_URL: 'postgresql://postgres:secret@localhost:5432/postgres',
    }),
    /Refusing destructive SQL validation/,
  );
});

test('SQL validation rejects malformed connection URLs without echoing them', () => {
  assert.throws(
    () => validationConnection({ PGVALIDATE_URL: 'not a database URL' }),
    { message: 'PGVALIDATE_URL must be a valid PostgreSQL URL.' },
  );
});

test('SQL validation rejects non-PostgreSQL URL protocols', () => {
  assert.throws(
    () => validationConnection({ PGVALIDATE_URL: 'https://localhost/brill_ops_validate' }),
    { message: 'PGVALIDATE_URL must use the postgres or postgresql protocol.' },
  );
});
