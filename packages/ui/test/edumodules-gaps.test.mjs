import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const dates = await load("../src/calendar/internal/date-utils.ts");
const picker = await load("../src/forms/date-picker/model.ts");
const listbox = await load("../src/forms/internal/listbox.ts");
const wizard = await load("../src/navigation/wizard/model.ts");
const feed = await load("../src/containers/feed/model.ts");
const due = await load("../src/atoms/due-chip/model.ts");
const stepper = await load("../src/forms/number-stepper/model.ts");

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
  assert.match(
    html.selectMenu({ name: "t", disabled: true }),
    /<input type="hidden"[^>]*disabled=""[^>]*name="t"/,
  );
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

test("Input stays a bare input without adornments and gains xs and bare", () => {
  const plain = html.input({ className: "w-48" });
  assert.match(plain, /^<input /);
  assert.match(plain, /class="[^"]*w-48/);
  assert.match(plain, /h-input/);
  assert.match(html.input({ size: "xs" }), /h-control-sm[^"]*px-2\.5/);
  const bare = html.input({ variant: "bare" });
  assert.doesNotMatch(bare, /border-control|bg-surface-control/);
  assert.match(bare, /bg-transparent/);
});

test("Input with adornments draws the field on a wrapper and moves className to it", () => {
  const markup = html.input({ start: "S/", end: "PEN", className: "w-48" });
  assert.match(
    markup,
    /^<span class="[^"]*w-48[^"]*border-control|^<span class="[^"]*border-control[^"]*w-48/,
  );
  assert.match(markup, /<span class="[^"]*text-ink-3[^"]*">S\/<\/span><input/);
  assert.match(markup, /<\/span>PEN|>PEN<\/span><\/span>$/);
  assert.doesNotMatch(markup, /<input[^>]*border-control/);
  assert.match(
    html.input({ end: "x", variant: "bare" }),
    /^<span class="[^"]*has-\[input:focus-visible\]/,
  );
});

test("Dropzone field mode makes the file input the labelled control and keeps zone mode as it was", () => {
  const zone = html.dropzone();
  assert.match(zone, /<button type="button"/);
  assert.match(zone, /aria-hidden="true"[^>]*class="hidden"|class="hidden"[^>]*aria-hidden="true"/);
  const field = html.dropzone({
    mode: "field",
    name: "docs",
    id: "docs-input",
    accept: ".pdf,image/*",
    required: true,
    "aria-label": "Docs",
  });
  assert.doesNotMatch(field, /<button/);
  assert.match(field, /<input[^>]*id="docs-input"/);
  assert.match(field, /<input[^>]*type="file"/);
  assert.match(field, /<input[^>]*name="docs"/);
  assert.match(field, /<input[^>]*accept="\.pdf,image\/\*"/);
  assert.match(field, /<input[^>]*required=""/);
  assert.match(field, /<input[^>]*aria-describedby="docs-input-title docs-input-hint"/);
  assert.match(field, /class="sr-only"/);
  assert.doesNotMatch(field, /tabindex="-1"/i);
});

test("Combobox required is aria-required by default and only native when asked", () => {
  const aria = html.combobox({ required: true });
  assert.match(aria, /aria-required="true"/);
  assert.doesNotMatch(aria, /<input[^>]*\srequired(=|\s|>)/);
  const native = html.combobox({ required: true, nativeRequired: true });
  assert.match(native, /aria-required="true"/);
  assert.match(native, /<input[^>]*\srequired=""/);
  assert.doesNotMatch(html.combobox({ nativeRequired: true }), /required|aria-required/);
});

test("Field accepts a node label and several children without cloning them", () => {
  const markup = html.fieldNodeLabel();
  assert.match(
    markup,
    /<label[^>]*for="[^"]+"[^>]*><span data-node-label="">Name <em>\*<\/em><\/span><\/label>/,
  );
  assert.match(markup, /class="contents"/);
  assert.match(markup, /data-extra=""/);
  assert.match(markup, /Shown on invoices/);
  assert.match(html.fieldNodeLabel({ controlId: "customer" }), /for="customer"/);
});

test("NumberStepper string mode keeps the caller's text, allows empty and has no value until it parses", () => {
  const empty = html.numberStepper({ mode: "string", value: "", placeholder: "0", min: 1, max: 5 });
  assert.match(empty, /value=""/);
  assert.match(empty, /placeholder="0"/);
  assert.doesNotMatch(empty, /aria-valuenow/);
  const typed = html.numberStepper({ mode: "string", value: "2,5", step: 0.5 });
  assert.match(typed, /value="2,5"/);
  assert.match(typed, /aria-valuenow="2.5"/);
  // Numeric mode is unchanged: the spinbutton always has a number.
  assert.match(html.numberStepper({ defaultValue: 4 }), /aria-valuenow="4"/);
  assert.match(html.numberStepper({ mode: "string", defaultValue: "7", id: "qty" }), /id="qty"/);
});

