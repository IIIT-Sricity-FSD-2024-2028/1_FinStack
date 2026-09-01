export type SubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'TRIAL'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export type BillingInterval = 'MONTHLY' | 'YEARLY';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID';
export type InvoiceBillingReason = 'INITIAL' | 'PLAN_CHANGE' | 'RENEWAL';
export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedCommercialResult<T> {
  items: T[];
  meta: PageMeta;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string | null;
  primaryEmail: string;
}

export interface CommercialPlanFeature {
  id: string;
  key: string;
  name: string;
  valueType: string;
  enabled: boolean;
  value: unknown;
}

export interface CommercialPlan {
  id: string;
  key: string;
  name: string;
  billingInterval: BillingInterval;
  basePrice: string;
  currency: string;
  features: CommercialPlanFeature[];
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currency: string;
  priceAtSubscription: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialStartAt: string | null;
  trialEndAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationSummary;
  plan: CommercialPlan;
}

export interface SafeStaff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export interface SubscriptionHistory {
  id: string;
  subscriptionId: string;
  action: string;
  previousStatus: SubscriptionStatus | null;
  newStatus: SubscriptionStatus | null;
  previousPlanId: string | null;
  newPlanId: string | null;
  note: string | null;
  metadata: unknown;
  createdAt: string;
  actorStaff: SafeStaff | null;
}

export interface Invoice {
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
  currency: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: OrganizationSummary;
  plan: Pick<CommercialPlan, 'id' | 'key' | 'name'>;
}

export interface Payment {
  id: string;
  organizationId: string;
  subscriptionId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
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
  organization: OrganizationSummary;
  invoice: { id: string; invoiceNumber: string; status: InvoiceStatus };
}

export interface CurrencyAmount {
  currency: string;
  amount: string;
}

export interface RevenueOverview {
  activeSubscriptions: number;
  trialSubscriptions: number;
  successfulRevenueByCurrency: CurrencyAmount[];
  pendingInvoiceValueByCurrency: CurrencyAmount[];
  failedPaymentCount: number;
  recentSuccessfulPayments: Payment[];
}
