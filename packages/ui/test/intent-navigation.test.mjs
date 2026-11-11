import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("intent-navigation-cases.tsx");

const rawIntentProps = /\sintent(key)?=/i;

const openingTags = (markup, marker) =>
  [...markup.matchAll(/<[a-z][^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => tag.includes(marker));

function assertCarries(markup, marker, intent = "probe", key = "k1") {
  const tags = openingTags(markup, marker);
  assert.equal(tags.length, 1, `exactly one element matches ${marker}`);
  assert.match(tags[0], new RegExp(`data-intent="${intent}"`));
  assert.match(tags[0], new RegExp(`data-intent-key="${key}"`));
  assert.doesNotMatch(markup, rawIntentProps);
}

test("TabsTrigger and TabsContent carry intent on the tab and the tabpanel", () => {
  const markup = html.tabs();
  assertCarries(markup, 'role="tab"');
  assertCarries(markup, 'role="tabpanel"');
});

test("TabsNavLink carries intent on the link", () => {
  assertCarries(html.tabsNav(), 'href="/a"');
});

test("SegmentedItem carries intent on the radio", () => {
  assertCarries(html.segmented(), 'role="radio"');
});

test("Stepper steps carry intent, and the key defaults to the step id", () => {
  assertCarries(html.stepper(), "data-status=");
  assertCarries(html.stepperDefaultKey(), "data-status=", "probe", "one");
});

test("Wizard steps carry intent through the stepper", () => {
  assertCarries(html.wizard(), "data-status=");
});

test("Breadcrumbs carry intent on the link and on the current item", () => {
  const markup = html.breadcrumbs();
  assertCarries(markup, 'href="/"');
  assertCarries(markup, 'aria-current="page"', "probe-current", "k2");
});

test("FloatingToc items carry intent on the link", () => {
  assertCarries(html.floatingToc(), 'href="#intro"');
});

test("Sidebar and BottomNav items carry intent on the link, keyed by the intent key", () => {
  assertCarries(html.sidebar(), 'href="/home"');
  assertCarries(html.bottomNav(), 'href="/home"');
});

test("an empty intent renders nothing, even with an intentKey", () => {
  const markup = html.emptyIntent();
  assert.doesNotMatch(markup, /data-intent/);
  assert.doesNotMatch(markup, rawIntentProps);
});
