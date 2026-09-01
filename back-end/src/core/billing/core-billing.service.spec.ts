import { Test, TestingModule } from '@nestjs/testing';
import {
  BillingInterval,
  InvoiceStatus,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CoreBillingService } from './core-billing.service';
import { RazorpayService } from './razorpay.service';

describe('CoreBillingService', () => {
  let service: CoreBillingService;

  const mockPrisma = {
    organizationSubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptionPayment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    subscriptionHistory: {
      create: jest.fn(),
    },
    paymentProviderWebhookEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
    platformAuditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
  };

  const razorpay = {
    createOrder: jest.fn(),
    getPublicKeyId: jest.fn().mockReturnValue('rzp_test_public'),
    toSmallestCurrencyUnit: jest.fn().mockReturnValue(799900),
    verifyCheckoutSignature: jest.fn().mockReturnValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreBillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RazorpayService, useValue: razorpay },
      ],
    }).compile();

    service = module.get(CoreBillingService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma));
  });

  it('creates an invoice from canonical subscription pricing', async () => {
    const periodStart = new Date('2026-08-01T00:00:00.000Z');
    const periodEnd = new Date('2026-09-01T00:00:00.000Z');
    mockPrisma.organizationSubscription.findUnique.mockResolvedValue({
      id: 'sub_1',
      organizationId: 'org_1',
      planId: 'plan_1',
      status: SubscriptionStatus.ACTIVE,
      billingInterval: BillingInterval.MONTHLY,
      currency: 'INR',
      priceAtSubscription: new Prisma.Decimal('7999'),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      plan: { id: 'plan_1', name: 'Professional' },
      organization: { id: 'org_1', name: 'Acme' },
    });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.create.mockResolvedValue({
      id: 'invoice_1',
      invoiceNumber: 'INV-202608-000001',
      organizationId: 'org_1',
      subscriptionId: 'sub_1',
      planId: 'plan_1',
      status: InvoiceStatus.PENDING,
      totalAmount: new Prisma.Decimal('7999'),
      currency: 'INR',
      payments: [],
    });

    await service.ensureInvoiceForSubscription('sub_1', 'staff_1');

    expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_1',
          subscriptionId: 'sub_1',
          planId: 'plan_1',
          totalAmount: new Prisma.Decimal('7999'),
          currency: 'INR',
        }),
      }),
    );
    expect(mockPrisma.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'billing.invoice.created',
          actorStaffId: 'staff_1',
        }),
      }),
    );
  });

  it('derives revenue, MRR, and ARR from successful billing records', async () => {
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('7999'),
        paidAt: new Date('2026-08-10T00:00:00.000Z'),
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
        invoice: { plan: { name: 'Professional' } },
        subscription: null,
      },
    ]);
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('7999') },
      _count: { id: 1 },
    });
    mockPrisma.subscriptionPayment.count.mockResolvedValue(1);
    mockPrisma.invoice.count.mockResolvedValue(2);
    mockPrisma.organizationSubscription.findMany.mockResolvedValue([
      {
        priceAtSubscription: new Prisma.Decimal('12000'),
        billingInterval: BillingInterval.MONTHLY,
      },
      {
        priceAtSubscription: new Prisma.Decimal('120000'),
        billingInterval: BillingInterval.YEARLY,
      },
    ]);

    const summary = await service.getRevenueSummary();

    expect(summary.totalCollectedRevenue).toBe('7999');
    expect(summary.mrr).toBe('22000');
    expect(summary.arr).toBe('264000');
    expect(summary.failedPayments).toBe(1);
    expect(summary.pendingInvoices).toBe(2);
    expect(mockPrisma.subscriptionPayment.aggregate).toHaveBeenCalledWith({
      where: {
        status: SubscriptionPaymentStatus.SUCCEEDED,
        invoice: { is: { status: InvoiceStatus.PAID } },
      },
      _sum: { amount: true },
      _count: { id: true },
    });
  });
});
