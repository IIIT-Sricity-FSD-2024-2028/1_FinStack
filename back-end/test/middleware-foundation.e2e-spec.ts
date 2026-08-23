import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/common/config/configure-http-application';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

interface LogRecord {
  context?: string;
  durationMs?: number;
  exceptionEvent?: boolean;
  level?: string;
  message?: string;
  method?: string;
  path?: string;
  requestId?: string;
  statusCode?: number;
}

describe('Client middleware foundation (e2e)', () => {
  let app: INestApplication;
  let dashboardService: DashboardService;
  let logDirectory: string;

  beforeAll(async () => {
    logDirectory = mkdtempSync(join(tmpdir(), 'finstack-client-logs-'));
    process.env.NODE_ENV = 'test';
    process.env.LOG_DIRECTORY = logDirectory;
    process.env.CORS_ORIGINS = 'http://localhost:5500';
    process.env.THROTTLE_TTL_SECONDS = '60';
    process.env.THROTTLE_LIMIT = '4';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApplication(app);
    await app.init();
    dashboardService = app.get(DashboardService);
  });

  afterAll(async () => {
    await app?.close();
    rmSync(logDirectory, { recursive: true, force: true });
    delete process.env.LOG_DIRECTORY;
    delete process.env.CORS_ORIGINS;
    delete process.env.THROTTLE_TTL_SECONDS;
    delete process.env.THROTTLE_LIMIT;
  });

  it('adds distinct server-generated UUID request IDs to Client routes', async () => {
    const first = await request(app.getHttpServer())
      .get('/users')
      .set('role', 'superuser')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/categories')
      .set('role', 'superuser')
      .expect(200);

    expect(first.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(first.headers['x-request-id']).not.toBe(
      second.headers['x-request-id'],
    );
  });

  it('replaces a caller-supplied request ID with a server-generated UUID', async () => {
    const suppliedRequestId = 'caller-controlled-request-id';
    const response = await request(app.getHttpServer())
      .get('/expenses')
      .set('role', 'superuser')
      .set('X-Request-ID', suppliedRequestId)
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(response.headers['x-request-id']).not.toBe(suppliedRequestId);
  });

  it('does not apply Client-scoped request middleware to an unrelated route', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(404);

    expect(response.headers['x-request-id']).toBeUndefined();
    expect(response.body.requestId).toBeUndefined();
  });

  it('preserves success envelopes and supports a normal Client state load', async () => {
    const paths = [
      '/users',
      '/expenses',
      '/categories',
      '/policies',
      '/notifications',
      '/audit',
      '/transactions',
      '/reports',
      '/dashboard',
    ];

    for (const path of paths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('role', 'superuser')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
    }
  });

  it('keeps known guard and validation errors useful and correlated', async () => {
    const forbidden = await request(app.getHttpServer())
      .get('/users')
      .expect(403);

    expect(forbidden.body).toMatchObject({
      success: false,
      message: 'A valid role header is required.',
      requestId: forbidden.headers['x-request-id'],
    });

    const validation = await request(app.getHttpServer())
      .post('/categories')
      .set('role', 'admin')
      .set('Authorization', 'Bearer SECRET_AUTH_TOKEN')
      .send({ name: 'SECRET_BODY_VALUE' })
      .expect(400);

    expect(validation.body.success).toBe(false);
    expect(validation.body.message).toContain('limit must not be less than 0');
    expect(validation.body.requestId).toBe(validation.headers['x-request-id']);
  });

  it('sanitizes unexpected errors and preserves server-side correlation', async () => {
    const overview = jest
      .spyOn(dashboardService, 'overview')
      .mockImplementationOnce(() => {
        throw new Error('SECRET_INTERNAL_FAILURE');
      });

    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .set('role', 'superuser')
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      message: 'Internal server error',
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toContain('SECRET_INTERNAL_FAILURE');
    overview.mockRestore();
  });

  it('sets Helmet headers and enforces the configured CORS allowlist', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/policies')
      .set('role', 'superuser')
      .set('Origin', 'http://localhost:5500')
      .expect(200);

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5500',
    );
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    expect(allowed.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(allowed.headers['content-security-policy']).toContain(
      "script-src 'self';",
    );
    expect(allowed.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );

    const disallowed = await request(app.getHttpServer())
      .get('/policies')
      .set('role', 'superuser')
      .set('Origin', 'https://not-allowed.example')
      .expect(200);

    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('applies a configurable throttle without blocking a normal state load', async () => {
    for (let requestNumber = 0; requestNumber < 4; requestNumber += 1) {
      await request(app.getHttpServer())
        .get('/reports/summary')
        .set('role', 'superuser')
        .expect(200);
    }

    const throttled = await request(app.getHttpServer())
      .get('/reports/summary')
      .set('role', 'superuser')
      .expect(429);

    expect(throttled.body.success).toBe(false);
    expect(throttled.body.requestId).toBe(throttled.headers['x-request-id']);
  });

  it('writes redacted structured completion and exception records', async () => {
    const applicationRecords = await waitForRecords(
      logDirectory,
      'application-',
      (records) => records.some((record) => record.context === 'HttpRequest'),
    );
    const errorRecords = await waitForRecords(
      logDirectory,
      'error-',
      (records) =>
        records.some(
          (record) =>
            record.context === 'HttpException' && record.statusCode === 500,
        ),
    );

    const completion = applicationRecords.find(
      (record) => record.context === 'HttpRequest' && record.path === '/users',
    );
    expect(completion).toMatchObject({
      message: 'HTTP request completed',
      method: 'GET',
      path: '/users',
      statusCode: 200,
    });
    expect(completion?.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(completion?.durationMs).toEqual(expect.any(Number));

    expect(
      errorRecords.some(
        (record) => record.level === 'warn' && record.statusCode === 403,
      ),
    ).toBe(true);
    expect(
      errorRecords.some(
        (record) => record.level === 'error' && record.statusCode === 500,
      ),
    ).toBe(true);
    expect(errorRecords.every((record) => record.exceptionEvent === true)).toBe(
      true,
    );

    const serializedLogs = JSON.stringify([
      ...applicationRecords,
      ...errorRecords,
    ]);
    expect(serializedLogs).not.toContain('SECRET_AUTH_TOKEN');
    expect(serializedLogs).not.toContain('SECRET_BODY_VALUE');
  });
});

async function waitForRecords(
  directory: string,
  prefix: string,
  predicate: (records: LogRecord[]) => boolean,
): Promise<LogRecord[]> {
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    const records = readRecords(directory, prefix);
    if (predicate(records)) {
      return records;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return readRecords(directory, prefix);
}

function readRecords(directory: string, prefix: string): LogRecord[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory)
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.log'))
    .flatMap((fileName) =>
      readFileSync(join(directory, fileName), 'utf8')
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as LogRecord),
    );
}
