import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineHighlightLine } from "../src/highlight-line/highlight-line.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineHighlightLine();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-highlight-line", () => {
  it("is a paragraph whose <strong> phrase is the stronger ink", async () => {
    const host = mount(
      `<ui-highlight-line>You earned <strong>S/ 1,200</strong> this week</ui-highlight-line>`,
    );
    const el = host.firstElementChild!;
    expect(el.getAttribute("role")).toBe("paragraph");
    expect(await ax("paragraph")).toBeTruthy();
    const strong = el.querySelector("strong")!;
    expect(getComputedStyle(strong).color).not.toBe(getComputedStyle(el).color);
    expect(getComputedStyle(el).maxWidth).not.toBe("none");
  });

  it("keeps an author role", () => {
    const host = mount(`<ui-highlight-line role="note">x</ui-highlight-line>`);
    expect(host.firstElementChild!.getAttribute("role")).toBe("note");
  });
});
