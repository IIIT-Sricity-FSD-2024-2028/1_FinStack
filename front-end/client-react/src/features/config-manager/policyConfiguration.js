export const APPROVAL_OPTIONS = [
  { levels: 0, value: "Auto Approved", label: "No manual review required" },
  { levels: 1, value: "Manager Approval", label: "Manager review required" },
  {
    levels: 2,
    value: "Manager + Finance",
    label: "Manager then Finance review required",
  },
];
export const APPROVAL_NOTE = "Approval routing is not active yet.";

export const POLICY_AMOUNT_ERROR =
  "Enter an amount greater than 0, up to 9999999999.99, with no more than two decimal places.";
export function policyFailureMessage(message) {
  if (/maxAmount|spending cap|decimal places/i.test(message || ""))
    return POLICY_AMOUNT_ERROR;
  if (
    /must (be|not|contain|match)|conforming to|should not|property .* exist/i.test(
      message || "",
    )
  )
    return "Check the policy name, category, currency and amount, then try again.";
  return message || "The policy could not be saved. Please try again.";
}

export function moneyValue(value, allowZero = false) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text) || text.length > 64) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents < (allowZero ? 0n : 1n) || cents > 999999999999n) return null;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function formatPolicyMoney(value, currency) {
  const amount = moneyValue(value, true);
  if (!amount) return `${currency} ${value}`;
  const [whole, fraction] = amount.split(".");
  const grouped = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(BigInt(whole));
  return `${currency === "INR" ? "₹" : `${currency} `}${grouped}.${fraction}`;
}
export function approvalLabel(policy) {
  if (policy.requiresApproval === false) return APPROVAL_OPTIONS[0].label;
  return (
    APPROVAL_OPTIONS.find((option) => option.value === policy.approval)
      ?.label || policy.approval
  );
}
export function filterPolicies(policies, search, status, categoryId) {
  const query = search.trim().toLowerCase();
  return policies.filter(
    (policy) =>
      policy.name.toLowerCase().includes(query) &&
      (status === "all" || policy.status === status) &&
      (categoryId === "all" || policy.categoryId === categoryId),
  );
}
export function policyActivationSummary(response, count) {
  const skipped = (response.skippedTemplates || []).map(
    (item) => `${item.name}${item.status === "Inactive" ? " (inactive)" : ""}`,
  );
  return `Activated ${response.createdCount} of ${count} selected policies.${response.existingCount ? ` ${response.existingCount} already existed and were left unchanged${skipped.length ? `: ${skipped.join(", ")}` : ""}.` : ""}`;
}
