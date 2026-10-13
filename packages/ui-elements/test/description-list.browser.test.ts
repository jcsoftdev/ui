import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineDescriptionList } from "../src/description-list/description-list.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineDescriptionList();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const DL = `<dl><dt>Plan</dt><dd>Pro</dd><dt>Seats</dt><dd>12</dd></dl>`;
const columns = (host: Element) =>
  getComputedStyle(host.querySelector("dl")!).gridTemplateColumns.split(" ").length;

describe("ui-description-list", () => {
  it("keeps the native term/definition semantics", async () => {
    mount(`<ui-description-list style="width:400px">${DL}</ui-description-list>`);
    expect(await ax("term", "Plan")).toBeTruthy();
    expect(await ax("definition")).toBeTruthy();
  });

  it("two columns when wide, stacked below 24rem of its own width", () => {
    const wide = mount(`<ui-description-list style="width:500px">${DL}</ui-description-list>`);
    expect(columns(wide)).toBe(2);
    const narrow = mount(`<ui-description-list style="width:300px">${DL}</ui-description-list>`);
    expect(columns(narrow)).toBe(1);
    expect(getComputedStyle(narrow.querySelector("dd")!).textAlign).toBe("left");
  });
});
