import test from "node:test";
import assert from "node:assert/strict";
import { buildExpenseTrend } from "../src/features/submitter/dashboardAnalytics.js";

test("expense trend preserves every persisted expense", () => {
  const points = buildExpenseTrend([
    { id: "one", date: "2026-10-01", amount: "1000" },
    { id: "two", date: "2026-10-02", amount: "500" },
    { id: "three", date: "2026-10-03", amount: "100" },
  ]);

  assert.equal(points.length, 3);
  assert.deepEqual(points.map((point) => point.value), [1000, 500, 100]);
});

test("expenses on the same date remain separate trend points", () => {
  const points = buildExpenseTrend([
    { id: "first", date: "2026-10-02", amount: "500" },
    { id: "second", date: "2026-10-02", amount: "100" },
  ]);

  assert.deepEqual(points.map((point) => point.id), ["first", "second"]);
  assert.equal(points[0].label, points[1].label);
});

test("expense trend is ordered by expense date", () => {
  const points = buildExpenseTrend([
    { id: "latest", date: "2026-10-03", amount: "100" },
    { id: "earliest", date: "2026-10-01", amount: "1000" },
    { id: "middle", date: "2026-10-02", amount: "500" },
  ]);

  assert.deepEqual(points.map((point) => point.id), [
    "earliest",
    "middle",
    "latest",
  ]);
});
