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
const listbox = await load("../src/forms/internal/listbox.ts");

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

test("Banner outline appearance keeps the surface, tints the border and keeps the roles", () => {
  const soft = html.bannerSoft();
  assert.match(soft, /bg-warning-soft/);
  assert.match(soft, /data-appearance="soft"/);
  for (const [tone, role] of [
    ["info", "status"],
    ["success", "status"],
    ["warning", "status"],
    ["danger", "alert"],
  ]) {
    const markup = html.bannerOutline(tone);
    assert.match(markup, new RegExp(`role="${role}"`), tone);
    assert.match(markup, new RegExp(`border-${tone}/40`), tone);
    assert.match(markup, /bg-surface/, tone);
    assert.doesNotMatch(markup, new RegExp(`bg-${tone}-soft`), tone);
    assert.match(markup, /<svg[^>]*aria-hidden="true"/, `${tone} keeps its glyph`);
  }
});

const options = [
  { value: "a", label: "Álamo" },
  { value: "b", label: "Abeto", disabled: true },
  { value: "c", label: "Cedro" },
  { value: "d", label: "Ciprés" },
  { value: "e", label: "Cerezo", description: "Prunus", keywords: "fruta" },
];

test("listbox navigation skips disabled options and does not wrap", () => {
  assert.equal(listbox.moveActive(options, 0, "next"), 2);
  assert.equal(listbox.moveActive(options, 4, "next"), 4);
  assert.equal(listbox.moveActive(options, 2, "prev"), 0);
  assert.equal(listbox.moveActive(options, 0, "prev"), 0);
  assert.equal(listbox.moveActive(options, 3, "first"), 0);
  assert.equal(listbox.moveActive(options, 0, "last"), 4);
  assert.equal(listbox.moveActive([{ value: "x", label: "X", disabled: true }], -1, "first"), -1);
});

test("listbox typeahead matches label prefixes ignoring case and accents and cycles on a repeated key", () => {
  assert.equal(listbox.typeaheadIndex(options, "al", -1), 0);
  assert.equal(listbox.typeaheadIndex(options, "ÁL", -1), 0);
  // "ab" matches the disabled Abeto only: never reached.
  assert.equal(listbox.typeaheadIndex(options, "ab", -1), -1);
  assert.equal(listbox.typeaheadIndex(options, "c", 0), 2);
  assert.equal(listbox.typeaheadIndex(options, "c", 2), 3);
  assert.equal(listbox.typeaheadIndex(options, "c", 4), 2);
  assert.equal(listbox.typeaheadIndex(options, "cc", 2), 3);
  assert.equal(listbox.typeaheadIndex(options, "cer", 2), 4);
  assert.equal(listbox.typeaheadIndex(options, "", 0), -1);
});

test("listbox typeahead buffer resets after a pause", () => {
  let state = { buffer: "", at: 0 };
  state = listbox.nextTypeahead(state, "c", 1000);
  state = listbox.nextTypeahead(state, "e", 1200);
  assert.equal(state.buffer, "ce");
  state = listbox.nextTypeahead(state, "d", 2000);
  assert.equal(state.buffer, "d");
});

test("listbox search ignores case and accents and also reads description and keywords", () => {
  assert.ok(listbox.matchesQuery(options[0], "alamo"));
  assert.ok(listbox.matchesQuery(options[4], "PRUNUS"));
  assert.ok(listbox.matchesQuery(options[4], "fruta"));
  assert.ok(!listbox.matchesQuery(options[2], "fruta"));
  assert.ok(listbox.matchesQuery(options[2], "   "));
});

test("listbox filtering keeps groups with matches, drops empty ones and caps the count", () => {
  const items = [
    { label: "Native", options: [options[0], options[2]] },
    { label: "Other", options: [options[3], options[4]] },
    options[1],
  ];
  const onlyC = listbox.filterItems(items, (o) => o.label.startsWith("C"));
  assert.deepEqual(
    onlyC.map((i) => i.label ?? i.value),
    ["Native", "Other"],
  );
  assert.equal(listbox.flattenItems(onlyC).length, 3);
  const capped = listbox.filterItems(items, () => true, 3);
  assert.deepEqual(
    listbox.flattenItems(capped).map((o) => o.value),
    ["a", "c", "d"],
  );
  assert.equal(listbox.filterItems(items, () => false).length, 0);
});

test("SelectMenu renders a closed select-only combobox with the placeholder and a hidden form input", () => {
  const markup = html.selectMenu({ name: "tree", required: true, invalid: true });
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-haspopup="listbox"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-required="true"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /data-placeholder/);
  assert.match(markup, />Select…</);
  assert.match(markup, /<input type="hidden" name="tree" value=""/);
  assert.doesNotMatch(markup, /role="listbox"/);
});

test("SelectMenu treats an empty string as a real option and shows its label", () => {
  const markup = html.selectMenu({ value: "" });
  assert.match(markup, />Any</);
  assert.doesNotMatch(markup, /data-placeholder/);
  assert.match(html.selectMenu({ value: "cedro", name: "t" }), /value="cedro"/);
  assert.match(html.selectMenu({ value: "nope" }), /data-placeholder/);
});

test("SelectMenu follows the locale for its placeholder and honours an explicit one", () => {
  assert.match(html.selectMenuEs(), />Seleccionar…</);
  assert.match(html.selectMenu({ placeholder: "Pick one" }), />Pick one</);
});

test("SelectMenu disabled drops the hidden input from submission", () => {
  assert.match(html.selectMenu({ name: "t", disabled: true }), /<input type="hidden"[^>]*disabled=""[^>]*name="t"/);
});

test("Combobox renders a closed combobox input that shows the selected label and submits the value", () => {
  const markup = html.combobox({ defaultValue: "pino", name: "tree", required: true });
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /aria-autocomplete="list"/);
  assert.match(markup, /value="Pino"/);
  assert.match(markup, /<input type="hidden" name="tree" value="pino"/);
  assert.match(markup, /aria-label="Clear"/);
  assert.doesNotMatch(
    html.combobox({ defaultValue: "pino", clearable: false }),
    /aria-label="Clear"/,
  );
  assert.doesNotMatch(html.combobox(), /aria-label="Clear"/);
});

test("Combobox falls back to valueLabel while the value is not among the options", () => {
  assert.match(html.combobox({ value: "zzz", valueLabel: "Zelkova" }), /value="Zelkova"/);
  assert.doesNotMatch(html.combobox({ value: "zzz" }), /value="[^"]/);
});
