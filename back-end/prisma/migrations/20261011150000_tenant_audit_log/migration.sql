-- Additive ledger, no fictional backfill or business-row changes.
CREATE TABLE "TenantAuditLog" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "actorUserId" UUID,
 "actorKind" VARCHAR(16) NOT NULL, "actorName" VARCHAR(201) NOT NULL, "actorRole" "TenantRole",
 "initiatedByUserId" UUID, "eventCode" VARCHAR(100) NOT NULL, "targetType" VARCHAR(40) NOT NULL,
 "targetId" VARCHAR(80) NOT NULL, "outcome" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
 "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "changes" JSONB NOT NULL,
 CONSTRAINT "TenantAuditLog_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TenantAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TenantAuditLog_actor_check" CHECK (("actorKind"='USER' AND "actorUserId" IS NOT NULL AND "actorRole" IS NOT NULL) OR ("actorKind"='SYSTEM' AND "actorUserId" IS NULL)),
 CONSTRAINT "TenantAuditLog_outcome_check" CHECK ("outcome" IN ('SUCCESS','FAILED'))
);
CREATE INDEX "TenantAuditLog_organizationId_occurredAt_id_idx" ON "TenantAuditLog"("organizationId","occurredAt","id");
CREATE INDEX "TenantAuditLog_organizationId_eventCode_occurredAt_idx" ON "TenantAuditLog"("organizationId","eventCode","occurredAt");
CREATE INDEX "TenantAuditLog_organizationId_targetType_targetId_occurredAt_idx" ON "TenantAuditLog"("organizationId","targetType","targetId","occurredAt");
CREATE INDEX "TenantAuditLog_organizationId_actorUserId_occurredAt_idx" ON "TenantAuditLog"("organizationId","actorUserId","occurredAt");
-- Immutable rows; the existing explicit organization teardown can cascade.
CREATE FUNCTION tenant_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Tenant audit records are append-only';
END $$;
CREATE TRIGGER tenant_audit_immutable BEFORE UPDATE OR DELETE ON "TenantAuditLog" FOR EACH ROW EXECUTE FUNCTION tenant_audit_immutable();
