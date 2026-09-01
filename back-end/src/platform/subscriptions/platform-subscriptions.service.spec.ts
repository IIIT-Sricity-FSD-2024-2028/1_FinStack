import { ConflictException } from '@nestjs/common';
import {
  BillingInterval,
  InvoiceBillingReason,
  InvoiceStatus,
  PlanStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

const now = new Date('2026-09-01T10:00:00.000Z');
const future = new Date('2026-10-01T10:00:00.000Z');
const organization = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Acme Finance',
  slug: 'acme-finance',
  primaryEmail: 'billing@acme.test',
};
const plan = {
  id: '20000000-0000-4000-8000-000000000001',
  key: 'STARTER',
  name: 'Starter',
  description: null,
  status: PlanStatus.ACTIVE,
  billingInterval: BillingInterval.MONTHLY,
  basePrice: new Prisma.Decimal('2999.0000'),
  currency: 'INR',
  trialDays: 14,
  createdAt: now,
  updatedAt: now,
  planFeatures: [],
};
const subscription = {
  id: '30000000-0000-4000-8000-000000000001',
  organizationId: organization.id,
  planId: plan.id,
  status: SubscriptionStatus.TRIAL,
  billingInterval: BillingInterval.MONTHLY,
  currency: 'INR',
  priceAtSubscription: new Prisma.Decimal('2999.0000'),
  currentPeriodStart: now,
  currentPeriodEnd: future,
  trialStartAt: now,
  trialEndAt: future,
  cancelledAt: null,
  createdAt: now,
  updatedAt: now,
  organization,
  plan,
};
const invoice = {
  id: '40000000-0000-4000-8000-000000000001',
  invoiceNumber: 'INV-202609-ABCDEF12',
  idempotencyKey: `subscription:${subscription.id}:initial`,
  organizationId: organization.id,
  subscriptionId: subscription.id,
  planId: plan.id,
  billingReason: InvoiceBillingReason.INITIAL,
  status: InvoiceStatus.PENDING,
  subtotal: new Prisma.Decimal('2999.0000'),
  taxAmount: new Prisma.Decimal('0'),
  totalAmount: new Prisma.Decimal('2999.0000'),
  currency: 'INR',
  billingPeriodStart: future,
  billingPeriodEnd: new Date('2026-11-01T10:00:00.000Z'),
  issueDate: now,
  dueDate: future,
  paidAt: null,
  voidedAt: null,
  createdAt: now,
  updatedAt: now,
  organization,
  plan: { id: plan.id, key: plan.key, name: plan.name },
};

type TransactionCallback<T> = (tx: T) => Promise<unknown>;

function transactionWith<T>(tx: T) {
  return jest.fn((callback: TransactionCallback<T>) => callback(tx));
}

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformSubscriptionsService(prisma as never);
}

