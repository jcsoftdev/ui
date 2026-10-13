import { describe, expect, it } from "vitest";
import { includesFilter, moveActiveIndex, rangeBetween, selectValue } from "../src/listbox.ts";

describe("listbox pure logic", () => {
  it("replaces in single mode and toggles in multiple mode", () => {
    expect(selectValue(["a"], "b", false)).toEqual(["b"]);
    expect(selectValue(["a"], "b", true)).toEqual(["a", "b"]);
    expect(selectValue(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("selects a range in either direction", () => {
    const values = ["a", "b", "c", "d"];
    expect(rangeBetween(values, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(values, "c", "a")).toEqual(["a", "b", "c"]);
    expect(rangeBetween(values, "x", "d")).toEqual(["d"]);
  });

  it("moves the active option, clamping unless it loops", () => {
    expect(moveActiveIndex(3, -1, "next")).toBe(0);
    expect(moveActiveIndex(3, -1, "prev")).toBe(2);
    expect(moveActiveIndex(3, 2, "next")).toBe(2);
    expect(moveActiveIndex(3, 2, "next", { loop: true })).toBe(0);
    expect(moveActiveIndex(3, 0, "prev", { loop: true })).toBe(2);
    expect(moveActiveIndex(30, 4, "pageNext", { pageSize: 10 })).toBe(14);
    expect(moveActiveIndex(30, 25, "pageNext", { pageSize: 10 })).toBe(29);
    expect(moveActiveIndex(30, 3, "pagePrev", { pageSize: 10 })).toBe(0);
    expect(moveActiveIndex(0, -1, "next")).toBe(-1);
  });

  it("filters by substring over value and keywords", () => {
    expect(includesFilter("Calendar", "CAL", [])).toBe(1);
    expect(includesFilter("Profile", "acct", ["account"])).toBe(0);
    expect(includesFilter("Profile", "acc", ["account"])).toBe(1);
  });
});
