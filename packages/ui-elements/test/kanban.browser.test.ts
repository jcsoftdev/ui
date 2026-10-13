import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineKanban, type KanbanColumn, type UiKanban } from "../src/kanban/kanban.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineKanban();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const board = (): KanbanColumn[] => [
  {
    id: "todo",
    title: "To do",
    cards: [
      { id: "a", title: "Write spec", tag: "docs", assignee: "Ana Ruiz" },
      { id: "b", title: "Build it" },
      { id: "c", title: "Ship it" },
    ],
  },
  { id: "doing", title: "Doing", wipLimit: 1, cards: [{ id: "d", title: "Review" }] },
  { id: "done", title: "Done", cards: [] },
];

const kanban = (attrs = "", dir = "ltr") => {
  const el = mount(
    `<div dir="${dir}" style="width:900px"><ui-kanban label="Sprint" ${attrs}></ui-kanban></div>`,
  ).querySelector<UiKanban>("ui-kanban")!;
  el.columns = board();
  return el;
};

const card = (el: Element, id: string) =>
  el.querySelector<HTMLElement>(`[data-sortable-item="${id}"]`)!;
const ids = (el: Element, column: string) =>
  [...el.querySelectorAll(`[data-sortable-list="${column}"] [data-sortable-item]`)].map(
    (node) => (node as HTMLElement).dataset.sortableItem,
  );
const status = (el: Element) => el.querySelector("[data-ui-part=status]")!.textContent;

