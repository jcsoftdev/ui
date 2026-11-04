import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html, orderTicketState, splitTicketLines, ticketLineCost, warnLeadSeconds } =
  await loadCases("order-ticket-cases.tsx");

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
  assert.match(markup, /, demorada</);
  assert.doesNotMatch(markup, /border-l-|border-s-|ring-2/);
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
