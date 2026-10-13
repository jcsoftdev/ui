import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { type ChatListItem, defineChatList, type UiChatList } from "../src/chat-list/chat-list.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineChatList();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const NOW = "2026-03-15T12:00:00";
const day = (back: number) => new Date(2026, 2, 15 - back, 9).toISOString();

const ITEMS: ChatListItem[] = [
  { id: "a", title: "Plan <b>trip</b>", updatedAt: day(0), preview: "Where to?", unread: true },
  { id: "b", title: "Recipes", updatedAt: day(1) },
  { id: "c", title: "Old chat", updatedAt: day(90) },
  { id: "d", title: "Newer today", updatedAt: new Date(2026, 2, 15, 11).toISOString() },
];

const setup = (attrs = "", items = ITEMS) => {
  const host = mount(`<ui-chat-list now="${NOW}" ${attrs}></ui-chat-list>`);
  const el = host.querySelector<UiChatList>("ui-chat-list")!;
  el.items = items;
  return el;
};

describe("ui-chat-list", () => {
  it("is a named navigation with date groups, newest first, and the active row marked", async () => {
    const el = setup('active-id="b"');
    expect(await ax("navigation", "Conversaciones")).toBeTruthy();
    const groups = [...el.querySelectorAll("[data-ui-part=group]")].map((g) => ({
      title: g.querySelector("h3")!.textContent,
      rows: [...g.querySelectorAll("[data-ui-part=title]")].map((t) => t.textContent),
    }));
    expect(groups).toEqual([
      { title: "Hoy", rows: ["Newer today", "Plan <b>trip</b>"] },
      { title: "Ayer", rows: ["Recipes"] },
      { title: "Anteriores", rows: ["Old chat"] },
    ]);
    expect(el.querySelector('[aria-current="true"] [data-ui-part=title]')!.textContent).toBe(
      "Recipes",
    );
    expect(el.querySelectorAll("b").length).toBe(0);
    expect(el.querySelector("[data-ui-part=unread] + [data-ui-part=sr]")!.textContent).toBe(
      "Sin leer: ",
    );
    expect(el.querySelector("section")!.getAttribute("aria-labelledby")).toBe(
      el.querySelector("h3")!.id,
    );
  });

  it("fires select, new and delete with the row id", async () => {
    const el = setup("creatable deletable");
    const events: [string, unknown][] = [];
    for (const type of ["select", "new", "delete"])
      el.addEventListener(type, (e) => events.push([type, (e as CustomEvent).detail]));
    el.querySelector<HTMLButtonElement>('[data-action="select"][data-id="c"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-action="delete"][data-id="b"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-action="new"]')!.click();
    expect(events).toEqual([
      ["select", { id: "c" }],
      ["delete", { id: "b" }],
      ["new", null],
    ]);
    expect(await ax("button", "Eliminar Recipes")).toBeTruthy();
    expect(await ax("button", "Nueva conversación")).toBeTruthy();
  });

  it("keeps focus on the same control when it re-renders", () => {
    const el = setup();
    const row = el.querySelector<HTMLButtonElement>('[data-action="select"][data-id="b"]')!;
    row.focus();
    el.activeId = "b";
    expect((document.activeElement as HTMLElement).dataset.id).toBe("b");
  });

  it("shows the empty text without items", () => {
    const el = setup('empty-text="Nothing yet"', []);
    expect(el.querySelector("[data-ui-part=empty]")!.textContent).toBe("Nothing yet");
  });

  it("windows a long list and moves between conversations with the arrow keys", async () => {
    const many: ChatListItem[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `c${i}`,
      title: `Chat ${i}`,
      updatedAt: new Date(2026, 2, 15, 8, 0, 1000 - i).toISOString(),
    }));
    const host = mount(
      `<div style="height:300px"><ui-chat-list now="${NOW}"></ui-chat-list></div>`,
    );
    const el = host.querySelector<UiChatList>("ui-chat-list")!;
    el.items = many;
    await wait(200);
    const rendered = el.querySelectorAll('[data-action="select"]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);
    const first = el.querySelector<HTMLButtonElement>('[data-action="select"]')!;
    expect(first.dataset.id).toBe("c0");
    first.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect((document.activeElement as HTMLElement).dataset.id).toBe("c2");
    await userEvent.keyboard("{End}");
    await wait(100);
    expect((document.activeElement as HTMLElement).dataset.id).toBe("c999");
    expect(el.querySelectorAll('[data-action="select"]').length).toBeLessThan(60);
  });
});
