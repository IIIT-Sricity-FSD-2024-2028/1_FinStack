import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInterval,
  InvoiceStatus,
  Prisma,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  invalidAmount,
  invalidPaymentTransition,
  invoiceNotFound,
  paymentNotFound,
  paymentVerificationFailure,
  subscriptionNotFound,
  webhookSignatureFailure,
} from './billing-errors';
import { RazorpayService } from './razorpay.service';

const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PENDING,
  InvoiceStatus.OVERDUE,
];

const invoiceInclude = {
  organization: true,
  plan: true,
  subscription: { include: { plan: true } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.InvoiceInclude;

const paymentInclude = {
  organization: true,
  invoice: true,
  subscription: { include: { plan: true } },
} satisfies Prisma.SubscriptionPaymentInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

type PaymentWithRelations = Prisma.SubscriptionPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class CoreBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
  ) {}

  async ensureInvoiceForSubscription(
    subscriptionId: string,
    actorStaffId?: string,
  ): Promise<InvoiceWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.organizationSubscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true, organization: true },
      });
      if (!subscription) {
        throw subscriptionNotFound();
      }

      const existing = await tx.invoice.findFirst({
        where: {
          subscriptionId,
          billingPeriodStart: subscription.currentPeriodStart,
          billingPeriodEnd: subscription.currentPeriodEnd,
          status: { not: InvoiceStatus.VOID },
        },
        include: invoiceInclude,
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        return existing;
      }

      const amount = new Prisma.Decimal(subscription.priceAtSubscription);
      if (amount.lessThanOrEqualTo(0)) {
        throw invalidAmount('Subscription price must be greater than zero.');
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const invoice = await tx.invoice.create({
        data: {
          organizationId: subscription.organizationId,
          subscriptionId: subscription.id,
          planId: subscription.planId,
          status: InvoiceStatus.PENDING,
          subtotal: amount,
          taxAmount: new Prisma.Decimal(0),
          totalAmount: amount,
          currency: subscription.currency,
          billingPeriodStart: subscription.currentPeriodStart,
          billingPeriodEnd: subscription.currentPeriodEnd,
          dueDate,
        },
        include: invoiceInclude,
      });

      await this.auditBilling(
        tx,
        actorStaffId,
        'billing.invoice.created',
        'Invoice',
        invoice.id,
        {
          invoiceNumber: invoice.invoiceNumber,
          organizationId: invoice.organizationId,
          subscriptionId: invoice.subscriptionId,
          amount: invoice.totalAmount.toString(),
          currency: invoice.currency,
        },
      );

      return invoice;
    });
  }

  async ensureCurrentInvoiceForOrganization(
    organizationId: string,
  ): Promise<InvoiceWithRelations> {
    const subscription =
      await this.findCurrentSubscriptionForOrganization(organizationId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No active subscription found for this organization.',
      });
    }
    return this.ensureInvoiceForSubscription(subscription.id);
  }

  async listInvoices(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: InvoiceStatus;
    organizationId?: string;
    from?: Date;
    to?: Date;
    sortBy?: 'createdAt' | 'dueDate' | 'issueDate' | 'totalAmount' | 'status';
    order?: 'asc' | 'desc';
  }) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const where = this.buildInvoiceWhere(query);
    const orderBy = {
      [query.sortBy || 'createdAt']: query.order || 'desc',
    } as Prisma.InvoiceOrderByWithRelationInput;

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getInvoice(
    id: string,
    organizationId?: string,
  ): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: invoiceInclude,
    });
    if (!invoice) {
      throw invoiceNotFound();
    }
    return invoice;
  }

  async listPayments(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: SubscriptionPaymentStatus;
    provider?: string;
    organizationId?: string;
    from?: Date;
    to?: Date;
    failedOnly?: boolean;
    sortBy?: 'createdAt' | 'paidAt' | 'failedAt' | 'amount' | 'status';
    order?: 'asc' | 'desc';
  }) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const where = this.buildPaymentWhere(query);
    const orderBy = {
      [query.sortBy || 'createdAt']: query.order || 'desc',
    } as Prisma.SubscriptionPaymentOrderByWithRelationInput;

    const [items, total] = await Promise.all([
      this.prisma.subscriptionPayment.findMany({
        where,
        include: paymentInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.subscriptionPayment.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getPayment(
    id: string,
    organizationId?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { id, ...(organizationId ? { organizationId } : {}) },
      include: paymentInclude,
    });
    if (!payment) {
      throw paymentNotFound();
    }
    return payment;
  }

  async getCustomerBilling(organizationId: string) {
    const [subscription, invoices, payments] = await Promise.all([
      this.findCurrentSubscriptionForOrganization(organizationId),
      this.prisma.invoice.findMany({
        where: { organizationId },
        include: invoiceInclude,
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.prisma.subscriptionPayment.findMany({
        where: { organizationId },
        include: paymentInclude,
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    ]);

    return {
      current: subscription
        ? {
            subscription,
            nextBillingDate: subscription.currentPeriodEnd,
            amount: subscription.priceAtSubscription,
            currency: subscription.currency,
            billingInterval: subscription.billingInterval,
          }
        : null,
      invoices,
      payments,
      failedPayments: payments.filter(
        (payment) => payment.status === SubscriptionPaymentStatus.FAILED,
      ),
    };
  }

  async createRazorpayOrderForInvoice(
    organizationId: string,
    invoiceId: string,
  ) {
    const invoice = await this.getInvoice(invoiceId, organizationId);
    this.assertInvoicePayable(invoice);

    const existingPending = invoice.payments.find(
      (payment) =>
        payment.provider === 'RAZORPAY' &&
        payment.status === SubscriptionPaymentStatus.PENDING &&
        payment.providerOrderId,
    );

    if (existingPending?.providerOrderId) {
      return {
        orderId: existingPending.providerOrderId,
        amount: this.razorpay.toSmallestCurrencyUnit(
          existingPending.amount,
          existingPending.currency,
        ),
        currency: existingPending.currency,
        keyId: this.razorpay.getPublicKeyId(),
        invoiceId: invoice.id,
        paymentId: existingPending.id,
      };
    }

    const order = await this.razorpay.createOrder({
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      receipt: invoice.invoiceNumber,
    });

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        organizationId: invoice.organizationId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        status: SubscriptionPaymentStatus.PENDING,
        provider: 'RAZORPAY',
        providerOrderId: order.orderId,
      },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        action: 'billing.payment.created',
        resourceType: 'SubscriptionPayment',
        resourceId: payment.id,
        metadata: {
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          provider: 'RAZORPAY',
          providerOrderId: order.orderId,
        },
      },
    });

    return { ...order, invoiceId: invoice.id, paymentId: payment.id };
  }

  async createRazorpayOrderForCurrentInvoice(organizationId: string) {
    const invoice =
      await this.ensureCurrentInvoiceForOrganization(organizationId);
    return this.createRazorpayOrderForInvoice(organizationId, invoice.id);
  }

  async verifyRazorpayPayment(
    organizationId: string,
    input: { orderId: string; paymentId: string; signature: string },
  ) {
    if (!this.razorpay.verifyCheckoutSignature(input)) {
      throw paymentVerificationFailure();
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.findFirst({
        where: {
          organizationId,
          provider: 'RAZORPAY',
          providerOrderId: input.orderId,
        },
        include: paymentInclude,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      return this.markPaymentSucceeded(tx, payment, {
        providerReference: input.paymentId,
        paymentMethod: payment.paymentMethod,
      });
    });
  }

  async recordCheckoutFailure(
    organizationId: string,
    input: {
      orderId: string;
      paymentId?: string;
      code?: string;
      reason?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.findFirst({
        where: {
          organizationId,
          provider: 'RAZORPAY',
          providerOrderId: input.orderId,
        },
        include: paymentInclude,
      });
      if (!payment) {
        throw paymentNotFound();
      }

      return this.markPaymentFailed(tx, payment, {
        providerReference: input.paymentId,
        failureCode: input.code,
        failureReason: input.reason || 'Razorpay checkout payment failed.',
      });
    });
  }

  async handleRazorpayWebhook(input: {
    rawBody: Buffer;
    signature?: string;
    eventId?: string;
    payload: Record<string, unknown>;
  }) {
    if (
      !input.signature ||
      !this.razorpay.verifyWebhookSignature(input.rawBody, input.signature)
    ) {
      throw webhookSignatureFailure();
    }

    const eventType = String(input.payload.event || 'unknown');
    const entity = this.getWebhookPaymentEntity(input.payload);
    const eventId =
      input.eventId ||
      String(input.payload.id || entity?.id || `${eventType}:${Date.now()}`);
    const providerPaymentId = entity?.id;
    const providerOrderId = entity?.order_id;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.paymentProviderWebhookEvent.create({
          data: {
            provider: 'RAZORPAY',
            eventId,
            eventType,
            providerPaymentId,
            providerOrderId,
            status: 'RECEIVED',
            payload: input.payload as Prisma.InputJsonObject,
          },
        });

        let payment: PaymentWithRelations | null = null;
        if (providerOrderId || providerPaymentId) {
          payment = await tx.subscriptionPayment.findFirst({
            where: {
              provider: 'RAZORPAY',
              OR: [
                ...(providerOrderId ? [{ providerOrderId }] : []),
                ...(providerPaymentId
                  ? [{ providerReference: providerPaymentId }]
                  : []),
              ],
            },
            include: paymentInclude,
          });
        }

        if (payment && this.isPaymentSuccessEvent(eventType)) {
          await this.markPaymentSucceeded(tx, payment, {
            providerReference: providerPaymentId,
            paymentMethod: entity?.method,
          });
        } else if (payment && this.isPaymentFailureEvent(eventType)) {
          await this.markPaymentFailed(tx, payment, {
            providerReference: providerPaymentId,
            paymentMethod: entity?.method,
            failureCode: entity?.error_code,
            failureReason:
              entity?.error_description ||
              entity?.error_reason ||
              'Razorpay reported payment failure.',
          });
        }

        await tx.paymentProviderWebhookEvent.update({
          where: { provider_eventId: { provider: 'RAZORPAY', eventId } },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });

        return {
          duplicate: false,
          processed: Boolean(payment),
          eventId,
          eventType,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { duplicate: true, processed: false, eventId, eventType };
      }
      throw error;
    }
  }

  async getRevenueSummary(query: { from?: Date; to?: Date } = {}) {
    const where = this.successfulPaymentWhere(query);
    const [payments, successfulAggregate, failedCount, pendingInvoiceCount] =
      await Promise.all([
        this.prisma.subscriptionPayment.findMany({
          where,
          include: {
            invoice: { include: { plan: true } },
            subscription: { include: { plan: true } },
          },
          orderBy: { paidAt: 'desc' },
        }),
        this.prisma.subscriptionPayment.aggregate({
          where,
          _sum: { amount: true },
          _count: { id: true },
        }),
        this.prisma.subscriptionPayment.count({
          where: { status: SubscriptionPaymentStatus.FAILED },
        }),
        this.prisma.invoice.count({
          where: { status: { in: OPEN_INVOICE_STATUSES } },
        }),
      ]);

    const mrr = await this.calculateMrr();
    const revenueByPlan = new Map<string, Prisma.Decimal>();
    const revenueByMonth = new Map<string, Prisma.Decimal>();

    for (const payment of payments) {
      const plan = payment.invoice?.plan || payment.subscription?.plan;
      const planName = plan?.name || 'Unassigned plan';
      revenueByPlan.set(
        planName,
        (revenueByPlan.get(planName) || new Prisma.Decimal(0)).plus(
          payment.amount,
        ),
      );

      const paidAt = payment.paidAt || payment.createdAt;
      const month = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.set(
        month,
        (revenueByMonth.get(month) || new Prisma.Decimal(0)).plus(
          payment.amount,
        ),
      );
    }

    return {
      rule: 'Revenue counts only SUCCEEDED SubscriptionPayment records. Pending and failed payments, and unpaid or void invoices, are excluded.',
      totalCollectedRevenue: successfulAggregate._sum.amount?.toString() || '0',
      successfulPayments: successfulAggregate._count.id,
      failedPayments: failedCount,
      pendingInvoices: pendingInvoiceCount,
      mrr: mrr.toString(),
      arr: mrr.mul(12).toString(),
      revenueByPlan: Array.from(revenueByPlan.entries()).map(
        ([plan, amount]) => ({
          plan,
          amount: amount.toString(),
        }),
      ),
      revenueByMonth: Array.from(revenueByMonth.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, amount]) => ({ month, amount: amount.toString() })),
      recentPayments: payments.slice(0, 6),
    };
  }

  private async calculateMrr(): Promise<Prisma.Decimal> {
    const paidSubscriptions =
      await this.prisma.organizationSubscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          payments: { some: { status: SubscriptionPaymentStatus.SUCCEEDED } },
        },
      });

    return paidSubscriptions.reduce((sum, subscription) => {
      const amount = new Prisma.Decimal(subscription.priceAtSubscription);
      const monthly =
        subscription.billingInterval === BillingInterval.YEARLY
          ? amount.div(12)
          : amount;
      return sum.plus(monthly);
    }, new Prisma.Decimal(0));
  }

  private async findCurrentSubscriptionForOrganization(organizationId: string) {
    return this.prisma.organizationSubscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.EXPIRING,
            SubscriptionStatus.GRACE_PERIOD,
          ],
        },
      },
      include: { organization: true, plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildInvoiceWhere(query: {
    search?: string;
    status?: InvoiceStatus;
    organizationId?: string;
    from?: Date;
    to?: Date;
  }): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
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
      ];
    }
    return where;
  }

  private buildPaymentWhere(query: {
    search?: string;
    status?: SubscriptionPaymentStatus;
    provider?: string;
    organizationId?: string;
    from?: Date;
    to?: Date;
    failedOnly?: boolean;
  }): Prisma.SubscriptionPaymentWhereInput {
    const where: Prisma.SubscriptionPaymentWhereInput = {};
    if (query.failedOnly) {
      where.status = SubscriptionPaymentStatus.FAILED;
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.provider) where.provider = query.provider.toUpperCase();
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { providerReference: { contains: search, mode: 'insensitive' } },
        { providerOrderId: { contains: search, mode: 'insensitive' } },
        {
          organization: {
            is: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          invoice: {
            is: { invoiceNumber: { contains: search, mode: 'insensitive' } },
          },
        },
      ];
    }
    return where;
  }

  private successfulPaymentWhere(query: {
    from?: Date;
    to?: Date;
  }): Prisma.SubscriptionPaymentWhereInput {
    return {
      status: SubscriptionPaymentStatus.SUCCEEDED,
      invoice: { is: { status: InvoiceStatus.PAID } },
      ...(query.from || query.to
        ? {
            paidAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };
  }

  private assertInvoicePayable(invoice: InvoiceWithRelations): void {
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException({
        code: 'INVOICE_ALREADY_PAID',
        message: 'Invoice is already paid.',
      });
    }
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException({
        code: 'INVOICE_VOID',
        message: 'Void invoices cannot be paid.',
      });
    }
    if (new Prisma.Decimal(invoice.totalAmount).lessThanOrEqualTo(0)) {
      throw invalidAmount('Invoice amount must be greater than zero.');
    }
  }

  private async markPaymentSucceeded(
    tx: Prisma.TransactionClient,
    payment: PaymentWithRelations,
    input: { providerReference?: string; paymentMethod?: string | null },
  ): Promise<PaymentWithRelations> {
    if (payment.status === SubscriptionPaymentStatus.REFUNDED) {
      throw invalidPaymentTransition(
        'Refunded payments cannot be marked succeeded.',
      );
    }

    const now = new Date();
    const updated = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: SubscriptionPaymentStatus.SUCCEEDED,
        providerReference: input.providerReference || payment.providerReference,
        paymentMethod: input.paymentMethod || payment.paymentMethod,
        paidAt: payment.paidAt || now,
        failedAt: null,
        failureCode: null,
        failureReason: null,
      },
      include: paymentInclude,
    });

    if (payment.invoiceId) {
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.PAID, paidAt: now },
      });
      await this.auditBilling(
        tx,
        undefined,
        'billing.invoice.paid',
        'Invoice',
        payment.invoiceId,
        {
          paymentId: payment.id,
          providerReference: input.providerReference,
        },
      );
    }

    if (
      payment.subscriptionId &&
      payment.subscription?.status !== SubscriptionStatus.ACTIVE
    ) {
      await tx.organizationSubscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: false },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: payment.subscriptionId,
          status: SubscriptionStatus.ACTIVE,
          previousStatus: payment.subscription?.status,
          newStatus: SubscriptionStatus.ACTIVE,
          action: 'PAYMENT_SUCCEEDED',
          note: 'Subscription activated after successful billing payment.',
          metadata: { paymentId: payment.id },
        },
      });
    }

    await this.auditBilling(
      tx,
      undefined,
      'billing.payment.succeeded',
      'SubscriptionPayment',
      payment.id,
      {
        invoiceId: payment.invoiceId,
        providerReference: input.providerReference,
      },
    );

    return updated;
  }

  private async markPaymentFailed(
    tx: Prisma.TransactionClient,
    payment: PaymentWithRelations,
    input: {
      providerReference?: string;
      paymentMethod?: string | null;
      failureCode?: string;
      failureReason?: string;
    },
  ): Promise<PaymentWithRelations> {
    if (payment.status === SubscriptionPaymentStatus.SUCCEEDED) {
      throw invalidPaymentTransition(
        'Succeeded payments cannot be marked failed.',
      );
    }

    const updated = await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: SubscriptionPaymentStatus.FAILED,
        providerReference: input.providerReference || payment.providerReference,
        paymentMethod: input.paymentMethod || payment.paymentMethod,
        failureCode: input.failureCode,
        failureReason: input.failureReason,
        failedAt: new Date(),
      },
      include: paymentInclude,
    });

    await this.auditBilling(
      tx,
      undefined,
      'billing.payment.failed',
      'SubscriptionPayment',
      payment.id,
      {
        invoiceId: payment.invoiceId,
        failureCode: input.failureCode,
        failureReason: input.failureReason,
      },
    );

    return updated;
  }

  private getWebhookPaymentEntity(payload: Record<string, unknown>): {
    id?: string;
    order_id?: string;
    method?: string;
    error_code?: string;
    error_description?: string;
    error_reason?: string;
  } | null {
    const outerPayload = payload.payload as Record<string, unknown> | undefined;
    const payment = outerPayload?.payment as
      Record<string, unknown> | undefined;
    const entity = payment?.entity as Record<string, unknown> | undefined;
    return entity
      ? {
          id: this.optionalString(entity.id),
          order_id: this.optionalString(entity.order_id),
          method: this.optionalString(entity.method),
          error_code: this.optionalString(entity.error_code),
          error_description: this.optionalString(entity.error_description),
          error_reason: this.optionalString(entity.error_reason),
        }
      : null;
  }

  private isPaymentSuccessEvent(eventType: string): boolean {
    return ['payment.captured', 'payment.authorized'].includes(eventType);
  }

  private isPaymentFailureEvent(eventType: string): boolean {
    return ['payment.failed'].includes(eventType);
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private async auditBilling(
    tx: Prisma.TransactionClient,
    actorStaffId: string | undefined,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await tx.platformAuditLog.create({
      data: {
        actorStaffId,
        action,
        resourceType,
        resourceId,
        metadata: metadata as Prisma.InputJsonObject,
      },
    });
  }
}
