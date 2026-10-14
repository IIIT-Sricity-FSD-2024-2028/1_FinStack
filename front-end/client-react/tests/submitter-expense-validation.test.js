import test from "node:test";
import assert from "node:assert/strict";
import { isValidExpenseAmount } from "../src/features/submitter/expenseValidation.js";

test("expense amount accepts positive values with at most two decimals", () => {
  for (const value of ["0.01", "1", "1.5", "1.50", "500", "999999999999.99"]) {
    assert.equal(isValidExpenseAmount(value), true, value);
  }
});

test("expense amount rejects empty, malformed, non-positive, over-precision, and oversized values", () => {
  for (const value of ["", "abc", "1x", "0", "0.00", "-1", "1.001", "1.", ".50", "1e5", "999999999999.999", "1000000000000.00"]) {
    assert.equal(isValidExpenseAmount(value), false, value);
  }
});
