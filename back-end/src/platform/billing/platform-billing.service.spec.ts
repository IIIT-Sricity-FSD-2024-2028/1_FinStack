import { BadRequestException } from '@nestjs/common';
import {
  BillingInterval,
  InvoiceBillingReason,
  InvoiceStatus,
  PaymentProviderEventStatus,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import {
  PlatformBillingService,
  TrustedPaymentFinalizationInput,
} from './platform-billing.service';

const now = new Date('2026-09-01T12:00:00.000Z');
const organization = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Acme Finance',
  slug: 'acme-finance',
  primaryEmail: 'billing@acme.test',
};
const invoiceSummary = {
  id: '40000000-0000-4000-8000-000000000001',
  invoiceNumber: 'INV-202609-ABCDEF12',
  status: InvoiceStatus.PENDING,
};
const paymentOutput = {
  id: '50000000-0000-4000-8000-000000000001',
  organizationId: organization.id,
  invoiceId: invoiceSummary.id,
  subscriptionId: '30000000-0000-4000-8000-000000000001',
  amount: new Prisma.Decimal('7999'),
  currency: 'INR',
  status: SubscriptionPaymentStatus.SUCCEEDED,
  provider: 'RAZORPAY',
  providerOrderId: 'order_verified_1',
  providerReference: 'pay_verified_1',
  paymentMethod: 'upi',
  failureCode: null,
  failureReason: null,
  paidAt: now,
  failedAt: null,
  createdAt: now,
  updatedAt: now,
  organization,
  invoice: { ...invoiceSummary, status: InvoiceStatus.PAID },
};

type TransactionCallback<T> = (tx: T) => Promise<unknown>;

function transactionWith<T>(tx: T) {
  return jest.fn((callback: TransactionCallback<T>) => callback(tx));
}

function serviceWithPrisma(prisma: Record<string, unknown>) {
  return new PlatformBillingService(prisma as never);
}

const verifiedInput: TrustedPaymentFinalizationInput = {
  provider: 'razorpay',
  providerEventId: 'event-captured-1',
  providerEventType: 'payment.captured',
  providerOrderId: 'order_verified_1',
  providerReference: 'pay_verified_1',
  amount: '7999.0000',
  currency: 'inr',
  paymentStatus: 'CAPTURED',
  verificationSource: 'SIGNED_WEBHOOK',
  paymentMethod: 'upi',
  occurredAt: now,
};