test("NumberStepper string stepping parses commas, snaps to the step grid and respects the limits", () => {
  const limits = { min: 0, max: 10, step: 0.5 };
  assert.equal(stepper.stepText("2,5", 1, limits), "3");
  assert.equal(stepper.stepText("2.2", 1, limits), "2.5");
  assert.equal(stepper.stepText("10", 1, limits), "10");
  assert.equal(stepper.stepText("0", -1, limits), "0");
  assert.equal(stepper.stepText("", 1, { min: 3, max: 10, step: 1 }), "3");
  assert.equal(stepper.stepText("", 1, { min: Number.NEGATIVE_INFINITY, max: 10, step: 2 }), "2");
  assert.equal(
    stepper.stepText("-", -1, { min: Number.NEGATIVE_INFINITY, max: 10, step: 2 }),
    "-2",
  );
  assert.equal(stepper.canStep("10", 1, limits), false);
  assert.equal(stepper.canStep("", 1, limits), true);
  assert.equal(stepper.canStep("0", -1, limits), false);
  assert.ok(Number.isNaN(stepper.parseNumber("1.")) === false);
  assert.ok(Number.isNaN(stepper.parseNumber("")));
});

test("Combobox falls back to valueLabel while the value is not among the options", () => {
  assert.match(html.combobox({ value: "zzz", valueLabel: "Zelkova" }), /value="Zelkova"/);
  assert.doesNotMatch(html.combobox({ value: "zzz" }), /value="[^"]/);
});

const ES = picker.dateFormatFor("es-PE");
const EN = picker.dateFormatFor("en-US");

test("typed date format follows the locale: es-PE day first, en-US month first, sv-SE year first", () => {
  assert.deepEqual(ES, { order: ["day", "month", "year"], separator: "/" });
  assert.deepEqual(EN.order, ["month", "day", "year"]);
  assert.deepEqual(picker.dateFormatFor("sv-SE").order, ["year", "month", "day"]);
  assert.equal(picker.formatDisplay("2026-09-07", ES), "07/09/2026");
  assert.equal(picker.formatDisplay("2026-09-07", EN), "09/07/2026");
  assert.equal(picker.formatDisplay("2026-02-30", ES), "");
  assert.equal(picker.formatDisplay("", ES), "");
  assert.equal(
    picker.displayPlaceholder(ES, { day: "dd", month: "mm", year: "aaaa" }),
    "dd/mm/aaaa",
  );
});

test("typed dates are masked per locale and only real dates parse", () => {
  assert.equal(picker.maskDisplay("7", ES), "7");
  assert.equal(picker.maskDisplay("0709", ES), "07/09");
  assert.equal(picker.maskDisplay("07", ES), "07");
  assert.equal(picker.maskDisplay("07/09/2026x99", ES), "07/09/2026");
  assert.equal(picker.maskDisplay("20260907", picker.dateFormatFor("sv-SE")), "2026-09-07");
  assert.equal(picker.parseDisplay("07/09/2026", ES), "2026-09-07");
  assert.equal(picker.parseDisplay("7/9/2026", ES), "2026-09-07");
  assert.equal(picker.parseDisplay("09/07/2026", EN), "2026-09-07");
  assert.equal(picker.parseDisplay("31/02/2026", ES), null);
  assert.equal(picker.parseDisplay("29/02/2028", ES), "2028-02-29");
  assert.equal(picker.parseDisplay("29/02/2026", ES), null);
  assert.equal(picker.parseDisplay("07/09/26", ES), null);
  assert.equal(picker.parseDisplay("07/09", ES), null);
});

test("date-time values are zone-less wall-clock strings and anything else is rejected", () => {
  assert.deepEqual(picker.splitDateTime("2026-09-07T09:30"), { date: "2026-09-07", time: "09:30" });
  for (const bad of [
    "2026-09-07T09:30Z",
    "2026-09-07T09:30:00",
    "2026-09-07T09:30-05:00",
    "2026-09-07 09:30",
    "2026-09-07T24:00",
    "2026-02-30T09:30",
    "",
  ]) {
    assert.equal(picker.splitDateTime(bad), null, bad);
  }
  assert.equal(picker.joinDateTime({ date: "2026-09-07", time: "09:30" }), "2026-09-07T09:30");
  assert.equal(picker.joinDateTime({ date: "2026-09-07", time: "" }), "");
});

test("date-time min and max accept a whole day or an exact moment", () => {
  const inRange = picker.dateTimeInRange;
  assert.ok(inRange("2026-09-05T08:00", "2026-09-05T08:00"));
  assert.ok(!inRange("2026-09-05T07:59", "2026-09-05T08:00"));
  assert.ok(inRange("2026-09-05T00:00", "2026-09-05"));
  assert.ok(inRange("2026-09-25T23:59", undefined, "2026-09-25"));
  assert.ok(!inRange("2026-09-26T00:00", undefined, "2026-09-25"));
  assert.ok(!inRange("2026-09-25T10:01", undefined, "2026-09-25T10:00"));
});

