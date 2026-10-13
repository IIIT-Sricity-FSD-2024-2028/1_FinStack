-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "limit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "requiresReceipt" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(7) NOT NULL DEFAULT '#7C3AED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxAmount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "approval" VARCHAR(100) NOT NULL DEFAULT 'Manager Approval',
    "status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "receiptRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseCategory_organizationId_status_idx" ON "ExpenseCategory"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_organizationId_id_key" ON "ExpenseCategory"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ExpensePolicy_organizationId_categoryId_idx" ON "ExpensePolicy"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "ExpensePolicy_organizationId_status_idx" ON "ExpensePolicy"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePolicy" ADD CONSTRAINT "ExpensePolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePolicy" ADD CONSTRAINT "ExpensePolicy_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "ExpenseCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- PostgreSQL expression indexes preserve case-insensitive tenant-local uniqueness.
CREATE UNIQUE INDEX "ExpenseCategory_org_name_ci_key" ON "ExpenseCategory" ("organizationId", lower(btrim("name")));
CREATE UNIQUE INDEX "ExpensePolicy_org_name_ci_key" ON "ExpensePolicy" ("organizationId", lower(btrim("name")));
ALTER TABLE "ExpenseCategory"
  ADD CONSTRAINT "ExpenseCategory_name_check" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "ExpenseCategory_limit_check" CHECK ("limit" >= 0),
  ADD CONSTRAINT "ExpenseCategory_status_check" CHECK ("status" IN ('Active', 'Inactive')),
  ADD CONSTRAINT "ExpenseCategory_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "ExpenseCategory_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE "ExpensePolicy"
  ADD CONSTRAINT "ExpensePolicy_name_check" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "ExpensePolicy_amount_check" CHECK ("maxAmount" >= 0),
  ADD CONSTRAINT "ExpensePolicy_status_check" CHECK ("status" IN ('Active', 'Inactive')),
  ADD CONSTRAINT "ExpensePolicy_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
