import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { registrationErrors } from "../src/features/shared/registrationValidation.js";
const source = await readFile(
  new URL("../src/services/session.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const runtime = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}
const session = {
  accessToken: "server-issued-token",
  organizationId: "org-1",
  user: {
    id: "user-1",
    organizationId: "org-1",
    employeeId: "CFG-1",
    firstName: "Alex",
    lastName: "Lee",
    email: "alex@company.org",
    role: "CONFIGURATION_MANAGER",
    status: "ACTIVE",
  },
};
function setup(status = 200, payload = { data: { ok: true } }) {
  globalThis.sessionStorage = storage();
  globalThis.localStorage = storage();
  globalThis.window = new EventTarget();
  window.FINSTACK_API_BASE_URL = "https://api.company.org/";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    };
  };
  runtime.installSessionRuntime();
  return calls;
}
test("SPA transport uses only bearer identity, preserves AbortSignal and exact decimal strings", async () => {
  const calls = setup();
  runtime.saveSession(session);
  const controller = new AbortController();
  await runtime.request("/api/v1/tenant/example", {
    method: "POST",
    body: { maxAmount: "5000.50" },
    signal: controller.signal,
  });
  assert.equal(calls[0].url, "https://api.company.org/api/v1/tenant/example");
  assert.deepEqual(calls[0].options.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer server-issued-token",
  });
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(JSON.parse(calls[0].options.body).maxAmount, "5000.50");
});
test("SPA rejects invalid session shape and retains compatibility for untouched legacy actors", () => {
  setup();
  assert.throws(() =>
    runtime.saveSession({ ...session, organizationId: "foreign-org" }),
  );
  runtime.saveSession(session);
  const saved = JSON.parse(sessionStorage.getItem("finstackUserSession"));
  assert.equal(saved.role, "configuration_manager");
  assert.equal(saved.fullName, "Alex Lee");
  runtime.clearSession();
  assert.equal(sessionStorage.getItem("finstackTenantAccessToken"), null);
  assert.equal(localStorage.getItem("currentUser"), null);
});
test("SPA authentication errors clear all session keys; permission errors preserve the session", async () => {
  setup(403, { error: { message: "Forbidden" } });
  runtime.saveSession(session);
  await assert.rejects(
    runtime.request("/private"),
    (error) => error.status === 403 && error.message === "Forbidden",
  );
  assert(runtime.currentSession());
  setup(401, { message: "Expired" });
  runtime.saveSession(session);
  await assert.rejects(
    runtime.request("/private"),
    (error) => error.status === 401,
  );
  assert.equal(runtime.currentSession(), null);
});
test("invalid public login sends no bearer token and does not clear another saved session", async () => {
  const calls = setup(401, {
    message: "Employee ID or password is incorrect.",
  });
  runtime.saveSession(session);
  await assert.rejects(
    runtime.request("/api/v1/tenant/auth/login", {
      authenticated: false,
      method: "POST",
      body: { employeeId: "EMP-1", password: "wrong" },
    }),
  );
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert(runtime.currentSession());
});
test("SPA validation never exposes backend decorators and defaults to reserved-domain rejection", async () => {
  setup(400, {
    message: ["email must be an email", "role must be a valid enum"],
  });
  runtime.saveSession(session);
  await assert.rejects(
    runtime.request("/private"),
    (error) => error.message === "Check the submitted values and try again.",
  );
  const value = {
    name: "Fictional QA",
    firstName: "Alex",
    lastName: "Tester",
    registrationCountry: "IN",
    registrationIdentifier: "",
    registrationExemptionReason:
      "Fictional local QA without a government registration.",
    primaryEmail: "office@company.test",
    email: "alex@company.test",
    authorizedContactTitle: "Tester",
    password: "chosen-password",
    confirmPassword: "chosen-password",
    planId: "plan",
    employeeCount: 3,
  };
  assert(registrationErrors(value).primaryEmail);
  assert.equal(registrationErrors(value, true).primaryEmail, undefined);
  assert(
    registrationErrors(
      {
        ...value,
        primaryEmail: "office@company.example",
        email: "alex@company.example",
      },
      true,
    ).primaryEmail,
  );
});
