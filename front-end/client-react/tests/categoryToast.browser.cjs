const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const { chromium } = require(
  process.env.FINSTACK_PLAYWRIGHT_MODULE ||
    "C:/Users/nikhi/AppData/Local/ms-playwright-go/1.57.0/package",
);

test("rendered React toast replaces, expires, preserves errors/focus and causes no layout shift", async () => {
  const root = path.resolve(__dirname, "..");
  const result = await build({
    stdin: {
      resolveDir: root,
      sourcefile: "category-toast-browser.jsx",
      loader: "jsx",
      contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { CategorySuccessToast, useCategoryToast } from './src/features/config-manager/categoryToast.js';
      function Harness() {
        const { notice, showSuccess } = useCategoryToast();
        const [error, setError] = useState('');
        return <><nav>Navigation</nav><CategorySuccessToast notice={notice}/>
          <button onClick={() => showSuccess('Category saved.', 2000)}>Save</button>
          <button onClick={() => showSuccess('Category reactivated.', 2000)}>Reactivate</button>
          <button onClick={() => showSuccess('Activated 8 categories.', 3000)}>Templates</button>
          <button onClick={() => setError('This name already exists.')}>Error</button>
          {error && <p role="alert">{error}</p>}
          <table><tbody><tr><td>Unchanged category table</td></tr></tbody></table></>;
      }
      createRoot(document.getElementById('root')).render(<Harness/>);
    `,
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
  });
  const css = fs.readFileSync(
    path.join(root, "src/features/config-manager/category-lifecycle.css"),
    "utf8",
  );
  const server = http.createServer((req, res) => {
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(result.outputFiles[0].text);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<style>${css}</style><div id="root"></div><script src="/app.js"></script>`,
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath:
        process.env.FINSTACK_BROWSER_EXECUTABLE ||
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      headless: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button", { name: "Save", exact: true }).waitFor();
    await page.clock.install();
    const tableBefore = await page.locator("table").boundingBox();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Category saved.", { exact: true }).waitFor();
    assert.equal(await page.locator(".category-success-toast").count(), 1);
    assert.deepEqual(await page.locator("table").boundingBox(), tableBefore);
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Save",
    );
    await page.clock.runFor(1000);
    await page.getByRole("button", { name: "Reactivate", exact: true }).click();
    await page.getByText("Category reactivated.", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("Category saved.", { exact: true }).count(),
      0,
    );
    await page.clock.runFor(1000);
    assert.equal(await page.locator(".category-success-toast").count(), 1);
    await page.clock.runFor(1000);
    await page
      .locator(".category-success-toast")
      .waitFor({ state: "detached" });
    assert.deepEqual(await page.locator("table").boundingBox(), tableBefore);
    await page.getByRole("button", { name: "Templates", exact: true }).click();
    await page.getByText("Activated 8 categories.", { exact: true }).waitFor();
    await page.clock.runFor(2000);
    assert.equal(await page.locator(".category-success-toast").count(), 1);
    await page.clock.runFor(1000);
    await page
      .locator(".category-success-toast")
      .waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Error", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page.clock.runFor(10000);
    assert.equal(
      await page.getByRole("alert").innerText(),
      "This name already exists.",
    );
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const host = await page
        .locator(".category-success-toast-host")
        .boundingBox();
      assert.ok(host.x >= 0 && host.x + host.width <= width);
      assert.equal(
        await page
          .locator(".category-success-toast-host")
          .evaluate((element) => getComputedStyle(element).position),
        "fixed",
      );
      assert.equal(
        await page.getByRole("alert").innerText(),
        "This name already exists.",
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".category-success-toast")
        .evaluate((element) => getComputedStyle(element).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
