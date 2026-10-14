-- CreateTable
CREATE TABLE "Expense" (
    "submissionKey" VARCHAR(100),
    "submissionFingerprint" CHAR(64),
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" VARCHAR(80) NOT NULL,
    "managerEmployeeId" VARCHAR(80) NOT NULL,
    "assignedFinanceOfficerId" UUID,
    "categoryId" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "merchant" VARCHAR(500) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "workflowStatus" VARCHAR(40) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "paymentMethod" VARCHAR(100) NOT NULL,
    "receiptFileName" VARCHAR(500) NOT NULL DEFAULT '',
    "details" JSONB NOT NULL DEFAULT '{}',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseStatusHistory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorRole" "TenantRole" NOT NULL,
    "previousStatus" VARCHAR(40),
    "newStatus" VARCHAR(40) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "note" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "originalName" VARCHAR(500) NOT NULL,
    "storageName" VARCHAR(100) NOT NULL,
    "mimeType" VARCHAR(80) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "expenseId" UUID NOT NULL,
    "batchId" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "requestedById" UUID NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "bankReference" VARCHAR(160),
    "reconciliationMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_organizationId_employeeId_createdAt_idx" ON "Expense"("organizationId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_organizationId_managerEmployeeId_workflowStatus_idx" ON "Expense"("organizationId", "managerEmployeeId", "workflowStatus");

-- CreateIndex
CREATE INDEX "Expense_organizationId_assignedFinanceOfficerId_workflowSta_idx" ON "Expense"("organizationId", "assignedFinanceOfficerId", "workflowStatus");

-- CreateIndex
CREATE INDEX "Expense_organizationId_workflowStatus_idx" ON "Expense"("organizationId", "workflowStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_organizationId_id_key" ON "Expense"("organizationId", "id");
CREATE UNIQUE INDEX "Expense_organizationId_employeeId_submissionKey_key" ON "Expense"("organizationId", "employeeId", "submissionKey");

-- CreateIndex
CREATE INDEX "ExpenseStatusHistory_organizationId_expenseId_at_idx" ON "ExpenseStatusHistory"("organizationId", "expenseId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseStatusHistory_expenseId_sequence_key" ON "ExpenseStatusHistory"("expenseId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_expenseId_key" ON "Receipt"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_storageName_key" ON "Receipt"("storageName");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_organizationId_expenseId_key" ON "Receipt"("organizationId", "expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpensePayment_expenseId_key" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpensePayment_organizationId_status_createdAt_idx" ON "ExpensePayment"("organizationId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_employeeId_fkey" FOREIGN KEY ("organizationId", "employeeId") REFERENCES "TenantUser"("organizationId", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_managerEmployeeId_fkey" FOREIGN KEY ("organizationId", "managerEmployeeId") REFERENCES "TenantUser"("organizationId", "employeeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_assignedFinanceOfficerId_fkey" FOREIGN KEY ("organizationId", "assignedFinanceOfficerId") REFERENCES "TenantUser"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_categoryId_fkey" FOREIGN KEY ("organizationId", "categoryId") REFERENCES "ExpenseCategory"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseStatusHistory" ADD CONSTRAINT "ExpenseStatusHistory_organizationId_expenseId_fkey" FOREIGN KEY ("organizationId", "expenseId") REFERENCES "Expense"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_organizationId_expenseId_fkey" FOREIGN KEY ("organizationId", "expenseId") REFERENCES "Expense"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_organizationId_expenseId_fkey" FOREIGN KEY ("organizationId", "expenseId") REFERENCES "Expense"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only new tables are affected. Historical foreign keys/indexes are untouched.
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_currency_code" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_status_valid" CHECK ("status" IN ('pending', 'approved', 'rejected'));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_workflow_valid" CHECK ("workflowStatus" IN ('draft', 'manager_review', 'finance_review', 'compliance_review', 'approved_for_payment', 'payment_processing', 'returned', 'rejected', 'paid'));
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_currency_code" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_status_valid" CHECK ("status" IN ('pending', 'processed', 'failed', 'reconciled'));
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_settlement_evidence" CHECK ("status" NOT IN ('processed', 'reconciled') OR "bankReference" IS NOT NULL);
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_reconciliation_evidence" CHECK ("status" <> 'reconciled' OR "reconciliationMetadata" IS NOT NULL);
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_size_positive" CHECK ("size" > 0);
