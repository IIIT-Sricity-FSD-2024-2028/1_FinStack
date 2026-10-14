import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_RECEIPT_SIZE,
  validateReceipt,
} from "../src/features/submitter/receiptValidation.js";

const receipt = (name, type, size = 100) => ({ name, type, size });

test("direct submission requires a receipt", () => {
  assert.equal(validateReceipt(null, { required: true }), "Receipt upload is required.");
});

test("JPEG, PNG, and PDF receipts within 5 MB are valid", () => {
  for (const file of [
    receipt("receipt.jpg", "image/jpeg"),
    receipt("receipt.jpeg", "image/jpeg"),
    receipt("receipt.png", "image/png"),
    receipt("receipt.pdf", "application/pdf", MAX_RECEIPT_SIZE),
  ]) {
    assert.equal(validateReceipt(file), "", file.name);
  }
});

test("invalid and oversized receipts are rejected", () => {
  assert.match(validateReceipt(receipt("receipt.exe", "application/octet-stream")), /JPEG/);
  assert.match(validateReceipt(receipt("receipt.pdf", "text/plain")), /not supported/);
  assert.match(validateReceipt(receipt("receipt.pdf", "application/pdf", MAX_RECEIPT_SIZE + 1)), /5 MB/);
});