test("calendar date helpers validate, clamp month ends and start the week by locale", () => {
  assert.ok(dates.isIsoDate("2026-09-07"));
  assert.ok(!dates.isIsoDate("2026-9-7"));
  assert.ok(!dates.isIsoDate("2026-02-29"));
  assert.equal(dates.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(dates.addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(dates.addMonths("2026-03-15", -3), "2025-12-15");
  assert.equal(dates.clampDate("2026-01-01", "2026-02-01", "2026-03-01"), "2026-02-01");
  assert.equal(dates.clampDate("2026-05-01", "2026-02-01", "2026-03-01"), "2026-03-01");
  assert.equal(dates.weekStartFor("es-PE"), 1);
  assert.equal(dates.weekStartFor("en-GB"), 1);
  assert.equal(dates.weekStartFor("en-US"), 0);
  assert.equal(dates.weekStartFor("es-MX"), 0);
  assert.equal(dates.weekStartFor("es"), 1);
  const weeks = dates.monthWeeks("2026-09-15", 1);
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0][0], "2026-08-31");
  assert.equal(dates.monthWeeks("2026-09-15", 0)[0][0], "2026-08-30");
  assert.deepEqual(dates.weekdayNames("es-PE", 1).map((d) => d.long)[0], "lunes");
});

test("dates never shift with the time zone", () => {
  const files = [
    join(here, "../src/calendar/internal/date-utils.ts"),
    join(here, "../src/forms/date-picker/model.ts"),
  ];
  const bundleOf = async (file, name) => {
    const out = await build({
      entryPoints: [file],
      bundle: true,
      format: "esm",
      platform: "neutral",
      write: false,
    });
    return `const ${name} = await import("data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString("base64")}");`;
  };
  return Promise.all([bundleOf(files[0], "d"), bundleOf(files[1], "p")]).then(([d, p]) => {
    const code = `${d}\n${p}\nconsole.log(JSON.stringify({
      plus: d.addDays("2026-03-08", 1),
      minus: d.addDays("2026-11-01", -1),
      month: d.addMonths("2026-10-31", 4),
      first: d.monthWeeks("2026-09-15", 1)[0][0],
      title: d.formatMonthTitle("2026-09-07", "es-PE"),
      full: d.formatFullDate("2026-09-07", "en-US"),
      today: d.todayIso(new Date(2026, 8, 7, 23, 59)),
      early: d.todayIso(new Date(2026, 8, 7, 0, 1)),
      typed: p.parseDisplay("07/09/2026", p.dateFormatFor("es-PE")),
      shown: p.formatDisplay("2026-09-07", p.dateFormatFor("es-PE")),
      pair: p.splitDateTime("2026-09-07T09:30"),
    }));`;
    const run = (tz) =>
      execFileSync(process.execPath, ["--input-type=module", "-e", code], {
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
      });
    const baseline = run("UTC");
    assert.equal(JSON.parse(baseline).today, "2026-09-07");
    assert.equal(JSON.parse(baseline).early, "2026-09-07");
    assert.equal(JSON.parse(baseline).typed, "2026-09-07");
    for (const tz of [
      "America/Lima",
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
      "Asia/Kolkata",
      "America/Sao_Paulo",
    ]) {
      assert.equal(run(tz), baseline, tz);
    }
  });
});

test("DatePicker renders the ISO value in the locale's order with a calendar button and hidden input", () => {
  const es = html.datePickerEs({ defaultValue: "2026-09-07", name: "start" });
  assert.match(es, /value="07\/09\/2026"/);
  assert.match(es, /aria-label="Abrir calendario"/);
  assert.match(es, /aria-label="Limpiar"/);
  assert.match(es, /<input type="hidden" name="start" value="2026-09-07"/);
  assert.match(es, /inputMode="numeric"/);
  assert.match(html.datePicker({ defaultValue: "2026-09-07" }), /value="09\/07\/2026"/);
  assert.match(html.datePickerEs(), /placeholder="dd\/mm\/aaaa"/);
  assert.doesNotMatch(html.datePickerEs(), /aria-label="Limpiar"/);
  assert.match(html.datePicker({ defaultValue: "garbage" }), /value=""/);
  assert.match(html.datePicker({ invalid: true }), /aria-invalid="true"/);
  assert.doesNotMatch(
    html.datePicker({ defaultValue: "2026-09-07", clearable: false }),
    /aria-label="Clear"/,
  );
});

test("date pickers and the calendar follow the provider locale, even through a partial nested value", () => {
  const nested = html.datePickerPartialEs({ defaultValue: "2026-09-07" });
  assert.match(nested, /value="07\/09\/2026"/);
  assert.match(nested, /placeholder="dd\/mm\/aaaa"/);
  assert.match(nested, /aria-label="Abrir calendario"/);
  const en = html.dateCalendar();
  const es = html.dateCalendarEs();
  assert.match(en, /September 2026/);
  assert.match(es, /septiembre de 2026|setiembre de 2026/);
  // Monday first in es-PE, Sunday first in en-US.
  assert.ok(en.indexOf("Sun") < en.indexOf("Mon"));
  assert.ok(es.indexOf("lun") < es.indexOf("dom"));
});

test("the strings context is registered once per page, so a second module copy reuses it", async () => {
  const key = Symbol.for("@jcsoftdev/ui/i18n/strings");
  await load("../src/i18n/index.ts");
  const first = globalThis[key];
  assert.ok(first, "context is registered on globalThis");
  await load("../src/i18n/index.ts");
  assert.equal(globalThis[key], first);
});

