import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("cases.tsx");

test("Field wires hint and error to the control and marks optional fields", () => {
  const plain = html.fieldPlain();
  assert.doesNotMatch(plain, /optional/);
  assert.match(plain, /<label[^>]*for="([^"]+)"/);

  const optional = html.fieldOptional();
  assert.match(optional, /Phone<span[^>]*> \(optional\)<\/span>/);
  assert.match(optional, /id="phone"/);
  assert.match(optional, /aria-describedby="phone-hint"/);
  assert.doesNotMatch(optional, /role="alert"/);
  assert.doesNotMatch(optional, /aria-invalid/);

  const failing = html.fieldError();
  assert.match(failing, /aria-invalid="true"/);
  assert.match(failing, /aria-describedby="phone-error"/);
  assert.match(failing, /id="phone-error"[^>]*role="alert"|role="alert"[^>]*id="phone-error"/);
});

test("the optional marker follows the active locale", () => {
  assert.match(html.fieldOptionalEs(), /\(opcional\)/);
});

test("Banner shows a status glyph per tone and only danger is an assertive alert", () => {
  const roles = { info: "status", success: "status", warning: "status", danger: "alert" };
  for (const [tone, role] of Object.entries(roles)) {
    const markup = html.bannerTone(tone);
    assert.match(markup, new RegExp(`role="${role}"`), tone);
    assert.match(markup, /<svg[^>]*aria-hidden="true"/, `${tone} has a default icon`);
  }
});

test("Banner title, hidden icon and custom icon", () => {
  assert.match(html.bannerTitle(), /<p class="font-semibold">Payment failed<\/p>Try another card/);
  assert.doesNotMatch(html.bannerNoIcon(), /<svg/);
  const custom = html.bannerCustomIcon();
  assert.match(custom, /data-custom/);
  assert.doesNotMatch(custom, /<svg/);
});

test("Chip adds a status glyph only for status tones and an explicit icon wins", () => {
  for (const tone of ["info", "success", "warning", "danger"]) {
    assert.match(html.chipStatus(tone), /<svg/, tone);
  }
  assert.doesNotMatch(html.chipStatus("neutral"), /<svg/);
  assert.doesNotMatch(html.chipStatic(), /<svg/);
  const custom = html.chipIcon();
  assert.match(custom, /data-custom/);
  assert.doesNotMatch(custom, /<svg/);
});

test("Button loadingLabel replaces the label and is announced; plain buttons render as before", () => {
  const loading = html.buttonLoading();
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /disabled/);
  assert.match(loading, /Saving…/);
  assert.doesNotMatch(loading, />Save</);
  assert.match(loading, /<span role="status" class="sr-only">Saving…<\/span>$/);

  const idle = html.buttonIdle();
  assert.match(idle, />Save</);
  assert.match(idle, /<span role="status" class="sr-only"><\/span>$/);

  assert.doesNotMatch(html.buttonPlain(), /role="status"/);
});

test("Button block and lg sizes", () => {
  const markup = html.buttonLayout();
  assert.match(markup, /h-control-lg/);
  assert.match(markup, /\bflex w-full\b/);
  assert.doesNotMatch(markup, /inline-flex/);
});

test("ErrorState keeps message working and adds title and description", () => {
  assert.match(html.errorLegacy(), />Could not load</);
  const titled = html.errorTitle();
  assert.match(titled, /Could not load/);
  assert.match(titled, /Your data is safe\./);
  assert.match(titled, /ID: a1b2/);
  assert.doesNotMatch(titled, /<button/);
});

