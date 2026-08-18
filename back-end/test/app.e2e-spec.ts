import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DatabaseHealthService } from '../src/database/database-health.service';

describe('FinStack foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({
          status: 'available',
          checkedAt: '2026-08-18T00:00:00.000Z',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves platform health without the legacy role header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/platform/health')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'healthy',
        api: { status: 'available' },
        database: { status: 'available' },
      },
    });
  });

  it('preserves the legacy role-header guard for Client V1 routes', async () => {
    await request(app.getHttpServer()).get('/users').expect(403);
    await request(app.getHttpServer())
      .get('/users')
      .set('role', 'user')
      .expect(200);
  });
});
