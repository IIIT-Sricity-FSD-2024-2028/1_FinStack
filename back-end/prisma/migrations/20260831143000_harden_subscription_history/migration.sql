ALTER TABLE "SubscriptionHistory"
ADD COLUMN "previousStatus" "SubscriptionStatus",
ADD COLUMN "newStatus" "SubscriptionStatus",
ADD COLUMN "previousPlanId" UUID,
ADD COLUMN "newPlanId" UUID,
ADD COLUMN "metadata" JSONB;

CREATE INDEX "SubscriptionHistory_previousPlanId_idx" ON "SubscriptionHistory"("previousPlanId");
CREATE INDEX "SubscriptionHistory_newPlanId_idx" ON "SubscriptionHistory"("newPlanId");
