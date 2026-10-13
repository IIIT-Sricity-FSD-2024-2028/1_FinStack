-- Add provenance without rewriting, renaming, or activating existing records.
ALTER TABLE "ExpenseCategory" ADD COLUMN "templateKey" VARCHAR(80);
ALTER TABLE "ExpensePolicy" ADD COLUMN "templateKey" VARCHAR(80);
-- PostgreSQL permits multiple NULL values: ordinary custom CRUD remains intact.
CREATE UNIQUE INDEX "ExpenseCategory_organizationId_templateKey_key" ON "ExpenseCategory"("organizationId", "templateKey");
CREATE UNIQUE INDEX "ExpensePolicy_organizationId_templateKey_key" ON "ExpensePolicy"("organizationId", "templateKey");
