import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import {
  createCategoryToast,
  CategorySuccessToast,
} from "../src/features/config-manager/categoryToast.js";

function clock() {
  let now = 0,
    id = 0;
  const tasks = new Map(),
    cancelled = [];
  const controller = createCategoryToast(
    (run, delay) => {
      const key = ++id;
      tasks.set(key, { run, at: now + delay });
      return key;
    },
    (key) => {
      cancelled.push(tasks.get(key)?.run);
      tasks.delete(key);
    },
  );
  function tick(ms) {
    const until = now + ms;
    for (;;) {
      const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      now = next[1].at;
      tasks.delete(next[0]);
      next[1].run();
    }
    now = until;
  }
  return { controller, tick, tasks, cancelled };
}

test("success renders immediately in one accessible toast and disappears at two seconds", () => {
  const { controller, tick } = clock();
  controller.show("Category saved.");
  const markup = renderToStaticMarkup(
    createElement(CategorySuccessToast, { notice: controller.getSnapshot() }),
  );
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.equal(markup.split("Category saved.").length - 1, 1);
  tick(1849);
  assert.equal(controller.getSnapshot().leaving, false);
  tick(1);
  assert.equal(controller.getSnapshot().leaving, true);
  tick(150);
  assert.equal(controller.getSnapshot(), null);
});

test("consecutive successes replace the message and stale callbacks cannot dismiss the newer toast", () => {
  const { controller, tick, cancelled } = clock();
  controller.show("First");
  tick(1000);
  controller.show("Second");
  for (const callback of cancelled) callback?.();
  assert.equal(controller.getSnapshot().message, "Second");
  tick(1000);
  assert.equal(controller.getSnapshot().message, "Second");
  tick(1000);
  assert.equal(controller.getSnapshot(), null);
});

test("template success lasts three seconds and dispose cancels timers and ignores late writes", () => {
  const { controller, tick, tasks } = clock();
  controller.show("Eight categories activated.", 3000);
  tick(2000);
  assert.ok(controller.getSnapshot());
  tick(1000);
  assert.equal(controller.getSnapshot(), null);
  controller.show("Saved");
  controller.dispose();
  assert.equal(tasks.size, 0);
  controller.show("Late async result");
  assert.equal(controller.getSnapshot().message, "Saved");
});

test("success UI is outside document flow; errors remain independently rendered without a timer or duplicate toast provider", () => {
  const source = readFileSync(
    new URL(
      "../src/features/config-manager/ConfigManagerExpenseCategories.jsx",
      import.meta.url,
    ),
    "utf8",
  );
  const css = readFileSync(
    new URL(
      "../src/features/config-manager/category-lifecycle.css",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(css, /\.category-success-toast-host\s*\{[^}]*position: fixed/s);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.equal((source.match(/<CategorySuccessToast /g) || []).length, 1);
  assert.doesNotMatch(source, /notify\(|templateMessage|type: "success"/);
  assert.match(source, /setOperationNotice\(\{ type: "error", message \}\)/);
  assert.doesNotMatch(source, /setTimeout|setInterval/);
});