test("DateTimePicker splits a zone-less value into date and time and keeps it for forms", () => {
  const markup = html.dateTimePicker({ defaultValue: "2026-09-07T09:30", name: "when" });
  assert.match(markup, /value="09\/07\/2026"/);
  assert.match(markup, /value="09:30"/);
  assert.match(markup, /<input type="hidden" name="when" value="2026-09-07T09:30"/);
  const zoned = html.dateTimePicker({ defaultValue: "2026-09-07T09:30:00Z" });
  assert.doesNotMatch(zoned, /value="09:30"/);
  assert.match(zoned, /aria-label="Time"/);
});

test("wizard gates run in order, stop at the first block and treat a throw as blocked", async () => {
  const calls = [];
  const ok = await wizard.evaluateGates([
    undefined,
    true,
    async () => {
      calls.push("a");
      return true;
    },
  ]);
  assert.deepEqual(ok, { ok: true, failed: false });
  const blocked = await wizard.evaluateGates([
    () => false,
    () => {
      calls.push("never");
      return true;
    },
  ]);
  assert.deepEqual(blocked, { ok: false, failed: false });
  const thrown = await wizard.evaluateGates([
    async () => {
      throw new Error("x");
    },
  ]);
  assert.deepEqual(thrown, { ok: false, failed: true });
  assert.deepEqual(calls, ["a"]);
});

test("wizard step helpers clamp the index, fill the announcement and pick the Enter key", () => {
  assert.equal(wizard.clampIndex(-1, 3), 0);
  assert.equal(wizard.clampIndex(9, 3), 2);
  assert.equal(wizard.clampIndex(Number.NaN, 3), 0);
  assert.equal(wizard.clampIndex(1, 0), 0);
  assert.equal(
    wizard.formatStepOf("Paso {current} de {total}: {label}", {
      current: 2,
      total: 4,
      label: "Pago",
    }),
    "Paso 2 de 4: Pago",
  );
  const key = (over = {}) => ({
    key: "Enter",
    defaultPrevented: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: "INPUT", type: "text" },
    ...over,
  });
  assert.equal(wizard.isAdvanceKey(key()), true);
  assert.equal(wizard.isAdvanceKey(key({ target: { tagName: "TEXTAREA" } })), false);
  assert.equal(wizard.isAdvanceKey(key({ target: { tagName: "INPUT", type: "checkbox" } })), false);
  assert.equal(wizard.isAdvanceKey(key({ target: { tagName: "BUTTON" } })), false);
  assert.equal(wizard.isAdvanceKey(key({ nativeEvent: { isComposing: true } })), false);
  assert.equal(wizard.isAdvanceKey(key({ shiftKey: true })), false);
  assert.equal(wizard.isAdvanceKey(key({ key: "a" })), false);
});

test("Wizard renders the first step with Back disabled, the step announcement and localized labels", () => {
  const markup = html.wizard();
  assert.match(markup, /Step 1 of 2: Alpha/);
  assert.match(markup, /aria-current="step"/);
  assert.match(markup, /first/);
  assert.doesNotMatch(markup, /second/);
  assert.match(markup, /<button[^>]*disabled[^>]*>(?:<span[^>]*>)?Back/);
  assert.match(markup, /Next/);
  assert.match(html.wizard({ defaultValue: "b" }), /Finish/);
  const es = html.wizardEs();
  assert.match(es, /Paso 1 de 2: Alfa/);
  assert.match(es, /Siguiente/);
  assert.match(es, /Atr\u00e1s/);
});

test("Wizard uses container queries only", () => {
  assert.doesNotMatch(html.wizard(), /class="[^"]*\b(?:sm|md|lg|xl):/);
  assert.match(html.wizard(), /@container\/wizard/);
});

test("Section is named by its title, steps headings down per nesting level and never pads inline edges", () => {
  const markup = html.section();
  const id = /<section[^>]*aria-labelledby="([^"]+)"/.exec(markup)?.[1];
  assert.ok(id);
  assert.match(markup, new RegExp(`<h2 id="${id.replace(/:/g, ":")}"[^>]*>Outer</h2>`));
  assert.match(markup, /<h3 [^>]*>Inner<\/h3>/);
  assert.match(markup, /data-depth="1"/);
  assert.match(markup, /border-t-divider/);
  assert.doesNotMatch(markup, /\bpx-|\bp-\d|\bpl-|\bpr-/);
  assert.match(markup, /@max-\[560px\]\/section/);
  assert.doesNotMatch(html.section({ as: "div" }), /<div[^>]*aria-labelledby/);
  assert.match(html.section({ titleAs: "h4" }), /<h4 [^>]*>Outer<\/h4>/);
});

test("Note is flush, tone only recolors and the divider is opt-in", () => {
  const plain = html.note();
  assert.match(plain, /^<p /);
  assert.doesNotMatch(plain, /border-t-divider|\bpx-/);
  assert.match(html.note({ tone: "danger" }), /text-danger/);
  assert.match(html.note({ divider: true }), /border-t-divider/);
});

test("Aside is a labelled complementary landmark that follows the locale", () => {
  assert.match(html.aside(), /<aside[^>]*aria-label="Related information"/);
  assert.match(html.asideEs(), /aria-label="Informaci\u00f3n relacionada"/);
  assert.doesNotMatch(html.aside(), /\bpx-/);
});

