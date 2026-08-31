import { Test, TestingModule } from '@nestjs/testing';
import { CoreSubscriptionsService } from './core-subscriptions.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus, BillingInterval } from '@prisma/client';

describe('CoreSubscriptionsService', () => {
  let service: CoreSubscriptionsService;
  let prisma: PrismaService;

  const mockPrisma = {
    organizationSubscription: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptionHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoreSubscriptionsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<CoreSubscriptionsService>(CoreSubscriptionsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('startTrial', () => {
    it('throws if organization missing', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.startTrial('org_1', 'plan_1', 14)).rejects.toThrow(NotFoundException);
    });

    it('throws if plan missing or inactive', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
      mockPrisma.plan.findUnique.mockResolvedValue({ status: 'INACTIVE' });
      await expect(service.startTrial('org_1', 'plan_1', 14)).rejects.toThrow(BadRequestException);
    });

    it('throws if duplicate active subscription exists', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
      mockPrisma.plan.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      mockPrisma.organizationSubscription.findMany.mockResolvedValue([{ status: SubscriptionStatus.ACTIVE }]);
      await expect(service.startTrial('org_1', 'plan_1', 14)).rejects.toThrow(BadRequestException);
    });

    it('creates trial subscription and history', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org_1' });
      mockPrisma.plan.findUnique.mockResolvedValue({ status: 'ACTIVE', billingInterval: BillingInterval.MONTHLY, currency: 'INR', basePrice: 100 });
      mockPrisma.organizationSubscription.findMany.mockResolvedValue([]);
      mockPrisma.organizationSubscription.create.mockResolvedValue({ id: 'sub_1' });
      mockPrisma.subscriptionHistory.create.mockResolvedValue({});

      const result = await service.startTrial('org_1', 'plan_1', 14);
      expect(result.id).toEqual('sub_1');
      expect(mockPrisma.subscriptionHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'START_TRIAL' }),
      }));
    });
  });

  describe('activate', () => {
    it('throws on invalid transition', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE });
      await expect(service.activate('sub_1')).rejects.toThrow(BadRequestException);
    });

    it('activates trial subscription', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.TRIAL });
      mockPrisma.organizationSubscription.update.mockResolvedValue({ id: 'sub_1', status: SubscriptionStatus.ACTIVE });
      await service.activate('sub_1');
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: SubscriptionStatus.ACTIVE },
      }));
    });
  });

  describe('upgrade', () => {
    it('throws if plan is missing', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, plan: { id: 'plan_1' } });
      mockPrisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.upgrade('sub_1', 'plan_2')).rejects.toThrow(NotFoundException);
    });

    it('throws if target plan is same as current', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, priceAtSubscription: 100, plan: { id: 'plan_2' } });
      await expect(service.upgrade('sub_1', 'plan_2')).rejects.toThrow(BadRequestException);
    });

    it('throws if target plan is cheaper', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, priceAtSubscription: 100, plan: { id: 'plan_1' } });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan_2', status: 'ACTIVE', basePrice: 50 });
      await expect(service.upgrade('sub_1', 'plan_2')).rejects.toThrow(BadRequestException);
    });

    it('performs upgrade', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, priceAtSubscription: 50, plan: { id: 'plan_1', name: 'Starter' } });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan_2', status: 'ACTIVE', basePrice: 100, name: 'Pro', billingInterval: 'MONTHLY', currency: 'INR' });
      mockPrisma.organizationSubscription.update.mockResolvedValue({ id: 'sub_1' });
      await service.upgrade('sub_1', 'plan_2');
      expect(mockPrisma.subscriptionHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'UPGRADE' }),
      }));
    });
  });

  describe('downgrade', () => {
    it('throws if target plan is more expensive', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, priceAtSubscription: 50, plan: { id: 'plan_1' } });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan_2', status: 'ACTIVE', basePrice: 100 });
      await expect(service.downgrade('sub_1', 'plan_2')).rejects.toThrow(BadRequestException);
    });

    it('performs downgrade', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, priceAtSubscription: 100, plan: { id: 'plan_1', name: 'Pro' } });
      mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan_2', status: 'ACTIVE', basePrice: 50, name: 'Starter', billingInterval: 'MONTHLY', currency: 'INR' });
      mockPrisma.organizationSubscription.update.mockResolvedValue({ id: 'sub_1' });
      await service.downgrade('sub_1', 'plan_2');
      expect(mockPrisma.subscriptionHistory.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'DOWNGRADE' }),
      }));
    });
  });

  describe('renew', () => {
    it('renews monthly', async () => {
      const end = new Date('2026-08-01T00:00:00Z');
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, billingInterval: BillingInterval.MONTHLY, currentPeriodEnd: end });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.renew('sub_1');
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
        }),
      }));
    });

    it('renews yearly', async () => {
      const end = new Date('2026-08-01T00:00:00Z');
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE, billingInterval: BillingInterval.YEARLY, currentPeriodEnd: end });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.renew('sub_1');
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          currentPeriodEnd: new Date('2027-08-01T00:00:00Z'),
        }),
      }));
    });
  });

  describe('suspend and reactivate', () => {
    it('suspends active subscription', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.suspend('sub_1');
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: SubscriptionStatus.SUSPENDED },
      }));
    });

    it('reactivates suspended subscription', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.SUSPENDED });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.reactivate('sub_1');
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false },
      }));
    });
  });

  describe('cancel', () => {
    it('cancels immediately', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.cancel('sub_1', true);
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
      }));
    });

    it('cancels at period end', async () => {
      mockPrisma.organizationSubscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.ACTIVE });
      mockPrisma.organizationSubscription.update.mockResolvedValue({});
      await service.cancel('sub_1', false);
      expect(mockPrisma.organizationSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: SubscriptionStatus.EXPIRING, cancelAtPeriodEnd: true }),
      }));
    });
  });
});
