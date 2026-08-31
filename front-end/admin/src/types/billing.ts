import type { BillingInterval, OrganizationSubscription } from './subscriptions';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID';

export type SubscriptionPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface BillingOrganization {
  id: string;
  name: string;
  primaryEmail: string;
}

export interface BillingPlan {
  id: string;
  key: string;
  name: string;
  billingInterval: BillingInterval;
  basePrice: string;
  currency: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  subscriptionId?: string | null;
  planId?: string | null;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: BillingOrganization | null;
  plan?: BillingPlan | null;
  subscription?: OrganizationSubscription | null;
  payments?: SubscriptionPayment[];
}

export interface SubscriptionPayment {
  id: string;
  organizationId: string;
  invoiceId?: string | null;
  subscriptionId?: string | null;
  amount: string;
  currency: string;
  status: SubscriptionPaymentStatus;
  provider?: string | null;
  providerReference?: string | null;
  providerOrderId?: string | null;
  paymentMethod?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  organization?: BillingOrganization | null;
  invoice?: Invoice | null;
  subscription?: OrganizationSubscription | null;
}

export interface BillingMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedInvoices {
  items: Invoice[];
  meta: BillingMeta;
}

export interface PaginatedPayments {
  items: SubscriptionPayment[];
  meta: BillingMeta;
}

export interface RevenueSummary {
  rule: string;
  totalCollectedRevenue: string;
  successfulPayments: number;
  failedPayments: number;
  pendingInvoices: number;
  mrr: string;
  arr: string;
  revenueByPlan: Array<{ plan: string; amount: string }>;
  revenueByMonth: Array<{ month: string; amount: string }>;
  recentPayments: SubscriptionPayment[];
}

export interface BillingListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  provider?: string;
  organizationId?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}
