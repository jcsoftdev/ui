// `material="liquid"` pulls the liquid code only when asked, and only the features it needs.
import { describe, expect, it } from "vitest";
import { defineButton } from "../src/button/button.ts";
import { mount, wait } from "./setup.ts";

const fetched = (pattern: RegExp) =>
  performance.getEntriesByType("resource").some((entry) => pattern.test(entry.name));

const until = async (test: () => boolean) => {
  for (let i = 0; i < 200 && !test(); i++) await wait(10);
  return test();
};

describe("material", () => {
  it("a solid button fetches no liquid code", async () => {
    defineButton();
    mount(`<ui-button>Plain</ui-button>`);
    await wait(100);
    expect(fetched(/internal\/liquid\.ts/)).toBe(false);
    expect(fetched(/ui-core\/dist\/liquid\//)).toBe(false);
  });

  it("material=liquid adopts the material CSS and lenses the host with the default features", async () => {
    const host = mount(`<ui-button material="liquid" style="width:140px">Glass</ui-button>`);
    const button = host.querySelector<HTMLElement>("ui-button")!;
    expect(await until(() => button.dataset.uiLiquid === "regular")).toBe(true);
    expect(getComputedStyle(button).getPropertyValue("--glass-lens").trim()).toBe("1");
    expect(await until(() => button.dataset.glassRefraction === "on")).toBe(true);
    expect(fetched(/ui-core\/dist\/liquid\/lens\.js/)).toBe(true);
    expect(fetched(/ui-core\/dist\/liquid\/specular\.js/)).toBe(true);
    expect(fetched(/ui-core\/dist\/liquid\/crystal\.js/)).toBe(false);
    button.removeAttribute("material");
    expect(button.dataset.uiLiquid).toBeUndefined();
    expect(button.dataset.glassRefraction).toBeUndefined();
  });

  it("liquid-preset=crystal loads the crystal lens into the shadow root", async () => {
    const host = mount(
      `<ui-button material="liquid" liquid-preset="crystal" liquid-motion="off" style="width:140px">Crystal</ui-button>`,
    );
    const button = host.querySelector<HTMLElement>("ui-button")!;
    expect(await until(() => button.dataset.glassRefraction === "on")).toBe(true);
    expect(fetched(/ui-core\/dist\/liquid\/crystal\.js/)).toBe(true);
    expect(button.shadowRoot?.querySelector("[data-glass-lens-layer]")).not.toBeNull();
    expect(button.style.getPropertyValue("--liquid-profile")).toBe("crystal");
  });

  it("lens=off keeps the base frosted material", async () => {
    const host = mount(
      `<ui-button material="liquid-clear" lens="off" liquid-frost="5">Frost</ui-button>`,
    );
    const button = host.querySelector<HTMLElement>("ui-button")!;
    expect(await until(() => button.dataset.uiLiquid === "clear")).toBe(true);
    await wait(100);
    expect(button.dataset.glassRefraction).toBeUndefined();
    expect(button.style.getPropertyValue("--liquid-frost")).toBe("5px");
    expect(getComputedStyle(button).backdropFilter).toContain("blur(5px)");
  });
});
