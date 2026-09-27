-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PROVISIONING', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(120),
    "primaryEmail" VARCHAR(320) NOT NULL,
    "primaryContactName" VARCHAR(160),
    "primaryContactEmail" VARCHAR(320),
    "billingEmail" VARCHAR(320),
    "country" VARCHAR(100),
    "defaultCurrency" CHAR(3) NOT NULL DEFAULT 'INR',
    "timezone" VARCHAR(80),
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PROVISIONING',
    "externalCustomerRef" VARCHAR(160),
    "metadata" JSONB,
    "statusChangedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_primaryEmail_key" ON "Organization"("primaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_externalCustomerRef_key" ON "Organization"("externalCustomerRef");

-- CreateIndex
CREATE INDEX "Organization_status_createdAt_idx" ON "Organization"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Organization_createdAt_idx" ON "Organization"("createdAt");
