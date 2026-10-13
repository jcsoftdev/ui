import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineFacts } from "../src/facts/facts.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineFacts();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const FACTS = (width: number) => `<ui-facts style="width:${width}px"><dl>
  <div><dt>Plan</dt><dd>Pro</dd></div><div><dt>Seats</dt><dd>12</dd></div>
  <div><dt>Region</dt><dd>EU</dd></div></dl></ui-facts>`;
const columns = (host: Element) =>
  getComputedStyle(host.querySelector("dl")!).gridTemplateColumns.split(" ").length;

describe("ui-facts", () => {
  it("keeps the native term/definition semantics and a dashed rule", async () => {
    const host = mount(FACTS(700));
    expect(await ax("term", "Region")).toBeTruthy();
    expect(getComputedStyle(host.querySelector("dl")!).borderTopStyle).toBe("dashed");
  });

  it("three columns when wide, one at 560px of its own width or less", () => {
    expect(columns(mount(FACTS(700)))).toBe(3);
    expect(columns(mount(FACTS(560)))).toBe(1);
  });
});
