import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';

export function manualQaSettings(env: NodeJS.ProcessEnv = process.env) {
  if (!env.FINSTACK_MANUAL_QA) return null;
  const fail = (): never => {
    throw new Error(
      'Manual QA requires explicit opt-in, development mode, loopback binding/database and an isolated finstack_manual_qa_<UUID> schema.',
    );
  };
  if (
    env.FINSTACK_MANUAL_QA !== '1' ||
    env.NODE_ENV !== 'development' ||
    env.FINSTACK_MANUAL_QA_BIND_HOST !== '127.0.0.1'
  )
    fail();
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL || '');
  } catch {
    return fail();
  }
  const schema = url.searchParams.get('schema') || '';
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.searchParams.getAll('schema').length !== 1 ||
    !/^finstack_manual_qa_[a-f0-9]{32}$/.test(schema) ||
    url.searchParams.has('options') ||
    url.searchParams.has('search_path') ||
    !url.pathname.slice(1)
  )
    fail();
  return {
    schema,
    database: decodeURIComponent(url.pathname.slice(1)),
    host: '127.0.0.1',
  };
}

export async function verifyManualQaDatabase(prisma: PrismaClient) {
  const settings = manualQaSettings();
  if (!settings) return false;
  const [actual] = await prisma.$queryRaw<
    Array<{ schema: string; database: string; serverAddress: string }>
  >`SELECT current_schema() AS schema, current_database() AS database, host(inet_server_addr()) AS "serverAddress"`;
  if (
    actual?.schema !== settings.schema ||
    actual.database !== settings.database ||
    !['127.0.0.1', '::1'].includes(actual.serverAddress)
  )
    throw new Error('Manual QA database/schema mismatch.');
  const migrations = await prisma.$queryRaw<
    Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>
  >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
  const expected = readdirSync(resolve(process.cwd(), 'prisma/migrations'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const expectedNames = new Set(expected);
  if (
    !expected.length ||
    expected.some(
      (name) =>
        !migrations.some(
          (row) =>
            row.migration_name === name &&
            row.finished_at &&
            !row.rolled_back_at,
        ),
    ) ||
    migrations.some(
      (row) =>
        (!row.finished_at && !row.rolled_back_at) ||
        (!!row.finished_at &&
          !row.rolled_back_at &&
          !expectedNames.has(row.migration_name)),
    )
  )
    throw new Error(
      'Manual QA requires all existing migrations successfully applied to its isolated schema.',
    );
  return true;
}
