import { PrismaClient } from '@prisma/client';
import { manualQaSettings, verifyManualQaDatabase } from './manual-qa';
import { organizationDomain } from '../../platform/organizations/organization-domain';
const schema = 'finstack_manual_qa_' + 'a'.repeat(32);
const enabled = {
  FINSTACK_MANUAL_QA: '1',
  NODE_ENV: 'development',
  FINSTACK_MANUAL_QA_BIND_HOST: '127.0.0.1',
  DATABASE_URL: `postgresql://127.0.0.1:5432/finstack?schema=${schema}`,
};
describe('Fail-closed local manual QA', () => {
  it('keeps ordinary mode strict and limits QA relaxation to .test', () => {
    expect(manualQaSettings({})).toBeNull();
    expect(organizationDomain('office@fictional.test')).toBeNull();
    expect(organizationDomain('office@fictional.example')).toBeNull();
    expect(organizationDomain('office@fictional.test', true)).toBe(
      'fictional.test',
    );
    expect(organizationDomain('office@fictional.example', true)).toBeNull();
    expect(organizationDomain('office@gmail.com', true)).toBeNull();
  });
  it('accepts the explicit loopback configuration', () => {
    expect(manualQaSettings(enabled)?.schema).toBe(schema);
  });
  it.each([
    { FINSTACK_MANUAL_QA: 'true' },
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { FINSTACK_MANUAL_QA_BIND_HOST: '0.0.0.0' },
    { DATABASE_URL: 'postgresql://127.0.0.1/finstack?schema=public' },
    {
      DATABASE_URL: `postgresql://db.example.org/finstack?schema=${schema}`,
    },
    {
      DATABASE_URL: `postgresql://127.0.0.1/finstack?schema=${schema}&schema=public`,
    },
    {
      DATABASE_URL: `postgresql://127.0.0.1/finstack?schema=${schema}&options=-csearch_path=public`,
    },
    {
      DATABASE_URL: `postgresql://127.0.0.1/finstack?schema=${schema}&search_path=public`,
    },
    { DATABASE_URL: 'not-a-url' },
  ])('rejects unsafe startup overrides: %j', (overrides) => {
    expect(() => manualQaSettings({ ...enabled, ...overrides })).toThrow(
      'Manual QA requires',
    );
  });
  it('verifies actual database/schema, loopback server and completed migrations', async () => {
    const previous = { ...process.env };
    Object.assign(process.env, enabled);
    const query = jest
      .fn()
      .mockResolvedValue([
        { schema: 'public', database: 'finstack', serverAddress: '127.0.0.1' },
      ]);
    const db = { $queryRaw: query } as unknown as PrismaClient;
    try {
      await expect(verifyManualQaDatabase(db)).rejects.toThrow('mismatch');
      query.mockResolvedValueOnce([
        { schema, database: 'finstack', serverAddress: '192.0.2.1' },
      ]);
      await expect(verifyManualQaDatabase(db)).rejects.toThrow('mismatch');
      query
        .mockResolvedValueOnce([
          { schema, database: 'finstack', serverAddress: '127.0.0.1' },
        ])
        .mockResolvedValueOnce([]);
      await expect(verifyManualQaDatabase(db)).rejects.toThrow('migrations');
      query
        .mockResolvedValueOnce([
          { schema, database: 'finstack', serverAddress: '127.0.0.1' },
        ])
        .mockResolvedValueOnce([
          {
            migration_name: 'not-in-this-checkout',
            finished_at: new Date(),
            rolled_back_at: null,
          },
        ]);
      await expect(verifyManualQaDatabase(db)).rejects.toThrow('migrations');
    } finally {
      process.env = previous;
    }
  });
});