test("DescriptionList fills empty values with a placeholder, keeps 0 and picks layout classes", () => {
  const markup = html.descriptionList();
  assert.match(
    markup,
    /<dd data-empty=""[^>]*><span aria-hidden="true">\u2014<\/span><span class="sr-only">None<\/span>/,
  );
  assert.match(markup, /<dd>0<\/dd>|<dd[^>]*>0<\/dd>/);
  assert.equal(markup.split("data-empty").length - 1, 1);
  assert.match(markup, /@max-sm\/dl:grid-cols-1/);
  assert.doesNotMatch(html.descriptionList({ layout: "inline" }), /@max-sm\/dl:grid-cols-1/);
  assert.match(html.descriptionList({ layout: "stacked" }), /grid-cols-1/);
  assert.match(
    html.descriptionList({ columns: 2 }),
    /@md\/dl:grid-cols-\[auto_minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/,
  );
  assert.match(html.descriptionList({ valueAlign: "start" }), /\[&amp;_dd\]:text-start/);
});

async function inZones(file, expression, zones) {
  const out = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  const code = `const m = await import("data:text/javascript;base64,${Buffer.from(out.outputFiles[0].contents).toString("base64")}");\nconsole.log(JSON.stringify(${expression}));`;
  const results = zones.map((tz) =>
    execFileSync(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    }),
  );
  return results;
}

const zones = ["UTC", "America/Lima", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Asia/Kolkata"];

test("feed time formats calendar dates in UTC so they never shift, in every zone", async () => {
  const results = await inZones(
    "../src/containers/feed/model.ts",
    `[m.formatFeedTime("2026-03-03", { locale: "en-US" }), m.formatFeedTime("2026-03-03", { locale: "es-PE", timeZone: "Pacific/Kiritimati" }), m.isCalendarDate("2026-02-30")]`,
    zones,
  );
  for (const result of results) assert.equal(result, results[0]);
  assert.deepEqual(JSON.parse(results[0]), ["Mar 3, 2026", "3 mar. 2026", false]);
});

test("feed time shows an instant in the requested zone and falls back to the raw text when invalid", () => {
  const instant = "2026-03-04T03:30:00Z";
  assert.match(
    feed.formatFeedTime(instant, { locale: "en-US", timeZone: "UTC" }),
    /Mar 4, 2026.*3:30/,
  );
  assert.match(
    feed.formatFeedTime(instant, { locale: "en-US", timeZone: "America/Lima" }),
    /Mar 3, 2026.*10:30/,
  );
  assert.equal(feed.formatFeedTime("garbage"), "garbage");
  assert.equal(
    feed.toDateTimeAttribute(new Date("2026-03-04T03:30:00Z")),
    "2026-03-04T03:30:00.000Z",
  );
  assert.equal(feed.toDateTimeAttribute("2026-03-03"), "2026-03-03");
});

test("feed relative time reads seconds, minutes, hours and days from the reference and then goes absolute", () => {
  const now = "2026-03-04T15:30:00Z";
  const rel = (value, locale = "en-US") =>
    feed.formatFeedTime(value, { locale, relative: true, now, timeZone: "UTC" });
  assert.equal(rel("2026-03-04T15:30:00Z"), "now");
  assert.equal(rel("2026-03-04T15:25:00Z"), "5 minutes ago");
  assert.equal(rel("2026-03-04T12:30:00Z"), "3 hours ago");
  assert.equal(rel("2026-03-03T15:30:00Z"), "yesterday");
  assert.equal(rel("2026-03-04T15:35:00Z"), "in 5 minutes");
  assert.equal(rel("2026-03-04T15:25:00Z", "es-PE"), "hace 5 minutos");
  assert.match(rel("2026-02-01T15:30:00Z"), /Feb 1, 2026/);
});

test("Feed renders time elements with machine values, a localized label and no inline padding", () => {
  const markup = html.feed();
  assert.match(markup, /<time dateTime="2026-03-04T15:30:00Z"[^>]*>Mar 4, 2026/);
  assert.match(markup, /<time dateTime="2026-03-03"[^>]*>Mar 3, 2026<\/time>/);
  assert.match(markup, /Ana/);
  assert.equal(markup.split("<time").length - 1, 2);
  assert.match(html.feedEs(), /<time dateTime="2026-03-03"[^>]*>3 mar\.? 2026<\/time>/);
  assert.doesNotMatch(markup, /\bpx-|\bpl-|\bpr-/);
});

test("Shortcuts items are links, buttons or a slotted child with icon, count and key hint", () => {
  const markup = html.shortcuts();
  assert.match(markup, /^<ul /);
  assert.match(markup, /<li><a href="#a"[^>]*>.*Alpha.*<kbd[^>]*>G A<\/kbd>/);
  assert.match(markup, /<li><button type="button"[^>]*>.*Action/);
  assert.match(markup, /<li><a [^>]*href="\/r"[^>]*data-router=""[^>]*>.*Routed.*<kbd[^>]*>G R/);
  assert.equal(markup.split("<a ").length - 1, 2);
  assert.doesNotMatch(markup, /\bpx-3|\bpl-/);
});

test("ListDetail collapses with container queries only and names its list", () => {
  const markup = html.listDetail();
  assert.match(markup, /@container\/list-detail/);
  assert.match(markup, /@min-\[641px\]\/list-detail:grid-cols-2/);
  assert.match(markup, /group-data-\[view=detail\]\/ld:@max-\[640px\]\/list-detail:hidden/);
  assert.match(markup, /group-data-\[view=list\]\/ld:@max-\[640px\]\/list-detail:hidden/);
  assert.match(markup, /<ul[^>]*aria-label="Students"/);
  assert.match(markup, /data-view="list"/);
  assert.match(
    html.listDetail({ defaultValue: "a" }),
    /data-view="detail"[^>]*>.*aria-current="true"/,
  );
  assert.match(html.listDetail({ defaultValue: "a" }), /Back to list/);
  assert.doesNotMatch(markup, /class="[^"]*\b(?:sm|md|lg|xl):/);
});

