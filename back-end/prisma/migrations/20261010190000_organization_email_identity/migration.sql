-- Abort instead of silently merging any historical case/whitespace collisions.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "Organization" GROUP BY lower(btrim("primaryEmail")) HAVING count(*) > 1) THEN
  RAISE EXCEPTION 'Organization identity migration blocked: normalized email collisions require an owner-reviewed resolution.';
 END IF;
END $$;
CREATE UNIQUE INDEX "Organization_primaryEmail_normalized_key" ON "Organization"(lower(btrim("primaryEmail")));
ALTER TABLE "Organization" ALTER COLUMN "primaryContactName" TYPE VARCHAR(201);
ALTER TABLE "Organization" ALTER COLUMN "registrationIdentifierKey" TYPE VARCHAR(320);
COMMIT;
