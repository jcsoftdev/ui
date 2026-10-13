import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { definePageHeader } from "../src/page-header/page-header.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  definePageHeader();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-page-header", () => {
  it("exposes the title as a level-1 heading", async () => {
    const host = mount(`<ui-page-header>
      <div><ui-page-header-eyebrow>Admin</ui-page-header-eyebrow>
        <ui-page-header-title>Team <span data-accent-word>settings</span></ui-page-header-title>
        <ui-page-header-lede>Manage seats.</ui-page-header-lede></div>
      <ui-page-header-actions><button>Invite</button></ui-page-header-actions></ui-page-header>`);
    const node = await ax("heading", "Team settings");
    expect(node).toBeTruthy();
    const title = host.querySelector("ui-page-header-title")!;
    title.setAttribute("aria-level", "2");
    expect(title.getAttribute("aria-level")).toBe("2");
  });

  it("wraps the actions under the title when the header is narrow", () => {
    const html = (width: number) => `<ui-page-header style="width:${width}px">
      <div style="width:200px">Title</div>
      <ui-page-header-actions><button style="width:150px">A</button></ui-page-header-actions></ui-page-header>`;
    const top = (host: Element) =>
      host.querySelector("ui-page-header-actions")!.getBoundingClientRect().top;
    const wide = mount(html(600));
    const wideTop = top(wide);
    const narrow = mount(html(300));
    expect(top(narrow)).toBeGreaterThan(narrow.querySelector("div")!.getBoundingClientRect().top);
    expect(wideTop).toBeLessThanOrEqual(wide.querySelector("div")!.getBoundingClientRect().bottom);
  });
});
