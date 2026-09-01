import {
  BadGatewayException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { createHmac } from 'crypto';
import { PlatformBillingService } from './platform-billing.service';
import { RazorpayService } from './razorpay.service';

const invoiceId = '40000000-0000-4000-8000-000000000001';
const paymentId = '50000000-0000-4000-8000-000000000001';
const subscriptionId = '30000000-0000-4000-8000-000000000001';
const orderId = 'order_test_123';
const razorpayPaymentId = 'pay_test_123';
const keyId = 'rzp_test_public';
const keySecret = 'test_secret';

const invoice = {
  id: invoiceId,
  invoiceNumber: 'INV-202609-ABCDEF12',
  status: InvoiceStatus.PENDING,
  totalAmount: new Prisma.Decimal('7999'),
  currency: 'INR',
  subscription: { id: subscriptionId, status: SubscriptionStatus.TRIAL },
};

const payment = {
  id: paymentId,
  organizationId: '10000000-0000-4000-8000-000000000001',
  invoiceId,
  subscriptionId,
  amount: '7999',
  currency: 'INR',
  status: SubscriptionPaymentStatus.PENDING,
  provider: 'RAZORPAY',
  providerOrderId: orderId,
  providerReference: null,
  paymentMethod: null,
  failureCode: null,
  failureReason: null,
  paidAt: null,
  failedAt: null,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
  updatedAt: new Date('2026-09-01T12:00:00.000Z'),
  organization: {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Acme Finance',
    slug: 'acme-finance',
    primaryEmail: 'billing@acme.test',
  },
  invoice: {
    id: invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    status: InvoiceStatus.PENDING,
  },
};

function response(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function signature(value: string): string {
  return createHmac('sha256', keySecret).update(value).digest('hex');
}

function serviceWith(
  prisma: Record<string, unknown>,
  billing: Record<string, unknown> = {},
): RazorpayService {
  const config = {
    get: jest.fn((key: string) =>
      key === 'RAZORPAY_KEY_ID'
        ? keyId
        : key === 'RAZORPAY_KEY_SECRET'
          ? keySecret
          : undefined,
    ),
  };
  return new RazorpayService(
    config as never,
    prisma as never,
    billing as unknown as PlatformBillingService,
  );
}

describe('RazorpayService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('creates an order from invoice amount/currency and never returns the secret', async () => {
    fetchMock.mockResolvedValue(
      response({
        id: orderId,
        amount: 799900,
        currency: 'INR',
        status: 'created',
      }),
    );
    const createdPayment = { ...payment, providerOrderId: orderId };
    const createPaymentAttempt = jest.fn().mockResolvedValue(createdPayment);
    const service = serviceWith(
      {
        invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
        subscriptionPayment: { findFirst: jest.fn().mockResolvedValue(null) },
      },
      { createPaymentAttempt },
    );

    const result = await service.createPaymentOrder(invoiceId, 'actor-id');
    const calls = fetchMock.mock.calls as unknown[][];
    const request = calls[0]?.[1] as RequestInit;
    const requestBody = typeof request.body === 'string' ? request.body : '';

    expect(result).toMatchObject({
      orderId,
      paymentId,
      invoiceId,
      amount: 799900,
      currency: 'INR',
      keyId,
      provider: 'RAZORPAY',
    });
    expect(JSON.stringify(result)).not.toContain(keySecret);
    expect(JSON.parse(requestBody)).toMatchObject({
      amount: 799900,
      currency: 'INR',
    });
    expect(createPaymentAttempt).toHaveBeenCalledWith({
      invoiceId,
      provider: 'RAZORPAY',
      providerOrderId: orderId,
      actorStaffId: 'actor-id',
    });
  });

  it('fails clearly when Razorpay credentials are absent', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const service = new RazorpayService(
      config as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createPaymentOrder(invoiceId, 'actor-id'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not create a provider order for an already-paid invoice', async () => {
    const service = serviceWith({
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          ...invoice,
          status: InvoiceStatus.PAID,
        }),
      },
    });

    await expect(
      service.createPaymentOrder(invoiceId, 'actor-id'),
    ).rejects.toMatchObject({
      response: { code: 'INVOICE_NOT_PAYABLE' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('verifies signature, fetches captured payment, and delegates finalization', async () => {
    fetchMock.mockResolvedValue(
      response({
        id: razorpayPaymentId,
        order_id: orderId,
        amount: 799900,
        currency: 'INR',
        status: 'captured',
        method: 'upi',
      }),
    );
    const finalize = jest
      .fn()
      .mockResolvedValue({ ...payment, status: 'SUCCEEDED' });
    const service = serviceWith(
      {
        subscriptionPayment: {
          findFirst: jest.fn().mockResolvedValue({
            ...payment,
            invoice: {
              id: invoiceId,
              status: InvoiceStatus.PENDING,
              totalAmount: invoice.totalAmount,
              currency: invoice.currency,
            },
            subscription: {
              id: subscriptionId,
              status: SubscriptionStatus.TRIAL,
            },
          }),
        },
      },
      { finalizeVerifiedProviderPayment: finalize },
    );

    await service.verifyCheckoutPayment({
      razorpay_order_id: orderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature(`${orderId}|${razorpayPaymentId}`),
    });

    const calls = fetchMock.mock.calls as unknown[][];
    expect(calls[0]?.[0]).toBe(
      `https://api.razorpay.com/v1/payments/${razorpayPaymentId}`,
    );
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        providerReference: razorpayPaymentId,
        amount: '7999.00',
        currency: 'INR',
        paymentStatus: 'CAPTURED',
        verificationSource: 'PROVIDER_API',
      }),
    );
  });

  it('rejects invalid signatures before contacting the provider', async () => {
    const service = serviceWith({
      subscriptionPayment: { findFirst: jest.fn() },
    });

    await expect(
      service.verifyCheckoutPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: 'invalid',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'wrong order',
      {
        order_id: 'order_other',
        amount: 799900,
        currency: 'INR',
        status: 'captured',
      },
    ],
    [
      'wrong amount',
      { order_id: orderId, amount: 1, currency: 'INR', status: 'captured' },
    ],
    [
      'wrong currency',
      {
        order_id: orderId,
        amount: 799900,
        currency: 'USD',
        status: 'captured',
      },
    ],
  ])('rejects %s from provider data', async (_label, providerPayment) => {
    fetchMock.mockResolvedValue(
      response({ id: razorpayPaymentId, ...providerPayment }),
    );
    const finalize = jest.fn();
    const service = serviceWith(
      {
        subscriptionPayment: {
          findFirst: jest.fn().mockResolvedValue({
            ...payment,
            invoice: {
              id: invoiceId,
              status: InvoiceStatus.PENDING,
              totalAmount: invoice.totalAmount,
              currency: invoice.currency,
            },
            subscription: {
              id: subscriptionId,
              status: SubscriptionStatus.TRIAL,
            },
          }),
        },
      },
      { finalizeVerifiedProviderPayment: finalize },
    );

    await expect(
      service.verifyCheckoutPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature(`${orderId}|${razorpayPaymentId}`),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(finalize).not.toHaveBeenCalled();
  });

  it('does not finalize an authorized payment', async () => {
    fetchMock.mockResolvedValue(
      response({
        id: razorpayPaymentId,
        order_id: orderId,
        amount: 799900,
        currency: 'INR',
        status: 'authorized',
      }),
    );
    const finalize = jest.fn();
    const service = serviceWith(
      {
        subscriptionPayment: {
          findFirst: jest.fn().mockResolvedValue({
            ...payment,
            invoice: {
              id: invoiceId,
              status: InvoiceStatus.PENDING,
              totalAmount: invoice.totalAmount,
              currency: invoice.currency,
            },
            subscription: {
              id: subscriptionId,
              status: SubscriptionStatus.TRIAL,
            },
          }),
        },
      },
      { finalizeVerifiedProviderPayment: finalize },
    );

    await expect(
      service.verifyCheckoutPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature(`${orderId}|${razorpayPaymentId}`),
      }),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_NOT_CAPTURED' } });
    expect(finalize).not.toHaveBeenCalled();
  });

  it('records a provider failure without paying the invoice or activating the subscription', async () => {
    fetchMock.mockResolvedValue(
      response({
        id: razorpayPaymentId,
        order_id: orderId,
        amount: 799900,
        currency: 'INR',
        status: 'failed',
        error_code: 'BAD_REQUEST_ERROR',
      }),
    );
    const recordFailure = jest
      .fn()
      .mockResolvedValue({ ...payment, status: 'FAILED' });
    const finalize = jest.fn();
    const service = serviceWith(
      {
        subscriptionPayment: {
          findFirst: jest.fn().mockResolvedValue({
            ...payment,
            invoice: {
              id: invoiceId,
              status: InvoiceStatus.PENDING,
              totalAmount: invoice.totalAmount,
              currency: invoice.currency,
            },
            subscription: {
              id: subscriptionId,
              status: SubscriptionStatus.TRIAL,
            },
          }),
        },
      },
      {
        recordVerifiedProviderPaymentFailure: recordFailure,
        finalizeVerifiedProviderPayment: finalize,
      },
    );

    await expect(
      service.verifyCheckoutPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature(`${orderId}|${razorpayPaymentId}`),
      }),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_NOT_CAPTURED' } });
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        providerReference: razorpayPaymentId,
        failureCode: 'BAD_REQUEST_ERROR',
      }),
    );
    expect(finalize).not.toHaveBeenCalled();
  });

  it('maps provider API failures to a safe gateway error', async () => {
    fetchMock.mockRejectedValue(new Error('network secret should not escape'));
    const service = serviceWith({
      subscriptionPayment: {
        findFirst: jest.fn().mockResolvedValue({
          ...payment,
          invoice: {
            id: invoiceId,
            status: InvoiceStatus.PENDING,
            totalAmount: invoice.totalAmount,
            currency: invoice.currency,
          },
          subscription: {
            id: subscriptionId,
            status: SubscriptionStatus.TRIAL,
          },
        }),
      },
    });

    await expect(
      service.verifyCheckoutPayment({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature(`${orderId}|${razorpayPaymentId}`),
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('processes a signed captured webhook with the raw body and replays idempotently', async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        id: 'evt_123',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: razorpayPaymentId,
              order_id: orderId,
              amount: 799900,
              currency: 'INR',
            },
          },
        },
      }),
    );
    fetchMock.mockResolvedValue(
      response({
        id: razorpayPaymentId,
        order_id: orderId,
        amount: 799900,
        currency: 'INR',
        status: 'captured',
      }),
    );
    const finalize = jest
      .fn()
      .mockResolvedValue({ ...payment, status: 'SUCCEEDED' });
    const eventFind = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: 'PROCESSED',
        subscriptionPayment: {
          ...payment,
          status: SubscriptionPaymentStatus.SUCCEEDED,
        },
      });
    const service = serviceWith(
      {
        paymentProviderEvent: { findUnique: eventFind },
        subscriptionPayment: {
          findFirst: jest.fn().mockResolvedValue({
            ...payment,
            invoice: {
              id: invoiceId,
              status: InvoiceStatus.PENDING,
              totalAmount: invoice.totalAmount,
              currency: invoice.currency,
            },
            subscription: {
              id: subscriptionId,
              status: SubscriptionStatus.TRIAL,
            },
          }),
        },
      },
      { finalizeVerifiedProviderPayment: finalize },
    );

    const first = await service.handleWebhook(
      rawBody,
      signature(rawBody.toString()),
      'evt_123',
    );
    const second = await service.handleWebhook(
      rawBody,
      signature(rawBody.toString()),
      'evt_123',
    );

    expect(first.processed).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