test("due state is overdue before the reference day, soon through the window, ok beyond", () => {
  const at = (value, options) => due.dueStatus(value, { today: "2026-03-04", ...options });
  assert.deepEqual(at("2026-03-03"), { state: "overdue", days: -1 });
  assert.deepEqual(at("2026-03-04"), { state: "soon", days: 0 });
  assert.deepEqual(at("2026-03-07"), { state: "soon", days: 3 });
  assert.deepEqual(at("2026-03-08"), { state: "ok", days: 4 });
  assert.deepEqual(at("2026-03-08", { soonDays: 5 }), { state: "soon", days: 4 });
  assert.deepEqual(at("2026-03-04", { soonDays: 0 }), { state: "soon", days: 0 });
  assert.deepEqual(at("2026-03-05", { soonDays: 0 }), { state: "ok", days: 1 });
  assert.equal(at("2026-02-30"), null);
  assert.equal(at("soon"), null);
  assert.equal(due.dueStatus("2026-03-04", { today: "nope" }), null);
});

test("due math crosses month, year and leap-day boundaries by calendar day", () => {
  assert.equal(due.daysBetween("2026-02-28", "2026-03-01"), 1);
  assert.equal(due.daysBetween("2028-02-28", "2028-03-01"), 2);
  assert.equal(due.daysBetween("2026-12-31", "2027-01-01"), 1);
  assert.equal(due.daysBetween("2026-03-08", "2026-03-09"), 1);
  assert.equal(due.daysBetween("2026-11-01", "2026-11-02"), 1);
});

test("due reads dates and naive date-times as written and an instant on the viewer's day, in every zone", async () => {
  const results = await inZones(
    "../src/atoms/due-chip/model.ts",
    `[m.dueCalendarDate("2026-03-04"), m.dueCalendarDate("2026-03-04T23:59"), m.dueCalendarDate("2026-03-04T00:01:30"), m.dueStatus("2026-03-04T23:59", { today: "2026-03-04" }).state, m.formatDueDay("2026-03-04", "2026-01-01", "en-US")]`,
    zones,
  );
  for (const result of results) assert.equal(result, results[0]);
  assert.deepEqual(JSON.parse(results[0]), [
    "2026-03-04",
    "2026-03-04",
    "2026-03-04",
    "soon",
    "Mar 4",
  ]);

  const instants = await inZones(
    "../src/atoms/due-chip/model.ts",
    `m.dueCalendarDate("2026-03-04T02:00:00Z")`,
    ["UTC", "America/Lima", "Pacific/Kiritimati"],
  );
  assert.deepEqual(
    instants.map((r) => JSON.parse(r)),
    ["2026-03-04", "2026-03-03", "2026-03-04"],
  );
});

test("due day labels add the year only outside the reference year", () => {
  assert.equal(due.formatDueDay("2026-03-04", "2026-01-01", "en-US"), "Mar 4");
  assert.equal(due.formatDueDay("2027-01-05", "2026-12-31", "en-US"), "Jan 5, 2027");
});

test("DueChip carries its state as tone, glyph and screen-reader text, and a machine date", () => {
  const ok = html.dueChip();
  assert.match(ok, /data-state="ok"/);
  assert.match(ok, /<time dateTime="2026-03-20">Mar 20<\/time>/);
  assert.doesNotMatch(ok, /sr-only/);
  const overdue = html.dueChip({ date: "2026-03-01" });
  assert.match(overdue, /data-state="overdue"/);
  assert.match(overdue, /bg-danger-soft/);
  assert.match(overdue, /<svg/);
  assert.match(overdue, /<span class="sr-only">, Overdue<\/span>/);
  const soon = html.dueChip({ date: "2026-03-06" });
  assert.match(soon, /bg-warning-soft/);
  assert.match(soon, /, Due soon/);
  const done = html.dueChip({ date: "2026-03-01", done: true });
  assert.match(done, /data-state="done"/);
  assert.doesNotMatch(done, /Overdue|bg-danger-soft/);
  assert.match(html.dueChipEs(), /, Vencido/);
  assert.doesNotMatch(html.dueChip({ date: "someday" }), /<time/);
  assert.match(html.dueChip({ date: "someday" }), /someday/);
});

