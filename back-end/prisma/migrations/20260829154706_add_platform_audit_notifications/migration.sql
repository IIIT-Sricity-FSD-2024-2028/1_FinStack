-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" UUID NOT NULL,
    "actorStaffId" UUID,
    "eventCode" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "resourceType" VARCHAR(120) NOT NULL,
    "resourceId" VARCHAR(120),
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "requestId" VARCHAR(120),
    "correlationId" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformNotification" (
    "id" UUID NOT NULL,
    "recipientStaffId" UUID NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "link" VARCHAR(255),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformAuditLog_actorStaffId_createdAt_idx" ON "PlatformAuditLog"("actorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_category_createdAt_idx" ON "PlatformAuditLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_resourceType_resourceId_idx" ON "PlatformAuditLog"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "PlatformNotification_recipientStaffId_isRead_createdAt_idx" ON "PlatformNotification"("recipientStaffId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformNotification_recipientStaffId_createdAt_idx" ON "PlatformNotification"("recipientStaffId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformNotification" ADD CONSTRAINT "PlatformNotification_recipientStaffId_fkey" FOREIGN KEY ("recipientStaffId") REFERENCES "PlatformStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
