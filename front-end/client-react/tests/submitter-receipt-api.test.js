import test from "node:test";
import assert from "node:assert/strict";

import { fetchExpenseReceipt } from "../src/features/submitter/api/receiptApi.js";

const receiptRequest = (overrides = {}) =>
  fetchExpenseReceipt({
    id: "expense/id",
    baseUrl: "https://api.example.test",
    accessToken: "test-token",
    ...overrides,
  });

test("receipt adapter uses the authenticated expense receipt endpoint and returns a Blob", async () => {
  let request;
  const blob = await receiptRequest({
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(new Blob(["receipt"], { type: "application/pdf" }), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    },
  });
  assert.equal(request.url, "https://api.example.test/api/v1/tenant/expenses/expense%2Fid/receipt");
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(blob.type, "application/pdf");
});

test("receipt adapter accepts only supported response MIME types", async () => {
  await assert.rejects(
    receiptRequest({
      fetchImpl: async () =>
        new Response("unsafe", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    }),
    /cannot be displayed safely/,
  );
});

test("receipt adapter reports 401, 403, and 404 responses", async () => {
  for (const [status, message] of [
    [401, /Sign in again/],
    [403, /permission/],
    [404, /No receipt/],
  ]) {
    let unauthorized = false;
    await assert.rejects(
      receiptRequest({
        onUnauthorized: () => {
          unauthorized = true;
        },
        fetchImpl: async () => new Response(null, { status }),
      }),
      message,
    );
    assert.equal(unauthorized, status === 401);
  }
});

test("receipt adapter reports network failures", async () => {
  await assert.rejects(
    receiptRequest({
      fetchImpl: async () => {
        throw new TypeError("offline");
      },
    }),
    /Check your connection/,
  );
});
