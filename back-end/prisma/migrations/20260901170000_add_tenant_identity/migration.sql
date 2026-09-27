CREATE TYPE "TenantUserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "TenantRole" AS ENUM ('CONFIGURATION_MANAGER', 'EXPENSE_SUBMITTER', 'MANAGER', 'FINANCE_OFFICER', 'COMPLIANCE_OFFICER');

CREATE TABLE "TenantUser" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" VARCHAR(80) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'EXPENSE_SUBMITTER',
    "status" "TenantUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantUser_organizationId_email_key" ON "TenantUser"("organizationId", "email");
CREATE UNIQUE INDEX "TenantUser_organizationId_employeeId_key" ON "TenantUser"("organizationId", "employeeId");
CREATE INDEX "TenantUser_organizationId_status_idx" ON "TenantUser"("organizationId", "status");

ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
