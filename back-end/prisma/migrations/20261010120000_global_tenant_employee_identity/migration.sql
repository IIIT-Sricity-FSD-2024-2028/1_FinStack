-- Preserve existing IDs and scoped keys. Abort safely if a deployment has ambiguous
-- or unsupported existing identifiers; never rename employees automatically.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TenantUser" GROUP BY "employeeId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Global employee login migration blocked: duplicate employee IDs require an owner-reviewed resolution.';
  END IF;
  IF EXISTS (SELECT 1 FROM "TenantUser" WHERE "employeeId" !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$') THEN
    RAISE EXCEPTION 'Global employee login migration blocked: unsupported employee IDs require an owner-reviewed resolution.';
  END IF;
END $$;
CREATE UNIQUE INDEX "TenantUser_employeeId_key" ON "TenantUser"("employeeId");
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_employeeId_format_check"
  CHECK ("employeeId" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$');
COMMIT;
