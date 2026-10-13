import test from "node:test";
import assert from "node:assert/strict";
import { configManagerResourceInternals } from "../src/adapters/configManagerResources.js";

test("status-only category updates preserve descriptions while explicit blanks clear them", () => {
  const existing = { description: "Flights and lodging", status: "Active" };
  const payload = configManagerResourceInternals.categoryPayload;
  assert.equal(
    payload({ status: "Inactive" }, existing).description,
    "Flights and lodging",
  );
  assert.equal(payload({ description: "" }, existing).description, "");
});
