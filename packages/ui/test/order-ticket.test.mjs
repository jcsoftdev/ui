import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const {
  html,
  orderTicketState,
  orderTicketTitle,
  splitTicketLines,
  ticketLineCost,
  warnLeadSeconds,
} = await loadCases("order-ticket-cases.tsx");

test("the state warns max(2 min, 25% of the target) ahead and is late only past the target", () => {
  const cases = [
    [0, 20, "ok"],
    [899, 20, "ok"],
    [900, 20, "warn"],
    [1200, 20, "warn"],
    [1201, 20, "late"],
    [179, 5, "ok"],
    [180, 5, "warn"],
    [300, 5, "warn"],
    [301, 5, "late"],
    [2699, 60, "ok"],
    [2700, 60, "warn"],
    [3601, 60, "late"],
  ];
  for (const [elapsed, target, expected] of cases) {
    assert.equal(orderTicketState(elapsed, target), expected, `${elapsed}s of ${target} min`);
  }
  assert.equal(warnLeadSeconds(4), 120);
  assert.equal(warnLeadSeconds(40), 600);
});

test("lines split by budget, keep their order and never leave a part empty", () => {
  const line = (id, extra = {}) => ({ id, qty: 1, name: id, ...extra });
  assert.deepEqual(splitTicketLines([], 4), []);
  assert.equal(ticketLineCost(line("a")), 1);
  assert.equal(ticketLineCost(line("a", { modifiers: ["x"], note: "n", allergy: "m" })), 3.4);
  const plain = ["a", "b", "c", "d", "e"].map((id) => line(id));
  const ids = (parts) => parts.map((part) => part.map((l) => l.id));
  assert.deepEqual(ids(splitTicketLines(plain, 2)), [["a", "b"], ["c", "d"], ["e"]]);
  assert.deepEqual(ids(splitTicketLines(plain, 10)), [["a", "b", "c", "d", "e"]]);
  const heavy = [line("a"), line("b", { note: "n", modifiers: ["x"] }), line("c")];
  assert.deepEqual(ids(splitTicketLines(heavy, 2)), [["a"], ["b"], ["c"]]);
  assert.deepEqual(ids(splitTicketLines(plain, 0.5)), [["a"], ["b"], ["c"], ["d"], ["e"]]);
  assert.deepEqual(ids(splitTicketLines(plain, 3, () => 1.5)), [["a", "b"], ["c", "d"], ["e"]]);
});

test("a late ticket fills its band and says how late with an alarm, never a stripe or ring", () => {
  const markup = html.late();
  assert.match(markup, /data-state="late"/);
  assert.match(markup, /data-part="band" class="[^"]*bg-danger text-surface/);
  assert.match(markup, /Demorada \+1:1[0-9]/);
  assert.match(markup, />demorada</);
  assert.doesNotMatch(markup, /border-l-|border-s-|ring-2/);
});

test("a ticket open for hours reads the overrun in hours", () => {
  const markup = html.lateLong();
  assert.match(markup, /Demorada \+22 h 15 min/);
  assert.match(markup, />22 h 35 min</);
  assert.doesNotMatch(markup, /\d{3,}:\d\d/);
  assert.match(markup, /aria-valuetext="22 h 35 min de 20 min"/);
  assert.doesNotMatch(markup, /\d{3,} de/);
});

test("the progress value keeps minutes under an hour and reads the target in hours too", () => {
  const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000 - 30000);
  assert.match(html.ticketEs({ since: minutesAgo(5) }), /aria-valuetext="5 min de 20 min"/);
  assert.match(
    html.ticketEs({ since: minutesAgo(61), targetMinutes: 90 }),
    /aria-valuetext="1 h 1 min de 1 h 30 min"/,
  );
});

test("a ticket without a table titles itself with the channel icon and number", () => {
  const markup = html.takeaway();
  assert.match(markup, /<h3[^>]*><svg[^>]*>.*?<\/svg><span>N\.º 42<\/span>/);
  assert.match(markup, />Delivery · Ana</);
  assert.match(html.ticket(), />4 guests · Rosa</);
});

