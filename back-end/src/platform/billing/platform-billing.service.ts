import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceBillingReason,
  InvoiceStatus,
  PaymentProviderEventStatus,
  Prisma,
  SubscriptionHistoryAction,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  invoiceInclude,
  pageMeta,
  PaginatedDto,
  PaymentDto,
  paymentInclude,
  RevenueOverviewDto,
  toInvoiceDto,
  toPaymentDto,
  InvoiceDto,
} from '../commercial/platform-commercial.types';
import { runPlatformSerializableTransaction } from '../common/platform-serializable-transaction';
import {
  ListInvoicesQueryDto,
  ListPaymentsQueryDto,
  RevenueOverviewQueryDto,
} from './dto/list-billing-query.dto';

const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.OVERDUE,
];

export interface CreatePaymentAttemptInput {
  invoiceId: string;
  provider: string;
  providerOrderId: string;
  actorStaffId?: string;
}

export interface TrustedPaymentFinalizationInput {
  provider: string;
  providerEventId: string;
  providerEventType: string;
  providerOrderId: string;
  providerReference: string;
  amount: string;
  currency: string;
  paymentStatus: 'CAPTURED';
  verificationSource: 'SIGNED_WEBHOOK' | 'PROVIDER_API';
  paymentMethod?: string;
  occurredAt: Date;
  payload?: Prisma.InputJsonObject;
  actorStaffId?: string;
}

export interface VerifiedProviderPaymentFailureInput {
  provider: string;
  providerEventId: string;
  providerEventType: string;
  providerOrderId: string;
  providerReference: string;
  paymentMethod?: string;
  failureCode?: string;
  failureReason?: string;
  actorStaffId?: string;
}

