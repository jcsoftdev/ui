import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineAppShell } from "../src/app-shell/app-shell.ts";
import { defineTopbar } from "../src/topbar/topbar.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineAppShell();
  defineTopbar();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const BAR = (
  width: string,
) => `<ui-app-shell style="width:${width}"><div style="flex:1;min-width:0">
  <ui-topbar breadcrumbs-label="Breadcrumb" menu-label="Open menu" search-label="Search"
    search-placeholder="Search anything">
    <span slot="crumb">Workspace</span><span slot="crumb">Projects</span><span slot="crumb">Alpha</span>
    <button slot="end">Account</button><button>Notifications</button></ui-topbar></div></ui-app-shell>`;

const until = async (test: () => boolean) => {
  for (let i = 0; i < 100 && !test(); i++) await wait(20);
  return test();
};

describe("ui-topbar", () => {
  it("is a banner with a breadcrumb navigation whose last crumb is the current page", async () => {
    const host = mount(BAR("1000px"));
    expect(await ax("banner")).toBeTruthy();
    expect(await ax("navigation", "Breadcrumb")).toBeTruthy();
    expect(await ax("button", "Search")).toBeTruthy();
    const crumbs = [...host.querySelectorAll("[slot=crumb]")];
    expect(crumbs.map((crumb) => crumb.getAttribute("aria-current"))).toEqual([null, null, "page"]);
    expect(host.querySelector("[data-ui-part=breadcrumbs]")?.contains(crumbs[0] ?? null)).toBe(
      true,
    );
    expect(host.querySelector("[data-ui-part=end]")?.textContent).toBe("Account");
    expect(host.querySelector("[data-ui-part=actions]")?.textContent).toBe("Notifications");
  });

  it("fires search from the button and from Cmd/Ctrl+K, and open-menu from the menu button", async () => {
    const host = mount(BAR("1000px"));
    const bar = host.querySelector("ui-topbar")!;
    const search = vi.fn();
    const menu = vi.fn();
    bar.addEventListener("search", search);
    bar.addEventListener("open-menu", menu);
    host.querySelector<HTMLElement>("[data-ui-part=search]")!.click();
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(search).toHaveBeenCalledTimes(3);
    host.querySelector<HTMLElement>("[data-ui-part=menu-button]")!.click();
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("shows the menu button only when the shell is under 900 px", async () => {
    const host = mount(BAR("1000px"));
    const button = host.querySelector<HTMLElement>("[data-ui-part=menu-button]")!;
    expect(getComputedStyle(button).display).toBe("none");
    host.querySelector<HTMLElement>("ui-app-shell")!.style.width = "700px";
    expect(await until(() => getComputedStyle(button).display !== "none")).toBe(true);
  });

  it("ignores Cmd/Ctrl+K while typing, with Shift, or when already handled; two bars fire once", async () => {
    const host = mount(`${BAR("1000px")}<input id="field" />`);
    const search = vi.fn();
    host.querySelector("ui-topbar")!.addEventListener("search", search);
    host.querySelector<HTMLInputElement>("#field")!.focus();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(search).not.toHaveBeenCalled();
    document.body.focus();
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{Control>}{Shift>}k{/Shift}{/Control}");
    expect(search).not.toHaveBeenCalled();
    host.insertAdjacentHTML("beforeend", BAR("1000px"));
    const second = vi.fn();
    host.querySelectorAll("ui-topbar")[1]!.addEventListener("search", second);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(search.mock.calls.length + second.mock.calls.length).toBe(1);
  });

  it("hides the parent crumbs in a narrow bar", () => {
    const host = mount(BAR("500px"));
    const [first, , last] = host.querySelectorAll<HTMLElement>("[slot=crumb]");
    expect(getComputedStyle(first!).display).toBe("none");
    expect(getComputedStyle(last!).display).not.toBe("none");
  });

  it("opts into Liquid Glass lazily", async () => {
    const host = mount(BAR("1000px"));
    const bar = host.querySelector<HTMLElement>("ui-topbar")!;
    expect(bar.dataset.uiLiquid).toBeUndefined();
    bar.setAttribute("material", "liquid");
    expect(await until(() => bar.dataset.uiLiquid === "regular")).toBe(true);
  });

  it("registers under a custom prefix", () => {
    expect(defineTopbar({ prefix: "acme" })).toBe("acme-topbar");
  });
});
