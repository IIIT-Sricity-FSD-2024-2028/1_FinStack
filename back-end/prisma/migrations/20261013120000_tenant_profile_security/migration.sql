-- Additive profile data and a credential revision for password/session revocation.
-- No business records, legal identity, subscriptions or invoices are modified.
ALTER TABLE "TenantUser"
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "location" VARCHAR(180),
  ADD COLUMN "avatarColor" VARCHAR(7),
  ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 0;
