import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { loadCases } from "./components/render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { html, units } = await loadCases("app-shell-gaps-cases.tsx");

async function load(path) {
  const bundle = await build({
    entryPoints: [join(here, path)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const code = Buffer.from(bundle.outputFiles[0].contents).toString("base64");
  return import(`data:text/javascript;base64,${code}`);
}

const nav = await load("../src/utils/list-navigation.ts");
const chat = await load("../src/containers/chat-thread/format.ts");
const kanban = await load("../src/containers/kanban/model.ts");

const tabStops = (markup, tag) =>
  (markup.match(new RegExp(`<${tag}[^>]*>`, "g")) ?? []).filter((el) =>
    el.includes('tabindex="0"'),
  );

test("Cols thirds is three columns, two under 1280 with an odd last item spanning, one under 720", () => {
  const markup = html.colsThirds();
  assert.match(markup, /grid-cols-\[repeat\(3,minmax\(0,1fr\)\)\]/);
  assert.match(markup, /@max-\[1279px\]\/page:grid-cols-\[repeat\(2,minmax\(0,1fr\)\)\]/);
  assert.match(
    markup,
    /@max-\[1279px\]\/page:\[&amp;&gt;:last-child:nth-child\(odd\)\]:col-span-2/,
  );
  assert.match(markup, /@max-\[719px\]\/page:grid-cols-\[minmax\(0,1fr\)\]/);
});

test("the other Cols variants keep their 940 / 1080 / 1500 cuts", () => {
  const markup = html.colsBase();
  assert.match(markup, /@max-\[940px\]\/page/);
  assert.match(markup, /@min-\[1500px\]\/page/);
  assert.doesNotMatch(markup, /719px|1279px/);
});

test("a ResponsiveList without onSelect renders exactly as before", () => {
  const markup = html.plainList();
  assert.doesNotMatch(
    markup,
    /role="(listbox|option|grid)"|aria-selected|aria-current|tabindex|data-row-scope/,
  );
});

test("selectable cards are a listbox of options with one selected and a single tab stop", () => {
  const markup = html.selectableList("b2");
  assert.match(markup, /<ul[^>]*role="listbox"/);
  assert.equal(markup.match(/role="option"/g)?.length, 3);
  assert.equal(markup.match(/aria-selected="true"/g)?.length, 1);
  const stops = tabStops(markup, "li");
  assert.equal(stops.length, 1);
  assert.match(stops[0], /data-row-key="b2"/);
  assert.match(stops[0], /aria-selected="true"/);
});

test("with no selection the first row owns the tab stop", () => {
  const markup = html.selectableList(null);
  assert.match(tabStops(markup, "li")[0], /data-row-key="a1"/);
  assert.doesNotMatch(markup, /aria-selected="true"/);
});

test("the table of a selectable list is a grid whose selected row carries aria-selected", () => {
  const table = html.selectableGrid("c3").split("</table>")[0];
  assert.match(table, /<table[^>]*role="grid"/);
  assert.equal(table.match(/<tr[^>]*aria-selected="true"/g)?.length, 1);
  assert.match(table.match(/<tr[^>]*aria-selected="true"[^>]*>/)[0], /data-row-key="c3"/);
  assert.equal(tabStops(table, "tr").length, 1);
});

test("rows with actions use aria-current instead of option semantics", () => {
  const markup = html.selectableList("c3", true);
  const cards = markup.split("</table>")[1] ?? markup;
  assert.doesNotMatch(cards, /role="(listbox|option)"/);
  assert.equal(cards.match(/aria-current="true"/g)?.length, 1);
});

test('layout="cards" renders no table', () => {
  const markup = html.cardsOnly();
  assert.doesNotMatch(markup, /<table/);
  assert.doesNotMatch(markup, /md:hidden/);
});

test("arrow keys, Home and End resolve the next row key and stop at the ends", () => {
  const keys = ["a", "b", "c"];
  assert.equal(nav.listNavigationTarget(keys, "a", "ArrowDown"), "b");
  assert.equal(nav.listNavigationTarget(keys, "b", "ArrowUp"), "a");
  assert.equal(nav.listNavigationTarget(keys, "c", "ArrowDown"), undefined);
  assert.equal(nav.listNavigationTarget(keys, "a", "ArrowUp"), undefined);
  assert.equal(nav.listNavigationTarget(keys, "b", "Home"), "a");
  assert.equal(nav.listNavigationTarget(keys, "a", "End"), "c");
  assert.equal(nav.listNavigationTarget(keys, null, "ArrowDown"), "a");
  assert.equal(nav.listNavigationTarget(keys, "a", "ArrowLeft"), undefined);
  assert.equal(nav.listNavigationTarget([], "a", "ArrowDown"), undefined);
});

test("ContextRail sticks to the top with its own scroll and a width per breakpoint", () => {
  const markup = html.contextRail({ stickyTop: 12 });
  assert.match(markup, /@container\/rail/);
  assert.match(markup, /--rail-m:360px/);
  assert.match(markup, /--rail-w:400px/);
  assert.match(markup, /--rail-xw:440px/);
  assert.match(markup, /--rail-top:12px/);
  const aside = markup.match(/<aside[^>]*>/)[0];
  assert.match(aside, /aria-label="Order"/);
  assert.match(aside, /sticky/);
  assert.match(aside, /overflow-y-auto/);
  assert.match(markup, /@max-\[719px\]\/rail:grid-cols-\[minmax\(0,1fr\)\]/);
});

test("ContextRail takes one width or a set per breakpoint, and any closed cut", () => {
  assert.match(html.contextRail({ width: 300 }), /--rail-m:300px;--rail-w:300px;--rail-xw:300px/);
  assert.match(html.contextRail({ width: { w: 420 } }), /--rail-m:360px;--rail-w:420px/);
  assert.match(
    html.contextRail({ breakpoint: 960 }),
    /@max-\[959px\]\/rail:grid-cols-\[minmax\(0,1fr\)\]/,
  );
});

test("sheet mode adds a summary bar that shows only when collapsed and opens a dialog", () => {
  const markup = html.contextRailSheet();
  assert.match(markup, /hidden @max-\[719px\]\/rail:block/);
  assert.match(
    markup,
    /<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*>View order/,
  );
  assert.match(markup, /@max-\[719px\]\/rail:hidden/);
  assert.doesNotMatch(html.contextRail(), /aria-haspopup/);
});

test("ChatThread is a labelled live log with day separators and three author kinds", () => {
  const markup = html.chat();
  assert.match(markup, /<section[^>]*aria-label="Conversation"/);
  assert.match(markup, /role="log"[^>]*aria-live="polite"/);
  assert.equal(markup.match(/data-slot="day"/g)?.length, 2);
  assert.match(markup, />Yesterday</);
  assert.match(markup, />Today</);
  for (const author of ["customer", "bot", "staff"]) {
    assert.match(markup, new RegExp(`data-author="${author}"`));
  }
  assert.match(markup, /El cliente pidió hablar con una persona/);
});

test("ChatThread puts incoming messages at the start, outgoing at the end, and names authors", () => {
  const markup = html.chat();
  const row = (author) => markup.match(new RegExp(`<li data-author="${author}"[^>]*>`))[0];
  assert.match(row("customer"), /justify-start/);
  assert.match(row("bot"), /justify-end/);
  assert.match(row("staff"), /justify-end/);
  assert.match(markup, />Rosa</);
  assert.match(markup, />Bot</);
  assert.match(markup, />Ana</);
  assert.match(markup, />Customer</);
});

test("ChatThread shows delivery status on outgoing messages only", () => {
  const markup = html.chat();
  assert.match(markup, /data-status="read"[^>]*>.*Read/);
  assert.match(markup, /data-status="failed"[^>]*>Not sent/);
  assert.equal(markup.match(/data-status=/g)?.length, 2);
});

test("ChatThread offers retry for a failed message only when onRetry is given", () => {
  assert.doesNotMatch(html.chat(), />Retry</);
  assert.match(html.chat({ onRetry: () => {} }), />Retry</);
});

test("ChatThread renders the composer after the log and uses kit tokens only", () => {
  const markup = html.chat();
  assert.ok(markup.indexOf('role="log"') < markup.indexOf('data-slot="composer"'));
  assert.match(markup, /<textarea aria-label="Message"/);
  assert.doesNotMatch(markup, /#[0-9a-f]{3,6}\b|rgb\(|dark:/i);
  assert.match(markup, /bg-accent text-on-accent/);
  assert.match(markup, /bg-accent-soft text-accent-ink/);
});

test("ChatThread shows its empty slot and no log without items", () => {
  const markup = html.chatEmpty();
  assert.match(markup, /No messages/);
  assert.doesNotMatch(markup, /role="log"/);
});

test("day keys, labels and breaks follow the time zone", () => {
  assert.equal(chat.dayKey("2026-10-29T03:00:00Z", "UTC"), "2026-10-29");
  assert.equal(chat.dayKey("2026-10-29T03:00:00Z", "America/Lima"), "2026-10-28");
  const labels = { today: "Today", yesterday: "Yesterday" };
  const now = "2026-10-29T15:00:00Z";
  const en = { locale: "en", timeZone: "UTC" };
  assert.equal(chat.formatDay("2026-10-29T01:00:00Z", now, labels, en), "Today");
  assert.equal(chat.formatDay("2026-10-28T23:59:00Z", now, labels, en), "Yesterday");
  assert.equal(chat.formatDay("2026-10-20T12:00:00Z", now, labels, en), "Tuesday, October 20");
  assert.match(chat.formatDay("2025-01-02T12:00:00Z", now, labels, en), /2025/);
  const days = [
    { at: "2026-10-28T10:00:00Z" },
    { at: "2026-10-28T11:00:00Z" },
    { at: "2026-10-29T00:30:00Z" },
  ];
  assert.deepEqual(
    chat.withDayBreaks(days, "UTC").map((b) => b.dayStart),
    [true, false, true],
  );
  assert.match(chat.formatTime("2026-10-28T14:05:00Z", en), /^0?2:05\s?PM$/);
});

test("Kanban cardGrid is opt-in and the lane becomes a container", () => {
  assert.doesNotMatch(html.kanbanDefault(), /data-card-grid|--lane-card-min|auto-fill/);
  const grid = html.kanbanGrid();
  assert.match(grid, /data-card-grid/);
  assert.match(grid, /@container\/lane/);
  assert.match(grid, /--lane-card-min:224px/);
  assert.match(
    grid,
    /@min-\[30rem\]\/lane:grid-cols-\[repeat\(auto-fill,minmax\(var\(--lane-card-min\),1fr\)\)\]/,
  );
});

test("dropping on a card grid follows reading order across rows and columns", () => {
  const cell = (col, row) => ({
    left: col * 100,
    right: col * 100 + 90,
    top: row * 60,
    bottom: row * 60 + 50,
  });
  const rects = [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)];
  assert.equal(kanban.dropIndexGrid(rects, 10, 10), 0);
  assert.equal(kanban.dropIndexGrid(rects, 95, 10), 1);
  assert.equal(kanban.dropIndexGrid(rects, 195, 10), 2);
  assert.equal(kanban.dropIndexGrid(rects, 10, 70), 2);
  assert.equal(kanban.dropIndexGrid(rects, 195, 70), 4);
  assert.equal(kanban.dropIndexGrid(rects, 10, 400), 4);
  assert.equal(kanban.dropIndexGrid([], 5, 5), 0);
});

test("ContextRail breakpoint never keeps the rail beside the work area and always collapses it", () => {
  const collapsedAt = (breakpoint, width) => units.isRailCollapsed(breakpoint, width);
  assert.equal(collapsedAt("never", 200), false);
  assert.equal(collapsedAt("never", null), false);
  assert.equal(collapsedAt("always", 2000), true);
  assert.equal(collapsedAt("always", null), true);
  assert.equal(collapsedAt(960, 959), true);
  assert.equal(collapsedAt(960, 960), false);
  assert.equal(collapsedAt(720, null), false);
});

test("ContextRail never adds no collapse query and always collapses with plain classes", () => {
  const never = html.contextRail({ breakpoint: "never", collapse: "sheet", summary: "Total" });
  assert.doesNotMatch(never, /@max-\[/);
  assert.match(never, /grid-cols-\[minmax\(0,1fr\)_var\(--rail\)\]/);
  const always = html.contextRail({ breakpoint: "always" });
  assert.match(always, /(?<![:\w-])grid-cols-\[minmax\(0,1fr\)\]/);
  assert.doesNotMatch(always, /grid-cols-\[minmax\(0,1fr\)_var\(--rail\)\]/);
  assert.match(always, /<aside[^>]*class="[^"]*static max-h-none/);
  const sheet = html.contextRail({ breakpoint: "always", collapse: "sheet", summary: "T" });
  assert.match(sheet, /<aside[^>]*class="[^"]*static max-h-none hidden"/);
  assert.match(sheet, /sticky bottom-\(--app-bottom-bar,0px\)[^"]* block"/);
  assert.match(sheet, /data-collapsed=""/);
});
