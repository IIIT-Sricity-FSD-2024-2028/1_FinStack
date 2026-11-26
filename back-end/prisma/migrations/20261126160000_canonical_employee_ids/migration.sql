BEGIN;
-- Published databases have never received the abandoned six-digit design.
-- Preserve every historical key and audit record. New fields are additive.
LOCK TABLE "Organization", "TenantUser" IN ACCESS EXCLUSIVE MODE;
ALTER TABLE "Organization" ADD COLUMN "employeePrefix" VARCHAR(12), ADD COLUMN "nextEmployeeNumber" INTEGER NOT NULL DEFAULT 1001;
ALTER TABLE "TenantUser" ADD COLUMN "canonicalEmployeeId" VARCHAR(20);
CREATE TABLE "EmployeePrefixReservation" (
  "prefix" VARCHAR(12) PRIMARY KEY,
  "organizationId" UUID NOT NULL UNIQUE,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EmployeeIdentityMapping" (
  "canonicalEmployeeId" VARCHAR(20) PRIMARY KEY,
  "userId" UUID NOT NULL UNIQUE,
  "organizationId" UUID NOT NULL,
  "previousEmployeeId" VARCHAR(80) NOT NULL UNIQUE,
  "operation" VARCHAR(20) NOT NULL,
  "migration" TEXT NOT NULL DEFAULT 'organization-prefixed-v1',
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EmployeeLoginAlias" (
  "alias" VARCHAR(80) PRIMARY KEY,
  "userId" UUID NOT NULL
);
-- Reservations intentionally have no cascading foreign keys: deletion cannot recycle IDs.
CREATE FUNCTION assign_employee_prefix(org_id UUID, org_name TEXT) RETURNS VARCHAR(12) LANGUAGE plpgsql AS $$
DECLARE base TEXT; candidate TEXT; suffix INTEGER := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(62394712085621);
  SELECT "prefix" INTO candidate FROM "EmployeePrefixReservation" WHERE "organizationId" = org_id;
  IF FOUND THEN RETURN candidate; END IF;
  base := substring(regexp_replace(upper(org_name), '[^A-Z]', '', 'g') FROM 1 FOR 3);
  IF length(base) < 2 THEN base := 'ORG'; END IF;
  LOOP
    candidate := base || CASE WHEN suffix = 0 THEN '' ELSE suffix::text END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "EmployeePrefixReservation" WHERE "prefix" = candidate);
    suffix := suffix + 1;
    IF suffix > 999999999 THEN RAISE EXCEPTION 'Organization prefix namespace exhausted'; END IF;
  END LOOP;
  INSERT INTO "EmployeePrefixReservation"("prefix", "organizationId") VALUES(candidate, org_id);
  RETURN candidate;
END $$;
-- A total ordering makes the one-time mapping reproducible from the same snapshot.
DO $$ DECLARE org RECORD; BEGIN
  FOR org IN SELECT id, name FROM "Organization" ORDER BY "createdAt", id LOOP
    UPDATE "Organization" SET "employeePrefix" = assign_employee_prefix(org.id, org.name) WHERE id = org.id;
  END LOOP;
END $$;
ALTER TABLE "Organization" ALTER COLUMN "employeePrefix" SET NOT NULL, ALTER COLUMN "employeePrefix" SET DEFAULT '',
  ADD CONSTRAINT "Organization_employeePrefix_format" CHECK ("employeePrefix" ~ '^[A-Z][A-Z0-9]{1,11}$'),
  ADD CONSTRAINT "Organization_employeeNumber_range" CHECK ("nextEmployeeNumber" BETWEEN 1001 AND 10000);
CREATE UNIQUE INDEX "Organization_employeePrefix_key" ON "Organization"("employeePrefix");
CREATE FUNCTION guard_employee_prefix() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."employeePrefix" := assign_employee_prefix(NEW.id, NEW.name);
    NEW."nextEmployeeNumber" := 1001;
  ELSIF NEW."employeePrefix" IS DISTINCT FROM OLD."employeePrefix" OR NEW."nextEmployeeNumber" < OLD."nextEmployeeNumber" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Organization employee prefix and consumed numbers are immutable.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employee_prefix_guard BEFORE INSERT OR UPDATE OF "employeePrefix", "nextEmployeeNumber" ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION guard_employee_prefix();
