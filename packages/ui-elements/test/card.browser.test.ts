import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineCard } from "../src/card/card.ts";
import { mount, wait } from "./setup.ts";

beforeAll(() => {
  defineCard();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const fetched = (pattern: RegExp) =>
  performance.getEntriesByType("resource").some((entry) => pattern.test(entry.name));

describe("ui-card", () => {
  it("is an opaque surface with header, body and footer sections", () => {
    const host = mount(`<ui-card style="width:300px">
      <ui-card-header>Head</ui-card-header><ui-card-body>Body</ui-card-body>
      <ui-card-footer>Foot</ui-card-footer></ui-card>`);
    const card = host.querySelector<HTMLElement>("ui-card")!;
    const style = getComputedStyle(card);
    expect(style.containerName).toBe("card");
    expect(style.containerType).toBe("inline-size");
    expect(style.borderTopStyle).toBe("solid");
    expect(style.boxShadow).not.toBe("none");
    expect(getComputedStyle(host.querySelector("ui-card-header")!).borderBottomStyle).toBe("solid");
    expect(getComputedStyle(host.querySelector("ui-card-footer")!).borderTopStyle).toBe("solid");
    expect(card.dataset.uiLiquid).toBeUndefined();
  });

  it("fetches no liquid code until material=liquid, then lenses the card itself", async () => {
    const host = mount(`<ui-card style="width:240px;height:80px">Plain</ui-card>`);
    await wait(100);
    expect(fetched(/internal\/liquid\.ts/)).toBe(false);
    const card = host.querySelector<HTMLElement>("ui-card")!;
    card.setAttribute("material", "liquid");
    for (let i = 0; i < 200 && card.dataset.uiLiquid !== "regular"; i++) await wait(10);
    expect(card.dataset.uiLiquid).toBe("regular");
    card.removeAttribute("material");
    expect(card.dataset.uiLiquid).toBeUndefined();
  });

  it("registers under a custom prefix", () => {
    expect(defineCard({ prefix: "acme" })).toBe("acme-card");
    expect(customElements.get("acme-card-footer")).toBeTruthy();
  });
});
