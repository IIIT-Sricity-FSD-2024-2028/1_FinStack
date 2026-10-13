import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryActivationSummary,
  filterCategories,
  paginateCategories,
} from "../src/features/config-manager/categoryLifecycle.js";

const categories = [
  { id: "1", name: "Meals", description: "Travel dining", status: "Active" },
  {
    id: "2",
    name: "Legacy Travel",
    description: "Older approved trips",
    status: "Inactive",
  },
  {
    id: "3",
    name: "Travel",
    description: "Current travel costs",
    status: "Active",
  },
];

test("All, Active, and Inactive filters combine with literal name/description search", () => {
  assert.deepEqual(
    filterCategories(categories, "", "all").map((item) => item.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    filterCategories(categories, "", "Active").map((item) => item.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterCategories(categories, "older", "Inactive").map((item) => item.id),
    ["2"],
  );
  assert.deepEqual(filterCategories(categories, "older", "Active"), []);
});

test("pagination clamps after category removal and handles empty results", () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({
    id: String(index),
  }));
  assert.deepEqual(paginateCategories(rows, 2, 10), {
    page: 2,
    pageCount: 2,
    items: [rows[10]],
    total: 11,
  });
  assert.deepEqual(paginateCategories(rows.slice(0, 10), 2, 10), {
    page: 1,
    pageCount: 1,
    items: rows.slice(0, 10),
    total: 10,
  });
  assert.deepEqual(paginateCategories([], 2, 10), {
    page: 1,
    pageCount: 1,
    items: [],
    total: 0,
  });
});

test("activation result names skipped categories and makes inactive preservation explicit", () => {
  assert.equal(
    categoryActivationSummary(
      {
        createdCount: 1,
        existingCount: 2,
        skippedTemplates: [
          { name: "Travel", status: "Inactive" },
          { name: "Meals", status: "Active" },
        ],
      },
      3,
    ),
    "Activated 1 of 3 selected categories. 2 already existed and were left unchanged: Travel (inactive), Meals.",
  );
  assert.equal(
    categoryActivationSummary(
      {
        createdCount: 0,
        existingCount: 1,
        skippedTemplates: [{ name: "Travel", status: "Inactive" }],
      },
      1,
    ),
    "No new categories were added. 1 already existed and were left unchanged: Travel (inactive).",
  );
});
