-- Additive indexes for ordered tenant pages and active manager lookups.
CREATE INDEX "TenantUser_organizationId_firstName_lastName_id_idx" ON "TenantUser"("organizationId","firstName","lastName","id");
CREATE INDEX "TenantUser_organizationId_role_status_firstName_lastName_id_idx" ON "TenantUser"("organizationId","role","status","firstName","lastName","id");
