import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { shouldSubmitQuery } = await loadCases("command-palette-cases.tsx");

test("free text submits only on a plain Enter with nothing highlighted", () => {
  const enter = { key: "Enter", isComposing: false, highlighted: "", search: "pedido" };
  const cases = [
    [enter, true],
    [{ ...enter, highlighted: "x" }, false],
    [{ ...enter, isComposing: true }, false],
    [{ ...enter, search: "   " }, false],
    [{ ...enter, search: "" }, false],
    [{ ...enter, key: "a" }, false],
  ];
  for (const [input, expected] of cases) {
    assert.equal(shouldSubmitQuery(input), expected, JSON.stringify(input));
  }
});