describe("ui-kanban", () => {
  it("exposes the board, columns and positioned draggable cards", async () => {
    const el = kanban();
    expect(await ax("group", "Sprint")).toBeTruthy();
    expect(await ax("button", "Write spec docs AR")).toBeTruthy();
    const b = card(el, "b");
    expect(b.getAttribute("role")).toBe("button");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(b.getAttribute("aria-roledescription")).toBe("draggable card");
    expect(b.parentElement!.getAttribute("aria-posinset")).toBe("2");
    expect(b.parentElement!.getAttribute("aria-setsize")).toBe("3");
    expect(document.getElementById(b.getAttribute("aria-describedby")!)!.textContent).toContain(
      "Space",
    );
    const chip = el.querySelector("[data-sortable-list=doing] [data-ui-part=count]")!;
    expect(chip.textContent).toBe("1/1");
    expect(chip.getAttribute("data-state")).toBe("at-limit");
    expect(chip.getAttribute("aria-label")).toBe("1 of 1 cards, work-in-progress limit");
    expect(el.querySelector("[data-sortable-list=done] [data-ui-part=empty]")!.textContent).toBe(
      "No cards",
    );
    expect(el.querySelector("[data-ui-part=status]")!.getAttribute("role")).toBe("status");
  });

  it("picks up, moves across columns, announces and drops with the keyboard", async () => {
    const el = kanban();
    const move = vi.fn();
    el.addEventListener("move", move);
    card(el, "a").focus();
    await userEvent.keyboard(" ");
    expect(card(el, "a").getAttribute("aria-pressed")).toBe("true");
    expect(status(el)).toBe("Picked up Write spec: To do, 1 / 3.");
    await userEvent.keyboard("{ArrowDown}");
    expect(status(el)).toBe("Moved Write spec: To do, 2 / 3.");
    expect(ids(el, "todo")).toEqual(["b", "a", "c"]);
    expect(document.activeElement).toBe(card(el, "a"));
    await userEvent.keyboard("{ArrowRight}");
    expect(ids(el, "doing")).toEqual(["d", "a"].slice(0, 2));
    await userEvent.keyboard("{ArrowRight}");
    expect(ids(el, "done")).toEqual(["a"]);
    expect(status(el)).toBe("Moved Write spec: Done, 1 / 1.");
    expect(move).not.toHaveBeenCalled();
    await userEvent.keyboard(" ");
    expect(status(el)).toBe("Dropped Write spec: Done, 1 / 1.");
    expect(move).toHaveBeenCalledTimes(1);
    expect(move.mock.calls[0]![0].detail.move).toEqual({
      itemId: "a",
      fromListId: "todo",
      fromIndex: 0,
      toListId: "done",
      toIndex: 0,
    });
    expect(el.columns[2]!.cards.map((c) => c.id)).toEqual(["a"]);
    expect(ids(el, "todo")).toEqual(["b", "c"]);
    expect(document.activeElement).toBe(card(el, "a"));
    expect(card(el, "a").getAttribute("aria-pressed")).toBe("false");
  });

  it("cancels with Escape and leaves the data alone", async () => {
    const el = kanban();
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowRight}");
    expect(ids(el, "doing")).toContain("a");
    await userEvent.keyboard("{Escape}");
    expect(status(el)).toBe("Cancelled: Write spec returns to its place.");
    expect(ids(el, "todo")).toEqual(["a", "b", "c"]);
    expect(el.columns[0]!.cards).toHaveLength(3);
    expect(document.activeElement).toBe(card(el, "a"));
  });

  it("lets the owner veto a move", async () => {
    const el = kanban();
    el.addEventListener("move", (event) => event.preventDefault());
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowDown} ");
    expect(ids(el, "todo")).toEqual(["a", "b", "c"]);
    expect(el.columns[0]!.cards.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("skips a full column and refuses when no column has room", async () => {
    const el = kanban("enforce-limit");
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowRight}");
    expect(status(el)).toBe("Moved Write spec: Done, 1 / 1.");
    await userEvent.keyboard("{Escape}");
    el.columns = board().map((c) => (c.id === "done" ? { ...c, wipLimit: 0 } : c));
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowRight}");
    expect(status(el)).toBe("That list reached its limit.");
    expect(ids(el, "todo")).toEqual(["a", "b", "c"]);
  });

  it("mirrors the cross-column arrows in right-to-left", async () => {
    const el = kanban("", "rtl");
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowLeft}");
    expect(ids(el, "doing")).toContain("a");
    await userEvent.keyboard("{ArrowRight}");
    expect(ids(el, "todo")).toContain("a");
    await userEvent.keyboard("{Escape}");
  });

  it("drags a card to another column with the pointer", () => {
    const el = kanban();
    const move = vi.fn();
    el.addEventListener("move", move);
    const from = card(el, "b").getBoundingClientRect();
    const target = el.querySelector("[data-sortable-list=done]")!.getBoundingClientRect();
    const fire = (type: string, x: number, y: number) =>
      window.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 3,
          pointerType: "mouse",
          button: 0,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    card(el, "b").dispatchEvent(
      new PointerEvent("pointerdown", {
        pointerId: 3,
        pointerType: "mouse",
        button: 0,
        clientX: from.left + 20,
        clientY: from.top + 10,
        bubbles: true,
      }),
    );
    fire("pointermove", from.left + 40, from.top + 40);
    fire("pointermove", target.left + 30, target.top + 60);
    expect(el.querySelector("[data-drop-indicator]")).toBeTruthy();
    expect(el.querySelector("[data-ui-part=ghost]")).toBeTruthy();
    expect(card(el, "b").hasAttribute("data-dragging")).toBe(true);
    fire("pointerup", target.left + 30, target.top + 60);
    expect(ids(el, "done")).toEqual(["b"]);
    expect(ids(el, "todo")).toEqual(["a", "c"]);
    expect(move).toHaveBeenCalledTimes(1);
    expect(el.querySelector("[data-ui-part=ghost]")).toBeNull();
    expect(el.querySelector("[data-drop-indicator]")).toBeNull();
  });

  it("announces a vetoed move as cancelled, not dropped", async () => {
    const el = kanban();
    const said: string[] = [];
    new MutationObserver(() => said.push(status(el) ?? "")).observe(
      el.querySelector("[data-ui-part=status]")!,
      { childList: true, characterData: true, subtree: true },
    );
    el.addEventListener("move", (event) => event.preventDefault());
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowDown} ");
    await vi.waitFor(() => expect(status(el)).toBe("Move cancelled: Write spec stays in To do."));
    expect(said.some((m) => m.startsWith("Dropped"))).toBe(false);
  });

  it("creates one controller when upgraded with enforce-limit", async () => {
    document.body.innerHTML = `<ui-late-kanban label="x" enforce-limit></ui-late-kanban>`;
    defineKanban({ prefix: "ui-late" });
    const el = document.querySelector<UiKanban>("ui-late-kanban")!;
    el.columns = board();
    const said: string[] = [];
    new MutationObserver(() => said.push(status(el) ?? "")).observe(
      el.querySelector("[data-ui-part=status]")!,
      { childList: true, characterData: true, subtree: true },
    );
    card(el, "b").focus();
    await userEvent.keyboard(" {ArrowDown} ");
    await vi.waitFor(() => expect(status(el)).toContain("Dropped Build it"));
    expect(said.filter((m) => m.startsWith("Picked up"))).toHaveLength(1);
    expect(said.some((m) => m.startsWith("Cancelled"))).toBe(false);
    // toggling after connect takes effect on the next move
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowRight}");
    expect(status(el)).toContain("Moved Write spec: Done");
    await userEvent.keyboard("{Escape}");
    el.removeAttribute("enforce-limit");
    card(el, "a").focus();
    await userEvent.keyboard(" {ArrowRight}");
    expect(status(el)).toContain("Moved Write spec: Doing");
  });

  it("registers under a custom prefix", () => {
    expect(defineKanban({ prefix: "acme" })).toBe("acme-kanban");
  });
});
