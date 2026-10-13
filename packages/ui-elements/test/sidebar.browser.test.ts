import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineAppShell } from "../src/app-shell/app-shell.ts";
import { defineSidebar, type UiSidebar } from "../src/sidebar/sidebar.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineAppShell();
  defineSidebar();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const SHELL = (width: string, attrs = "") => `<ui-app-shell style="width:${width};height:400px">
  <ui-sidebar aria-label="Main" ${attrs}>
    <div slot="header">Brand</div>
    <ui-sidebar-group label="Workspace">
      <ui-sidebar-item href="#home" active badge="3" badge-tone="danger" badge-label="unread">Home</ui-sidebar-item>
      <ui-sidebar-item>Reports
        <ui-sidebar-item href="#daily">Daily</ui-sidebar-item>
        <ui-sidebar-item href="#weekly">Weekly</ui-sidebar-item></ui-sidebar-item>
    </ui-sidebar-group>
    <ui-sidebar-group label="Team" collapsible>
      <ui-sidebar-item href="#people">People</ui-sidebar-item>
    </ui-sidebar-group>
    <div slot="footer">User</div></ui-sidebar>
  <main style="flex:1">Page</main></ui-app-shell>`;

const until = async (test: () => boolean) => {
  for (let i = 0; i < 100 && !test(); i++) await wait(20);
  return test();
};

describe("ui-sidebar", () => {
  it("exposes a complementary landmark, named group navigations and the current page", async () => {
    const host = mount(SHELL("1200px"));
    expect(await ax("complementary", "Main")).toBeTruthy();
    expect(await ax("navigation", "Workspace")).toBeTruthy();
    expect(await ax("navigation", "Team")).toBeTruthy();
    const home = host.querySelector<HTMLAnchorElement>("a[href='#home']")!;
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(home.textContent).toContain("3 unread");
  });

  it("stays visible and unobstructed in a wide shell", async () => {
    const host = mount(SHELL("1200px"));
    const sidebar = host.querySelector<UiSidebar>("ui-sidebar")!;
    await wait(50);
    expect(sidebar.inert).toBe(false);
    expect(getComputedStyle(sidebar).position).toBe("sticky");
    expect(sidebar.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
  });

  it("is an inert off-canvas drawer in a narrow shell, opened by `open`, closed by Escape or the scrim", async () => {
    const host = mount(SHELL("700px"));
    const sidebar = host.querySelector<UiSidebar>("ui-sidebar")!;
    const close = vi.fn();
    sidebar.addEventListener("close", close);
    expect(await until(() => sidebar.inert)).toBe(true);
    expect(sidebar.getBoundingClientRect().right).toBeLessThanOrEqual(0);
    expect(document.querySelector("[data-ui=sidebar-scrim]")).toBeNull();
    sidebar.open = true;
    expect(await until(() => !sidebar.inert)).toBe(true);
    await wait(250);
    expect(sidebar.getBoundingClientRect().left).toBe(0);
    expect(document.activeElement?.getAttribute("href")).toBe("#home");
    await userEvent.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(1);
    document.querySelector<HTMLElement>("[data-ui=sidebar-scrim]")!.click();
    expect(close).toHaveBeenCalledTimes(2);
    sidebar.open = false;
    expect(await until(() => sidebar.inert)).toBe(true);
    expect(document.querySelector("[data-ui=sidebar-scrim]")).toBeNull();
  });

  it("branches and collapsible groups are disclosures", async () => {
    const host = mount(SHELL("1200px"));
    const reports = host.querySelector<HTMLButtonElement>("button[data-ui-part=link]")!;
    expect(reports.getAttribute("aria-expanded")).toBe("false");
    expect(
      host.querySelector<HTMLElement>("a[href='#daily']")!.getBoundingClientRect().height,
    ).toBe(0);
    reports.click();
    expect(reports.getAttribute("aria-expanded")).toBe("true");
    expect(
      host.querySelector<HTMLElement>("a[href='#daily']")!.getBoundingClientRect().height,
    ).toBeGreaterThan(0);
    const team = host.querySelector<HTMLButtonElement>(
      "ui-sidebar-group button[data-ui-part=label]",
    )!;
    expect(team.getAttribute("aria-expanded")).toBe("true");
    team.click();
    expect(team.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("ui-sidebar-group[collapsible]")?.hasAttribute("collapsed")).toBe(
      true,
    );
  });

  it("moves between visible links with the tree keys and opens and closes branches", async () => {
    const host = mount(SHELL("1200px"));
    const home = host.querySelector<HTMLElement>("a[href='#home']")!;
    const reports = host.querySelector<HTMLButtonElement>("button[data-ui-part=link]")!;
    home.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(reports);
    await userEvent.keyboard("{ArrowRight}");
    expect(reports.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("href")).toBe("#daily");
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(reports);
    await userEvent.keyboard("{ArrowLeft}");
    expect(reports.getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{End}");
    expect(document.activeElement?.getAttribute("href")).toBe("#people");
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement?.tagName).toBe("BUTTON");
    expect(document.activeElement?.textContent).toContain("Team");
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement?.getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(home);
  });

  it("opts into Liquid Glass lazily", async () => {
    const host = mount(SHELL("1200px"));
    const sidebar = host.querySelector<UiSidebar>("ui-sidebar")!;
    expect(sidebar.dataset.uiLiquid).toBeUndefined();
    sidebar.setAttribute("material", "liquid");
    expect(await until(() => sidebar.dataset.uiLiquid === "regular")).toBe(true);
  });

  it("registers under a custom prefix", () => {
    expect(defineSidebar({ prefix: "acme" })).toBe("acme-sidebar");
  });
});
