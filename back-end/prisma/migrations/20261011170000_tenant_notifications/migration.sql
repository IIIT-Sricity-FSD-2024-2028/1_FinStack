-- Additive, no conversion of unverifiable process-local notification history.
CREATE UNIQUE INDEX "TenantUser_organizationId_id_key" ON "TenantUser"("organizationId","id");
CREATE TABLE "TenantNotification" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "recipientUserId" UUID NOT NULL,
 "eventCode" VARCHAR(100) NOT NULL,"eventKey" VARCHAR(320) NOT NULL,"type" VARCHAR(20) NOT NULL,
 "title" VARCHAR(200) NOT NULL,"message" VARCHAR(2000) NOT NULL,"sourceType" VARCHAR(40),"sourceId" VARCHAR(100),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"readAt" TIMESTAMP(3),"dismissedAt" TIMESTAMP(3),
 CONSTRAINT "TenantNotification_pkey" PRIMARY KEY("id"),
 CONSTRAINT "TenantNotification_organizationId_fkey" FOREIGN KEY("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TenantNotification_recipient_fkey" FOREIGN KEY("organizationId","recipientUserId") REFERENCES "TenantUser"("organizationId","id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TenantNotification_type_check" CHECK("type" IN ('info','success','warning','danger'))
);
CREATE UNIQUE INDEX "TenantNotification_organizationId_recipientUserId_eventKey_key" ON "TenantNotification"("organizationId","recipientUserId","eventKey");
CREATE INDEX "TenantNotification_recipient_page_idx" ON "TenantNotification"("organizationId","recipientUserId","dismissedAt","createdAt","id");
CREATE INDEX "TenantNotification_recipient_unread_idx" ON "TenantNotification"("organizationId","recipientUserId","dismissedAt","readAt");
