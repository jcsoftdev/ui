// Real-browser check of the playground: starts Vite, drives every element in Chromium and asserts
// behaviour, then builds the page and asserts the Liquid Glass code stays out of the eager bundle.
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.SCREENSHOT_DIR ?? join(root, "screenshots");
mkdirSync(outDir, { recursive: true });

const server = await createServer({ root, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const requested = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto(url);
  await page.waitForFunction(() => customElements.get("ui-toaster"));
  const liquidRequests = () => requested.filter((u) => /liquid|lens|specular/.test(u));
  assert.deepEqual(liquidRequests(), [], "no liquid code before a surface asks for it");

  // Form association: required validity, FormData from every control, reset.
  await page.locator("#save").click();
  assert.equal(await page.locator("#result").textContent(), "", "required name blocks submit");
  await page.locator("ui-input").locator("input").fill("Ana");
  // Roles set through ElementInternals reach the accessibility tree (the package tests read it over
  // CDP) but not Playwright's role engine, so the leaves are located by tag here.
  await page.locator("ui-radio[value=both]").click();
  await page.locator("ui-switch[name=vip]").click();
  await page.locator("#save").click();
  assert.deepEqual(JSON.parse(await page.locator("#result").textContent()), {
    name: "Ana",
    service: "both",
    reminder: "on",
    vip: "on",
  });
  await page.getByRole("status").filter({ hasText: "Booking saved" }).waitFor();

  // Dialog from an invoker; Escape closes and focus returns.
  await page.locator("#open-dialog").click();
  await page.getByRole("dialog", { name: "Delete booking?" }).waitFor();
  await page.screenshot({ path: join(outDir, "dialog.png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "open-dialog");

  // Popover from popovertarget.
  await page.locator("#open-popover").click();
  assert.equal(await page.locator("#filters").evaluate((el) => el.matches(":popover-open")), true);
  await page.keyboard.press("Escape");

  // Tabs.
  await page.getByRole("tab", { name: "Week" }).click();
  await page.getByRole("tabpanel", { name: "Week" }).waitFor();

  // Liquid Glass: fetched only now.
  await page.locator("#make-liquid").click();
  await page.waitForFunction(() => document.getElementById("liquid")?.dataset.uiLiquid);
  assert.ok(liquidRequests().length > 0, "liquid code loads on demand");
  await page.screenshot({ path: join(outDir, "playground.png"), fullPage: true });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await server.close();
}

// Production build: the entry chunk must not contain the liquid engine.
const dist = join(root, "dist");
await build({ root, logLevel: "error", build: { outDir: dist, emptyOutDir: true } });
const assets = readdirSync(join(dist, "assets")).filter((file) => file.endsWith(".js"));
const html = readFileSync(join(dist, "index.html"), "utf8");
const entry = assets.find((file) => html.includes(file));
assert.ok(entry, "entry chunk found");
const code = readFileSync(join(dist, "assets", entry), "utf8");
assert.ok(!code.includes("feDisplacementMap"), "the refraction engine is not in the entry chunk");
assert.ok(assets.length > 1, "liquid code is split into lazy chunks");
console.log(`vanilla-elements ok: ${assets.length} chunks, screenshots in ${outDir}`);
