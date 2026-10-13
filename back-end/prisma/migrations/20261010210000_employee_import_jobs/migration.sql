BEGIN;
-- Abort safely if legacy normalized email collisions need an owner's review.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "TenantUser" GROUP BY "organizationId", lower(btrim(email)) HAVING count(*) > 1) THEN RAISE EXCEPTION 'Resolve normalized tenant email collisions before migration'; END IF; END $$;
CREATE UNIQUE INDEX "TenantUser_org_email_ci_key" ON "TenantUser"("organizationId",lower(btrim("email")));
ALTER TABLE "TenantUser" ADD COLUMN "credentialSetupRequired" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "activationTokenHash" CHAR(64), ADD COLUMN "activationExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TenantUser_activationTokenHash_key" ON "TenantUser"("activationTokenHash");
CREATE TABLE "EmployeeImportJob" (
 "id" UUID PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT,
 "createdById" UUID NOT NULL REFERENCES "TenantUser"("id") ON DELETE RESTRICT, "confirmedById" UUID,
 "idempotencyKey" UUID NOT NULL, "fileHash" CHAR(64) NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'VALIDATING',
 "totalCount" INTEGER NOT NULL DEFAULT 0, "validCount" INTEGER NOT NULL DEFAULT 0, "invalidCount" INTEGER NOT NULL DEFAULT 0,
 "processedCount" INTEGER NOT NULL DEFAULT 0, "successfulCount" INTEGER NOT NULL DEFAULT 0, "failedCount" INTEGER NOT NULL DEFAULT 0,
 "retries" INTEGER NOT NULL DEFAULT 0, "error" VARCHAR(500), "leaseToken" UUID, "leaseExpiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "confirmedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
 CONSTRAINT "EmployeeImportJob_counts_check" CHECK ("totalCount" BETWEEN 0 AND 10000 AND "processedCount" >= 0 AND "successfulCount" >= 0 AND "failedCount" >= 0),
 CONSTRAINT "EmployeeImportJob_status_check" CHECK (status IN ('VALIDATING','READY','QUEUED','RUNNING','COMPLETED','FAILED'))
);
CREATE UNIQUE INDEX "EmployeeImportJob_organizationId_idempotencyKey_key" ON "EmployeeImportJob"("organizationId","idempotencyKey");
CREATE INDEX "EmployeeImportJob_organizationId_createdAt_idx" ON "EmployeeImportJob"("organizationId","createdAt");
CREATE INDEX "EmployeeImportJob_status_leaseExpiresAt_idx" ON "EmployeeImportJob"("status","leaseExpiresAt");
CREATE TABLE "EmployeeImportRow" (
 "id" UUID PRIMARY KEY, "jobId" UUID NOT NULL REFERENCES "EmployeeImportJob"("id") ON DELETE CASCADE,
 "rowNumber" INTEGER NOT NULL, "employeeId" VARCHAR(80) NOT NULL, "email" VARCHAR(320) NOT NULL,
 "payload" JSONB NOT NULL, "status" VARCHAR(20) NOT NULL, "errors" TEXT[] NOT NULL, "userId" UUID NOT NULL,
 CONSTRAINT "EmployeeImportRow_status_check" CHECK (status IN ('VALID','INVALID','SUCCEEDED','FAILED'))
);
CREATE UNIQUE INDEX "EmployeeImportRow_jobId_rowNumber_key" ON "EmployeeImportRow"("jobId","rowNumber");
CREATE INDEX "EmployeeImportRow_jobId_status_rowNumber_idx" ON "EmployeeImportRow"("jobId","status","rowNumber");
CREATE INDEX "EmployeeImportRow_jobId_employeeId_idx" ON "EmployeeImportRow"("jobId","employeeId");
CREATE INDEX "EmployeeImportRow_jobId_email_idx" ON "EmployeeImportRow"("jobId","email");
COMMIT;
