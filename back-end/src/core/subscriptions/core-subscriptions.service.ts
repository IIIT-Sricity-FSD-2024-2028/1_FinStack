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

  async findAll(query: {
    status?: SubscriptionStatus;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?:
      | 'createdAt'
      | 'updatedAt'
      | 'currentPeriodEnd'
      | 'status'
      | 'organizationName'
      | 'planName';
    order?: 'asc' | 'desc';
  }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where = this.buildListWhere(query);
    const orderBy = this.buildListOrderBy(query.sortBy, query.order);

    const [items, total] = await Promise.all([
      this.prisma.organizationSubscription.findMany({
        where,
        include: { organization: true, plan: true },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.organizationSubscription.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string) {
    const sub = await this.prisma.organizationSubscription.findUnique({
      where: { id },
      include: {
        organization: true,
        plan: true,
        history: {
          orderBy: { createdAt: 'desc' },
          include: { actorStaff: true },
        },
      },
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
      subs.find(
        (s) =>
          s.status === SubscriptionStatus.ACTIVE ||
          s.status === SubscriptionStatus.TRIAL,
      ) ||
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
    trialDays?: number,
    actorStaffId?: string,
  ) {
    return this.prisma.$transaction((tx) =>
      this.startTrialInTransaction(
        tx,
        organizationId,
        planId,
        trialDays,
        actorStaffId,
      ),
    );
  }

  async startTrialInTransaction(
    tx: Prisma.TransactionClient,
    organizationId: string,
    planId: string,
    trialDays?: number,
    actorStaffId?: string,
  ) {
    const org = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const plan = await tx.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'ACTIVE')
      throw new BadRequestException('Plan is not active');

    // Check incompatible active subscription
    const existing = await tx.organizationSubscription.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    if (
      existing.some((subscription) =>
        (
          [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.EXPIRING,
            SubscriptionStatus.GRACE_PERIOD,
          ] as SubscriptionStatus[]
        ).includes(subscription.status),
      )
    ) {
      throw new BadRequestException(
        'Organization already has an active subscription',
      );
    }

    const effectiveTrialDays = trialDays ?? plan.trialDays ?? 14;
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(
      currentPeriodStart.getTime() + effectiveTrialDays * 24 * 60 * 60 * 1000,
    );

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

    await this.recordHistory(tx, {
      subscriptionId: sub.id,
      status: SubscriptionStatus.TRIAL,
      action: 'START_TRIAL',
      note: `Started trial for ${effectiveTrialDays} days`,
      actorStaffId,
      newStatus: SubscriptionStatus.TRIAL,
      newPlanId: planId,
    });
    await this.auditPlatformSubscription(
      tx,
      actorStaffId,
      'subscription.trial_started',
      sub.id,
      { organizationId, planId },
    );

    return sub;
  }

  async activate(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        sub.status !== SubscriptionStatus.TRIAL &&
        sub.status !== SubscriptionStatus.SUSPENDED
      ) {
        throw new BadRequestException(
          `Cannot activate subscription from ${sub.status}`,
        );
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.ACTIVE },
        include: { organization: true, plan: true },
      });

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.ACTIVE,
        action: 'ACTIVATE',
        note: 'Subscription activated',
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.ACTIVE,
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.activated',
        id,
        { previousStatus: sub.status, newStatus: SubscriptionStatus.ACTIVE },
      );

      return updated;
    });
  }

  async upgrade(
    id: string,
    newPlanId: string,
    actorStaffId?: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
        include: { plan: true },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        (
          [
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELLED,
          ] as SubscriptionStatus[]
        ).includes(sub.status)
      ) {
        throw new BadRequestException(
          `Cannot change plan for subscription in ${sub.status} state`,
        );
      }

      if (sub.plan.id === newPlanId) {
        throw new BadRequestException(
          'Target plan must be different from the current plan',
        );
      }

      const newPlan = await tx.plan.findUnique({ where: { id: newPlanId } });
      if (!newPlan) throw new NotFoundException('New plan not found');
      if (newPlan.status !== 'ACTIVE')
        throw new BadRequestException('New plan is not active');

      if (Number(newPlan.basePrice) <= Number(sub.priceAtSubscription)) {
        throw new BadRequestException(
          'Target plan base price must be strictly greater than current plan for upgrade',
        );
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

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.ACTIVE,
        action: 'UPGRADE',
        note: reason || `Changed plan from ${sub.plan.name} to ${newPlan.name}`,
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.ACTIVE,
        previousPlanId: sub.plan.id,
        newPlanId: newPlan.id,
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.upgraded',
        id,
        { fromPlanId: sub.plan.id, toPlanId: newPlan.id },
      );

      return updated;
    });
  }

  async downgrade(
    id: string,
    newPlanId: string,
    actorStaffId?: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
        include: { plan: true },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        (
          [
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELLED,
          ] as SubscriptionStatus[]
        ).includes(sub.status)
      ) {
        throw new BadRequestException(
          `Cannot change plan for subscription in ${sub.status} state`,
        );
      }

      if (sub.plan.id === newPlanId) {
        throw new BadRequestException(
          'Target plan must be different from the current plan',
        );
      }

      const newPlan = await tx.plan.findUnique({ where: { id: newPlanId } });
      if (!newPlan) throw new NotFoundException('New plan not found');
      if (newPlan.status !== 'ACTIVE')
        throw new BadRequestException('New plan is not active');

      if (Number(newPlan.basePrice) >= Number(sub.priceAtSubscription)) {
        throw new BadRequestException(
          'Target plan base price must be strictly lower than current plan for downgrade',
        );
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

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.ACTIVE,
        action: 'DOWNGRADE',
        note: reason || `Changed plan from ${sub.plan.name} to ${newPlan.name}`,
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.ACTIVE,
        previousPlanId: sub.plan.id,
        newPlanId: newPlan.id,
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.downgraded',
        id,
        { fromPlanId: sub.plan.id, toPlanId: newPlan.id },
      );

      return updated;
    });
  }

  async renew(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        (
          [
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELLED,
          ] as SubscriptionStatus[]
        ).includes(sub.status)
      ) {
        throw new BadRequestException(
          `Cannot renew subscription in ${sub.status} state`,
        );
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

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.ACTIVE,
        action: 'RENEW',
        note: `Renewed for ${sub.billingInterval}`,
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.ACTIVE,
        metadata: {
          previousPeriodEnd: sub.currentPeriodEnd.toISOString(),
          currentPeriodEnd: newEnd.toISOString(),
        },
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.renewed',
        id,
        {
          previousPeriodEnd: sub.currentPeriodEnd.toISOString(),
          currentPeriodEnd: newEnd.toISOString(),
        },
      );

      return updated;
    });
  }

  async suspend(id: string, note?: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        (
          [
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELLED,
          ] as SubscriptionStatus[]
        ).includes(sub.status)
      ) {
        throw new BadRequestException(
          `Cannot suspend subscription from ${sub.status}`,
        );
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.SUSPENDED },
        include: { organization: true, plan: true },
      });

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.SUSPENDED,
        action: 'SUSPEND',
        note: note || 'Subscription suspended',
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.SUSPENDED,
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.suspended',
        id,
        { previousStatus: sub.status, newStatus: SubscriptionStatus.SUSPENDED },
      );

      return updated;
    });
  }

  async reactivate(id: string, actorStaffId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
      });
      if (!sub) throw new NotFoundException('Subscription not found');

      if (
        sub.status !== SubscriptionStatus.SUSPENDED &&
        sub.status !== SubscriptionStatus.EXPIRING
      ) {
        throw new BadRequestException(`Cannot reactivate from ${sub.status}`);
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data: { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false },
        include: { organization: true, plan: true },
      });

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: SubscriptionStatus.ACTIVE,
        action: 'REACTIVATE',
        note: 'Subscription reactivated',
        actorStaffId,
        previousStatus: sub.status,
        newStatus: SubscriptionStatus.ACTIVE,
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.reactivated',
        id,
        { previousStatus: sub.status, newStatus: SubscriptionStatus.ACTIVE },
      );

      return updated;
    });
  }

  async cancel(
    id: string,
    immediate = false,
    actorStaffId?: string,
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.organizationSubscription.findUnique({
        where: { id },
      });
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
        note = reason || 'Subscription cancelled immediately';
      } else {
        data.status = SubscriptionStatus.EXPIRING;
        data.cancelAtPeriodEnd = true;
        nextStatus = SubscriptionStatus.EXPIRING;
        note = reason || 'Subscription scheduled to cancel at period end';
      }

      const updated = await tx.organizationSubscription.update({
        where: { id },
        data,
        include: { organization: true, plan: true },
      });

      await this.recordHistory(tx, {
        subscriptionId: id,
        status: nextStatus,
        action: 'CANCEL',
        note,
        actorStaffId,
        previousStatus: sub.status,
        newStatus: nextStatus,
        metadata: { immediate },
      });
      await this.auditPlatformSubscription(
        tx,
        actorStaffId,
        'subscription.cancelled',
        id,
        {
          previousStatus: sub.status,
          newStatus: nextStatus,
          immediate,
        },
      );

      return updated;
    });
  }

  private buildListWhere(query: {
    status?: SubscriptionStatus;
    search?: string;
  }): Prisma.OrganizationSubscriptionWhereInput {
    const where: Prisma.OrganizationSubscriptionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const search = query.search?.trim();
    if (!search) {
      return where;
    }

    const searchFilters: Prisma.OrganizationSubscriptionWhereInput[] = [
      {
        organization: {
          is: { name: { contains: search, mode: 'insensitive' } },
        },
      },
      {
        organization: {
          is: { primaryEmail: { contains: search, mode: 'insensitive' } },
        },
      },
      {
        plan: {
          is: { name: { contains: search, mode: 'insensitive' } },
        },
      },
      {
        plan: {
          is: { key: { contains: search, mode: 'insensitive' } },
        },
      },
    ];

    if (this.isUuid(search)) {
      searchFilters.unshift({ id: search }, { organizationId: search });
    }

    where.OR = searchFilters;
    return where;
  }

  private buildListOrderBy(
    sortBy:
      | 'createdAt'
      | 'updatedAt'
      | 'currentPeriodEnd'
      | 'status'
      | 'organizationName'
      | 'planName' = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ): Prisma.OrganizationSubscriptionOrderByWithRelationInput {
    if (sortBy === 'organizationName') {
      return { organization: { name: order } };
    }
    if (sortBy === 'planName') {
      return { plan: { name: order } };
    }
    return { [sortBy]: order };
  }

  private async auditPlatformSubscription(
    tx: Prisma.TransactionClient,
    actorStaffId: string | undefined,
    action: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!actorStaffId) {
      return;
    }

    await tx.platformAuditLog.create({
      data: {
        actorStaffId,
        action,
        resourceType: 'OrganizationSubscription',
        resourceId,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  }

  private async recordHistory(
    tx: Prisma.TransactionClient,
    data: {
      subscriptionId: string;
      status: SubscriptionStatus;
      action: string;
      note?: string;
      actorStaffId?: string;
      previousStatus?: SubscriptionStatus;
      newStatus?: SubscriptionStatus;
      previousPlanId?: string;
      newPlanId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: data.subscriptionId,
        status: data.status,
        action: data.action,
        note: data.note,
        actorStaffId: data.actorStaffId,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        previousPlanId: data.previousPlanId,
        newPlanId: data.newPlanId,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
