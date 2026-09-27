-- CreateEnum
CREATE TYPE "PlatformStaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "PlatformStaff" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "status" "PlatformStaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRole" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "isSystemPreset" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformRolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- CreateTable
CREATE TABLE "PlatformStaffRole" (
    "staffId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByStaffId" UUID,
    CONSTRAINT "PlatformStaffRole_pkey" PRIMARY KEY ("staffId", "roleId")
);

-- CreateTable
CREATE TABLE "PlatformAuthSession" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "refreshTokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformStaff_email_key" ON "PlatformStaff"("email");
CREATE INDEX "PlatformStaff_status_createdAt_idx" ON "PlatformStaff"("status", "createdAt");
CREATE UNIQUE INDEX "PlatformRole_key_key" ON "PlatformRole"("key");
CREATE UNIQUE INDEX "PlatformRole_name_key" ON "PlatformRole"("name");
CREATE INDEX "PlatformRole_isActive_idx" ON "PlatformRole"("isActive");
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "PlatformRolePermission_permissionId_idx" ON "PlatformRolePermission"("permissionId");
CREATE INDEX "PlatformStaffRole_roleId_idx" ON "PlatformStaffRole"("roleId");
CREATE INDEX "PlatformStaffRole_assignedByStaffId_idx" ON "PlatformStaffRole"("assignedByStaffId");
CREATE UNIQUE INDEX "PlatformAuthSession_refreshTokenHash_key" ON "PlatformAuthSession"("refreshTokenHash");
CREATE INDEX "PlatformAuthSession_staffId_revokedAt_idx" ON "PlatformAuthSession"("staffId", "revokedAt");
CREATE INDEX "PlatformAuthSession_expiresAt_idx" ON "PlatformAuthSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformRolePermission" ADD CONSTRAINT "PlatformRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformStaffRole" ADD CONSTRAINT "PlatformStaffRole_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "PlatformStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformStaffRole" ADD CONSTRAINT "PlatformStaffRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PlatformRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformStaffRole" ADD CONSTRAINT "PlatformStaffRole_assignedByStaffId_fkey" FOREIGN KEY ("assignedByStaffId") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformAuthSession" ADD CONSTRAINT "PlatformAuthSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "PlatformStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