test("toggles are buttons with a tri-state aria-pressed and read-only drops every button", () => {
  const markup = html.ticket({ onReadyAll: () => undefined, chip: "Fondos" });
  assert.match(markup, /data-line="a"[^>]*><button type="button" aria-pressed="true"/);
  assert.match(markup, /data-line="b"[^>]*><button type="button" aria-pressed="mixed"/);
  assert.match(markup, /data-line="c"[^>]*><button type="button" aria-pressed="false"/);
  assert.match(markup, />All ready</);
  const readOnly = html.ticket({ readOnly: true, onReadyAll: () => undefined, chip: "Fondos" });
  assert.doesNotMatch(readOnly, /<button/);
  assert.doesNotMatch(readOnly, /aria-pressed/);
  assert.match(readOnly, />Fondos</);
});

test("an allergy is its own danger outline, apart from the note and never amber", () => {
  const markup = html.ticketEs();
  assert.match(markup, /data-part="allergy" class="[^"]*text-danger[^"]*"[^>]*>.*?Alergia: Maní/);
  assert.match(markup, /data-part="note"[^>]*>.*?Nota: Poco picante/);
  assert.doesNotMatch(markup, /data-part="allergy" class="[^"]*warning/);
});

test("continuation labels the first part «(1 de n)» and later parts «(cont.)»", () => {
  assert.match(html.ticketEs({ partIndex: 1, partCount: 2 }), />\(1 de 2\)</);
  assert.match(html.ticketEs({ partIndex: 2, partCount: 2 }), />\(cont\.\)</);
  assert.doesNotMatch(html.ticketEs(), /\(1 de|\(cont\.\)/);
});

test("the view transition name lands on the root and nothing spins", () => {
  assert.match(
    html.ticket({ viewTransitionName: "ticket-7" }),
    /<article[^>]*style="view-transition-name:ticket-7"/,
  );
  assert.doesNotMatch(html.ticket(), /animate-spin|role="status"/);
});

const titleStrings = {
  orderTicketNumber: "N.º {number}",
  orderTicketTableAndNumber: "{table} · N.º {number}",
};

test("orderTicketTitle puts the number beside the table, zero included", () => {
  const cases = [
    [{ table: "Mesa 1", number: 4 }, "Mesa 1 · N.º 4"],
    [{ table: "Mesa 1" }, "Mesa 1"],
    [{ number: 7 }, "N.º 7"],
    [{ table: "Mesa 1", number: 0 }, "Mesa 1 · N.º 0"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(orderTicketTitle(input, titleStrings), expected);
  }
});

test("the heading holds only the title", () => {
  const heading = html.ticket({ table: "Mesa 1" }).match(/<h3[^>]*>(.*?)<\/h3>/)?.[1] ?? "";
  assert.doesNotMatch(heading, /on time/);
  assert.doesNotMatch(heading, /, /);
  assert.match(html.ticketEs({ table: "Mesa 1" }), /<h3[^>]*><span>Mesa 1<\/span><\/h3>/);
});

test("the state describes the article", () => {
  const markup = html.ticketEs({ table: "Mesa 1" });
  const describedBy = markup.match(/<article[^>]*aria-describedby="([^"]+)"/)?.[1] ?? "";
  const [stateId] = describedBy.split(" ");
  assert.match(markup, new RegExp(`id="${stateId}" class="sr-only">a tiempo<`));
});

test("a consumer describedby is kept", () => {
  const markup = html.ticket({ "aria-describedby": "mine" });
  assert.match(markup, /<article[^>]*aria-describedby="[^" ]+ mine"/);
});

test("table and number render together", () => {
  assert.match(html.ticketEs({ table: "Mesa 1", number: 4 }), /<span>Mesa 1 · N\.º 4<\/span>/);
});

test("the ticket carries its intent attributes", () => {
  assert.match(
    html.ticket({ intent: "order", intentKey: "o1" }),
    /data-intent="order" data-intent-key="o1"/,
  );
});
