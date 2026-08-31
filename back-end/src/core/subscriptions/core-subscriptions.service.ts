import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BillingInterval, SubscriptionStatus, Prisma } from '@prisma/client';

@Injectable()
export class CoreSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { status?: SubscriptionStatus; page?: number; limit?: number }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.organizationSubscription.findMany({
        where,
        include: { organization: true, plan: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organizationSubscription.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { id },
      include: { organization: true, plan: true },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    return sub;
  }

  async findByOrganizationId(organizationId: string) {
    const subs = await this.prisma.organizationSubscription.findMany({
      where: { organizationId },
      include: { organization: true, plan: true },
      orderBy: { createdAt: 'desc' },
    });
    // Return active or trial if possible, else the latest
    return (
      subs.find((s) => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.TRIAL) ||
      subs[0] ||
      null
    );
  }

  async getHistory(subscriptionId: string) {
    return this.prisma.subscriptionHistory.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      include: { actorStaff: true },
    });
  }

  // START_TRIAL / ASSIGN
  async startTrial(
    organizationId: string,
    planId: string,
    trialDays: number,
    actorStaffId?: string,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'ACTIVE') throw new BadRequestException('Plan is not active');

    // Check incompatible active subscription
    const existing = await this.findByOrganizationId(organizationId);
    if (
      existing &&
      ([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRING, SubscriptionStatus.GRACE_PERIOD] as SubscriptionStatus[]).includes(
        existing.status,
      )
    ) {
      throw new BadRequestException('Organization already has an active subscription');
    }

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart.getTime() + trialDays * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.create({
        data: {
          organizationId,
          planId,
          status: SubscriptionStatus.TRIAL,
          billingInterval: plan.billingInterval,
          currency: plan.currency,
          priceAtSubscription: plan.basePrice,
          currentPeriodStart,
          currentPeriodEnd,
          trialStartAt: currentPeriodStart,
          trialEndAt: currentPeriodEnd,
        },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: sub.id,
          status: SubscriptionStatus.TRIAL,
          action: 'START_TRIAL',
          note: `Started trial for ${trialDays} days`,
          actorStaffId,
        },
      });

      return sub;
    });
  }

  async activate(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (sub.status !== SubscriptionStatus.TRIAL && sub.status !== SubscriptionStatus.SUSPENDED) {
        throw new BadRequestException(`Cannot activate subscription from ${sub.status}`);
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.ACTIVE },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.ACTIVE,
          action: 'ACTIVATE',
          note: 'Subscription activated',
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async upgrade(id: string, newPlanId: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id }, include: { plan: true } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED] as SubscriptionStatus[]).includes(sub.status)) {
        throw new BadRequestException(`Cannot change plan for subscription in ${sub.status} state`);
      }

      if (sub.plan.id === newPlanId) {
        throw new BadRequestException('Target plan must be different from the current plan');
      }

      const newPlan = await tx.plan.findUnique({ where: { id: newPlanId } });
      if (!newPlan) throw new NotFoundException('New plan not found');
      if (newPlan.status !== 'ACTIVE') throw new BadRequestException('New plan is not active');

      if (Number(newPlan.basePrice) <= Number(sub.priceAtSubscription)) {
        throw new BadRequestException('Target plan base price must be strictly greater than current plan for upgrade');
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: {
          planId: newPlan.id,
          priceAtSubscription: newPlan.basePrice,
          currency: newPlan.currency,
          billingInterval: newPlan.billingInterval,
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
        },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.ACTIVE,
          action: 'UPGRADE',
          note: `Changed plan from ${sub.plan.name} to ${newPlan.name}`,
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async downgrade(id: string, newPlanId: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id }, include: { plan: true } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED] as SubscriptionStatus[]).includes(sub.status)) {
        throw new BadRequestException(`Cannot change plan for subscription in ${sub.status} state`);
      }

      if (sub.plan.id === newPlanId) {
        throw new BadRequestException('Target plan must be different from the current plan');
      }

      const newPlan = await tx.plan.findUnique({ where: { id: newPlanId } });
      if (!newPlan) throw new NotFoundException('New plan not found');
      if (newPlan.status !== 'ACTIVE') throw new BadRequestException('New plan is not active');

      if (Number(newPlan.basePrice) >= Number(sub.priceAtSubscription)) {
        throw new BadRequestException('Target plan base price must be strictly lower than current plan for downgrade');
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: {
          planId: newPlan.id,
          priceAtSubscription: newPlan.basePrice,
          currency: newPlan.currency,
          billingInterval: newPlan.billingInterval,
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
        },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.ACTIVE,
          action: 'DOWNGRADE',
          note: `Changed plan from ${sub.plan.name} to ${newPlan.name}`,
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async renew(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED] as SubscriptionStatus[]).includes(sub.status)) {
        throw new BadRequestException(`Cannot renew subscription in ${sub.status} state`);
      }

      const newStart = new Date(sub.currentPeriodEnd);
      const newEnd = new Date(newStart);
      if (sub.billingInterval === BillingInterval.MONTHLY) {
        newEnd.setMonth(newEnd.getMonth() + 1);
      } else {
        newEnd.setFullYear(newEnd.getFullYear() + 1);
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.ACTIVE, // Resets Grace Period etc
          currentPeriodStart: newStart,
          currentPeriodEnd: newEnd,
        },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.ACTIVE,
          action: 'RENEW',
          note: `Renewed for ${sub.billingInterval}`,
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async suspend(id: string, note?: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (([SubscriptionStatus.SUSPENDED, SubscriptionStatus.CANCELLED] as SubscriptionStatus[]).includes(sub.status)) {
        throw new BadRequestException(`Cannot suspend subscription from ${sub.status}`);
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.SUSPENDED },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.SUSPENDED,
          action: 'SUSPEND',
          note: note || 'Subscription suspended',
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async reactivate(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (sub.status !== SubscriptionStatus.SUSPENDED && sub.status !== SubscriptionStatus.EXPIRING) {
        throw new BadRequestException(`Cannot reactivate from ${sub.status}`);
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false },
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: SubscriptionStatus.ACTIVE,
          action: 'REACTIVATE',
          note: 'Subscription reactivated',
          actorStaffId,
        },
      });

      return updated;
    });
  }

  async cancel(id: string, immediate = false, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({ where: { id } });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (sub.status === SubscriptionStatus.CANCELLED) {
        throw new BadRequestException('Subscription is already cancelled');
      }

      const data: Prisma.OrganizationSubscriptionUpdateInput = {};
      let nextStatus: SubscriptionStatus = sub.status;
      let note = '';

      if (immediate) {
        data.status = SubscriptionStatus.CANCELLED;
        data.cancelledAt = new Date();
        nextStatus = SubscriptionStatus.CANCELLED;
        note = 'Subscription cancelled immediately';
      } else {
        data.status = SubscriptionStatus.EXPIRING;
        data.cancelAtPeriodEnd = true;
        nextStatus = SubscriptionStatus.EXPIRING;
        note = 'Subscription scheduled to cancel at period end';
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data,
        include: { organization: true, plan: true },
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: id,
          status: nextStatus,
          action: 'CANCEL',
          note,
          actorStaffId,
        },
      });

      return updated;
    });
  }
}
