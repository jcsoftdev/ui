import { describe, expect, it } from "vitest";
import * as reactPin from "../../ui/src/containers/table/pin.ts";
import * as pin from "../src/column-pin.ts";

const WIDTHS = { a: 120, b: 80, c: 200, d: 60, e: 90 };
const ORDER = ["a", "b", "c", "d", "e"];
const CASES: pin.PinnedColumns[] = [
  {},
  { left: ["a"] },
  { left: ["a", "b"], right: ["e"] },
  { left: ["a"], right: ["a", "d", "e"] },
  { left: ["zzz", "b"], right: ["e", "d"] },
  { right: ["c", "d", "e"] },
];

describe("column-pin parity with the React table", () => {
  it("computes the same sticky offsets", () => {
    for (const pinned of CASES)
      expect(pin.computePinOffsets(WIDTHS, pinned)).toEqual(
        reactPin.computePinOffsets(WIDTHS, pinned),
      );
  });

  it("sanitises like the React kit", () => {
    for (const pinned of CASES)
      for (const known of [null, ORDER, ["a", "e"]])
        expect(pin.sanitizePinned(pinned, known)).toEqual(reactPin.sanitizePinned(pinned, known));
  });

  it("pins, moves and unpins like the React kit", () => {
    for (const pinned of CASES)
      for (const id of ["a", "c", "e", "ghost"])
        for (const side of ["left", "right", null] as const)
          expect(pin.setColumnPin(pinned, id, side, ORDER)).toEqual(
            reactPin.setColumnPin(pinned, id, side, ORDER),
          );
  });

  it("parses stored pins like the React kit", () => {
    for (const raw of [
      null,
      "",
      "nope",
      "[]",
      '{"left":["a",1],"right":"x"}',
      '{"left":["a"],"right":["b"]}',
    ])
      expect(pin.parseStoredPins(raw)).toEqual(reactPin.parseStoredPins(raw));
  });
});
