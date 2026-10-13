-- Additive: preserve historical access without asserting new verification.
CREATE TYPE "OrganizationRegistrationStatus" AS ENUM ('LEGACY_APPROVED', 'PENDING_ORGANIZATION_REVIEW', 'APPROVED', 'REJECTED');
ALTER TABLE "Organization"
 ADD COLUMN "registrationStatus" "OrganizationRegistrationStatus" NOT NULL DEFAULT 'LEGACY_APPROVED',
 ADD COLUMN "registrationIdentifier" VARCHAR(160),
 ADD COLUMN "registrationIdentifierKey" VARCHAR(160),
 ADD COLUMN "registrationExemptionReason" VARCHAR(500),
 ADD COLUMN "registrationCountry" CHAR(2),
 ADD COLUMN "normalizedDomain" VARCHAR(253),
 ADD COLUMN "authorizedContactTitle" VARCHAR(120),
 ADD COLUMN "registrationSubmittedAt" TIMESTAMP(3),
 ADD COLUMN "reviewedAt" TIMESTAMP(3),
 ADD COLUMN "reviewedByStaffId" UUID,
 ADD COLUMN "reviewNote" VARCHAR(2000),
 ADD COLUMN "domainVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Organization_normalizedDomain_key" ON "Organization"("normalizedDomain");
CREATE UNIQUE INDEX "Organization_registrationCountry_registrationIdentifierKey_key" ON "Organization"("registrationCountry", "registrationIdentifierKey");
CREATE INDEX "Organization_registrationStatus_registrationSubmittedAt_idx" ON "Organization"("registrationStatus", "registrationSubmittedAt");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_registration_identity_check" CHECK (
 "registrationStatus" = 'LEGACY_APPROVED' OR
 ("registrationCountry" IS NOT NULL AND "normalizedDomain" IS NOT NULL AND "registrationSubmittedAt" IS NOT NULL
 AND (("registrationIdentifierKey" IS NOT NULL AND "registrationExemptionReason" IS NULL)
 OR ("registrationIdentifierKey" IS NULL AND length(COALESCE("registrationExemptionReason", '')) >= 10)))
);
