import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineChatMessage, type UiChatMessage } from "../src/chat-message/chat-message.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineChatMessage();
});

afterEach(() => {
  document.body.innerHTML = "";
  (window as unknown as { hacked?: unknown }).hacked = undefined;
});

const pwned = () => (window as unknown as { hacked?: unknown }).hacked;
const bubble = (el: Element) => el.querySelector("[data-ui-part=bubble]") as HTMLElement;

const PAYLOADS = [
  `<img src=x onerror="window.hacked=1">`,
  `<script>window.hacked=1</script>`,
  `<svg onload="window.hacked=1"></svg>`,
  `[click](javascript:window.hacked=1)`,
];

describe("ui-chat-message", () => {
  it("is a named article with an avatar, the bubble, time and aria-busy while streaming", async () => {
    const host = mount(
      `<ui-chat-message author="assistant" name="Ada Lovelace" content="Hola" time="10:30" status="streaming"></ui-chat-message>`,
    );
    const el = host.querySelector<UiChatMessage>("ui-chat-message")!;
    expect(await ax("article", "Ada Lovelace")).toBeTruthy();
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.querySelector("[data-ui-part=avatar]")!.textContent).toBe("AL");
    expect(bubble(el).textContent).toBe("Hola");
    expect(el.querySelector("[data-ui-part=time]")!.textContent).toBe("10:30");
    el.status = "done";
    expect(el.hasAttribute("aria-busy")).toBe(false);
  });

  it("shows a typing indicator while an empty answer streams, and a role=alert on error", async () => {
    const host = mount(`<ui-chat-message status="streaming"></ui-chat-message>`);
    const el = host.querySelector<UiChatMessage>("ui-chat-message")!;
    expect(await ax("status", "El asistente está escribiendo")).toBeTruthy();
    el.status = "error";
    expect(el.querySelector("[role=alert]")!.textContent).toBe("No se pudo enviar el mensaje.");
  });

  it("moves slot=footer children under the bubble and keeps other children as the body", () => {
    const host = mount(
      `<ui-chat-message author="user"><b>rich</b><span slot="footer">actions</span></ui-chat-message>`,
    );
    const el = host.querySelector<UiChatMessage>("ui-chat-message")!;
    expect(bubble(el).querySelector("b")).toBeTruthy();
    expect(el.footer.textContent).toBe("actions");
  });

  for (const payload of PAYLOADS) {
    it(`renders ${JSON.stringify(payload)} inert as text by default`, async () => {
      const host = mount(`<ui-chat-message author="assistant"></ui-chat-message>`);
      const el = host.querySelector<UiChatMessage>("ui-chat-message")!;
      el.content = payload;
      await wait(50);
      expect(bubble(el).textContent).toBe(payload);
      expect(bubble(el).querySelectorAll("img, script, svg, a").length).toBe(0);
      expect(pwned()).toBeUndefined();
    });
  }

  it("markdown goes through ui-core: raw HTML stays text, javascript: links are not links", async () => {
    const source = `**bold** <img src=x onerror="window.hacked=1"> [x](javascript:window.hacked=1) [ok](https://example.com)`;
    const host = mount(`<ui-chat-message author="assistant" format="markdown"></ui-chat-message>`);
    const el = host.querySelector<UiChatMessage>("ui-chat-message")!;
    el.content = source;
    await wait(100);
    const body = bubble(el);
    expect(body.querySelector("strong, b")?.textContent).toBe("bold");
    expect(body.querySelectorAll("img").length).toBe(0);
    expect(body.textContent).toContain('<img src=x onerror="window.hacked=1">');
    const hrefs = [...body.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://example.com/"]);
    await wait(50);
    expect(pwned()).toBeUndefined();
  });

  it("html format is sanitised by ui-core, and user messages never render rich", async () => {
    const source = `<p>hi</p><img src=x onerror="window.hacked=1"><script>window.hacked=1</script><a href="javascript:window.hacked=1">x</a>`;
    const host = mount(
      `<ui-chat-message author="assistant" format="html"></ui-chat-message><ui-chat-message author="user" format="html"></ui-chat-message>`,
    );
    const [assistant, user] = host.querySelectorAll<UiChatMessage>(
      "ui-chat-message",
    ) as unknown as UiChatMessage[];
    assistant!.content = source;
    user!.content = source;
    await wait(100);
    expect(bubble(assistant!).querySelector("p")?.textContent).toBe("hi");
    expect(bubble(assistant!).querySelectorAll("img, script").length).toBe(0);
    for (const a of bubble(assistant!).querySelectorAll("a"))
      expect(a.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    expect(bubble(user!).textContent).toBe(source);
    await wait(50);
    expect(pwned()).toBeUndefined();
  });
});
