import {
  BillingInterval,
  FeatureValueType,
  InvoiceBillingReason,
  InvoiceStatus,
  PlatformStaffStatus,
  Prisma,
  SubscriptionHistoryAction,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '@prisma/client';

export interface PageMetaDto {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedDto<T> {
  items: T[];
  meta: PageMetaDto;
}

export interface OrganizationSummaryDto {
  id: string;
  name: string;
  slug: string | null;
  primaryEmail: string;
}

export interface PlanFeatureDto {
  id: string;
  key: string;
  name: string;
  valueType: FeatureValueType;
  enabled: boolean;
  value: Prisma.JsonValue | null;
  isAddOn: boolean;
  addOnPrice: string;
}

export interface CommercialPlanDto {
  id: string;
  key: string;
  name: string;
  billingInterval: BillingInterval;
  basePrice: string;
  currency: string;
  features: PlanFeatureDto[];
  includedEmployeeCount: number;
  additionalEmployeePrice: string;
}

export interface SubscriptionDto {
  id: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  priceAtSubscription: string;
  employeeCount: number;
  employeeAmount: string;
  featureAmount: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartAt: string | null;
  trialEndAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationSummaryDto;
  plan: CommercialPlanDto;
}

export interface SafeStaffDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: PlatformStaffStatus;
}

export interface SubscriptionHistoryDto {
  id: string;
  subscriptionId: string;
  action: SubscriptionHistoryAction;
  previousStatus: SubscriptionStatus | null;
  newStatus: SubscriptionStatus | null;
  previousPlanId: string | null;
  newPlanId: string | null;
  note: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  actorStaff: SafeStaffDto | null;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  subscriptionId: string;
  planId: string;
  billingReason: InvoiceBillingReason;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  employeeCount: number;
  employeeAmount: string;
  featureAmount: string;
  currency: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationSummaryDto;
  plan: Pick<CommercialPlanDto, 'id' | 'key' | 'name'>;
}

export interface PaymentDto {
  id: string;
  organizationId: string;
  subscriptionId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  status: SubscriptionPaymentStatus;
  provider: string;
  providerOrderId: string;
  providerReference: string | null;
  paymentMethod: string | null;
  failureCode: string | null;
  failureReason: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationSummaryDto;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
  };
}

export interface CurrencyAmountDto {
  currency: string;
  amount: string;
}

export interface RevenueOverviewDto {
  activeSubscriptions: number;
  trialSubscriptions: number;
  successfulRevenueByCurrency: CurrencyAmountDto[];
  pendingInvoiceValueByCurrency: CurrencyAmountDto[];
  failedPaymentCount: number;
  recentSuccessfulPayments: PaymentDto[];
}

export const subscriptionInclude = {
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

export const historyInclude = {
  actorStaff: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
    },
  },
} satisfies Prisma.SubscriptionHistoryInclude;

export const invoiceInclude = {
  organization: {
    select: { id: true, name: true, slug: true, primaryEmail: true },
  },
  plan: { select: { id: true, key: true, name: true } },
} satisfies Prisma.InvoiceInclude;

export const paymentInclude = {
  organization: {
    select: { id: true, name: true, slug: true, primaryEmail: true },
  },
  invoice: {
    select: { id: true, invoiceNumber: true, status: true },
  },
} satisfies Prisma.SubscriptionPaymentInclude;

type SubscriptionRecord = Prisma.OrganizationSubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;
type HistoryRecord = Prisma.SubscriptionHistoryGetPayload<{
  include: typeof historyInclude;
}>;
type InvoiceRecord = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;
type PaymentRecord = Prisma.SubscriptionPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

const date = (value: Date | null): string | null =>
  value ? value.toISOString() : null;

export function toSubscriptionDto(record: SubscriptionRecord): SubscriptionDto {
  return {
    id: record.id,
    status: record.status,
    billingInterval: record.billingInterval,
    currency: record.currency,
    priceAtSubscription: record.priceAtSubscription.toString(),
    employeeCount: record.employeeCount ?? 1,
    employeeAmount: record.employeeAmount?.toString() ?? '0',
    featureAmount: record.featureAmount?.toString() ?? '0',
    currentPeriodStart: date(record.currentPeriodStart),
    currentPeriodEnd: date(record.currentPeriodEnd),
    trialStartAt: date(record.trialStartAt),
    trialEndAt: date(record.trialEndAt),
    cancelledAt: date(record.cancelledAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    organization: record.organization,
    plan: {
      id: record.plan.id,
      key: record.plan.key,
      name: record.plan.name,
      billingInterval: record.plan.billingInterval,
      basePrice: record.plan.basePrice.toString(),
      includedEmployeeCount: record.plan.includedEmployeeCount ?? 1,
      additionalEmployeePrice:
        record.plan.additionalEmployeePrice?.toString() ?? '0',
      currency: record.plan.currency,
      features: record.plan.planFeatures
        .map((assignment) => ({
          id: assignment.feature.id,
          key: assignment.feature.key,
          name: assignment.feature.name,
          valueType: assignment.feature.valueType,
          enabled: assignment.enabled,
          value: assignment.value,
          isAddOn: assignment.isAddOn ?? false,
          addOnPrice: assignment.addOnPrice?.toString() ?? '0',
        }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    },
  };
}

export function toSubscriptionHistoryDto(
  record: HistoryRecord,
): SubscriptionHistoryDto {
  return {
    id: record.id,
    subscriptionId: record.subscriptionId,
    action: record.action,
    previousStatus: record.previousStatus,
    newStatus: record.newStatus,
    previousPlanId: record.previousPlanId,
    newPlanId: record.newPlanId,
    note: record.note,
    metadata: record.metadata,
    createdAt: record.createdAt.toISOString(),
    actorStaff: record.actorStaff,
  };
}

export function toInvoiceDto(record: InvoiceRecord): InvoiceDto {
  return {
    id: record.id,
    invoiceNumber: record.invoiceNumber,
    organizationId: record.organizationId,
    subscriptionId: record.subscriptionId,
    planId: record.planId,
    billingReason: record.billingReason,
    status: record.status,
    subtotal: record.subtotal.toString(),
    taxAmount: record.taxAmount.toString(),
    totalAmount: record.totalAmount.toString(),
    employeeCount: record.employeeCount ?? 1,
    employeeAmount: (record.employeeAmount ?? 0).toString(),
    featureAmount: (record.featureAmount ?? 0).toString(),
    currency: record.currency,
    billingPeriodStart: date(record.billingPeriodStart),
    billingPeriodEnd: date(record.billingPeriodEnd),
    issueDate: record.issueDate.toISOString(),
    dueDate: record.dueDate.toISOString(),
    paidAt: date(record.paidAt),
    voidedAt: date(record.voidedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    organization: record.organization,
    plan: record.plan,
  };
}

export function toPaymentDto(record: PaymentRecord): PaymentDto {
  return {
    id: record.id,
    organizationId: record.organizationId,
    subscriptionId: record.subscriptionId,
    invoiceId: record.invoiceId,
    amount: record.amount.toString(),
    currency: record.currency,
    status: record.status,
    provider: record.provider,
    providerOrderId: record.providerOrderId,
    providerReference: record.providerReference,
    paymentMethod: record.paymentMethod,
    failureCode: record.failureCode,
    failureReason: record.failureReason,
    paidAt: date(record.paidAt),
    failedAt: date(record.failedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    organization: record.organization,
    invoice: record.invoice,
  };
}

export function pageMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): PageMetaDto {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}
