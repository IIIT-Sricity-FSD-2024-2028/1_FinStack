-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PENDING', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateSequence
CREATE SEQUENCE "InvoiceNumberSequence";

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" VARCHAR(40) NOT NULL DEFAULT ('INV-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || lpad(nextval('"InvoiceNumberSequence"'::regclass)::text, 6, '0')),
    "organizationId" UUID NOT NULL,
    "subscriptionId" UUID,
    "planId" UUID,
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

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invoiceId" UUID,
    "subscriptionId" UUID,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(50),
    "providerReference" VARCHAR(160),
    "providerOrderId" VARCHAR(160),
    "paymentMethod" VARCHAR(80),
    "failureCode" VARCHAR(120),
    "failureReason" VARCHAR(500),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProviderWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "eventId" VARCHAR(180) NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "providerPaymentId" VARCHAR(160),
    "providerOrderId" VARCHAR(160),
    "status" VARCHAR(40) NOT NULL,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");
CREATE INDEX "Invoice_planId_idx" ON "Invoice"("planId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_providerReference_key" ON "SubscriptionPayment"("providerReference");
CREATE UNIQUE INDEX "SubscriptionPayment_providerOrderId_key" ON "SubscriptionPayment"("providerOrderId");
CREATE INDEX "SubscriptionPayment_organizationId_idx" ON "SubscriptionPayment"("organizationId");
CREATE INDEX "SubscriptionPayment_invoiceId_idx" ON "SubscriptionPayment"("invoiceId");
CREATE INDEX "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
CREATE INDEX "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");
CREATE INDEX "SubscriptionPayment_provider_idx" ON "SubscriptionPayment"("provider");
CREATE INDEX "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProviderWebhookEvent_provider_eventId_key" ON "PaymentProviderWebhookEvent"("provider", "eventId");
CREATE INDEX "PaymentProviderWebhookEvent_eventType_idx" ON "PaymentProviderWebhookEvent"("eventType");
CREATE INDEX "PaymentProviderWebhookEvent_providerPaymentId_idx" ON "PaymentProviderWebhookEvent"("providerPaymentId");
CREATE INDEX "PaymentProviderWebhookEvent_providerOrderId_idx" ON "PaymentProviderWebhookEvent"("providerOrderId");
CREATE INDEX "PaymentProviderWebhookEvent_receivedAt_idx" ON "PaymentProviderWebhookEvent"("receivedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
