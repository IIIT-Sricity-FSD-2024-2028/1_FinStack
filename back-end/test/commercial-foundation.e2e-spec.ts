import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { seedPlatformAuthRbac, seedProductCatalog } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { DatabaseHealthService } from '../src/database/database-health.service';
import { PrismaService } from '../src/database/prisma.service';
import { PlatformBillingService } from '../src/platform/billing/platform-billing.service';

describe('Admin commercial foundation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let billing: PlatformBillingService;
  let manageToken: string;
  let viewToken: string;
  let manageStaffId: string;
  let organizationId: string;
  let starterPlanId: string;
  let professionalPlanId: string;
  let subscriptionId: string;
  let initialInvoiceId: string;
  let changeInvoiceId: string;
  const roleIds: string[] = [];
  const staffIds: string[] = [];

  beforeAll(async () => {
    process.env.PLATFORM_JWT_ACCESS_SECRET =
      'commercial-e2e-secret-with-more-than-thirty-two-characters';
    process.env.PLATFORM_JWT_ISSUER = 'finstack-commercial-e2e';
    process.env.PLATFORM_JWT_AUDIENCE = 'finstack-admin-commercial-e2e';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({
          status: 'available',
          checkedAt: '2026-09-01T00:00:00.000Z',
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    billing = app.get(PlatformBillingService);
    await seedPlatformAuthRbac(prisma);
    await seedProductCatalog(prisma);

    const manager = await createActor([
      'subscription.subscription.view',
      'subscription.subscription.manage',
      'billing.invoice.view',
      'billing.payment.view',
      'billing.revenue.view',
    ]);
    manageToken = manager.token;
    manageStaffId = manager.staffId;
    viewToken = (await createActor(['subscription.subscription.view'])).token;

    const organization = await prisma.organization.create({
      data: {
        name: `Commercial E2E ${Date.now()}`,
        slug: `commercial-e2e-${randomUUID()}`,
        primaryEmail: `commercial-${randomUUID()}@example.test`,
      },
    });
    organizationId = organization.id;
    starterPlanId = (
      await prisma.plan.findUniqueOrThrow({ where: { key: 'STARTER' } })
    ).id;
    professionalPlanId = (
      await prisma.plan.findUniqueOrThrow({ where: { key: 'PROFESSIONAL' } })
    ).id;
  });

  afterAll(async () => {
    if (organizationId) {
      const subscriptions = await prisma.organizationSubscription.findMany({
        where: { organizationId },
        select: { id: true },
      });
      const subscriptionIds = subscriptions.map(({ id }) => id);
      if (subscriptionIds.length > 0) {
        const payments = await prisma.subscriptionPayment.findMany({
          where: { subscriptionId: { in: subscriptionIds } },
          select: { id: true },
        });
        const paymentIds = payments.map(({ id }) => id);
        if (paymentIds.length > 0) {
          await prisma.paymentProviderEvent.deleteMany({
            where: { subscriptionPaymentId: { in: paymentIds } },
          });
        }
        await prisma.subscriptionPayment.deleteMany({
          where: { subscriptionId: { in: subscriptionIds } },
        });
        await prisma.invoice.deleteMany({
          where: { subscriptionId: { in: subscriptionIds } },
        });
        await prisma.subscriptionHistory.deleteMany({
          where: { subscriptionId: { in: subscriptionIds } },
        });
        await prisma.organizationSubscription.deleteMany({
          where: { id: { in: subscriptionIds } },
        });
      }
      await prisma.organization.delete({ where: { id: organizationId } });
    }
    if (staffIds.length > 0) {
      await prisma.platformAuditLog.deleteMany({
        where: { actorStaffId: { in: staffIds } },
      });
      await prisma.platformStaff.deleteMany({
        where: { id: { in: staffIds } },
      });
    }
    if (roleIds.length > 0) {
      await prisma.platformRole.deleteMany({ where: { id: { in: roleIds } } });
    }
    await app.close();
  });

  async function createActor(permissionKeys: string[]): Promise<{
    token: string;
    staffId: string;
  }> {
    const suffix = randomUUID();
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
      select: { id: true },
    });
    expect(permissions).toHaveLength(permissionKeys.length);
    const role = await prisma.platformRole.create({
      data: {
        key: `COMMERCIAL_E2E_${suffix}`.replace(/-/g, '_').slice(0, 100),
        name: `Commercial E2E ${suffix}`.slice(0, 150),
        rolePermissions: {
          create: permissions.map(({ id }) => ({ permissionId: id })),
        },
      },
    });
    roleIds.push(role.id);
    const staff = await prisma.platformStaff.create({
      data: {
        firstName: 'Commercial',
        lastName: 'Tester',
        email: `commercial-staff-${suffix}@example.test`,
        passwordHash: await argon2.hash('Commercial-e2e-password-2026!'),
        roles: { create: { roleId: role.id } },
      },
    });
    staffIds.push(staff.id);
    const session = await prisma.platformAuthSession.create({
      data: {
        staffId: staff.id,
        refreshTokenHash: createHash('sha256').update(suffix).digest('hex'),
        expiresAt: new Date(Date.now() + 120_000),
      },
    });
    const token = new JwtService().sign(
      { sub: staff.id, sid: session.id, type: 'access' },
      {
        algorithm: 'HS256',
        secret: process.env.PLATFORM_JWT_ACCESS_SECRET,
        issuer: process.env.PLATFORM_JWT_ISSUER,
        audience: process.env.PLATFORM_JWT_AUDIENCE,
        expiresIn: '10m',
      },
    );
    return { token, staffId: staff.id };
  }

  it('requires platform authentication and explicit manage permission', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/platform/subscriptions')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/platform/subscriptions')
      .set('Authorization', `Bearer ${viewToken}`)
      .send({ organizationId, planId: starterPlanId })
      .expect(403);
  });

  it('assigns from Plan values and enforces one effective subscription', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/platform/subscriptions')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ organizationId, planId: starterPlanId })
      .expect(201);
    const body = response.body as unknown as {
      data: {
        subscription: {
          id: string;
          status: SubscriptionStatus;
          priceAtSubscription: string;
          currency: string;
          plan: { id: string; features: unknown[] };
        };
        invoice: { id: string; totalAmount: string; currency: string };
      };
    };
    subscriptionId = body.data.subscription.id;
    initialInvoiceId = body.data.invoice.id;

    const starter = await prisma.plan.findUniqueOrThrow({
      where: { id: starterPlanId },
    });
    expect(body.data.subscription).toMatchObject({
      status: SubscriptionStatus.TRIAL,
      priceAtSubscription: starter.basePrice.toString(),
      currency: starter.currency,
      plan: { id: starter.id },
    });
    expect(body.data.subscription.plan.features).not.toHaveLength(0);
    expect(body.data.invoice).toMatchObject({
      totalAmount: starter.basePrice.toString(),
      currency: starter.currency,
    });

    await request(app.getHttpServer())
      .post('/api/v1/platform/subscriptions')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ organizationId, planId: professionalPlanId })
      .expect(409);

    await expect(
      prisma.organizationSubscription.create({
        data: {
          organizationId,
          planId: professionalPlanId,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: starter.billingInterval,
          currency: starter.currency,
          priceAtSubscription: starter.basePrice,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const audit = await prisma.platformAuditLog.findFirstOrThrow({
      where: {
        actorStaffId: manageStaffId,
        action: 'subscription.assigned',
        resourceId: subscriptionId,
      },
    });
    expect(audit.actorStaffId).toBe(manageStaffId);
  });

  it('returns frozen pagination contracts and safe history projections', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/platform/subscriptions?page=1&pageSize=10')
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    const listBody = list.body as unknown as {
      data: { items: unknown[]; meta: Record<string, number> };
    };
    expect(listBody.data.meta).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });

    const history = await request(app.getHttpServer())
      .get(`/api/v1/platform/subscriptions/${subscriptionId}/history`)
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    const historyText = JSON.stringify(history.body);
    expect(historyText).not.toContain('passwordHash');
    expect(historyText).not.toContain('refreshTokenHash');
  });

  it('does not change plans until trusted captured payment finalization', async () => {
    await billing
      .createPaymentAttempt({
        invoiceId: initialInvoiceId,
        provider: 'E2E_PROVIDER',
        providerOrderId: `initial-${randomUUID()}`,
        actorStaffId: manageStaffId,
      })
      .then(async (attempt) => {
        const finalized = await billing.finalizeVerifiedProviderPayment({
          provider: attempt.provider,
          providerEventId: `event-${randomUUID()}`,
          providerEventType: 'payment.captured',
          providerOrderId: attempt.providerOrderId,
          providerReference: `payment-${randomUUID()}`,
          amount: attempt.amount,
          currency: attempt.currency,
          paymentStatus: 'CAPTURED',
          verificationSource: 'PROVIDER_API',
          occurredAt: new Date(),
        });
        expect(finalized.status).toBe('SUCCEEDED');
      });

    const change = await request(app.getHttpServer())
      .post(`/api/v1/platform/subscriptions/${subscriptionId}/plan-changes`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ planId: professionalPlanId, reason: 'E2E upgrade' })
      .expect(201);
    const changeBody = change.body as unknown as {
      data: { invoice: { id: string; planId: string; totalAmount: string } };
    };
    changeInvoiceId = changeBody.data.invoice.id;

    const beforePayment =
      await prisma.organizationSubscription.findUniqueOrThrow({
        where: { id: subscriptionId },
      });
    expect(beforePayment.planId).toBe(starterPlanId);

    const attempt = await billing.createPaymentAttempt({
      invoiceId: changeInvoiceId,
      provider: 'E2E_PROVIDER',
      providerOrderId: `change-${randomUUID()}`,
      actorStaffId: manageStaffId,
    });
    const eventId = `event-${randomUUID()}`;
    const finalized = await billing.finalizeVerifiedProviderPayment({
      provider: attempt.provider,
      providerEventId: eventId,
      providerEventType: 'payment.captured',
      providerOrderId: attempt.providerOrderId,
      providerReference: `payment-${randomUUID()}`,
      amount: attempt.amount,
      currency: attempt.currency,
      paymentStatus: 'CAPTURED',
      verificationSource: 'SIGNED_WEBHOOK',
      occurredAt: new Date(),
    });
    const duplicate = await billing.finalizeVerifiedProviderPayment({
      provider: attempt.provider,
      providerEventId: eventId,
      providerEventType: 'payment.captured',
      providerOrderId: attempt.providerOrderId,
      providerReference: finalized.providerReference ?? '',
      amount: attempt.amount,
      currency: attempt.currency,
      paymentStatus: 'CAPTURED',
      verificationSource: 'SIGNED_WEBHOOK',
      occurredAt: new Date(),
    });
    expect(duplicate.id).toBe(finalized.id);

    const afterPayment =
      await prisma.organizationSubscription.findUniqueOrThrow({
        where: { id: subscriptionId },
      });
    const professional = await prisma.plan.findUniqueOrThrow({
      where: { id: professionalPlanId },
    });
    expect(afterPayment).toMatchObject({
      planId: professionalPlanId,
      status: SubscriptionStatus.ACTIVE,
      currency: professional.currency,
    });
    expect(
      afterPayment.priceAtSubscription.equals(professional.basePrice),
    ).toBe(true);
  });

  it('serves invoice, payment, and currency-safe revenue APIs', async () => {
    const invoices = await request(app.getHttpServer())
      .get('/api/v1/platform/billing/invoices?pageSize=10')
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    const invoiceBody = invoices.body as unknown as {
      data: { items: unknown[]; meta: { totalItems: number } };
    };
    expect(invoiceBody.data.items).toHaveLength(2);
    expect(invoiceBody.data.meta.totalItems).toBe(2);

    const payments = await request(app.getHttpServer())
      .get('/api/v1/platform/billing/payments?pageSize=10')
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    expect(JSON.stringify(payments.body)).not.toContain('passwordHash');

    const overview = await request(app.getHttpServer())
      .get('/api/v1/platform/billing/overview')
      .set('Authorization', `Bearer ${manageToken}`)
      .expect(200);
    const overviewBody = overview.body as unknown as {
      data: {
        activeSubscriptions: number;
        trialSubscriptions: number;
        successfulRevenueByCurrency: Array<{
          currency: string;
          amount: string;
        }>;
        pendingInvoiceValueByCurrency: unknown[];
        recentSuccessfulPayments: unknown[];
      };
    };
    expect(overviewBody.data.activeSubscriptions).toBeGreaterThanOrEqual(1);
    expect(overviewBody.data.successfulRevenueByCurrency).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: 'INR' }) as unknown,
      ]),
    );
    expect(overviewBody.data).not.toHaveProperty('mrr');
    expect(overviewBody.data).not.toHaveProperty('arr');
  });

  it('cancels and only reactivates an already-paid unexpired subscription', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/platform/subscriptions/${subscriptionId}/cancellations`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ reason: 'E2E lifecycle check' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/subscriptions/${subscriptionId}/reactivations`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({})
      .expect(201);

    const subscription =
      await prisma.organizationSubscription.findUniqueOrThrow({
        where: { id: subscriptionId },
      });
    expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
  });
});
