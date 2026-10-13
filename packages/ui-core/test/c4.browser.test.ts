import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createDisclosure } from "../src/disclosure.ts";
import { createSortable, type SortableList } from "../src/sortable.ts";
import { createTree, type TreeNode } from "../src/tree.ts";
import { createVirtualList } from "../src/virtual-list.ts";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createTree", () => {
  const nodes: TreeNode[] = [
    { id: "src", name: "src", children: [{ id: "app", name: "app.ts" }] },
    { id: "readme", name: "README.md" },
  ];

  function setup() {
    const host = mount("");
    let expanded = new Set<string>();
    let selected: string | null = null;
    const onSelect = vi.fn((id: string) => {
      selected = id;
    });
    const render = () => {
      const had = (document.activeElement as HTMLElement | null)?.dataset?.nodeId;
      host.innerHTML = "";
      const list = tree.rows();
      for (const row of list) {
        const el = document.createElement("div");
        el.dataset.nodeId = row.node.id;
        el.textContent = row.node.name;
        host.append(el);
      }
      tree.update();
      if (had) tree.focus(had);
    };
    const tree = createTree(host, {
      nodes: () => nodes,
      expanded: () => expanded,
      selected: () => selected,
      onSelect,
      onExpandedChange: (ids) => {
        expanded = new Set(ids);
        render();
      },
    });
    render();
    return { host, onSelect };
  }

  it("exposes the tree ARIA state with a single tab stop", () => {
    const { host } = setup();
    const [src, readme] = Array.from(host.children) as HTMLElement[];
    expect(src?.getAttribute("role")).toBe("treeitem");
    expect(src?.getAttribute("aria-expanded")).toBe("false");
    expect(src?.getAttribute("aria-level")).toBe("1");
    expect(readme?.getAttribute("aria-setsize")).toBe("2");
    expect(readme?.hasAttribute("aria-expanded")).toBe(false);
    expect([src?.tabIndex, readme?.tabIndex]).toEqual([0, -1]);
  });

  it("opens with ArrowRight, descends, closes with ArrowLeft and jumps with End", async () => {
    const { host } = setup();
    (host.children[0] as HTMLElement).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(host.children[0]?.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement?.textContent).toBe("app.ts");
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement?.textContent).toBe("src");
    await userEvent.keyboard("{End}");
    expect(document.activeElement?.textContent).toBe("README.md");
    await userEvent.keyboard("{Home}{ArrowLeft}");
    expect(host.children).toHaveLength(2);
  });

  it("selects with Enter, toggles a branch and finds rows by typing", async () => {
    const { host, onSelect } = setup();
    (host.children[0] as HTMLElement).focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("src", expect.anything());
    expect(host.children[0]?.getAttribute("aria-selected")).toBe("true");
    expect(host.children[0]?.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("r");
    expect(document.activeElement?.textContent).toBe("README.md");
  });
});

describe("createDisclosure", () => {
  it("wires aria-expanded/controls, makes a closed panel inert and fires once per change", async () => {
    const host = mount(`<button>Toggle</button><div><p>body</p></div>`);
    const trigger = host.querySelector("button") as HTMLElement;
    const panel = host.querySelector("div") as HTMLElement;
    const onOpenChange = vi.fn();
    const d = createDisclosure({ trigger, panel, onOpenChange });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.inert).toBe(true);
    await userEvent.click(trigger);
    expect(panel.inert).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    d.set(true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    d.control(false);
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });
});