describe('PlatformBillingService', () => {
  it('keeps revenue separated by currency and omits speculative MRR', async () => {
    const prisma = {
      organizationSubscription: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2),
      },
      subscriptionPayment: {
        groupBy: jest.fn().mockResolvedValue([
          { currency: 'INR', _sum: { amount: new Prisma.Decimal('12000') } },
          { currency: 'USD', _sum: { amount: new Prisma.Decimal('250') } },
        ]),
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([paymentOutput]),
      },
      invoice: {
        groupBy: jest.fn().mockResolvedValue([
          {
            currency: 'INR',
            _sum: { totalAmount: new Prisma.Decimal('7999') },
          },
        ]),
      },
    };
    const service = serviceWithPrisma(prisma);

    const overview = await service.getRevenueOverview({});

    expect(overview).toMatchObject({
      activeSubscriptions: 4,
      trialSubscriptions: 2,
      successfulRevenueByCurrency: [
        { currency: 'INR', amount: '12000' },
        { currency: 'USD', amount: '250' },
      ],
      pendingInvoiceValueByCurrency: [{ currency: 'INR', amount: '7999' }],
      failedPaymentCount: 3,
    });
    expect(overview).not.toHaveProperty('mrr');
    expect(overview).not.toHaveProperty('arr');
  });

  it('creates payment attempts from authoritative invoice values', async () => {
    const invoice = {
      ...invoiceSummary,
      organizationId: organization.id,
      subscriptionId: paymentOutput.subscriptionId,
      totalAmount: new Prisma.Decimal('7999'),
      currency: 'INR',
    };
    const pendingPayment = {
      ...paymentOutput,
      status: SubscriptionPaymentStatus.PENDING,
      providerReference: null,
      paidAt: null,
      invoice: invoiceSummary,
    };
    let capturedPaymentCreate: unknown;
    const tx = {
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
      subscriptionPayment: {
        create: jest.fn((args: unknown) => {
          capturedPaymentCreate = args;
          return Promise.resolve(pendingPayment);
        }),
      },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await service.createPaymentAttempt({
      invoiceId: invoice.id,
      provider: 'razorpay',
      providerOrderId: paymentOutput.providerOrderId,
      actorStaffId: 'actor-id',
    });

    const paymentCreate = capturedPaymentCreate as {
      data: Record<string, unknown>;
    };
    expect(paymentCreate.data).toMatchObject({
      amount: invoice.totalAmount,
      currency: invoice.currency,
      provider: 'RAZORPAY',
    });
  });

  it('finalizes capture, invoice, plan change, history, event, and audit atomically', async () => {
    const targetPlan = {
      id: '20000000-0000-4000-8000-000000000002',
      billingInterval: BillingInterval.MONTHLY,
      currency: 'INR',
      basePrice: new Prisma.Decimal('7999'),
    };
    const pendingPayment = {
      id: paymentOutput.id,
      provider: 'RAZORPAY',
      providerOrderId: paymentOutput.providerOrderId,
      providerReference: null,
      amount: paymentOutput.amount,
      currency: paymentOutput.currency,
      status: SubscriptionPaymentStatus.PENDING,
      invoiceId: invoiceSummary.id,
      subscriptionId: paymentOutput.subscriptionId,
      invoice: {
        id: invoiceSummary.id,
        status: InvoiceStatus.PENDING,
        planId: targetPlan.id,
        billingReason: InvoiceBillingReason.PLAN_CHANGE,
        billingPeriodStart: now,
        billingPeriodEnd: new Date('2026-10-01T12:00:00.000Z'),
      },
      subscription: {
        id: paymentOutput.subscriptionId,
        planId: '20000000-0000-4000-8000-000000000001',
        status: SubscriptionStatus.ACTIVE,
      },
    };
    const findPayment = jest
      .fn()
      .mockResolvedValueOnce(pendingPayment)
      .mockResolvedValueOnce(paymentOutput);
    let capturedPaymentUpdate: unknown;
    let capturedInvoiceUpdate: unknown;
    let capturedSubscriptionUpdate: unknown;
    let capturedEventUpdate: unknown;
    const tx = {
      paymentProviderEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-db-id' }),
        update: jest.fn((args: unknown) => {
          capturedEventUpdate = args;
          return Promise.resolve({});
        }),
      },
      subscriptionPayment: {
        findUnique: findPayment,
        update: jest.fn((args: unknown) => {
          capturedPaymentUpdate = args;
          return Promise.resolve({});
        }),
      },
      invoice: {
        update: jest.fn((args: unknown) => {
          capturedInvoiceUpdate = args;
          return Promise.resolve({});
        }),
      },
      plan: { findUnique: jest.fn().mockResolvedValue(targetPlan) },
      organizationSubscription: {
        update: jest.fn((args: unknown) => {
          capturedSubscriptionUpdate = args;
          return Promise.resolve({});
        }),
      },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await expect(
      service.finalizeVerifiedProviderPayment(verifiedInput),
    ).resolves.toMatchObject({ status: SubscriptionPaymentStatus.SUCCEEDED });
    expect(
      (capturedPaymentUpdate as { data: Record<string, unknown> }).data,
    ).toMatchObject({
      status: SubscriptionPaymentStatus.SUCCEEDED,
      providerReference: verifiedInput.providerReference,
    });
    expect(
      (capturedInvoiceUpdate as { data: Record<string, unknown> }).data,
    ).toMatchObject({ status: InvoiceStatus.PAID });
    expect(
      (capturedSubscriptionUpdate as { data: Record<string, unknown> }).data,
    ).toMatchObject({
      planId: targetPlan.id,
      status: SubscriptionStatus.ACTIVE,
      priceAtSubscription: targetPlan.basePrice,
    });
    expect(
      (capturedEventUpdate as { data: Record<string, unknown> }).data,
    ).toMatchObject({ status: PaymentProviderEventStatus.PROCESSED });
  });

  it('rejects checkout authorization and commercial mismatches', async () => {
    const service = serviceWithPrisma({ $transaction: jest.fn() });
    const authorized = {
      ...verifiedInput,
      paymentStatus: 'AUTHORIZED',
    } as unknown as TrustedPaymentFinalizationInput;
    await expect(
      service.finalizeVerifiedProviderPayment(authorized),
    ).rejects.toBeInstanceOf(BadRequestException);

    const pendingPayment = {
      id: paymentOutput.id,
      provider: 'RAZORPAY',
      providerOrderId: paymentOutput.providerOrderId,
      providerReference: null,
      amount: paymentOutput.amount,
      currency: paymentOutput.currency,
      status: SubscriptionPaymentStatus.PENDING,
      invoiceId: invoiceSummary.id,
      subscriptionId: paymentOutput.subscriptionId,
      invoice: {
        ...invoiceSummary,
        billingReason: InvoiceBillingReason.INITIAL,
      },
      subscription: {
        id: paymentOutput.subscriptionId,
        planId: 'plan-id',
        status: SubscriptionStatus.PENDING_PAYMENT,
      },
    };
    const tx = {
      paymentProviderEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-db-id' }),
      },
      subscriptionPayment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment),
        update: jest.fn(),
      },
    };
    const mismatchService = serviceWithPrisma({
      $transaction: transactionWith(tx),
    });
    const mismatch = mismatchService.finalizeVerifiedProviderPayment({
      ...verifiedInput,
      amount: '1.00',
    });
    await expect(mismatch).rejects.toBeInstanceOf(BadRequestException);
    await mismatch.catch((error: unknown) => {
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({ code: 'PAYMENT_COMMERCIAL_MISMATCH' });
    });
    expect(tx.subscriptionPayment.update).not.toHaveBeenCalled();
  });

  it('returns the original payment for a processed provider event', async () => {
    const tx = {
      paymentProviderEvent: {
        findUnique: jest.fn().mockResolvedValue({
          status: PaymentProviderEventStatus.PROCESSED,
          subscriptionPayment: paymentOutput,
        }),
      },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await expect(
      service.finalizeVerifiedProviderPayment(verifiedInput),
    ).resolves.toMatchObject({ id: paymentOutput.id });
  });

  it('records provider failure without paying the invoice or activating a subscription', async () => {
    const pendingPayment = {
      ...paymentOutput,
      status: SubscriptionPaymentStatus.PENDING,
      providerReference: null,
      paidAt: null,
      failedAt: null,
      invoice: { ...invoiceSummary, status: InvoiceStatus.PENDING },
    };
    const failedPayment = {
      ...paymentOutput,
      status: SubscriptionPaymentStatus.FAILED,
      failedAt: now,
      invoice: invoiceSummary,
    };
    const findPayment = jest
      .fn()
      .mockResolvedValueOnce(pendingPayment)
      .mockResolvedValueOnce(failedPayment);
    let capturedUpdate: unknown;
    const tx = {
      paymentProviderEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'event-failed-id' }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscriptionPayment: {
        findUnique: findPayment,
        update: jest.fn((args: unknown) => {
          capturedUpdate = args;
          return Promise.resolve({});
        }),
      },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = serviceWithPrisma({ $transaction: transactionWith(tx) });

    await expect(
      service.recordVerifiedProviderPaymentFailure({
        provider: 'razorpay',
        providerEventId: 'event-failed-1',
        providerEventType: 'payment.failed',
        providerOrderId: paymentOutput.providerOrderId,
        providerReference: 'pay_failed_1',
        failureCode: 'BAD_REQUEST_ERROR',
      }),
    ).resolves.toMatchObject({ status: SubscriptionPaymentStatus.FAILED });
    expect(
      (capturedUpdate as { data: Record<string, unknown> }).data,
    ).toMatchObject({
      status: SubscriptionPaymentStatus.FAILED,
      providerReference: 'pay_failed_1',
      failureCode: 'BAD_REQUEST_ERROR',
    });
    expect(tx.paymentProviderEvent.update).toHaveBeenCalled();
  });
});
