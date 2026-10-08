// Pure logic behind undo / redo, paste and fill of DataGrid.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

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

const h = await load("../src/containers/data-grid/history.ts");
const edit = await load("../src/containers/data-grid/grid-edit.ts");

const cells = (id, before, after) => ({
  kind: "cells",
  source: "edit",
  changes: [{ rowId: id, columnId: "total", before, after }],
});

test("undo returns the inverse and redo the original command", () => {
  let state = h.pushCommand(h.createHistory(), cells("v1", 35, 40));
  assert.equal(h.canUndo(state), true);
  assert.equal(h.canRedo(state), false);
  const undone = h.undoCommand(state);
  assert.deepEqual(undone.apply.changes[0], {
    rowId: "v1",
    columnId: "total",
    before: 40,
    after: 35,
  });
  state = undone.state;
  assert.equal(h.canUndo(state), false);
  assert.equal(h.canRedo(state), true);
  const redone = h.redoCommand(state);
  assert.equal(redone.apply.changes[0].after, 40);
  assert.equal(h.canRedo(redone.state), false);
  assert.equal(h.undoCommand(h.createHistory()), null);
  assert.equal(h.redoCommand(h.createHistory()), null);
});

test("a new command drops the redo branch and no-ops are not recorded", () => {
  let state = h.pushCommand(h.createHistory(), cells("v1", 1, 2));
  state = h.pushCommand(state, cells("v1", 2, 3));
  state = h.undoCommand(state).state;
  assert.equal(state.future.length, 1);
  state = h.pushCommand(state, cells("v2", 5, 6));
  assert.equal(state.future.length, 0);
  assert.equal(state.past.length, 2);
  assert.equal(h.pushCommand(state, cells("v3", 7, 7)), state);
  assert.equal(h.pushCommand(state, { kind: "rows-add", rows: [] }), state);
});

test("depth keeps only the newest commands, also when it shrinks", () => {
  let state = h.createHistory(3);
  for (let i = 0; i < 6; i += 1) state = h.pushCommand(state, cells("v", i, i + 1));
  assert.equal(state.past.length, 3);
  assert.equal(state.past[0].changes[0].before, 3);
  state = h.setHistoryDepth(state, 1);
  assert.equal(state.past.length, 1);
  assert.equal(state.past[0].changes[0].before, 5);
  assert.equal(h.createHistory(0).depth, 1);
});

test("row commands invert to the opposite row command and keep their indices", () => {
  const rows = [
    { rowId: "a", index: 1, row: { id: "a" } },
    { rowId: "c", index: 3, row: { id: "c" } },
  ];
  let state = h.pushCommand(h.createHistory(), { kind: "rows-remove", rows });
  const undone = h.undoCommand(state);
  assert.equal(undone.apply.kind, "rows-add");
  assert.deepEqual(
    undone.apply.rows.map((r) => r.index),
    [1, 3],
  );
  state = h.pushCommand(undone.state, { kind: "rows-add", rows });
  assert.equal(h.undoCommand(state).apply.kind, "rows-remove");
  assert.equal(h.commandSize(undone.apply), 2);
});

test("summarizeHistory counts both stacks", () => {
  let state = h.pushCommand(h.createHistory(), cells("v1", 1, 2));
  state = h.pushCommand(state, cells("v1", 2, 3));
  state = h.undoCommand(state).state;
  assert.deepEqual(h.summarizeHistory(state), {
    canUndo: true,
    canRedo: true,
    undoCount: 1,
    redoCount: 1,
  });
});

test("parseTSV reads rows, quoted fields and CRLF", () => {
  assert.deepEqual(edit.parseTSV("a\tb\n1\t2\n"), [
    ["a", "b"],
    ["1", "2"],
  ]);
  assert.deepEqual(edit.parseTSV('"x\ty"\t"he said ""hi"""\r\n"l1\nl2"\tz'), [
    ["x\ty", 'he said "hi"'],
    ["l1\nl2", "z"],
  ]);
  assert.deepEqual(edit.parseTSV("solo"), [["solo"]]);
  assert.deepEqual(edit.parseTSV(""), []);
  assert.deepEqual(edit.parseTSV("a\t\tc"), [["a", "", "c"]]);
});

test("planPaste lands from the origin, clips at the limits and fills a selection with one value", () => {
  const table = [
    ["1", "2"],
    ["3", "4"],
  ];
  assert.deepEqual(
    edit.planPaste(table, { r: 2, c: 1 }, { maxR: 2, maxC: 5 }).map((t) => [t.r, t.c, t.text]),
    [
      [2, 1, "1"],
      [2, 2, "2"],
    ],
  );
  const filled = edit.planPaste(
    [["x"]],
    { r: 1, c: 0 },
    { maxR: 9, maxC: 9 },
    {
      r0: 1,
      r1: 2,
      c0: 0,
      c1: 1,
    },
  );
  assert.equal(filled.length, 4);
  assert.ok(filled.every((t) => t.text === "x"));
  assert.deepEqual(edit.planPaste([], { r: 1, c: 0 }, { maxR: 1, maxC: 1 }), []);
});

test("planFill copies the first row down or the first column right", () => {
  const down = edit.planFill({ r0: 2, r1: 4, c0: 1, c1: 2 }, "down");
  assert.equal(down.length, 4);
  assert.deepEqual(down[0], { r: 3, c: 1, from: { r: 2, c: 1 } });
  assert.deepEqual(down[3], { r: 4, c: 2, from: { r: 2, c: 2 } });
  const right = edit.planFill({ r0: 1, r1: 2, c0: 0, c1: 2 }, "right");
  assert.equal(right.length, 4);
  assert.deepEqual(right[0], { r: 1, c: 1, from: { r: 1, c: 0 } });
  assert.deepEqual(edit.planFill({ r0: 1, r1: 1, c0: 0, c1: 0 }, "down"), []);
});

test("parseLooseNumber reads pasted currency, decimal commas and thousands", () => {
  assert.equal(edit.parseLooseNumber("S/ 1,234.50"), 1234.5);
  assert.equal(edit.parseLooseNumber("12,5"), 12.5);
  assert.equal(edit.parseLooseNumber("1,234"), 1234);
  assert.equal(edit.parseLooseNumber("-3"), -3);
  assert.equal(edit.parseLooseNumber("Corte"), null);
  assert.equal(edit.parseLooseNumber(""), null);
});

test("sameCellValue compares dates by time and text values by text", () => {
  assert.equal(edit.sameCellValue(new Date(2026, 9, 1), new Date(2026, 9, 1)), true);
  assert.equal(edit.sameCellValue("a", "b"), false);
  assert.equal(edit.sameCellValue("5", 5), false);
  assert.equal(edit.sameCellValue(5, "5"), true);
  assert.equal(edit.sameCellValue("", null), true);
});
