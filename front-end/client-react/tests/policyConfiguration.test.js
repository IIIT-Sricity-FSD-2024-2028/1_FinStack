import test from "node:test";
import assert from "node:assert/strict";
import {
  moneyValue,
  formatPolicyMoney,
  filterPolicies,
  APPROVAL_OPTIONS,
  APPROVAL_NOTE,
  POLICY_AMOUNT_ERROR,
  policyFailureMessage,
} from "../src/features/config-manager/policyConfiguration.js";
import { configManagerResourceInternals } from "../src/adapters/configManagerResources.js";
test("policy amounts retain decimal precision and enforce the existing DECIMAL upper bound", () => {
  for (const [input, expected] of [
    ["500", "500.00"],
    ["5000", "5000.00"],
    ["5000.50", "5000.50"],
    ["7500.75", "7500.75"],
    ["7500.50", "7500.50"],
    ["0.01", "0.01"],
    ["9999999999.99", "9999999999.99"],
  ])
    assert.equal(moneyValue(input), expected);
  for (const value of ["0", "-1", "", "1e3", "1.005", "10000000000", "invalid"])
    assert.equal(moneyValue(value), null);
  assert.equal(formatPolicyMoney("5000", "INR"), "₹5,000.00");
  assert.equal(
    formatPolicyMoney("9999999999.99", "USD"),
    "USD 9,99,99,99,999.99",
  );
});
test("policy status patches preserve descriptions and omit unchanged money", () => {
  const existing = {
    description: "Retain",
    maxAmountExact: "7500.50",
    receiptRequired: false,
    currency: "EUR",
    approval: "Manager Approval",
  };
  const payload = configManagerResourceInternals.policyPayload(
    { status: "Inactive" },
    existing,
  );
  assert.equal(payload.description, "Retain");
  assert.equal(payload.receiptRequired, false);
  assert.equal(payload.currency, "EUR");
  assert.equal("maxAmount" in payload, false);
  assert.equal(
    configManagerResourceInternals.policyPayload(
      { maxAmount: "7500.50" },
      existing,
    ).maxAmount,
    "7500.50",
  );
});
test("policy name, status and category filters combine using stable category IDs", () => {
  const rows = [
    { name: "Meals", status: "Active", categoryId: "a" },
    { name: "Travel", status: "Inactive", categoryId: "b" },
  ];
  assert.deepEqual(filterPolicies(rows, " travel ", "Inactive", "b"), [
    rows[1],
  ]);
  assert.deepEqual(filterPolicies(rows, "travel", "Active", "b"), []);
  assert.equal(filterPolicies(rows, "", "all", "all").length, 2);
});
test("approval labels retain legacy values and disclose metadata-only behavior", () => {
  assert.deepEqual(
    APPROVAL_OPTIONS.map((item) => item.value),
    ["Auto Approved", "Manager Approval", "Manager + Finance"],
  );
  assert.equal(APPROVAL_NOTE, "Approval routing is not active yet.");
});
test("backend validator details become one human-readable message", () => {
  assert.equal(
    policyFailureMessage(
      "maxAmount must not be greater than 9999999999.99, maxAmount must not be less than 0, maxAmount must be a number conforming to the specified constraints",
    ),
    POLICY_AMOUNT_ERROR,
  );
  assert.equal(
    policyFailureMessage("currency must match /^[A-Z]{3}$/ regular expression"),
    "Check the policy name, category, currency and amount, then try again.",
  );
});
