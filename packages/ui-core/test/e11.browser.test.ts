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

describe("createSortable owner refusal and full lists", () => {
  type Card = { id: string; title: string };
  function setup(lists: SortableList<Card>[], onMove: () => boolean | undefined) {
    const host = document.createElement("div");
    document.body.append(host);
    const announce = vi.fn();
    const render = (current: readonly SortableList<Card>[]) => {
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
      enforceLimit: true,
      itemLabel: (x) => x.title,
      listLabel: (l) => `List ${l.id.toUpperCase()}`,
      announce,
      onMove,
      onDraft: (draft) => {
        render(draft ?? lists);
        (host.querySelector("[data-sortable-item]") as HTMLElement | null)?.focus();
      },
    });
    render(lists);
    (host.querySelector("[data-sortable-item]") as HTMLElement).focus();
    return announce;
  }

  it("announces a refused move instead of a drop", async () => {
    const announce = setup(
      [
        { id: "a", items: [{ id: "1", title: "One" }] },
        { id: "b", items: [] },
      ],
      () => false,
    );
    await userEvent.keyboard(" {ArrowRight} ");
    const said = announce.mock.calls.map((c) => c[0] as string);
    expect(said.at(-1)).toBe("Move cancelled: One stays in List A.");
    expect(said.some((m) => m.startsWith("Dropped"))).toBe(false);
  });

  it("announces the drop when the owner accepts", async () => {
    const announce = setup(
      [
        { id: "a", items: [{ id: "1", title: "One" }] },
        { id: "b", items: [] },
      ],
      () => undefined,
    );
    await userEvent.keyboard(" {ArrowRight} ");
    expect(announce.mock.calls.at(-1)?.[0]).toBe("Dropped One: List B, 1 / 1.");
  });

  it("skips a full list to the next one with room", async () => {
    const announce = setup(
      [
        { id: "a", items: [{ id: "1", title: "One" }] },
        { id: "b", limit: 1, items: [{ id: "2", title: "Two" }] },
        { id: "c", items: [] },
      ],
      () => undefined,
    );
    await userEvent.keyboard(" {ArrowRight}");
    expect(announce.mock.calls.at(-1)?.[0]).toBe("Moved One: List C, 1 / 1.");
  });
});

describe("tree typeahead folds diacritics", () => {
  it("finds an accented name from the plain letter", async () => {
    const nodes: TreeNode[] = [
      { id: "a", name: "alpha" },
      { id: "e", name: "Éxito" },
    ];
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = '<div data-node-id="a">a</div><div data-node-id="e">e</div>';
    const tree = createTree(host, {
      nodes: () => nodes,
      expanded: () => new Set(),
      onExpandedChange: () => {},
    });
    tree.focus("a");
    await userEvent.keyboard("e");
    expect(document.activeElement?.getAttribute("data-node-id")).toBe("e");
  });
});
