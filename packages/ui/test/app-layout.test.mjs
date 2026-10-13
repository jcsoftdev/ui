import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html, splitBottomNavItems, createAppShellStore, nextSegmentedValue } =
  await loadCases("app-layout-cases.tsx");

test("Grid fits columns from the minimum width unless a count is given", () => {
  assert.match(
    html.gridFluid(),
    /grid-template-columns:repeat\(auto-fill, minmax\(min\(100%, 12rem\), 1fr\)\)/,
  );
  assert.match(html.gridFixed(), /grid-template-columns:repeat\(3, minmax\(0, 1fr\)\)/);
});

test("FormError is an assertive alert and FormStatus a polite status", () => {
  assert.match(html.formError("Card declined"), /^<p role="alert"[^>]*>Card declined<\/p>$/);
  assert.match(html.formStatus("Saved"), /^<p role="status"[^>]*>Saved<\/p>$/);
});

test("FormError and FormStatus render nothing without a message", () => {
  for (const empty of [null, undefined, ""]) {
    assert.equal(html.formError(empty), "");
    assert.equal(html.formStatus(empty), "");
  }
});

test("Form keeps its attributes and merges className", () => {
  const markup = html.form();
  assert.match(markup, /<form[^>]*action="\/save"/);
  assert.match(markup, /class="[^"]*flex-col[^"]*extra"/);
});

test("Breadcrumbs is a named nav whose last item is the current page and not a link", () => {
  const markup = html.breadcrumbs();
  assert.match(markup, /<nav aria-label="Breadcrumbs"/);
  assert.match(markup, /<ol[^>]*>/);
  assert.equal(markup.match(/<a /g)?.length, 2);
  assert.match(markup, /<span aria-current="page"[^>]*>Today<\/span>/);
  assert.doesNotMatch(markup, /aria-current="page"[^>]*>Home/);
});

test("Breadcrumbs follows the locale, an explicit label and the injected link renderer", () => {
  assert.match(html.breadcrumbsEs(), /aria-label="Ruta de navegación"/);
  const custom = html.breadcrumbsCustom();
  assert.match(custom, /aria-label="Trail"/);
  assert.match(custom, /data-router-link="\/"/);
  assert.doesNotMatch(custom, /<a /);
});

test("LiveStatusBar is a polite status with a text per connection state", () => {
  const texts = { live: "Live", reconnecting: "Reconnecting…", offline: "Offline" };
  for (const [status, text] of Object.entries(texts)) {
    const markup = html.liveBar(status);
    assert.match(markup, new RegExp(`role="status"[^>]*data-status="${status}"`), status);
    assert.match(markup, new RegExp(`</span>${text}</span><b>3 waiting</b>`), status);
  }
  assert.match(html.liveBar("live", { live: "Connected" }), /Connected/);
  assert.match(html.liveBarEs(), /Sin conexión/);
});

test("the bottom bar keeps everything when it fits and gives one slot to More otherwise", () => {
  const items = ["a", "b", "c", "d", "e", "f", "g"];
  assert.deepEqual(splitBottomNavItems(items.slice(0, 5)), {
    visible: ["a", "b", "c", "d", "e"],
    overflow: [],
  });
  assert.deepEqual(splitBottomNavItems(items), {
    visible: ["a", "b", "c", "d"],
    overflow: ["e", "f", "g"],
  });
  assert.deepEqual(splitBottomNavItems(items, 3), {
    visible: ["a", "b"],
    overflow: ["c", "d", "e", "f", "g"],
  });
});

test("BottomNav renders a landmark with the current page and a More button only on overflow", () => {
  const fits = html.bottomNav(5, 1);
  assert.match(fits, /<nav aria-label="Sections"/);
  assert.match(fits, /<a [^>]*aria-current="page"[^>]*>.*Item 1/);
  assert.doesNotMatch(fits, /aria-haspopup="dialog"/);

  const overflowing = html.bottomNav(7, 1);
  assert.equal(overflowing.match(/<a /g)?.length, 4);
  assert.match(
    overflowing,
    /<button[^>]*data-active="false"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/,
  );
  assert.doesNotMatch(overflowing, /Item 4/);
});

test("More is marked active when the current page is behind it", () => {
  assert.match(html.bottomNav(7, 6), /<button[^>]*data-active="true"/);
});

test("the AppShell store starts at the server snapshot and only changes after a measure", () => {
  const store = createAppShellStore();
  assert.equal(store.getServerSnapshot(), false);
  assert.equal(store.getSnapshot(), store.getServerSnapshot());

  let notified = 0;
  store.subscribe(() => notified++);
  const element = (width) => ({ getBoundingClientRect: () => ({ width }) });
  store.observe(element(375));
  assert.equal(store.getSnapshot(), true);
  store.observe(element(1200));
  assert.equal(store.getSnapshot(), false);
  store.observe(element(1000));
  assert.equal(notified, 2);
});

test("useAppShell reads the server snapshot during server render and is null outside a shell", () => {
  assert.equal(
    html.appShellReader(),
    '<div class="@container/app flex min-w-0"><i>false</i></div>',
  );
  assert.equal(html.appShellOutside(), "<i>null</i>");
});

test("Topbar renders without a search trigger and keeps it when onSearch is given", () => {
  const without = html.topbarNoSearch();
  assert.doesNotMatch(without, /<button/);
  assert.doesNotMatch(without, /Search/);
  assert.match(without, /<nav aria-label="Trail"/);

  const withSearch = html.topbarSearch();
  assert.match(withSearch, /<button[^>]*aria-label="Search"/);
  assert.match(withSearch, /Search anything/);
});

test("OfflineBanner shows an optional action next to the queue counter", () => {
  const both = html.offlineAction();
  assert.match(both, /tabular-nums.*<button type="button">Retry<\/button>/);
  assert.match(html.offlineActionOnly(), /<button type="button">Retry<\/button>/);
  assert.doesNotMatch(html.offlineActionOnly(), /tabular-nums/);
  assert.doesNotMatch(html.offlinePlain(), /<button/);
});

test("Checkbox label is a <label> bound to the checkbox button", () => {
  const markup = html.checkboxLabel();
  const id = markup.match(/<button[^>]*role="checkbox"[^>]*id="([^"]+)"/)?.[1];
  assert.ok(id);
  assert.match(
    markup,
    new RegExp(`<label for="${id.replace(/[:]/g, "\\$&")}"[^>]*>Remember me</label>`),
  );

  const custom = html.checkboxLabelId();
  assert.match(custom, /id="remember"/);
  assert.match(custom, /<label for="remember" data-disabled=""/);
});

test("Checkbox without label renders no label and no generated id", () => {
  const bare = html.checkboxBare();
  assert.doesNotMatch(bare, /<label/);
  assert.doesNotMatch(bare, /<button[^>]*\sid=/);
});

test("Segmented keeps the selected item on a second press unless deselectable", () => {
  assert.equal(nextSegmentedValue("day", "day", false), "day");
  assert.equal(nextSegmentedValue("day", "week", false), "week");
  assert.equal(nextSegmentedValue("", "day", false), "day");
  assert.equal(nextSegmentedValue("day", "day", true), "");
  assert.equal(nextSegmentedValue("day", "week", true), "week");
});
