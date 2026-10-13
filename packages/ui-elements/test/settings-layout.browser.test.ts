import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineSettingsLayout } from "../src/settings-layout/settings-layout.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineSettingsLayout();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const LAYOUT = (width: number) => `<div style="container:page / inline-size;width:${width}px">
  <ui-settings-layout>
    <ui-settings-layout-nav>
      <ui-settings-layout-nav-item id="a" active>Profile</ui-settings-layout-nav-item>
      <ui-settings-layout-nav-item id="b">Billing</ui-settings-layout-nav-item>
      <ui-settings-layout-nav-item id="c" disabled>Danger</ui-settings-layout-nav-item>
    </ui-settings-layout-nav>
    <ui-settings-layout-main><div>1</div><div>2</div></ui-settings-layout-main>
  </ui-settings-layout></div>`;

describe("ui-settings-layout", () => {
  it("names the nav, and its items are buttons with aria-current for the active one", async () => {
    const host = mount(LAYOUT(1000));
    expect(await ax("navigation", "Sections")).toBeTruthy();
    expect(await ax("button", "Billing")).toBeTruthy();
    expect(host.querySelector("#a")!.getAttribute("aria-current")).toBe("true");
    expect(host.querySelector("#b")!.hasAttribute("aria-current")).toBe(false);
    host.querySelector("#b")!.toggleAttribute("active", true);
    expect(host.querySelector("#b")!.getAttribute("aria-current")).toBe("true");
  });

  it("Tab reaches items, Enter and Space click them, a disabled item is skipped", async () => {
    const host = mount(LAYOUT(1000));
    const clicked = vi.fn();
    for (const item of host.querySelectorAll("ui-settings-layout-nav-item"))
      item.addEventListener("click", clicked);
    await userEvent.tab();
    expect(document.activeElement?.id).toBe("a");
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(document.activeElement?.id).toBe("b");
    await userEvent.keyboard(" ");
    expect(clicked).toHaveBeenCalledTimes(2);
    await userEvent.tab();
    expect(document.activeElement?.id).not.toBe("c");
    host.querySelector<HTMLElement>("#c")!.click();
    expect(clicked).toHaveBeenCalledTimes(2);
  });

  it("collapses to one column at 940px of the page container, and masonry from 1180px", () => {
    const wide = mount(LAYOUT(1300));
    const cols = (host: Element) =>
      getComputedStyle(host.querySelector("ui-settings-layout")!).gridTemplateColumns.split(" ")
        .length;
    expect(cols(wide)).toBe(2);
    expect(getComputedStyle(wide.querySelector("ui-settings-layout-main")!).columnCount).toBe("2");
    const narrow = mount(LAYOUT(900));
    expect(cols(narrow)).toBe(1);
    expect(getComputedStyle(narrow.querySelector("ui-settings-layout-nav")!).flexDirection).toBe(
      "row",
    );
  });
});