test("Seal is plain content unless labelled, then a named group, with a tone frame", () => {
  const plain = html.seal();
  assert.doesNotMatch(plain, /role=|aria-label/);
  assert.match(plain, /border-accent-ink/);
  assert.match(plain, />Receipt</);
  const labelled = html.seal({ label: "Verified", tone: "danger" });
  assert.match(labelled, /role="group"/);
  assert.match(labelled, /aria-label="Verified"/);
  assert.match(labelled, /border-danger/);
  assert.match(labelled, /data-tone="danger"/);
});

test("ChipGroup renders toggle buttons in a named fieldset with hidden inputs for the selection", () => {
  const markup = html.chipGroup({ defaultValue: ["m"], name: "subjects" });
  assert.match(markup, /^<fieldset[^>]*aria-label="Subjects"/);
  assert.match(markup, /data-type="multiple"/);
  assert.match(
    markup,
    /aria-pressed="true"[^>]*>(?:<svg[\s\S]*?<\/svg>)?<span class="min-w-0">Math/,
  );
  assert.match(markup, /aria-pressed="false"[^>]*>(?:<span[^>]*>)?Art/);
  assert.match(markup, /<button[^>]*disabled[^>]*>.*PE/);
  assert.match(markup, /<input type="hidden" name="subjects" value="m"\/>/);
  assert.equal(markup.split('type="hidden"').length - 1, 1);
  assert.doesNotMatch(html.chipGroup(), /type="hidden"/);
  assert.match(html.chipGroup({ type: "single", defaultValue: "a" }), /data-type="single"/);
  assert.doesNotMatch(html.chipGroup({ type: "single", defaultValue: "a" }), /<svg/);
});

test("ChipGroup takes its id and description from Field and flags invalid without aria-invalid", () => {
  const markup = html.chipGroupInField();
  const id = /<label[^>]*for="([^"]+)"/.exec(markup)?.[1];
  assert.ok(id);
  assert.match(markup, new RegExp(`<fieldset[^>]*id="${id}"`));
  assert.match(markup, /aria-describedby="[^"]*-hint [^"]*-error"/);
  assert.match(markup, /data-invalid=""/);
  assert.doesNotMatch(markup.slice(markup.indexOf("<fieldset")), /^<fieldset[^>]*aria-invalid/);
});

test("TabsNav is a labelled navigation of real links with aria-current on the current page", () => {
  const markup = html.tabsNav();
  assert.match(markup, /^<nav[^>]*aria-label="Sections"/);
  assert.doesNotMatch(markup, /role="tab/);
  assert.match(markup, /<a [^>]*href="\/b"[^>]*aria-current="page"[^>]*>.*Beta.*3/);
  assert.equal(markup.split('aria-current="page"').length - 1, 1);
  assert.match(markup, /<a [^>]*href="\/c"[^>]*data-router=""[^>]*>Gamma<\/a>/);
  assert.equal(markup.split("<a ").length - 1, 3);
  assert.doesNotMatch(markup, /<nav[^>]*class="[^"]*\bpx-/);
  assert.match(markup, /@max-\[420px\]\/tabs-nav/);
});

test("IconButton is a square Button named by its required label", () => {
  const markup = html.iconButton();
  assert.match(markup, /^<button /);
  assert.match(markup, /aria-label="Delete row"/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /w-control/);
  assert.match(markup, /h-control/);
  assert.match(markup, /px-0/);
  assert.doesNotMatch(markup, /px-control-x/);
  assert.match(html.iconButton({ size: "sm" }), /w-control-sm/);
  assert.match(html.iconButton({ size: "lg" }), /w-control-lg/);
});

