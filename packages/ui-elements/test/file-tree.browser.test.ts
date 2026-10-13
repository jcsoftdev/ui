import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineFileTree, type FileTreeNode, type UiFileTree } from "../src/file-tree/file-tree.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineFileTree();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const nodes = (): FileTreeNode[] => [
  {
    id: "src",
    name: "src",
    children: [
      { id: "app", name: "app.ts" },
      { id: "button", name: "button.tsx" },
      { id: "lib", name: "lib", children: [{ id: "util", name: "util.ts" }] },
    ],
  },
  { id: "readme", name: "README.md" },
  { id: "pkg", name: "package.json" },
];

const tree = (attrs = "", dir = "ltr", data = nodes()) => {
  const el = mount(
    `<div dir="${dir}"><ui-file-tree label="Project" ${attrs}></ui-file-tree></div>`,
  ).querySelector<UiFileTree>("ui-file-tree")!;
  el.nodes = data;
  return el;
};

const item = (el: Element, id: string) => el.querySelector<HTMLElement>(`[data-node-id="${id}"]`)!;

describe("ui-file-tree", () => {
  it("renders the APG tree with levels, sets and one tab stop", async () => {
    const el = tree('expanded="src"');
    expect(await ax("tree", "Project")).toBeTruthy();
    expect(await ax("treeitem", "src")).toBeTruthy();
    const src = item(el, "src");
    expect(src.getAttribute("aria-expanded")).toBe("true");
    expect(src.getAttribute("aria-level")).toBe("1");
    expect(src.getAttribute("aria-setsize")).toBe("3");
    const button = item(el, "button");
    expect(button.getAttribute("aria-level")).toBe("2");
    expect(button.getAttribute("aria-posinset")).toBe("2");
    expect(button.hasAttribute("aria-expanded")).toBe(false);
    const stops = [...el.querySelectorAll<HTMLElement>("[role=treeitem]")].filter(
      (row) => row.tabIndex === 0,
    );
    expect(stops).toEqual([src]);
    expect(item(el, "util")).toBeNull();
  });

  it("moves, opens and closes with the arrows and jumps with Home/End", async () => {
    const el = tree();
    item(el, "src").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(item(el, "src").getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(item(el, "app"));
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(item(el, "util"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(item(el, "lib"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(item(el, "lib").getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(item(el, "src"));
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(item(el, "pkg"));
    expect(item(el, "pkg").tabIndex).toBe(0);
    expect(item(el, "src").tabIndex).toBe(-1);
  });

  it("selects with Enter, Space or a click and reports it", async () => {
    const el = tree('expanded="src"');
    const select = vi.fn();
    el.addEventListener("select", select);
    item(el, "app").focus();
    await userEvent.keyboard("{Enter}");
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ detail: expect.objectContaining({ id: "app" }) }),
    );
    expect(item(el, "app").getAttribute("aria-selected")).toBe("true");
    item(el, "readme").click();
    expect(el.selectedId).toBe("readme");
    expect(item(el, "app").getAttribute("aria-selected")).toBe("false");
    item(el, "src").click();
    expect(item(el, "src").getAttribute("aria-expanded")).toBe("false");
  });

  it("moves focus to the next row whose name starts with the typed text", async () => {
    const el = tree();
    item(el, "src").focus();
    await userEvent.keyboard("re");
    expect(document.activeElement).toBe(item(el, "readme"));
    document.body.innerHTML = "";
    const other = tree();
    item(other, "src").focus();
    await userEvent.keyboard("p");
    expect(document.activeElement).toBe(item(other, "pkg"));
  });

  it("mirrors the open and close keys in right-to-left", async () => {
    const el = tree("", "rtl");
    item(el, "src").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(item(el, "src").getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{ArrowLeft}");
    expect(item(el, "src").getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(item(el, "app"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(item(el, "src"));
  });

  it("loads the children of a lazy folder on first open", async () => {
    let release: (children: FileTreeNode[]) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<FileTreeNode[]>((resolve) => {
          release = resolve;
        }),
    );
    const el = tree("", "ltr", [{ id: "remote", name: "remote", lazy: true }]);
    el.loadChildren = load;
    item(el, "remote").focus();
    expect(item(el, "remote").getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{ArrowRight}");
    expect(load).toHaveBeenCalledTimes(1);
    expect(item(el, "remote").getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(item(el, "remote"));
    release([{ id: "r1", name: "one.txt" }]);
    await vi.waitFor(() => expect(item(el, "r1")).toBeTruthy());
    expect(item(el, "remote").hasAttribute("aria-busy")).toBe(false);
    expect(item(el, "r1").getAttribute("aria-level")).toBe("2");
    await userEvent.keyboard("{ArrowLeft}{ArrowRight}");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("closes a lazy folder and reports an error when loading fails", async () => {
    const el = tree("", "ltr", [{ id: "remote", name: "remote", lazy: true }]);
    el.loadChildren = () => Promise.reject(new Error("offline"));
    const error = vi.fn();
    el.addEventListener("loaderror", error);
    item(el, "remote").focus();
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(item(el, "remote").getAttribute("aria-expanded")).toBe("false");
    expect(item(el, "remote").hasAttribute("aria-busy")).toBe(false);
  });

  it("loads a lazy folder that is open from the start and never mutates the caller's nodes", async () => {
    const data: FileTreeNode[] = [{ id: "remote", name: "remote", lazy: true }];
    const load = vi.fn(async () => [{ id: "r1", name: "one.txt" }]);
    const el = tree('expanded="remote"', "ltr", data);
    el.loadChildren = load;
    await vi.waitFor(() => expect(item(el, "r1")).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
    expect(data[0]).toEqual({ id: "remote", name: "remote", lazy: true });
    el.expandedIds = [];
    el.expandedIds = ["remote"];
    expect(item(el, "r1")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reports the collapse when a load fails", async () => {
    const el = tree("", "ltr", [{ id: "remote", name: "remote", lazy: true }]);
    el.loadChildren = () => Promise.reject(new Error("offline"));
    const changed = vi.fn();
    el.addEventListener("expandedchange", changed);
    item(el, "remote").focus();
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ detail: { ids: [] } }));
  });

  it("drops a stale answer when the nodes were replaced and moves focus off a removed row", async () => {
    let release: (children: FileTreeNode[]) => void = () => {};
    const el = tree("", "ltr", [{ id: "remote", name: "remote", lazy: true }]);
    el.loadChildren = () =>
      new Promise<FileTreeNode[]>((resolve) => {
        release = resolve;
      });
    item(el, "remote").focus();
    await userEvent.keyboard("{ArrowRight}");
    el.nodes = [
      { id: "other", name: "other" },
      { id: "remote", name: "remote", lazy: true },
    ];
    release([{ id: "r1", name: "late.txt" }]);
    await vi.waitFor(() => expect(item(el, "remote").hasAttribute("aria-busy")).toBe(false));
    expect(item(el, "r1")).toBeNull();
    el.nodes = [{ id: "other", name: "other" }];
    expect(document.activeElement).toBe(item(el, "other"));
  });

  it("registers under a custom prefix", () => {
    expect(defineFileTree({ prefix: "acme" })).toBe("acme-file-tree");
  });
});