describe("createVirtualList", () => {
  it("windows fixed rows on scroll and scrolls an index into view", async () => {
    const host = mount(
      `<div style="height:100px;overflow:auto"><div style="height:10000px"></div></div>`,
    );
    const scroller = host.firstElementChild as HTMLElement;
    const onChange = vi.fn();
    const list = createVirtualList(scroller, {
      count: () => 1000,
      rowHeight: 10,
      overscan: 0,
      onChange,
    });
    expect(list.window.start).toBe(0);
    expect(list.window.end).toBe(11);
    scroller.scrollTop = 500;
    await vi.waitFor(() => expect(list.window.start).toBe(50));
    list.scrollToIndex(900);
    await vi.waitFor(() => expect(list.window.start).toBeGreaterThanOrEqual(890));
    list.destroy();
  });

  it("keeps exact offsets once measured heights replace the estimate", () => {
    const host = mount(
      `<div style="height:100px;overflow:auto"><div style="height:10000px"></div></div>`,
    );
    const list = createVirtualList(host.firstElementChild as HTMLElement, {
      count: () => 100,
      estimateHeight: 20,
      overscan: 0,
      onChange: () => {},
    });
    expect(list.window.totalHeight).toBe(2000);
    list.measure(0, 120);
    expect(list.window.totalHeight).toBe(2100);
    expect(list.window.end).toBe(1);
    list.destroy();
  });
});

describe("createSortable", () => {
  function setup() {
    const host = mount("");
    let lists: SortableList<string>[] = [
      { id: "a", items: ["1", "2"] },
      { id: "b", items: ["3"] },
    ];
    const announce = vi.fn();
    const onMove = vi.fn((_m, next: SortableList<string>[]) => {
      lists = next;
      render(lists);
    });
    const render = (current: readonly SortableList<string>[]) => {
      host.innerHTML = current
        .map(
          (l) =>
            `<ul data-sortable-list="${l.id}">${l.items
              .map((i) => `<li tabindex="0" data-sortable-item="${i}">${i}</li>`)
              .join("")}</ul>`,
        )
        .join("");
    };
    const sortable = createSortable<string>(host, {
      lists: () => lists,
      getId: (x) => x,
      onMove,
      announce,
      onDraft: (draft) => render(draft ?? lists),
    });
    render(lists);
    return {
      host,
      onMove,
      announce,
      sortable,
      get lists() {
        return lists;
      },
    };
  }

  it("picks up with Space, moves across lists with arrows and commits once on drop", async () => {
    const ctx = setup();
    (ctx.host.querySelector('[data-sortable-item="1"]') as HTMLElement).focus();
    await userEvent.keyboard(" ");
    expect(ctx.sortable.grabbed).toBe("1");
    await userEvent.keyboard("{ArrowDown}{ArrowRight}");
    expect(ctx.onMove).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("1");
    await userEvent.keyboard(" ");
    expect(ctx.onMove).toHaveBeenCalledTimes(1);
    expect(ctx.onMove.mock.calls[0]?.[0]).toMatchObject({
      itemId: "1",
      fromListId: "a",
      toListId: "b",
    });
    expect(ctx.lists.map((l) => l.items)).toEqual([["2"], ["3", "1"]]);
    expect(ctx.announce).toHaveBeenCalled();
  });

  it("Escape restores the original order without reporting a move", async () => {
    const ctx = setup();
    (ctx.host.querySelector('[data-sortable-item="2"]') as HTMLElement).focus();
    await userEvent.keyboard(" {ArrowUp}{Escape}");
    expect(ctx.onMove).not.toHaveBeenCalled();
    expect(ctx.host.querySelector("ul")?.textContent).toBe("12");
  });

  it("drags with the pointer and drops into another list", async () => {
    const ctx = setup();
    const item = ctx.host.querySelector('[data-sortable-item="1"]') as HTMLElement;
    const target = ctx.host.querySelector('[data-sortable-list="b"]') as HTMLElement;
    const from = item.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const fire = (type: string, x: number, y: number, el: EventTarget) =>
      el.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true }),
      );
    fire("pointerdown", from.x + 2, from.y + 2, item);
    fire("pointermove", to.x + 5, to.y + to.height / 2, window);
    fire("pointerup", to.x + 5, to.y + to.height / 2, window);
    expect(ctx.onMove).toHaveBeenCalledTimes(1);
    expect(ctx.onMove.mock.calls[0]?.[0]).toMatchObject({ itemId: "1", toListId: "b" });
  });
});
