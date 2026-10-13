-- Per-account UI preferences; existing users start with application defaults.
ALTER TABLE "TenantUser" ADD COLUMN "preferences" JSONB;
