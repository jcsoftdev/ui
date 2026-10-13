import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineTabs, type UiTabs } from "../src/tabs/tabs.ts";
import { defineToast, selectVisible, toast } from "../src/toast/toast.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineTabs();
  defineToast();
});

afterEach(() => {
  toast.dismiss();
  document.body.innerHTML = "";
});

const TABS = (attrs = "") => `<ui-tabs ${attrs}>
  <ui-tab-list aria-label="Sections"><ui-tab value="a">Alpha</ui-tab><ui-tab value="b" disabled>Beta</ui-tab>
    <ui-tab value="c">Gamma</ui-tab></ui-tab-list>
  <ui-tab-panel value="a">A body</ui-tab-panel><ui-tab-panel value="b">B body</ui-tab-panel>
  <ui-tab-panel value="c">C body</ui-tab-panel></ui-tabs>`;

describe("ui-tabs", () => {
  it("wires tab/tabpanel ARIA, selects the first tab and follows focus (automatic)", async () => {
    const host = mount(TABS());
    const tabs = host.querySelector<UiTabs>("ui-tabs")!;
    const change = vi.fn();
    tabs.addEventListener("change", change);
    expect(tabs.value).toBe("a");
    expect((await ax("tab", "Alpha"))?.properties.selected).toBe(true);
    expect(await ax("tabpanel", "Alpha")).toBeTruthy();
    expect(await ax("tablist", "Sections")).toBeTruthy();
    const [alpha, beta, gamma] = host.querySelectorAll<HTMLElement>("ui-tab");
    expect([alpha!.tabIndex, beta!.tabIndex, gamma!.tabIndex]).toEqual([0, -1, -1]);
    alpha!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(gamma);
    expect(tabs.value).toBe("c");
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: "c" } }));
    expect(host.querySelector<HTMLElement>("ui-tab-panel[value=c]")!.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>("ui-tab-panel[value=a]")!.hidden).toBe(true);
    beta!.click();
    expect(tabs.value).toBe("c");
  });

  it("falls back to the first enabled tab when the value names a disabled one", () => {
    const host = mount(TABS('value="b"'));
    expect(host.querySelector<UiTabs>("ui-tabs")!.value).toBe("a");
  });

  it("only selects on Enter, Space or click in manual mode", async () => {
    const host = mount(TABS('activation="manual" value="c"'));
    const tabs = host.querySelector<UiTabs>("ui-tabs")!;
    const [alpha, , gamma] = host.querySelectorAll<HTMLElement>("ui-tab");
    gamma!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(alpha);
    expect(tabs.value).toBe("c");
    await userEvent.keyboard("{Enter}");
    expect(tabs.value).toBe("a");
  });
});

describe("toast", () => {
  beforeEach(() => mount(`<ui-toaster duration="100"></ui-toaster>`));

  it("announces in a named region, dismisses itself, and keeps only the newest two visible", async () => {
    toast("Saved", { description: "Booking updated", duration: Number.POSITIVE_INFINITY });
    toast.error("Failed");
    toast.success("Third");
    await frame();
    expect(await ax("region", "Notifications")).toBeTruthy();
    const items = [...document.querySelectorAll<HTMLElement>("[data-ui-part=toast]")];
    expect(items.map((item) => item.textContent)).toEqual(["Failed", "Third"]);
    expect(items[0]!.getAttribute("role")).toBe("alert");
    expect(items[1]!.getAttribute("role")).toBe("status");
    await wait(450);
    expect(document.querySelectorAll("[data-ui-part=toast]").length).toBe(1);
    expect(document.querySelector("[data-ui-part=toast]")?.textContent).toContain("Saved");
  });

  it("pauses on hover, runs the action, and Alt+T focuses the region", async () => {
    const undo = vi.fn();
    const dismissed = vi.fn();
    toast("Deleted", {
      duration: 300,
      action: { label: "Undo", onClick: undo },
      onDismiss: dismissed,
    });
    await frame();
    const item = document.querySelector<HTMLElement>("[data-ui-part=toast]")!;
    // Move the pointer away first: a toast appearing under a still pointer gets no pointerenter.
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } });
    await userEvent.hover(item);
    await wait(450);
    expect(item.dataset.state).toBe("open");
    await userEvent.click(item.querySelector("button")!);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(item.dataset.state).toBe("closed");
    await userEvent.keyboard("{Alt>}t{/Alt}");
    expect(document.activeElement?.localName).toBe("ui-toaster");
  });

  it("keeps focus inside a toast when another toast arrives", async () => {
    toast("First", { duration: Number.POSITIVE_INFINITY, action: { label: "Undo", onClick() {} } });
    await frame();
    const button = document.querySelector<HTMLElement>("[data-ui-part=action]")!;
    button.focus();
    toast("Second", { duration: Number.POSITIVE_INFINITY });
    await frame();
    expect(document.activeElement).toBe(button);
  });

  it("selectVisible keeps closing toasts and the newest open ones", () => {
    const list = [
      { id: 1, state: "open" },
      { id: 2, state: "closed" },
      { id: 3, state: "open" },
      { id: 4, state: "open" },
    ];
    expect(selectVisible(list, 2).map((t) => t.id)).toEqual([2, 3, 4]);
  });
});
