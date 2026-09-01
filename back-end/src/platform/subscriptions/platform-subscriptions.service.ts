import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  InvoiceBillingReason,
  InvoiceStatus,
  PlanStatus,
  Prisma,
  SubscriptionHistoryAction,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  invoiceInclude,
  pageMeta,
  PaginatedDto,
  SubscriptionDto,
  SubscriptionHistoryDto,
  toInvoiceDto,
  toSubscriptionDto,
  toSubscriptionHistoryDto,
} from '../commercial/platform-commercial.types';
import { runPlatformSerializableTransaction } from '../common/platform-serializable-transaction';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import {
  ListSubscriptionHistoryQueryDto,
  ListSubscriptionsQueryDto,
} from './dto/list-subscriptions-query.dto';

const EFFECTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.PENDING_PAYMENT,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.EXPIRING,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.SUSPENDED,
];
const PLAN_CHANGE_ALLOWED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.EXPIRING,
  SubscriptionStatus.GRACE_PERIOD,
];
const REACTIVATABLE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELLED,
  SubscriptionStatus.SUSPENDED,
];

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: ListSubscriptionsQueryDto,
  ): Promise<PaginatedDto<SubscriptionDto>> {
    const where = this.buildWhere(query);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.organizationSubscription.findMany({
        where,
        include: this.subscriptionInclude(),
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.organizationSubscription.count({ where }),
    ]);

    return {
      items: records.map(toSubscriptionDto),
      meta: pageMeta(query.page, query.pageSize, totalItems),
    };
  }

  async findOne(id: string): Promise<SubscriptionDto> {
    const record = await this.prisma.organizationSubscription.findUnique({
      where: { id },
      include: this.subscriptionInclude(),
    });
    if (!record) this.subscriptionNotFound();
    return toSubscriptionDto(record);
  }

  async findHistory(
    subscriptionId: string,
    query: ListSubscriptionHistoryQueryDto,
  ): Promise<PaginatedDto<SubscriptionHistoryDto>> {
    await this.requireSubscription(subscriptionId);
    const where = { subscriptionId };
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.subscriptionHistory.findMany({
        where,
        include: {
          actorStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.subscriptionHistory.count({ where }),
    ]);
    return {
      items: records.map(toSubscriptionHistoryDto),
      meta: pageMeta(query.page, query.pageSize, totalItems),
    };
  }

  async assign(dto: AssignSubscriptionDto, actorStaffId: string) {
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const [organization, plan, existing] = await Promise.all([
            tx.organization.findUnique({
              where: { id: dto.organizationId },
              select: { id: true },
            }),
            tx.plan.findUnique({ where: { id: dto.planId } }),
            tx.organizationSubscription.findFirst({
              where: {
                organizationId: dto.organizationId,
                status: { in: EFFECTIVE_SUBSCRIPTION_STATUSES },
              },
              select: { id: true },
            }),
          ]);
          if (!organization) {
            throw new NotFoundException({
              code: 'ORGANIZATION_NOT_FOUND',
              message: 'Organization not found.',
            });
          }
          if (!plan) this.planNotFound();
          if (plan.status !== PlanStatus.ACTIVE) {
            throw new ConflictException({
              code: 'PLAN_INACTIVE',
              message: 'Only an active plan can be assigned.',
            });
          }
          if (existing) this.effectiveSubscriptionConflict();

          const now = new Date();
          const hasTrial = (plan.trialDays ?? 0) > 0;
          const trialEnd = hasTrial
            ? this.addDays(now, plan.trialDays ?? 0)
            : null;
          const status = hasTrial
            ? SubscriptionStatus.TRIAL
            : SubscriptionStatus.PENDING_PAYMENT;
          const subscription = await tx.organizationSubscription.create({
            data: {
              organizationId: organization.id,
              planId: plan.id,
              status,
              billingInterval: plan.billingInterval,
              currency: plan.currency,
              priceAtSubscription: plan.basePrice,
              currentPeriodStart: hasTrial ? now : null,
              currentPeriodEnd: trialEnd,
              trialStartAt: hasTrial ? now : null,
              trialEndAt: trialEnd,
            },
            include: this.subscriptionInclude(),
          });

          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              action: SubscriptionHistoryAction.ASSIGNED,
              newStatus: status,
              newPlanId: plan.id,
              actorStaffId,
              note: hasTrial
                ? `Assigned with the plan's ${plan.trialDays ?? 0}-day trial.`
                : 'Assigned pending successful payment.',
            },
          });

          const billingStart = trialEnd ?? now;
          const invoice = await this.createInvoice(tx, {
            subscriptionId: subscription.id,
            organizationId: organization.id,
            plan,
            reason: InvoiceBillingReason.INITIAL,
            billingPeriodStart: billingStart,
            billingPeriodEnd: this.addBillingInterval(
              billingStart,
              plan.billingInterval,
            ),
            dueDate: billingStart,
            idempotencyKey: `subscription:${subscription.id}:initial`,
            actorStaffId,
          });

          await this.audit(
            tx,
            actorStaffId,
            'subscription.assigned',
            subscription.id,
            {
              organizationId: organization.id,
              planId: plan.id,
              status,
              invoiceId: invoice.id,
            },
          );

          return {
            subscription: toSubscriptionDto(subscription),
            invoice: toInvoiceDto(invoice),
          };
        },
        {
          code: 'SUBSCRIPTION_ASSIGNMENT_CONFLICT',
          message: 'Subscription assignment conflicted with another update.',
        },
      );
    } catch (error) {
      this.handleUniqueSubscriptionError(error);
    }
  }

  async requestPlanChange(
    id: string,
    dto: ChangeSubscriptionPlanDto,
    actorStaffId: string,
  ) {
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const subscription = await tx.organizationSubscription.findUnique({
            where: { id },
          });
          if (!subscription) this.subscriptionNotFound();
          if (!PLAN_CHANGE_ALLOWED_STATUSES.includes(subscription.status)) {
            throw new ConflictException({
              code: 'SUBSCRIPTION_PLAN_CHANGE_NOT_ALLOWED',
              message: `A plan change cannot be requested from ${subscription.status}.`,
            });
          }
          if (subscription.planId === dto.planId) {
            throw new ConflictException({
              code: 'SUBSCRIPTION_PLAN_UNCHANGED',
              message: 'The requested plan is already assigned.',
            });
          }

          const [plan, pendingChange] = await Promise.all([
            tx.plan.findUnique({ where: { id: dto.planId } }),
            tx.invoice.findFirst({
              where: {
                subscriptionId: id,
                billingReason: InvoiceBillingReason.PLAN_CHANGE,
                status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
              },
              select: { id: true },
            }),
          ]);
          if (!plan) this.planNotFound();
          if (plan.status !== PlanStatus.ACTIVE) {
            throw new ConflictException({
              code: 'PLAN_INACTIVE',
              message: 'Only an active plan can be selected.',
            });
          }
          if (pendingChange) {
            throw new ConflictException({
              code: 'PLAN_CHANGE_ALREADY_PENDING',
              message: 'This subscription already has a pending plan change.',
            });
          }

          const now = new Date();
          const invoice = await this.createInvoice(tx, {
            subscriptionId: subscription.id,
            organizationId: subscription.organizationId,
            plan,
            reason: InvoiceBillingReason.PLAN_CHANGE,
            billingPeriodStart: now,
            billingPeriodEnd: this.addBillingInterval(
              now,
              plan.billingInterval,
            ),
            dueDate: now,
            idempotencyKey: `subscription:${subscription.id}:plan-change:${plan.id}:${randomUUID()}`,
            actorStaffId,
          });
          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              action: SubscriptionHistoryAction.PLAN_CHANGE_REQUESTED,
              previousStatus: subscription.status,
              newStatus: subscription.status,
              previousPlanId: subscription.planId,
              newPlanId: plan.id,
              actorStaffId,
              note: dto.reason?.trim() || 'Plan change requested.',
              metadata: { invoiceId: invoice.id },
            },
          });
          await this.audit(
            tx,
            actorStaffId,
            'subscription.plan_change_requested',
            subscription.id,
            {
              previousPlanId: subscription.planId,
              newPlanId: plan.id,
              invoiceId: invoice.id,
            },
          );
          return { invoice: toInvoiceDto(invoice) };
        },
        {
          code: 'PLAN_CHANGE_CONFLICT',
          message: 'The plan change conflicted with another update.',
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PLAN_CHANGE_ALREADY_PENDING',
          message: 'This subscription already has a pending plan change.',
        });
      }
      throw error;
    }
  }

  async cancel(
    id: string,
    dto: CancelSubscriptionDto,
    actorStaffId: string,
  ): Promise<SubscriptionDto> {
    return runPlatformSerializableTransaction(
      this.prisma,
      async (tx) => {
        const current = await tx.organizationSubscription.findUnique({
          where: { id },
        });
        if (!current) this.subscriptionNotFound();
        if (current.status === SubscriptionStatus.CANCELLED) {
          throw new ConflictException({
            code: 'SUBSCRIPTION_ALREADY_CANCELLED',
            message: 'Subscription is already cancelled.',
          });
        }

        const now = new Date();
        const updated = await tx.organizationSubscription.update({
          where: { id },
          data: { status: SubscriptionStatus.CANCELLED, cancelledAt: now },
          include: this.subscriptionInclude(),
        });
        await tx.invoice.updateMany({
          where: {
            subscriptionId: id,
            status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
          },
          data: { status: InvoiceStatus.VOID, voidedAt: now },
        });
        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: id,
            action: SubscriptionHistoryAction.CANCELLED,
            previousStatus: current.status,
            newStatus: SubscriptionStatus.CANCELLED,
            previousPlanId: current.planId,
            newPlanId: current.planId,
            actorStaffId,
            note: dto.reason?.trim() || 'Cancelled by platform staff.',
          },
        });
        await this.audit(tx, actorStaffId, 'subscription.cancelled', id, {
          previousStatus: current.status,
          reason: dto.reason?.trim() || null,
        });
        return toSubscriptionDto(updated);
      },
      {
        code: 'SUBSCRIPTION_CANCELLATION_CONFLICT',
        message: 'Cancellation conflicted with another update.',
      },
    );
  }

  async reactivate(id: string, actorStaffId: string): Promise<SubscriptionDto> {
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const current = await tx.organizationSubscription.findUnique({
            where: { id },
          });
          if (!current) this.subscriptionNotFound();
          if (!REACTIVATABLE_STATUSES.includes(current.status)) {
            throw new ConflictException({
              code: 'SUBSCRIPTION_REACTIVATION_NOT_ALLOWED',
              message: `Subscription cannot be reactivated from ${current.status}.`,
            });
          }
          if (
            !current.currentPeriodEnd ||
            current.currentPeriodEnd <= new Date()
          ) {
            throw new ConflictException({
              code: 'SUBSCRIPTION_PAYMENT_REQUIRED',
              message:
                'An expired subscription requires a successful renewal payment.',
            });
          }
          const successfulPayment = await tx.subscriptionPayment.findFirst({
            where: {
              subscriptionId: id,
              status: SubscriptionPaymentStatus.SUCCEEDED,
            },
            select: { id: true },
          });
          if (!successfulPayment) {
            throw new ConflictException({
              code: 'SUBSCRIPTION_PAYMENT_REQUIRED',
              message:
                'Reactivation requires a successful payment for the current period.',
            });
          }

          const updated = await tx.organizationSubscription.update({
            where: { id },
            data: { status: SubscriptionStatus.ACTIVE, cancelledAt: null },
            include: this.subscriptionInclude(),
          });
          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: id,
              action: SubscriptionHistoryAction.REACTIVATED,
              previousStatus: current.status,
              newStatus: SubscriptionStatus.ACTIVE,
              previousPlanId: current.planId,
              newPlanId: current.planId,
              actorStaffId,
              note: 'Reactivated within an already-paid billing period.',
            },
          });
          await this.audit(tx, actorStaffId, 'subscription.reactivated', id, {
            previousStatus: current.status,
            paymentId: successfulPayment.id,
          });
          return toSubscriptionDto(updated);
        },
        {
          code: 'SUBSCRIPTION_REACTIVATION_CONFLICT',
          message: 'Reactivation conflicted with another update.',
        },
      );
    } catch (error) {
      this.handleUniqueSubscriptionError(error);
    }
  }

  private buildWhere(
    query: ListSubscriptionsQueryDto,
  ): Prisma.OrganizationSubscriptionWhereInput {
    const where: Prisma.OrganizationSubscriptionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.planId) where.planId = query.planId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { id: { equals: this.uuidOrImpossible(search) } },
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
        { plan: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { plan: { is: { key: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private subscriptionInclude() {
    return {
      organization: {
        select: { id: true, name: true, slug: true, primaryEmail: true },
      },
      plan: {
        include: {
          planFeatures: {
            where: { enabled: true },
            include: { feature: true },
          },
        },
      },
    } satisfies Prisma.OrganizationSubscriptionInclude;
  }

  private async createInvoice(
    tx: Prisma.TransactionClient,
    input: {
      subscriptionId: string;
      organizationId: string;
      plan: {
        id: string;
        basePrice: Prisma.Decimal;
        currency: string;
        billingInterval: BillingInterval;
      };
      reason: InvoiceBillingReason;
      billingPeriodStart: Date;
      billingPeriodEnd: Date;
      dueDate: Date;
      idempotencyKey: string;
      actorStaffId: string;
    },
  ) {
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: this.invoiceNumber(),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        planId: input.plan.id,
        billingReason: input.reason,
        subtotal: input.plan.basePrice,
        totalAmount: input.plan.basePrice,
        currency: input.plan.currency,
        billingPeriodStart: input.billingPeriodStart,
        billingPeriodEnd: input.billingPeriodEnd,
        dueDate: input.dueDate,
      },
      include: invoiceInclude,
    });
    await this.audit(
      tx,
      input.actorStaffId,
      'billing.invoice.created',
      invoice.id,
      {
        subscriptionId: input.subscriptionId,
        organizationId: input.organizationId,
        planId: input.plan.id,
        billingReason: input.reason,
        amount: input.plan.basePrice.toString(),
        currency: input.plan.currency,
      },
    );
    return invoice;
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorStaffId: string | null,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    return tx.platformAuditLog.create({
      data: {
        actorStaffId,
        action,
        resourceType: action.startsWith('billing.')
          ? 'Invoice'
          : 'OrganizationSubscription',
        resourceId,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  }

  private async requireSubscription(id: string): Promise<void> {
    const exists = await this.prisma.organizationSubscription.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) this.subscriptionNotFound();
  }

  private addDays(value: Date, days: number): Date {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private addBillingInterval(value: Date, interval: BillingInterval): Date {
    const result = new Date(value);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    if (interval === BillingInterval.MONTHLY) {
      result.setUTCMonth(result.getUTCMonth() + 1);
    } else {
      result.setUTCFullYear(result.getUTCFullYear() + 1);
    }
    const lastDay = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }

  private invoiceNumber(): string {
    const month = new Date().toISOString().slice(0, 7).replace('-', '');
    return `INV-${month}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private uuidOrImpossible(value: string): string {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : '00000000-0000-0000-0000-000000000000';
  }

  private subscriptionNotFound(): never {
    throw new NotFoundException({
      code: 'SUBSCRIPTION_NOT_FOUND',
      message: 'Subscription not found.',
    });
  }

  private planNotFound(): never {
    throw new NotFoundException({
      code: 'PLAN_NOT_FOUND',
      message: 'Plan not found.',
    });
  }

  private effectiveSubscriptionConflict(): never {
    throw new ConflictException({
      code: 'EFFECTIVE_SUBSCRIPTION_EXISTS',
      message: 'Organization already has an effective subscription.',
    });
  }

  private handleUniqueSubscriptionError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      this.effectiveSubscriptionConflict();
    }
    throw error;
  }
}
