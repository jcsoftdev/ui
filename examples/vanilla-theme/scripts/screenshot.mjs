// Real-browser check: starts Vite, opens the playground in Chromium, changes the brand color and
// asserts the theme was applied, the audit passes and the DOM-only applyTheme took effect.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR ?? join(root, "screenshots");
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 1100 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);

  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  assert.equal(await accent(), "#6d28d9");
  assert.match(await page.locator("#audit").textContent(), /meet WCAG AA/);
  await page.screenshot({ path: join(outDir, "light-violet.png"), fullPage: true });

  await page.locator("#brand").fill("#0e7490");
  assert.equal(await accent(), "#0e7490");
  const btn = await page.locator(".btn.primary").evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.backgroundColor, s.color];
  });
  assert.equal(btn[0], "rgb(14, 116, 144)");
  assert.notEqual(btn[1], btn[0]);

  await page.locator("#scheme").selectOption("dark");
  await page.screenshot({ path: join(outDir, "dark-teal.png"), fullPage: true });
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(dark, "rgb(0, 0, 0)");

  await page.locator("#brand").fill("#fbbf24");
  await page.locator("#scheme").selectOption("light");
  assert.match(await page.locator("#audit").textContent(), /meet WCAG AA/);
  await page.screenshot({ path: join(outDir, "light-amber.png"), fullPage: true });

  assert.deepEqual(errors, []);
  console.log(`playground ok, screenshots in ${outDir}`);
} finally {
  await browser.close();
  await server.close();
}
