import test from "node:test";
import { configManagerResources } from "../src/adapters/configManagerResources.js";
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

test("new employees need no invented login ID while credentials and reporting remain validated", () => {
  for (const employeeId of [undefined, "", "   "]) {
    assert.deepEqual(employeeErrors({ ...valid, employeeId }), {});
  }
  assert.ok(
    employeeErrors({ ...valid, employeeId: undefined, password: "" }).password,
  );
  assert.ok(
    employeeErrors({ ...valid, employeeId: undefined, roles: [] }).roles,
  );
});

test("provisioning transport omits absent IDs and tenant selectors, preserves reporting and exposes the returned ID", async () => {
  const previousWindow = globalThis.window;
  const calls = [];
  const created = {
    id: "immutable-user-uuid",
    employeeId: "ACM-10000000000040008000000000000001-0123456789ABCDEF0123",
  };
  try {
    globalThis.window = {
      FinStackTenantSession: {
        request: async (path, options) => {
          calls.push({
            path,
            method: options.method,
            body: JSON.parse(JSON.stringify(options.body)),
          });
          return created;
        },
      },
    };
    const result = await configManagerResources.users.create({
      firstName: "Alex",
      lastName: "Tester",
      email: "alex@example.test",
      role: "expense_submitter",
      password: "fixture-password-only",
      department: "Engineering",
      managerId: "same-tenant-manager-uuid",
      organizationId: "untrusted-tenant",
    });
    assert.deepEqual(calls, [
      {
        path: "/api/v1/tenant/configuration/users",
        method: "POST",
        body: {
          firstName: "Alex",
          lastName: "Tester",
          email: "alex@example.test",
          role: "EXPENSE_SUBMITTER",
          initialPassword: "fixture-password-only",
          department: "Engineering",
          managerId: "same-tenant-manager-uuid",
        },
      },
    ]);
    assert.equal(result.employeeId, created.employeeId);
    await configManagerResources.users.create({
      ...valid,
      role: "manager",
      employeeId: "LEGACY-1",
    });
    assert.equal(calls[1].body.employeeId, "LEGACY-1");
  } finally {
    globalThis.window = previousWindow;
  }
});
