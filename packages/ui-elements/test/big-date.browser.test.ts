import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineBigDate } from "../src/big-date/big-date.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineBigDate();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const time = (host: Element) => host.shadowRoot!.querySelector("time")!;

describe("ui-big-date", () => {
  it("renders a calendar date in UTC as a localized <time>", () => {
    const host = mount(`<ui-big-date value="2026-01-01" locale="en-US"></ui-big-date>`);
    const el = host.firstElementChild!;
    expect(time(el).hidden).toBe(false);
    expect(time(el).getAttribute("datetime")).toBe("2026-01-01");
    expect(time(el).textContent).toBe("Thursday, January 1");
    el.setAttribute("format", '{"weekday":"short","month":"short","day":"2-digit"}');
    expect(time(el).textContent).toBe("Thu, Jan 01");
    el.setAttribute("locale", "es-PE");
    expect(time(el).textContent).toContain("jue");
  });

  it("shows its children when it has no valid value", () => {
    const host = mount(`<ui-big-date>12 Oct</ui-big-date>`);
    const el = host.firstElementChild!;
    expect(time(el).hidden).toBe(true);
    el.setAttribute("value", "not-a-date");
    expect(time(el).hidden).toBe(true);
    expect(el.hasAttribute("data-dated")).toBe(false);
  });

  it("has a compact size", () => {
    const host = mount(`<ui-big-date>5</ui-big-date><ui-big-date size="compact">5</ui-big-date>`);
    const [normal, compact] = Array.from(host.children).map((el) => getComputedStyle(el).fontSize);
    expect(normal).toBe("30px");
    expect(compact).toBe("22px");
  });
});
