CREATE TYPE "SubscriptionStatus" AS ENUM (
  'PENDING_PAYMENT',
  'TRIAL',
  'ACTIVE',
  'EXPIRING',
  'GRACE_PERIOD',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE "SubscriptionHistoryAction" AS ENUM (
  'ASSIGNED',
  'PAYMENT_ACTIVATED',
  'PLAN_CHANGE_REQUESTED',
  'PLAN_CHANGED',
  'RENEWED',
  'CANCELLED',
  'REACTIVATED'
);

CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "InvoiceBillingReason" AS ENUM ('INITIAL', 'PLAN_CHANGE', 'RENEWAL');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

CREATE TABLE "OrganizationSubscription" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "billingInterval" "BillingInterval" NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "priceAtSubscription" DECIMAL(18,4) NOT NULL,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "trialStartAt" TIMESTAMP(3),
  "trialEndAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionHistory" (
  "id" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "action" "SubscriptionHistoryAction" NOT NULL,
  "previousStatus" "SubscriptionStatus",
  "newStatus" "SubscriptionStatus",
  "previousPlanId" UUID,
  "newPlanId" UUID,
  "actorStaffId" UUID,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" UUID NOT NULL,
  "invoiceNumber" VARCHAR(40) NOT NULL,
  "idempotencyKey" VARCHAR(180) NOT NULL,
  "organizationId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "billingReason" "InvoiceBillingReason" NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
  "subtotal" DECIMAL(18,4) NOT NULL,
  "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "billingPeriodStart" TIMESTAMP(3),
  "billingPeriodEnd" TIMESTAMP(3),
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "subscriptionId" UUID NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" VARCHAR(50) NOT NULL,
  "providerOrderId" VARCHAR(160) NOT NULL,
  "providerReference" VARCHAR(160),
  "paymentMethod" VARCHAR(80),
  "failureCode" VARCHAR(120),
  "failureReason" VARCHAR(500),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProviderEvent" (
  "id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "eventId" VARCHAR(180) NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "providerOrderId" VARCHAR(160),
  "providerReference" VARCHAR(160),
  "subscriptionPaymentId" UUID,
  "status" "PaymentProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB,
  "failureReason" VARCHAR(500),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSubscription_one_effective_per_org"
  ON "OrganizationSubscription"("organizationId")
  WHERE "status" IN ('PENDING_PAYMENT', 'TRIAL', 'ACTIVE', 'EXPIRING', 'GRACE_PERIOD', 'SUSPENDED');
CREATE INDEX "OrganizationSubscription_organizationId_status_idx" ON "OrganizationSubscription"("organizationId", "status");
CREATE INDEX "OrganizationSubscription_planId_idx" ON "OrganizationSubscription"("planId");
CREATE INDEX "OrganizationSubscription_status_currentPeriodEnd_idx" ON "OrganizationSubscription"("status", "currentPeriodEnd");
CREATE INDEX "OrganizationSubscription_createdAt_idx" ON "OrganizationSubscription"("createdAt");

CREATE INDEX "SubscriptionHistory_subscriptionId_createdAt_idx" ON "SubscriptionHistory"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionHistory_actorStaffId_idx" ON "SubscriptionHistory"("actorStaffId");

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");
CREATE INDEX "Invoice_subscriptionId_createdAt_idx" ON "Invoice"("subscriptionId", "createdAt");
CREATE INDEX "Invoice_planId_idx" ON "Invoice"("planId");
CREATE INDEX "Invoice_status_dueDate_idx" ON "Invoice"("status", "dueDate");

CREATE UNIQUE INDEX "SubscriptionPayment_providerOrderId_key" ON "SubscriptionPayment"("providerOrderId");
CREATE UNIQUE INDEX "SubscriptionPayment_providerReference_key" ON "SubscriptionPayment"("providerReference");
CREATE INDEX "SubscriptionPayment_organizationId_status_idx" ON "SubscriptionPayment"("organizationId", "status");
CREATE INDEX "SubscriptionPayment_invoiceId_idx" ON "SubscriptionPayment"("invoiceId");
CREATE INDEX "SubscriptionPayment_subscriptionId_createdAt_idx" ON "SubscriptionPayment"("subscriptionId", "createdAt");
CREATE INDEX "SubscriptionPayment_status_paidAt_idx" ON "SubscriptionPayment"("status", "paidAt");

CREATE UNIQUE INDEX "PaymentProviderEvent_provider_eventId_key" ON "PaymentProviderEvent"("provider", "eventId");
CREATE INDEX "PaymentProviderEvent_providerOrderId_idx" ON "PaymentProviderEvent"("providerOrderId");
CREATE INDEX "PaymentProviderEvent_providerReference_idx" ON "PaymentProviderEvent"("providerReference");
CREATE INDEX "PaymentProviderEvent_subscriptionPaymentId_idx" ON "PaymentProviderEvent"("subscriptionPaymentId");
CREATE INDEX "PaymentProviderEvent_receivedAt_idx" ON "PaymentProviderEvent"("receivedAt");

ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionHistory" ADD CONSTRAINT "SubscriptionHistory_actorStaffId_fkey"
  FOREIGN KEY ("actorStaffId") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_subscriptionPaymentId_fkey"
  FOREIGN KEY ("subscriptionPaymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
