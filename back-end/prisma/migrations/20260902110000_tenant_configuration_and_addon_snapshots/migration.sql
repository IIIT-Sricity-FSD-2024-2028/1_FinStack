ALTER TABLE "TenantUser"
  ADD COLUMN "department" VARCHAR(120) NOT NULL DEFAULT 'General',
  ADD COLUMN "managerId" UUID;

ALTER TABLE "OrganizationSubscription"
  ADD COLUMN "selectedAddOns" JSONB;

ALTER TABLE "Invoice"
  ADD COLUMN "selectedAddOns" JSONB;

ALTER TABLE "TenantUser"
  ADD CONSTRAINT "TenantUser_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "TenantUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TenantUser_organizationId_managerId_idx"
  ON "TenantUser"("organizationId", "managerId");
