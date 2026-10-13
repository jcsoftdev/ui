import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineFloatingToc, type UiFloatingToc } from "../src/floating-toc/floating-toc.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineFloatingToc();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const PAGE = `<ui-floating-toc heading="On this page" scroll-root="#scroller">
    <ui-toc-item target="intro">Intro</ui-toc-item>
    <ui-toc-item target="usage" level="2">Usage</ui-toc-item>
    <ui-toc-item target="api">API</ui-toc-item></ui-floating-toc>
  <div id="scroller" style="height:200px;overflow:auto">
    <h2 id="intro" style="margin:0;height:400px">Intro</h2>
    <h2 id="usage" style="margin:0;height:400px">Usage</h2>
    <h2 id="api" style="margin:0;height:400px">API</h2></div>`;

const until = async (test: () => boolean) => {
  for (let i = 0; i < 100 && !test(); i++) await wait(20);
  return test();
};

describe("ui-floating-toc", () => {
  it("is a named navigation whose links mirror the items and mark the first as current", async () => {
    const host = mount(PAGE);
    expect(await ax("navigation", "On this page")).toBeTruthy();
    const links = [...host.querySelectorAll<HTMLAnchorElement>("ui-toc-item a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#intro", "#usage", "#api"]);
    expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([
      "location",
      null,
      null,
    ]);
  });

  it("follows the scroll position and fires change", async () => {
    const host = mount(PAGE);
    const toc = host.querySelector<UiFloatingToc>("ui-floating-toc")!;
    const change = vi.fn();
    toc.addEventListener("change", change);
    host.querySelector("#scroller")!.scrollTop = 420;
    expect(await until(() => toc.active === "usage")).toBe(true);
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ detail: { id: "usage" } }));
    expect(host.querySelector("a[href='#usage']")?.getAttribute("aria-current")).toBe("location");
    expect(host.querySelector("a[href='#intro']")?.hasAttribute("aria-current")).toBe(false);
  });

  it("a click scrolls to the heading and makes it current", async () => {
    const host = mount(PAGE);
    const toc = host.querySelector<UiFloatingToc>("ui-floating-toc")!;
    host.querySelector<HTMLAnchorElement>("a[href='#api']")!.click();
    expect(toc.active).toBe("api");
    expect(await until(() => host.querySelector("#scroller")!.scrollTop > 400)).toBe(true);
    expect(location.hash).toBe("");
  });

  it("the items property builds the links", () => {
    const host = mount(`<ui-floating-toc></ui-floating-toc>`);
    const toc = host.querySelector<UiFloatingToc>("ui-floating-toc")!;
    toc.items = [
      { id: "a", label: "A" },
      { id: "b", label: "B", level: 3 },
    ];
    expect(toc.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(host.querySelector("ui-toc-item[level='3']")?.textContent).toContain("B");
  });

  it("registers under a custom prefix", () => {
    expect(defineFloatingToc({ prefix: "acme" })).toBe("acme-floating-toc");
  });
});
