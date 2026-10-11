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