test("ErrorState never renders a raw error object", () => {
  const markup = html.errorRawObject();
  assert.doesNotMatch(markup, /ECONNRESET|10\.0\.0\.4|\[object/);
  assert.match(markup, /Something went wrong\. Try again\./);
});

test("ErrorState localizes the retry action and the id prefix", () => {
  const markup = html.errorEs();
  assert.match(markup, />Reintentar</);
  assert.match(markup, /ID: x/);
});

const { runConfirm } = await loadCases("cases.tsx");

test("ConfirmAction starts as a single trigger that names the action, without the consequence", () => {
  const idle = html.confirmIdle();
  assert.match(idle, />Cancel order</);
  assert.doesNotMatch(idle, /The order is cancelled\./);
  assert.doesNotMatch(idle, /<fieldset/);
});

test("runConfirm folds returned failures and thrown errors into one outcome", async () => {
  assert.deepEqual(await runConfirm(async () => {}, "fallback"), { status: "done" });
  assert.deepEqual(await runConfirm(async () => ({ ok: true }), "fallback"), { status: "done" });
  assert.deepEqual(
    await runConfirm(async () => ({ ok: false, error: "Already paid" }), "fallback"),
    {
      status: "failed",
      message: "Already paid",
    },
  );
  assert.deepEqual(
    await runConfirm(async () => {
      throw new Error("boom");
    }, "fallback"),
    { status: "failed", message: "fallback" },
  );
});

test("ResponsiveList renders a table from its container width up and stacked cards below it", () => {
  const markup = html.list(true);
  const [table, cards] = markup.split("<ul");
  assert.match(table, /class="[^"]*hidden[^"]*@min-\[42rem\]\/responsive-list:block/);
  assert.match(table, /<caption class="sr-only">Orders<\/caption>/);
  assert.match(table, /<th[^>]*scope="col"[^>]*>City</);
  assert.match(table, /<th[^>]*scope="col"[^>]*>Actions</);
  assert.match(cards, /aria-label="Orders"[^>]*@min-\[42rem\]\/responsive-list:hidden/);
});

test("ResponsiveList keys every row in both markups and applies rowClassName", () => {
  const markup = html.list(false);
  assert.equal(markup.match(/data-row-key="a1"/g)?.length, 2);
  assert.equal(markup.match(/data-row-key="b2"/g)?.length, 2);
  assert.equal(markup.match(/is-late/g)?.length, 2);
  assert.doesNotMatch(markup, /Actions/);
});

test("ResponsiveList cards title with the primary column and list the rest as details", () => {
  const cards = html.list(false).split("<ul")[1];
  assert.match(cards, /font-semibold[^>]*>Marco</);
  assert.match(cards, /<dt[^>]*>City<\/dt><dd[^>]*>Lima<\/dd>/);
  assert.match(cards, /<dt[^>]*>Total<\/dt><dd[^>]*>S\/ 45<\/dd>/);
  assert.doesNotMatch(cards, /<dt[^>]*>Customer</);
});

test("ResponsiveList actions go in a last column and under each card, localized", () => {
  const markup = html.list(true);
  assert.equal(markup.match(/Open a1/g)?.length, 2);
  assert.match(html.list(true, "es"), />Acciones</);
});

test("custom tones resolve through --tone-<name> variables; built-in tones keep their classes", () => {
  const chip = html.chipTone("yape");
  assert.match(chip, /--tone-c:var\(--tone-yape\)/);
  assert.match(chip, /--tone-c-soft:var\(--tone-yape-soft\)/);
  assert.match(chip, /--tone-c-ink:var\(--tone-yape-ink\)/);
  assert.match(chip, /bg-\(--tone-c-soft\)/);
  assert.match(html.chipTone("danger"), /bg-danger-soft/);
  assert.doesNotMatch(html.chipTone("danger"), /--tone-c/);
  assert.doesNotMatch(html.chipTone("Bad;Name"), /--tone-c/);

  assert.match(html.statusDotTone("yape"), /bg-\(--tone-c\)/);
  assert.match(html.statusDotTone("success"), /bg-success/);

  const kpi = html.kpiTone("yape");
  assert.match(kpi, /text-\(--tone-c-ink\)/);
  assert.match(kpi, /bg-\(--tone-c\)/);
  assert.match(kpi, /data-icon/);
  assert.match(kpi, /data-trend/);
  assert.match(html.kpiTone("success"), /text-success/);
  assert.match(html.kpiDanger(), /text-danger/);
  assert.doesNotMatch(html.kpiPlain(), /rounded-pill|data-icon/);

  assert.match(html.avatarTone("yape"), /bg-\(--tone-c-soft\)/);
  assert.match(html.avatarTone(), /bg-sunken/);
});

test("Avatar draws a labelled status dot only when asked", () => {
  assert.match(html.avatarStatus(), /absolute right-0 bottom-0/);
  assert.match(html.avatarStatus(), />Online</);
  assert.doesNotMatch(html.avatarTone(), /absolute/);
});

test("KpiGroup auto-fit sets a minmax column template from minItemWidth", () => {
  assert.match(html.kpiGroupAutoFit(), /repeat\(auto-fit, minmax\(min\(100%, 160px\), 1fr\)\)/);
});

test("CopyField takes its labels from the UI strings and has a live region", () => {
  const field = html.copyField();
  assert.match(field, /<span>Copy<\/span>/);
  assert.match(field, /readOnly|readonly/);
  assert.match(field, /role="status"/);
  assert.match(html.copyField("es"), /<span>Copiar<\/span>/);
});

test("Topbar renders only the parts it is given", () => {
  const bare = html.topbarBare();
  assert.doesNotMatch(bare, /<nav/);
  assert.doesNotMatch(bare, /Ctrl\+K|⌘K/);
  assert.match(bare, /data-end/);
  const full = html.topbarFull();
  assert.match(full, /<nav[^>]*aria-label="Ruta"/);
  assert.match(full, /aria-label="Buscar"/);
});

test("outlined, compact and slot variants add their markup", () => {
  assert.match(html.emptyOutlined(), /border-dashed/);
  assert.match(html.errorOutlined(), /border-danger/);
  assert.match(html.pageHeaderCompact(), /data-compact/);
  const header = html.cardHeaderSlots();
  assert.match(header, /data-icon/);
  assert.match(header, /Caja/);
  assert.match(header, /data-action/);
});

test("Segmented renders options and a block layout", () => {
  const plain = html.segmentedOptions();
  assert.match(plain, /role="radio"[^>]*>Día</);
  assert.match(plain, /inline-flex/);
  const block = html.segmentedOptions(true);
  assert.match(block, /flex w-full/);
  assert.match(block, /flex-1/);
});

test("Button announces the UI string `loading` when no loadingLabel is given", () => {
  const loading = html.buttonLoadingDefault();
  assert.match(loading, />Save</);
  assert.match(loading, /<span role="status" class="sr-only">Loading<\/span>$/);
  assert.match(
    html.buttonLoadingDefaultEs(),
    /<span role="status" class="sr-only">Cargando<\/span>$/,
  );
});
