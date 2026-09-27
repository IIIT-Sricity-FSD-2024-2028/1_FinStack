CREATE UNIQUE INDEX "Invoice_one_open_commercial_change_per_subscription"
  ON "Invoice"("subscriptionId", "billingReason")
  WHERE "billingReason" IN ('PLAN_CHANGE', 'RENEWAL')
    AND "status" IN ('PENDING', 'OVERDUE');
