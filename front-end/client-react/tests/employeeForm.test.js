import test from "node:test";
import assert from "node:assert/strict";
import {
  employeeErrors,
  employeeFailure,
  peopleLabel,
} from "../src/features/config-manager/employeeForm.js";
const valid = {
  firstName: "  Alex ",
  lastName: " Tester ",
  email: " alex@example.test ",
  employeeId: " QA-1 ",
  department: "Engineering",
  roles: ["manager"],
  password: "Test-Password-1",
};
test("manual employee validation mirrors existing bounds without restricting international names", () => {
  assert.deepEqual(employeeErrors(valid), {});
  assert.deepEqual(
    employeeErrors({ ...valid, firstName: "Álex", lastName: "O’Neil" }),
    {},
  );
  for (const [field, value] of [
    ["firstName", "   "],
    ["lastName", "x".repeat(101)],
    ["firstName", "a\u0000b"],
    ["email", "broken"],
    ["employeeId", "bad id"],
    ["employeeId", "x".repeat(81)],
    ["department", "x".repeat(121)],
    ["password", "short"],
  ])
    assert.ok(employeeErrors({ ...valid, [field]: value })[field]);
  assert.ok(employeeErrors({ ...valid, roles: ["administrator"] }).roles);
});
test("profile editing does not require or replace credentials or employee ID", () => {
  assert.deepEqual(
    employeeErrors({ ...valid, password: "", employeeId: "" }, true),
    {},
  );
});
test("duplicate and manager errors are actionable without backend decorator names", () => {
  assert.ok(
    employeeFailure(
      "Employee ID is unavailable or email already exists in this organization.",
    ).employeeId,
  );
  assert.ok(
    employeeFailure("Manager must belong to this organization.").managerId,
  );
  assert.doesNotMatch(
    employeeFailure("initialPassword must be longer than 8").form,
    /initialPassword/,
  );
  assert.equal(peopleLabel(1), "1 employee");
  assert.equal(peopleLabel(2), "2 employees");
});
