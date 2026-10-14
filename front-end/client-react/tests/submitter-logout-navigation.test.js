import test from "node:test";
import assert from "node:assert/strict";
import { logoutSubmitter } from "../src/features/submitter/submitterNavigation.js";

test("explicit Submitter logout replaces the prior route with login before ending the session", () => {
  const calls = [];
  logoutSubmitter(
    (...arguments_) => calls.push(["navigate", ...arguments_]),
    () => calls.push(["endSession"]),
  );

  assert.deepEqual(calls, [
    ["navigate", "/login", { replace: true, state: null }],
    ["endSession"],
  ]);
});