describe('PlatformSubscriptionsService', () => {
  it('assigns authoritative Plan commercial values and creates an initial invoice', async () => {
    let capturedSubscriptionCreate: unknown;
    let capturedInvoiceCreate: unknown;
    const tx = {
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      plan: { findUnique: jest.fn().mockResolvedValue(plan) },
      organizationSubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn((args: unknown) => {
          capturedSubscriptionCreate = args;
          return Promise.resolve(subscription);
        }),
      },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
      invoice: {
        create: jest.fn((args: unknown) => {
          capturedInvoiceCreate = args;
          return Promise.resolve(invoice);
        }),
      },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });
    const dto: AssignSubscriptionDto = {
      organizationId: organization.id,
      planId: plan.id,
    };

    const result = await service.assign(dto, 'actor-id');

    expect(result.subscription).toMatchObject({
      status: SubscriptionStatus.TRIAL,
      priceAtSubscription: '2999',
      currency: 'INR',
      billingInterval: BillingInterval.MONTHLY,
    });
    expect(result.invoice).toMatchObject({
      totalAmount: '2999',
      currency: 'INR',
      billingReason: InvoiceBillingReason.INITIAL,
    });
    const subscriptionCreate = capturedSubscriptionCreate as {
      data: Record<string, unknown>;
    };
    expect(subscriptionCreate.data).toMatchObject({
      planId: plan.id,
      priceAtSubscription: plan.basePrice,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
    });
    const invoiceCreate = capturedInvoiceCreate as {
      data: Record<string, unknown>;
    };
    expect(invoiceCreate.data).toMatchObject({
      subtotal: plan.basePrice,
      totalAmount: plan.basePrice,
      currency: plan.currency,
    });
  });

  it('rejects a second effective subscription before writing', async () => {
    const tx = {
      organization: { findUnique: jest.fn().mockResolvedValue(organization) },
      plan: { findUnique: jest.fn().mockResolvedValue(plan) },
      organizationSubscription: {
        findFirst: jest.fn().mockResolvedValue({ id: subscription.id }),
        create: jest.fn(),
      },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    const attempt = service.assign(
      { organizationId: organization.id, planId: plan.id },
      'actor-id',
    );
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await attempt.catch((error: unknown) => {
      const response = (error as ConflictException).getResponse();
      expect(response).toMatchObject({ code: 'EFFECTIVE_SUBSCRIPTION_EXISTS' });
    });
    expect(tx.organizationSubscription.create).not.toHaveBeenCalled();
  });

  it('creates a payment-gated plan-change invoice without changing the subscription', async () => {
    const targetPlan = {
      ...plan,
      id: '20000000-0000-4000-8000-000000000002',
      key: 'PROFESSIONAL',
      name: 'Professional',
      basePrice: new Prisma.Decimal('7999'),
    };
    const planChangeInvoice = {
      ...invoice,
      id: '40000000-0000-4000-8000-000000000002',
      planId: targetPlan.id,
      billingReason: InvoiceBillingReason.PLAN_CHANGE,
      subtotal: targetPlan.basePrice,
      totalAmount: targetPlan.basePrice,
      plan: {
        id: targetPlan.id,
        key: targetPlan.key,
        name: targetPlan.name,
      },
    };
    const tx = {
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue(subscription),
        update: jest.fn(),
      },
      plan: { findUnique: jest.fn().mockResolvedValue(targetPlan) },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(planChangeInvoice),
      },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    const result = await service.requestPlanChange(
      subscription.id,
      { planId: targetPlan.id, reason: 'Need more capacity' },
      'actor-id',
    );

    expect(result.invoice).toMatchObject({
      planId: targetPlan.id,
      totalAmount: '7999',
    });
    expect(tx.organizationSubscription.update).not.toHaveBeenCalled();
  });

  it('cancels atomically and voids open invoices', async () => {
    const cancelled = {
      ...subscription,
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: now,
    };
    let capturedInvoiceUpdate: unknown;
    const tx = {
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue(subscription),
        update: jest.fn().mockResolvedValue(cancelled),
      },
      invoice: {
        updateMany: jest.fn((args: unknown) => {
          capturedInvoiceUpdate = args;
          return Promise.resolve({ count: 1 });
        }),
      },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await expect(
      service.cancel(
        subscription.id,
        { reason: 'Customer request' },
        'actor-id',
      ),
    ).resolves.toMatchObject({ status: SubscriptionStatus.CANCELLED });
    const invoiceUpdate = capturedInvoiceUpdate as {
      data: { status: InvoiceStatus };
    };
    expect(invoiceUpdate.data.status).toBe(InvoiceStatus.VOID);
  });

  it('requires an unexpired paid period before reactivation', async () => {
    const cancelled = {
      ...subscription,
      status: SubscriptionStatus.CANCELLED,
      currentPeriodEnd: future,
    };
    const tx = {
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue(cancelled),
        update: jest.fn(),
      },
      subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await expect(
      service.reactivate(subscription.id, 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organizationSubscription.update).not.toHaveBeenCalled();
  });

  it('uses a safe actor projection for subscription history', async () => {
    let capturedFindMany: unknown;
    const findMany = jest.fn((args: Prisma.SubscriptionHistoryFindManyArgs) => {
      capturedFindMany = args;
      return Promise.resolve([]);
    });
    const prisma = {
      organizationSubscription: {
        findUnique: jest.fn().mockResolvedValue({ id: subscription.id }),
      },
      subscriptionHistory: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest
        .fn()
        .mockImplementation((operations: Array<Promise<unknown>>) =>
          Promise.all(operations),
        ),
    };
    const service = serviceWithPrisma(prisma);

    await service.findHistory(subscription.id, { page: 1, pageSize: 20 });

    const args = capturedFindMany as Prisma.SubscriptionHistoryFindManyArgs;
    expect(args.include?.actorStaff).toEqual({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      },
    });
    expect(JSON.stringify(args)).not.toContain('passwordHash');
  });
});
