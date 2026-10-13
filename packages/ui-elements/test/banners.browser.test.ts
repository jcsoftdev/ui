import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineBanner } from "../src/banner/banner.ts";
import { defineOfflineBanner } from "../src/offline-banner/offline-banner.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineBanner();
  defineOfflineBanner();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-banner", () => {
  it("is a polite status unless the tone is danger", async () => {
    mount('<ui-banner tone="warning">Heads up</ui-banner>');
    expect(await ax("status")).toBeTruthy();
    expect(await ax("alert")).toBeFalsy();
    document.body.innerHTML = "";
    mount('<ui-banner tone="danger">Broken</ui-banner>');
    expect(await ax("alert")).toBeTruthy();
  });

  it("switches role when the tone changes", async () => {
    const host = mount("<ui-banner>Info</ui-banner>").firstElementChild as HTMLElement;
    host.setAttribute("tone", "danger");
    expect(await ax("alert")).toBeTruthy();
  });

  it("shows the heading, a decorative glyph and the action slot", async () => {
    const host = mount(
      '<ui-banner heading="Sync" tone="success">Done<button slot="action">Undo</button></ui-banner>',
    ).firstElementChild as HTMLElement;
    await frame();
    const root = host.shadowRoot as ShadowRoot;
    expect(root.querySelector<HTMLElement>("[part=title]")?.textContent).toBe("Sync");
    expect(root.querySelector("[part=icon]")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector("[part=icon] svg")).toBeTruthy();
    expect(root.querySelector<HTMLElement>("[part=action]")?.hidden).toBe(false);
    expect(await ax("button", "Undo")).toBeTruthy();
  });

  it("hides the icon with no-icon", () => {
    const host = mount("<ui-banner no-icon>x</ui-banner>").firstElementChild as HTMLElement;
    expect(host.shadowRoot?.querySelector<HTMLElement>("[part=icon]")?.hidden).toBe(true);
  });
});

describe("ui-offline-banner", () => {
  it("is a warning status with the message and an accessible queue counter", async () => {
    const host = mount(
      '<ui-offline-banner message="You are offline" queued-changes="3" queued-label="3 changes waiting"></ui-offline-banner>',
    ).firstElementChild as HTMLElement;
    expect(await ax("status")).toBeTruthy();
    const root = host.shadowRoot as ShadowRoot;
    expect(root.querySelector("[part=message]")?.textContent).toBe("You are offline");
    const count = root.querySelector("[part=count]") as HTMLElement;
    expect(count.querySelector("[aria-hidden=true]")?.textContent).toBe("3");
    expect(count.querySelector(".sr-only")?.textContent).toBe("3 changes waiting");
    host.setAttribute("queued-changes", "0");
    expect(root.querySelector("[part=count]")).toBeNull();
  });

  it("tracks connectivity with auto and emits change", () => {
    const host = mount('<ui-offline-banner message="Offline" auto></ui-offline-banner>')
      .firstElementChild as HTMLElement;
    const seen: boolean[] = [];
    host.addEventListener("change", (event) => seen.push((event as CustomEvent).detail.online));
    expect(host.hasAttribute("data-online")).toBe(true);
    window.dispatchEvent(new Event("offline"));
    expect(host.hasAttribute("data-online")).toBe(false);
    expect(getComputedStyle(host).display).toBe("block");
    window.dispatchEvent(new Event("online"));
    expect(getComputedStyle(host).display).toBe("none");
    expect(seen).toEqual([false, true]);
    host.remove();
    window.dispatchEvent(new Event("offline"));
    expect(seen).toHaveLength(2);
  });

  it("is always shown without auto", () => {
    const host = mount('<ui-offline-banner message="Offline"></ui-offline-banner>')
      .firstElementChild as HTMLElement;
    window.dispatchEvent(new Event("online"));
    expect(getComputedStyle(host).display).toBe("block");
  });

  it("registers under a custom prefix", () => {
    expect(defineBanner({ prefix: "acme" })).toBe("acme-banner");
    expect(defineOfflineBanner({ prefix: "acme" })).toBe("acme-offline-banner");
  });
});
