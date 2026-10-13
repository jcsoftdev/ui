import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChatMessage } from "../src/chat-message/chat-message.ts";
import {
  type ConversationMessage,
  defineConversation,
  type UiConversation,
} from "../src/conversation/conversation.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineChatMessage();
  defineConversation();
});

afterEach(() => {
  document.body.innerHTML = "";
  (window as unknown as { hacked?: unknown }).hacked = undefined;
});

const make = (n: number, from = 0): ConversationMessage[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${from + i}`,
    author: (from + i) % 2 ? "assistant" : "user",
    content: `Message number ${from + i} with enough words to occupy a line or two of the bubble`,
    status: "done",
  }));

const setup = (children = "") => {
  const host = mount(
    `<div style="height:300px"><ui-conversation>${children}</ui-conversation></div>`,
  );
  const el = host.querySelector<UiConversation>("ui-conversation")!;
  const scroller = el.querySelector<HTMLElement>("[data-ui-part=scroller]")!;
  const live = el.querySelector<HTMLElement>("[data-ui-part=sr]")!;
  return {
    host,
    el,
    scroller,
    live,
    jump: el.querySelector<HTMLButtonElement>("[data-ui-part=jump]")!,
  };
};

/** Polls until `check` holds (smooth scrolling has no fixed duration, and CI is slower). */
async function until(check: () => boolean, ms = 5000): Promise<void> {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await wait(50);
}

const atBottom = (s: HTMLElement) => s.scrollHeight - s.scrollTop - s.clientHeight <= 2;

describe("ui-conversation", () => {
  it("is a focusable log that is not itself live, plus one polite status region", async () => {
    const { scroller, live } = setup();
    expect(await ax("log", "Conversación")).toBeTruthy();
    expect(scroller.tabIndex).toBe(0);
    expect(scroller.getAttribute("aria-live")).toBe("off");
    expect(live.getAttribute("role")).toBe("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
  });

  it("follows new content while at the bottom, lets go when scrolled up, and jumps back", async () => {
    const msgs = make(30)
      .map((m) => `<ui-chat-message author="${m.author}" content="${m.content}"></ui-chat-message>`)
      .join("");
    const { el, scroller, jump } = setup(msgs);
    await wait(150);
    expect(atBottom(scroller)).toBe(true);
    el.content.insertAdjacentHTML(
      "beforeend",
      `<ui-chat-message content="newest"></ui-chat-message>`,
    );
    await wait(150);
    expect(atBottom(scroller)).toBe(true);
    expect(jump.hidden).toBe(true);

    scroller.scrollTop = 0;
    await wait(100);
    el.content.insertAdjacentHTML(
      "beforeend",
      `<ui-chat-message content="while away"></ui-chat-message>`,
    );
    await wait(150);
    expect(atBottom(scroller)).toBe(false);
    expect(jump.hidden).toBe(false);
    expect(await ax("button", "Más reciente")).toBeTruthy();
    jump.click();
    await until(() => atBottom(scroller));
    expect(atBottom(scroller)).toBe(true);
    expect(jump.hidden).toBe(true);
  });

  it("moves children appended to the host into the scroller", async () => {
    const { el, scroller } = setup();
    el.insertAdjacentHTML("beforeend", `<ui-chat-message content="late"></ui-chat-message>`);
    await wait(30);
    expect(scroller.querySelector("ui-chat-message")).toBeTruthy();
    expect(el.querySelectorAll(":scope > ui-chat-message").length).toBe(0);
  });

  it("virtualises a large history: few rows in the DOM, still pinned to the newest", async () => {
    const { el, scroller } = setup();
    el.messages = make(2000);
    await wait(300);
    const rows = el.querySelectorAll("[data-ui-part=row]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(40);
    expect(atBottom(scroller)).toBe(true);
    expect(
      el.querySelector('[data-ui-part="row"]:last-child ui-chat-message')?.getAttribute("content"),
    ).toContain("1999");

    scroller.scrollTop = 0;
    await wait(200);
    const first = el.querySelector('[data-ui-part="row"] ui-chat-message');
    expect(first?.getAttribute("content")).toContain("Message number 0 ");
    expect(el.querySelectorAll("[data-ui-part=row]").length).toBeLessThan(40);
  });

  it("renders data-mode messages inert, even a hostile one", async () => {
    const { el } = setup();
    el.messages = [
      {
        id: "x",
        author: "assistant",
        content: `<img src=x onerror="window.hacked=1"><script>window.hacked=1</script>`,
        status: "done",
      },
    ];
    await wait(100);
    const body = el.querySelector("[data-ui-part=bubble]")!;
    expect(body.querySelectorAll("img, script").length).toBe(0);
    expect(body.textContent).toContain("<script>");
    expect((window as unknown as { hacked?: unknown }).hacked).toBeUndefined();
  });

  it("announces politely: not the history, not the user, not streaming, bursts coalesced", async () => {
    const { el, live } = setup();
    const history = make(6);
    el.messages = history;
    await wait(900);
    expect(live.textContent).toBe("");

    el.messages = [
      ...history,
      { id: "u", author: "user", content: "my own message", status: "done" },
    ];
    await wait(900);
    expect(live.textContent).toBe("");

    const streaming: ConversationMessage = {
      id: "a1",
      author: "assistant",
      name: "Ada",
      content: "Wor",
      status: "streaming",
    };
    el.messages = [
      ...history,
      { id: "u", author: "user", content: "my own message", status: "done" },
      streaming,
    ];
    await wait(900);
    expect(live.textContent).toBe("");
    el.messages = [
      ...history,
      { id: "u", author: "user", content: "my own message", status: "done" },
      { ...streaming, content: "Word", status: "streaming" },
    ];
    await wait(900);
    expect(live.textContent).toBe("");

    const done = { ...streaming, content: "Final answer", status: "done" as const };
    const base = [
      ...history,
      { id: "u", author: "user" as const, content: "my own message", status: "done" as const },
    ];
    el.messages = [...base, done];
    await wait(900);
    expect(live.textContent).toBe("Ada: Final answer");

    el.messages = [
      ...base,
      done,
      { id: "b1", author: "assistant", name: "Bo", content: "one", status: "done" },
      { id: "b2", author: "assistant", name: "Bo", content: "two", status: "done" },
      { id: "b3", author: "assistant", name: "Bo", content: "three", status: "done" },
    ];
    await wait(900);
    expect(live.textContent).toBe("3 mensajes nuevos");
  });

  it("announces children-mode assistant messages that arrive after the first paint", async () => {
    const { el, live } = setup(
      `<ui-chat-message author="assistant" name="Ada" content="old"></ui-chat-message>`,
    );
    await wait(900);
    expect(live.textContent).toBe("");
    el.content.insertAdjacentHTML(
      "beforeend",
      `<ui-chat-message author="assistant" name="Ada" content="fresh"></ui-chat-message>`,
    );
    await wait(900);
    expect(live.textContent).toBe("Ada: fresh");
  });

  it("is reachable and scrollable by keyboard", async () => {
    const { scroller } = setup(
      make(30)
        .map((m) => `<ui-chat-message content="${m.content}"></ui-chat-message>`)
        .join(""),
    );
    await wait(150);
    await userEvent.tab();
    expect(document.activeElement).toBe(scroller);
    await frame();
    const before = scroller.scrollTop;
    await userEvent.keyboard("{PageUp}");
    await wait(100);
    expect(scroller.scrollTop).toBeLessThan(before);
  });
});
