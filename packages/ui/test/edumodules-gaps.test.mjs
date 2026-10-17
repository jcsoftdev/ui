import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadCases } from "./components/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const tooltip = await load("../src/overlays/tooltip/model.ts");
const confirm = await load("../src/containers/confirm-action/model.ts");

const { html } = await loadCases("gaps-cases.tsx");

test("Spinner is a labelled status that follows the locale and UI string overrides", () => {
  assert.match(
    html.spinnerDefault(),
    /role="status"[^>]*aria-label="Loading"|aria-label="Loading"[^>]*role="status"/,
  );
  assert.match(html.spinnerEs(), /aria-label="Cargando"/);
  assert.match(html.spinnerOverride(), /aria-label="Un momento"/);
  assert.match(html.spinnerLabel(), /aria-label="Saving"/);
});

test("Spinner only spins when motion is allowed and can be decorative", () => {
  assert.match(html.spinnerDefault(), /motion-safe:animate-spin/);
  const decorative = html.spinnerDecorative();
  assert.match(decorative, /aria-hidden="true"/);
  assert.doesNotMatch(decorative, /role="status"|aria-label/);
});

test("Spinner named sizes use classes and numeric sizes use inline pixels", () => {
  assert.match(html.spinnerLabel(), /size-7/);
  const px = html.spinnerPixels();
  assert.match(px, /width:40px;height:40px/);
  assert.match(px, /color:red/);
  assert.doesNotMatch(px, /size-4/);
});

test("Kbd renders a kbd element and merges className", () => {
  const markup = html.kbd();
  assert.match(markup, /^<kbd /);
  assert.match(markup, /class="[^"]*extra"/);
  assert.match(markup, />⌘K<\/kbd>$/);
});

test("Tooltip opens on mouse and pen hover but never on touch", () => {
  assert.equal(tooltip.opensOnHover("mouse"), true);
  assert.equal(tooltip.opensOnHover("pen"), true);
  assert.equal(tooltip.opensOnHover("touch"), false);
});

test("Tooltip opens on keyboard focus but not on focus caused by a press", () => {
  assert.equal(tooltip.opensOnFocus({ pressed: false, focusVisible: true }), true);
  assert.equal(tooltip.opensOnFocus({ pressed: true, focusVisible: true }), false);
  assert.equal(tooltip.opensOnFocus({ pressed: false, focusVisible: false }), false);
});

test("AlertDialog confirm outcome: void and ok close, a returned error or a throw stay open", async () => {
  assert.deepEqual(await confirm.runConfirm(async () => undefined, "fallback"), { status: "done" });
  assert.deepEqual(await confirm.runConfirm(async () => ({ ok: true }), "fallback"), {
    status: "done",
  });
  assert.deepEqual(await confirm.runConfirm(async () => ({ ok: false, error: "Taken" }), "x"), {
    status: "failed",
    message: "Taken",
  });
  assert.deepEqual(
    await confirm.runConfirm(async () => {
      throw new Error("network");
    }, "Could not complete"),
    { status: "failed", message: "Could not complete" },
  );
});
