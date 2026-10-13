import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineGenericRow } from "../src/generic-row/generic-row.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineGenericRow();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-generic-row", () => {
  it("lays out start, content and end in three columns, and drops the first border", () => {
    const host = mount(`<div style="width:400px">
      <ui-generic-row><i id="a" style="width:20px">A</i>
        <ui-generic-row-content><ui-generic-row-title>T</ui-generic-row-title>
          <ui-generic-row-meta>M</ui-generic-row-meta></ui-generic-row-content>
        <b id="e">E</b></ui-generic-row>
      <ui-generic-row><ui-generic-row-content>Only</ui-generic-row-content><b data-end id="e2">E</b></ui-generic-row></div>`);
    const [first, second] = [...host.querySelectorAll("ui-generic-row")] as [Element, Element];
    const rect = (selector: string) => host.querySelector(selector)!.getBoundingClientRect();
    expect(rect("#a").right).toBeLessThanOrEqual(
      first.querySelector("ui-generic-row-content")!.getBoundingClientRect().left,
    );
    expect(rect("#e").left).toBeGreaterThanOrEqual(
      first.querySelector("ui-generic-row-content")!.getBoundingClientRect().right,
    );
    expect(getComputedStyle(first).borderTopWidth).toBe("0px");
    expect(getComputedStyle(second).borderTopStyle).toBe("solid");
    // `data-end` keeps the end child in column 3 when there is no start child.
    expect(rect("#e2").left).toBeGreaterThan(
      second.querySelector("ui-generic-row-content")!.getBoundingClientRect().left,
    );
  });
});
