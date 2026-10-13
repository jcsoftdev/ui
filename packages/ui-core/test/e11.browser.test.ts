import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createSortable, type SortableList } from "../src/sortable.ts";
import { createTree, type TreeNode } from "../src/tree.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createTree rtl", () => {
  const nodes: TreeNode[] = [{ id: "d", name: "d", children: [{ id: "f", name: "f" }] }];

  function setup(rtl: boolean) {
    const host = document.createElement("div");
    document.body.append(host);
    let expanded = new Set<string>();
    const render = () => {
      host.innerHTML = tree
        .rows()
        .map((row) => `<div data-node-id="${row.node.id}">${row.node.name}</div>`)
        .join("");
      tree.update();
    };
    const tree = createTree(host, {
      nodes: () => nodes,
      expanded: () => expanded,
      rtl: () => rtl,
      onExpandedChange: (ids) => {
        expanded = new Set(ids);
        render();
      },
    });
    render();
    (host.querySelector("[data-node-id=d]") as HTMLElement).focus();
    return host;
  }

  it("ArrowLeft opens and ArrowRight closes when rtl", async () => {
    const host = setup(true);
    await userEvent.keyboard("{ArrowRight}");
    expect(host.querySelector("[data-node-id=d]")?.getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard("{ArrowLeft}");
    expect(host.querySelector("[data-node-id=d]")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps ArrowRight opening by default", async () => {
    const host = setup(false);
    await userEvent.keyboard("{ArrowRight}");
    expect(host.querySelector("[data-node-id=d]")?.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("createSortable rtl and labels", () => {
  function setup(rtl: boolean) {
    const host = document.createElement("div");
    document.body.append(host);
    const lists: SortableList<{ id: string; title: string }>[] = [
      { id: "a", items: [{ id: "1", title: "First card" }] },
      { id: "b", items: [] },
    ];
    const announce = vi.fn();
    const onMove = vi.fn();
    const render = (current: readonly SortableList<{ id: string; title: string }>[]) => {
      host.innerHTML = current
        .map(
          (l) =>
            `<ul data-sortable-list="${l.id}">${l.items
              .map((i) => `<li tabindex="0" data-sortable-item="${i.id}">${i.title}</li>`)
              .join("")}</ul>`,
        )
        .join("");
    };
    createSortable(host, {
      lists: () => lists,
      getId: (x) => x.id,
      rtl: () => rtl,
      itemLabel: (x) => x.title,
      listLabel: (l) => `List ${l.id.toUpperCase()}`,
      announce,
      onMove,
      onDraft: (draft) => {
        render(draft ?? lists);
        if (draft) (host.querySelector("[data-sortable-item]") as HTMLElement).focus();
      },
    });
    render(lists);
    (host.querySelector("[data-sortable-item]") as HTMLElement).focus();
    return { announce, onMove };
  }

  it("announces item and list labels instead of ids", async () => {
    const { announce } = setup(false);
    await userEvent.keyboard(" {ArrowRight}");
    expect(announce).toHaveBeenCalledWith("Picked up First card: List A, 1 / 1.");
    expect(announce).toHaveBeenLastCalledWith("Moved First card: List B, 1 / 1.");
    await userEvent.keyboard("{Escape}");
    expect(announce).toHaveBeenLastCalledWith("Cancelled: First card returns to its place.");
  });

  it("goes to the next list with ArrowLeft when rtl, and ignores ArrowRight", async () => {
    const { announce } = setup(true);
    await userEvent.keyboard(" {ArrowRight}");
    expect(announce).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{ArrowLeft}");
    expect(announce).toHaveBeenLastCalledWith("Moved First card: List B, 1 / 1.");
  });
});