CREATE FUNCTION allocate_canonical_employee_id(org_id UUID) RETURNS VARCHAR(20) LANGUAGE plpgsql AS $$
DECLARE prefix TEXT; number INTEGER; candidate TEXT;
BEGIN
  LOOP
    -- Atomic per-organization row locking serializes allocation across every writer.
    UPDATE "Organization" SET "nextEmployeeNumber" = "nextEmployeeNumber" + 1
      WHERE id = org_id AND "nextEmployeeNumber" <= 9999
      RETURNING "employeePrefix", "nextEmployeeNumber" - 1 INTO prefix, number;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Employee ID range exhausted for this organization (1001-9999).';
    END IF;
    candidate := prefix || '-' || number::text;
    IF NOT EXISTS (SELECT 1 FROM "EmployeeIdentityMapping" WHERE "canonicalEmployeeId" = candidate OR "previousEmployeeId" = candidate)
       AND NOT EXISTS (SELECT 1 FROM "TenantUser" WHERE "employeeId" = candidate OR "canonicalEmployeeId" = candidate) THEN RETURN candidate; END IF;
  END LOOP;
END $$;
DO $$ DECLARE employee RECORD; canonical TEXT; BEGIN
  FOR employee IN SELECT id, "organizationId", "employeeId" FROM "TenantUser" ORDER BY "organizationId", "createdAt", id LOOP
    canonical := allocate_canonical_employee_id(employee."organizationId");
    UPDATE "TenantUser" SET "canonicalEmployeeId" = canonical WHERE id = employee.id;
    INSERT INTO "EmployeeIdentityMapping"("canonicalEmployeeId", "userId", "organizationId", "previousEmployeeId", "operation")
      VALUES(canonical, employee.id, employee."organizationId", employee."employeeId", 'backfill');
  END LOOP;
END $$;
INSERT INTO "EmployeeLoginAlias"("alias", "userId")
SELECT "canonicalEmployeeId", id FROM "TenantUser" UNION SELECT "employeeId", id FROM "TenantUser";
ALTER TABLE "TenantUser" ALTER COLUMN "canonicalEmployeeId" SET NOT NULL, ALTER COLUMN "canonicalEmployeeId" SET DEFAULT '',
  ADD CONSTRAINT "TenantUser_canonicalEmployeeId_format" CHECK ("canonicalEmployeeId" ~ '^[A-Z][A-Z0-9]{1,11}-[1-9][0-9]{3}$');
CREATE UNIQUE INDEX "TenantUser_canonicalEmployeeId_key" ON "TenantUser"("canonicalEmployeeId");
CREATE FUNCTION guard_canonical_employee_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."canonicalEmployeeId" IS DISTINCT FROM OLD."canonicalEmployeeId" OR NEW."employeeId" IS DISTINCT FROM OLD."employeeId" OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Assigned employee identities and organization are immutable.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."canonicalEmployeeId" <> '' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Canonical Employee IDs are allocated by the server.';
  END IF;
  IF EXISTS (SELECT 1 FROM "EmployeeIdentityMapping" WHERE "canonicalEmployeeId" = NEW."employeeId" OR "previousEmployeeId" = NEW."employeeId") THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Employee login identifier is unavailable.';
  END IF;
  NEW."canonicalEmployeeId" := allocate_canonical_employee_id(NEW."organizationId");
  IF NEW."employeeId" LIKE '__allocate__:%' THEN NEW."employeeId" := NEW."canonicalEmployeeId"; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER canonical_employee_identity_guard BEFORE INSERT OR UPDATE OF "canonicalEmployeeId", "employeeId", "organizationId" ON "TenantUser"
  FOR EACH ROW EXECUTE FUNCTION guard_canonical_employee_identity();
CREATE FUNCTION record_employee_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  -- One globally unique alias index closes canonical-vs-legacy concurrency races.
  INSERT INTO "EmployeeLoginAlias"("alias", "userId") SELECT DISTINCT value, NEW.id FROM (VALUES (NEW."canonicalEmployeeId"), (NEW."employeeId")) AS aliases(value);
  INSERT INTO "EmployeeIdentityMapping"("canonicalEmployeeId", "userId", "organizationId", "previousEmployeeId", "operation")
    VALUES(NEW."canonicalEmployeeId", NEW.id, NEW."organizationId", NEW."employeeId", 'provision');
  RETURN NEW;
END $$;
CREATE TRIGGER employee_identity_record AFTER INSERT ON "TenantUser" FOR EACH ROW EXECUTE FUNCTION record_employee_identity();
CREATE FUNCTION guard_employee_identity_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Employee identity allocation history is append-only.';
END $$;
CREATE TRIGGER employee_identity_history_guard BEFORE UPDATE OR DELETE ON "EmployeeIdentityMapping" FOR EACH ROW EXECUTE FUNCTION guard_employee_identity_history();
CREATE TRIGGER employee_login_alias_history_guard BEFORE UPDATE OR DELETE ON "EmployeeLoginAlias" FOR EACH ROW EXECUTE FUNCTION guard_employee_identity_history();
CREATE TRIGGER employee_prefix_history_guard BEFORE UPDATE OR DELETE ON "EmployeePrefixReservation" FOR EACH ROW EXECUTE FUNCTION guard_employee_identity_history();
COMMIT;