test("IconButton takes the Button variants and merges className", () => {
  assert.match(html.iconButton({ variant: "primary" }), /bg-accent/);
  assert.match(html.iconButton({ variant: "danger" }), /bg-danger-soft/);
  assert.match(
    html.iconButton({ variant: "ghost", className: "extra" }),
    /bg-transparent[^"]*extra|extra/,
  );
});

test("IconButton loading swaps the icon for a spinner and announces the localized string", () => {
  const markup = html.iconButtonEs();
  assert.doesNotMatch(markup, /data-icon/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /role="status"[^>]*>Cargando/);
  assert.match(html.iconButton(), /data-icon/);
});

test("Chip size sm is the compact tag: grows with content, tabular numerals, keeps square", () => {
  const tag = html.chipTag();
  assert.match(tag, /min-h-5/);
  assert.match(tag, /tabular-nums/);
  assert.match(tag, /rounded-chip/);
  assert.match(tag, /bg-surface-2/);
  assert.doesNotMatch(tag, /\bh-6\b/);
  const plain = html.chipDefault();
  assert.match(plain, /\bh-6\b/);
  assert.doesNotMatch(plain, /min-h-5|tabular-nums/);
});

test("RadioGroup names every radio from its label and links the description", () => {
  const markup = html.radioGroup();
  const radios = [...markup.matchAll(/<button[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
  assert.equal(radios.length, 2);
  for (const radio of radios) {
    const labelledby = radio.match(/aria-labelledby="([^"]+)"/)?.[1];
    assert.ok(labelledby, "radio has aria-labelledby");
    assert.match(markup, new RegExp(`<b id="${labelledby}"`));
  }
  assert.match(radios[0], /aria-describedby="[^"]+-description"/);
  assert.doesNotMatch(radios[1], /aria-describedby/);
});

test("Skeleton list, kpis and key-value render N decorative items in one labelled status", () => {
  for (const variant of ["list", "kpis", "key-value"]) {
    const markup = html.skeleton({ variant, count: 3 });
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1, variant);
    assert.match(markup, /aria-label="Loading"/);
    assert.ok((markup.match(/aria-hidden="true"/g) ?? []).length >= 6, variant);
  }
  assert.equal((html.skeleton({ variant: "list", count: 3 }).match(/min-h-11/g) ?? []).length, 3);
  assert.equal(
    (html.skeleton({ variant: "kpis", count: 5 }).match(/rounded-card/g) ?? []).length,
    5,
  );
  assert.equal(
    (html.skeleton({ variant: "key-value", count: 2 }).match(/contents/g) ?? []).length,
    2,
  );
});

test("Skeleton variants never pad the inline edges and the list rows grow under touch", () => {
  for (const variant of ["list", "key-value", "bar", "lines", "table", "card"]) {
    assert.doesNotMatch(html.skeleton({ variant }), /(?:^|[\s"])(?:px|ps|pe|pl|pr)-\d/, variant);
  }
  // KPI cards pad their own content; the grid and the status root stay flush.
  const kpis = html.skeleton({ variant: "kpis", count: 3 });
  assert.equal((kpis.match(/(?:^|[\s"])px-4/g) ?? []).length, 3);
  assert.match(html.skeleton({ variant: "list" }), /in-data-\[density=touch\]:min-h-14/);
});

test("Skeleton bar is one block sized by className and the label follows the locale", () => {
  const bar = html.skeleton({ variant: "bar", className: "h-8 w-32" });
  assert.match(bar, /role="status"/);
  assert.match(bar, /h-8/);
  assert.match(bar, /w-32/);
  assert.doesNotMatch(bar, /h-3\b|w-full/);
  assert.doesNotMatch(bar, /<div[^>]*>.*<div/);
  assert.match(html.skeletonEs(), /aria-label="Cargando"/);
});

test("ErrorState actions render under the message, beside the retry button, and stay optional", () => {
  const both = html.errorActions({ onRetry: () => {} });
  assert.match(both, /Retry<\/button><a /);
  assert.match(both, /data-act/);
  assert.match(html.errorActions(), /<a href="\/home"/);
  assert.doesNotMatch(html.errorActions(), /<button/);
  const none = html.errorActions({ actions: undefined });
  assert.doesNotMatch(none, /flex-wrap/);
  const raw = html.errorActions({ actions: new Error("boom") });
  assert.doesNotMatch(raw, /boom|flex-wrap/);
});

test("DueChip state forces the look whatever the date says, and wins over done", () => {
  const hot = html.dueChip({ date: "2026-03-20", state: "overdue" });
  assert.match(hot, /data-state="overdue"/);
  assert.match(hot, /bg-danger-soft/);
  assert.match(hot, /, Overdue/);
  assert.match(html.dueChip({ date: "2026-03-01", state: "ok" }), /data-state="ok"/);
  assert.match(html.dueChip({ date: "2026-03-01", state: "done" }), /data-state="done"/);
  const forcedOverDone = html.dueChip({ date: "2026-03-20", done: true, state: "soon" });
  assert.match(forcedOverDone, /data-state="soon"/);
  assert.match(forcedOverDone, /, Due soon/);
});

test("Seal has an institutional strong-neutral tone and takes a tonePalettes tone by name", () => {
  const institutional = html.seal({ tone: "institutional" });
  assert.match(institutional, /border-ink\b/);
  assert.match(institutional, /data-tone="institutional"/);
  assert.doesNotMatch(institutional, /border-accent-ink/);
  const custom = html.seal({ tone: "ministry" });
  assert.match(custom, /border-\(--tone-c\)/);
  assert.match(custom, /--tone-c:var\(--tone-ministry\)/);
  assert.match(html.seal({ tone: "neutral" }), /border-line-strong/);
});

test("Stepper steps carry a status: done and error get a glyph and a spoken state, the rest stay numbered", () => {
  const steps = [
    { id: "a", label: "Data", status: "done" },
    { id: "b", label: "Docs" },
    { id: "c", label: "Pay", status: "error" },
    { id: "d", label: "Review" },
  ];
  const markup = html.stepper(steps);
  assert.match(markup, /data-status="done"/);
  assert.match(markup, /data-status="current"/);
  assert.match(markup, /data-status="error"/);
  assert.match(markup, /data-status="pending"/);
  assert.match(markup, /, Completed/);
  assert.match(markup, /, Has an error/);
  assert.equal((markup.match(/aria-current="step"/g) ?? []).length, 1);
  assert.match(markup, />2<\/span>/);
  assert.match(markup, /bg-success-soft/);
  assert.match(markup, /bg-danger-soft/);
  assert.match(html.stepper(steps, "b", "es"), /, Completado/);
  const plain = html.stepper(
    [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    "a",
  );
  assert.doesNotMatch(plain, /sr-only">,/);
  assert.match(plain, /data-status="current"/);
});