@Injectable()
export class PlatformBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listInvoices(
    query: ListInvoicesQueryDto,
  ): Promise<PaginatedDto<InvoiceDto>> {
    this.validateRange(query.from, query.to);
    const where = this.invoiceWhere(query);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return {
      items: records.map(toInvoiceDto),
      meta: pageMeta(query.page, query.pageSize, totalItems),
    };
  }

  async listPayments(
    query: ListPaymentsQueryDto,
  ): Promise<PaginatedDto<PaymentDto>> {
    this.validateRange(query.from, query.to);
    const where = this.paymentWhere(query);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.subscriptionPayment.findMany({
        where,
        include: paymentInclude,
        orderBy: { [query.sortBy]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.subscriptionPayment.count({ where }),
    ]);
    return {
      items: records.map(toPaymentDto),
      meta: pageMeta(query.page, query.pageSize, totalItems),
    };
  }

  async getRevenueOverview(
    query: RevenueOverviewQueryDto,
  ): Promise<RevenueOverviewDto> {
    this.validateRange(query.from, query.to);
    const paymentDate = this.dateRange(query.from, query.to);
    const invoiceDate = this.dateRange(query.from, query.to);
    const successfulWhere: Prisma.SubscriptionPaymentWhereInput = {
      status: SubscriptionPaymentStatus.SUCCEEDED,
      ...(paymentDate ? { paidAt: paymentDate } : {}),
    };
    const pendingInvoiceWhere: Prisma.InvoiceWhereInput = {
      status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
      ...(invoiceDate ? { issueDate: invoiceDate } : {}),
    };
    const failedWhere: Prisma.SubscriptionPaymentWhereInput = {
      status: SubscriptionPaymentStatus.FAILED,
      ...(paymentDate ? { failedAt: paymentDate } : {}),
    };

    const [
      activeSubscriptions,
      trialSubscriptions,
      successfulByCurrency,
      pendingByCurrency,
      failedPaymentCount,
      recentSuccessfulPayments,
    ] = await Promise.all([
      this.prisma.organizationSubscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.organizationSubscription.count({
        where: { status: SubscriptionStatus.TRIAL },
      }),
      this.prisma.subscriptionPayment.groupBy({
        by: ['currency'],
        where: successfulWhere,
        _sum: { amount: true },
        orderBy: { currency: 'asc' },
      }),
      this.prisma.invoice.groupBy({
        by: ['currency'],
        where: pendingInvoiceWhere,
        _sum: { totalAmount: true },
        orderBy: { currency: 'asc' },
      }),
      this.prisma.subscriptionPayment.count({ where: failedWhere }),
      this.prisma.subscriptionPayment.findMany({
        where: successfulWhere,
        include: paymentInclude,
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      activeSubscriptions,
      trialSubscriptions,
      successfulRevenueByCurrency: successfulByCurrency.map((item) => ({
        currency: item.currency,
        amount: item._sum.amount?.toString() ?? '0',
      })),
      pendingInvoiceValueByCurrency: pendingByCurrency.map((item) => ({
        currency: item.currency,
        amount: item._sum.totalAmount?.toString() ?? '0',
      })),
      failedPaymentCount,
      recentSuccessfulPayments: recentSuccessfulPayments.map(toPaymentDto),
    };
  }

  async createPaymentAttempt(
    input: CreatePaymentAttemptInput,
  ): Promise<PaymentDto> {
    const provider = this.requiredUpper(input.provider, 'provider');
    const providerOrderId = this.required(
      input.providerOrderId,
      'providerOrderId',
    );
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const invoice = await tx.invoice.findUnique({
            where: { id: input.invoiceId },
          });
          if (!invoice) this.invoiceNotFound();
          if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
            throw new ConflictException({
              code: 'INVOICE_NOT_PAYABLE',
              message: `Invoice cannot be paid from ${invoice.status}.`,
            });
          }

          const payment = await tx.subscriptionPayment.create({
            data: {
              organizationId: invoice.organizationId,
              invoiceId: invoice.id,
              subscriptionId: invoice.subscriptionId,
              amount: invoice.totalAmount,
              currency: invoice.currency,
              provider,
              providerOrderId,
            },
            include: paymentInclude,
          });
          await this.audit(
            tx,
            input.actorStaffId ?? null,
            'billing.payment.created',
            'SubscriptionPayment',
            payment.id,
            {
              invoiceId: invoice.id,
              provider,
              providerOrderId,
              amount: invoice.totalAmount.toString(),
              currency: invoice.currency,
            },
          );
          return toPaymentDto(payment);
        },
        {
          code: 'PAYMENT_ATTEMPT_CONFLICT',
          message: 'Payment attempt creation conflicted with another update.',
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PROVIDER_ORDER_ALREADY_RECORDED',
          message: 'Provider order has already been recorded.',
        });
      }
      throw error;
    }
  }

  async recordVerifiedProviderPaymentFailure(
    input: VerifiedProviderPaymentFailureInput,
  ): Promise<PaymentDto> {
    const provider = this.requiredUpper(input.provider, 'provider');
    const providerEventId = this.required(
      input.providerEventId,
      'providerEventId',
    );
    const providerEventType = this.required(
      input.providerEventType,
      'providerEventType',
    );
    const providerOrderId = this.required(
      input.providerOrderId,
      'providerOrderId',
    );
    const providerReference = this.required(
      input.providerReference,
      'providerReference',
    );

    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const existingEvent = await tx.paymentProviderEvent.findUnique({
            where: { provider_eventId: { provider, eventId: providerEventId } },
            include: { subscriptionPayment: { include: paymentInclude } },
          });
          if (existingEvent) {
            if (
              existingEvent.status === PaymentProviderEventStatus.PROCESSED &&
              existingEvent.subscriptionPayment
            ) {
              return toPaymentDto(existingEvent.subscriptionPayment);
            }
            throw new ConflictException({
              code: 'PROVIDER_EVENT_IN_PROGRESS',
              message: 'Provider event has already been received.',
            });
          }

          const payment = await tx.subscriptionPayment.findUnique({
            where: { providerOrderId },
            include: { invoice: true },
          });
          if (!payment || payment.provider !== provider) {
            throw new NotFoundException({
              code: 'PAYMENT_NOT_FOUND',
              message: 'Payment attempt was not found for the provider order.',
            });
          }
          if (
            payment.providerReference &&
            payment.providerReference !== providerReference
          ) {
            throw new ConflictException({
              code: 'PAYMENT_IDEMPOTENCY_MISMATCH',
              message: 'Provider event does not match the recorded payment.',
            });
          }

          const event = await tx.paymentProviderEvent.create({
            data: {
              provider,
              eventId: providerEventId,
              eventType: providerEventType,
              providerOrderId,
              providerReference,
              subscriptionPaymentId: payment.id,
            },
          });

          if (payment.status === SubscriptionPaymentStatus.SUCCEEDED) {
            await tx.paymentProviderEvent.update({
              where: { id: event.id },
              data: {
                status: PaymentProviderEventStatus.PROCESSED,
                processedAt: new Date(),
              },
            });
            return this.getPaymentDto(tx, payment.id);
          }
          if (payment.status !== SubscriptionPaymentStatus.PENDING) {
            await tx.paymentProviderEvent.update({
              where: { id: event.id },
              data: {
                status: PaymentProviderEventStatus.PROCESSED,
                processedAt: new Date(),
              },
            });
            return this.getPaymentDto(tx, payment.id);
          }

          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: SubscriptionPaymentStatus.FAILED,
              providerReference,
              paymentMethod: input.paymentMethod?.trim() || null,
              failedAt: new Date(),
              failureCode: input.failureCode?.trim() || null,
              failureReason:
                input.failureReason?.trim() ||
                'Provider reported payment failure.',
            },
          });
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              status: PaymentProviderEventStatus.PROCESSED,
              processedAt: new Date(),
            },
          });
          await this.audit(
            tx,
            input.actorStaffId ?? null,
            'billing.payment.failed',
            'SubscriptionPayment',
            payment.id,
            {
              invoiceId: payment.invoiceId,
              provider,
              providerEventId,
              providerReference,
              failureCode: input.failureCode?.trim() || null,
            },
          );
          return this.getPaymentDto(tx, payment.id);
        },
        {
          code: 'PAYMENT_FAILURE_CONFLICT',
          message: 'Payment failure processing conflicted with another update.',
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentProviderEvent.findUnique({
          where: { provider_eventId: { provider, eventId: providerEventId } },
          include: { subscriptionPayment: { include: paymentInclude } },
        });
        if (
          existing?.status === PaymentProviderEventStatus.PROCESSED &&
          existing.subscriptionPayment
        ) {
          return toPaymentDto(existing.subscriptionPayment);
        }
        throw new ConflictException({
          code: 'PAYMENT_IDEMPOTENCY_CONFLICT',
          message: 'Payment provider data has already been used.',
        });
      }
      throw error;
    }
  }

  /**
   * Service-only boundary for a provider adapter that has independently
   * verified capture. Checkout callbacks must never call this directly.
   */
  async finalizeVerifiedProviderPayment(
    input: TrustedPaymentFinalizationInput,
  ): Promise<PaymentDto> {
    this.assertTrustedFinalization(input);
    const provider = this.requiredUpper(input.provider, 'provider');
    const providerOrderId = this.required(
      input.providerOrderId,
      'providerOrderId',
    );
    const providerReference = this.required(
      input.providerReference,
      'providerReference',
    );
    const currency = this.requiredUpper(input.currency, 'currency');
    const verifiedAmount = this.parseAmount(input.amount);
    try {
      return await runPlatformSerializableTransaction(
        this.prisma,
        async (tx) => {
          const existingEvent = await tx.paymentProviderEvent.findUnique({
            where: {
              provider_eventId: { provider, eventId: input.providerEventId },
            },
            include: {
              subscriptionPayment: { include: paymentInclude },
            },
          });
          if (existingEvent) {
            if (
              existingEvent.status === PaymentProviderEventStatus.PROCESSED &&
              existingEvent.subscriptionPayment
            ) {
              return toPaymentDto(existingEvent.subscriptionPayment);
            }
            throw new ConflictException({
              code: 'PROVIDER_EVENT_IN_PROGRESS',
              message: 'Provider event has already been received.',
            });
          }

          const payment = await tx.subscriptionPayment.findUnique({
            where: { providerOrderId },
            include: {
              invoice: true,
              subscription: true,
            },
          });
          if (!payment || payment.provider !== provider) {
            throw new NotFoundException({
              code: 'PAYMENT_NOT_FOUND',
              message:
                'Payment attempt was not found for the verified provider order.',
            });
          }

          const event = await tx.paymentProviderEvent.create({
            data: {
              provider,
              eventId: input.providerEventId,
              eventType: input.providerEventType,
              providerOrderId,
              providerReference,
              subscriptionPaymentId: payment.id,
              payload: input.payload,
            },
          });

          if (payment.status === SubscriptionPaymentStatus.SUCCEEDED) {
            if (
              payment.providerReference !== providerReference ||
              !verifiedAmount.equals(payment.amount) ||
              currency !== payment.currency
            ) {
              throw new ConflictException({
                code: 'PAYMENT_IDEMPOTENCY_MISMATCH',
                message: 'Provider event does not match the finalized payment.',
              });
            }
            await tx.paymentProviderEvent.update({
              where: { id: event.id },
              data: {
                status: PaymentProviderEventStatus.PROCESSED,
                processedAt: new Date(),
              },
            });
            return this.getPaymentDto(tx, payment.id);
          }
          if (payment.status !== SubscriptionPaymentStatus.PENDING) {
            throw new ConflictException({
              code: 'PAYMENT_FINALIZATION_NOT_ALLOWED',
              message: `Payment cannot be finalized from ${payment.status}.`,
            });
          }
          if (!PAYABLE_INVOICE_STATUSES.includes(payment.invoice.status)) {
            throw new ConflictException({
              code: 'INVOICE_NOT_PAYABLE',
              message: `Invoice cannot be paid from ${payment.invoice.status}.`,
            });
          }

          if (
            !verifiedAmount.equals(payment.amount) ||
            currency !== payment.currency
          ) {
            throw new BadRequestException({
              code: 'PAYMENT_COMMERCIAL_MISMATCH',
              message:
                'Verified amount or currency does not match the invoice.',
            });
          }

          await tx.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: SubscriptionPaymentStatus.SUCCEEDED,
              providerReference,
              paymentMethod: input.paymentMethod?.trim() || null,
              paidAt: input.occurredAt,
              failedAt: null,
              failureCode: null,
              failureReason: null,
            },
          });
          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: { status: InvoiceStatus.PAID, paidAt: input.occurredAt },
          });
          await this.finalizeSubscriptionFromInvoice(tx, payment, input);
          await tx.paymentProviderEvent.update({
            where: { id: event.id },
            data: {
              status: PaymentProviderEventStatus.PROCESSED,
              processedAt: new Date(),
            },
          });
          await this.audit(
            tx,
            input.actorStaffId ?? null,
            'billing.payment.succeeded',
            'SubscriptionPayment',
            payment.id,
            {
              invoiceId: payment.invoiceId,
              provider,
              providerEventId: input.providerEventId,
              providerReference,
              verificationSource: input.verificationSource,
            },
          );
          return this.getPaymentDto(tx, payment.id);
        },
        {
          code: 'PAYMENT_FINALIZATION_CONFLICT',
          message: 'Payment finalization conflicted with another update.',
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentProviderEvent.findUnique({
          where: {
            provider_eventId: { provider, eventId: input.providerEventId },
          },
          include: {
            subscriptionPayment: { include: paymentInclude },
          },
        });
        if (
          existing?.status === PaymentProviderEventStatus.PROCESSED &&
          existing.subscriptionPayment
        ) {
          return toPaymentDto(existing.subscriptionPayment);
        }
        throw new ConflictException({
          code: 'PAYMENT_IDEMPOTENCY_CONFLICT',
          message: 'Payment provider data has already been used.',
        });
      }
      throw error;
    }
  }

  private async finalizeSubscriptionFromInvoice(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      subscriptionId: string;
      invoice: {
        id: string;
        planId: string;
        billingReason: InvoiceBillingReason;
        billingPeriodStart: Date | null;
        billingPeriodEnd: Date | null;
        totalAmount: Prisma.Decimal;
        employeeCount: number;
        employeeAmount: Prisma.Decimal;
        featureAmount: Prisma.Decimal;
        selectedAddOns?: Prisma.JsonValue | null;
      };
      subscription: {
        id: string;
        status: SubscriptionStatus;
        planId: string;
      };
    },
    input: TrustedPaymentFinalizationInput,
  ): Promise<void> {
    const plan = await tx.plan.findUnique({
      where: { id: payment.invoice.planId },
    });
    if (!plan) {
      throw new ConflictException({
        code: 'INVOICE_PLAN_NOT_FOUND',
        message: 'The invoiced plan no longer exists.',
      });
    }
    if (payment.subscription.status === SubscriptionStatus.CANCELLED) {
      throw new ConflictException({
        code: 'SUBSCRIPTION_CANCELLED',
        message: 'A cancelled subscription cannot be activated by payment.',
      });
    }

    const reason = payment.invoice.billingReason;
    const action =
      reason === InvoiceBillingReason.PLAN_CHANGE
        ? SubscriptionHistoryAction.PLAN_CHANGED
        : reason === InvoiceBillingReason.RENEWAL
          ? SubscriptionHistoryAction.RENEWED
          : SubscriptionHistoryAction.PAYMENT_ACTIVATED;
    const auditAction =
      reason === InvoiceBillingReason.PLAN_CHANGE
        ? 'subscription.plan_changed'
        : reason === InvoiceBillingReason.RENEWAL
          ? 'subscription.renewed'
          : 'subscription.payment_activated';

    await tx.organizationSubscription.update({
      where: { id: payment.subscriptionId },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: plan.billingInterval,
        currency: plan.currency,
        priceAtSubscription: payment.invoice.totalAmount ?? plan.basePrice,
        employeeCount: payment.invoice.employeeCount ?? 1,
        employeeAmount: payment.invoice.employeeAmount ?? new Prisma.Decimal(0),
        featureAmount: payment.invoice.featureAmount ?? new Prisma.Decimal(0),
        selectedAddOns: payment.invoice.selectedAddOns ?? undefined,
        currentPeriodStart:
          payment.invoice.billingPeriodStart ?? input.occurredAt,
        currentPeriodEnd: payment.invoice.billingPeriodEnd,
        cancelledAt: null,
      },
    });
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: payment.subscriptionId,
        action,
        previousStatus: payment.subscription.status,
        newStatus: SubscriptionStatus.ACTIVE,
        previousPlanId: payment.subscription.planId,
        newPlanId: plan.id,
        note: 'Finalized from a trusted successful-payment event.',
        metadata: {
          invoiceId: payment.invoice.id,
          paymentId: payment.id,
          providerEventId: input.providerEventId,
        },
        actorStaffId: input.actorStaffId,
      },
    });
    await this.audit(
      tx,
      input.actorStaffId ?? null,
      auditAction,
      'OrganizationSubscription',
      payment.subscriptionId,
      {
        previousStatus: payment.subscription.status,
        previousPlanId: payment.subscription.planId,
        newPlanId: plan.id,
        paymentId: payment.id,
      },
    );
  }

  private invoiceWhere(query: ListInvoicesQueryDto): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.organizationId) where.organizationId = query.organizationId;
    const range = this.dateRange(query.from, query.to);
    if (range) where.issueDate = range;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        {
          organization: {
            is: { name: { contains: search, mode: 'insensitive' } },
          },
        },
        { plan: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    return where;
  }

  private paymentWhere(
    query: ListPaymentsQueryDto,
  ): Prisma.SubscriptionPaymentWhereInput {
    const where: Prisma.SubscriptionPaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.organizationId) where.organizationId = query.organizationId;
    if (query.provider) where.provider = query.provider.trim().toUpperCase();
    const range = this.dateRange(query.from, query.to);
    if (range) where.createdAt = range;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { providerOrderId: { contains: search, mode: 'insensitive' } },
        { providerReference: { contains: search, mode: 'insensitive' } },
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

  private dateRange(from?: Date, to?: Date): Prisma.DateTimeFilter | null {
    if (!from && !to) return null;
    return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  }

  private validateRange(from?: Date, to?: Date): void {
    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'The from date must not be after the to date.',
      });
    }
  }

  private assertTrustedFinalization(
    input: TrustedPaymentFinalizationInput,
  ): void {
    if (input.paymentStatus !== 'CAPTURED') {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_CAPTURED',
        message: 'Only a provider-confirmed captured payment can be finalized.',
      });
    }
    if (
      !['SIGNED_WEBHOOK', 'PROVIDER_API'].includes(input.verificationSource)
    ) {
      throw new BadRequestException({
        code: 'PAYMENT_VERIFICATION_REQUIRED',
        message: 'A trusted provider verification source is required.',
      });
    }
    this.required(input.providerEventId, 'providerEventId');
    this.required(input.providerEventType, 'providerEventType');
    this.required(input.providerOrderId, 'providerOrderId');
    this.required(input.providerReference, 'providerReference');
    if (
      !(input.occurredAt instanceof Date) ||
      Number.isNaN(input.occurredAt.getTime())
    ) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_TIMESTAMP',
        message: 'A valid provider payment timestamp is required.',
      });
    }
  }

  private required(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_PROVIDER_DATA',
        message: `${field} is required.`,
      });
    }
    return normalized;
  }

  private requiredUpper(value: string, field: string): string {
    return this.required(value, field).toUpperCase();
  }

  private parseAmount(value: string): Prisma.Decimal {
    try {
      const amount = new Prisma.Decimal(value);
      if (!amount.isPositive()) throw new Error('Amount must be positive.');
      return amount;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_PROVIDER_AMOUNT',
        message: 'Provider amount must be a positive decimal value.',
      });
    }
  }

  private async getPaymentDto(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<PaymentDto> {
    const payment = await tx.subscriptionPayment.findUnique({
      where: { id },
      include: paymentInclude,
    });
    if (!payment) {
      throw new Error('Finalized payment could not be reloaded.');
    }
    return toPaymentDto(payment);
  }

  private invoiceNotFound(): never {
    throw new NotFoundException({
      code: 'INVOICE_NOT_FOUND',
      message: 'Invoice not found.',
    });
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorStaffId: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    return tx.platformAuditLog.create({
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
