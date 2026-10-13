import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  defineMessageActions,
  type UiMessageActions,
} from "../src/message-actions/message-actions.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineMessageActions();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const buttons = (el: Element) =>
  [...el.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.hidden);

describe("ui-message-actions", () => {
  it("is a toolbar with one tab stop and arrow-key roving", async () => {
    const host = mount(
      `<ui-message-actions text="hi" regenerate feedbackable></ui-message-actions>`,
    );
    const el = host.querySelector<UiMessageActions>("ui-message-actions")!;
    expect(await ax("toolbar", "Acciones del mensaje")).toBeTruthy();
    const items = buttons(el);
    expect(items.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Copiar mensaje",
      "Regenerar respuesta",
      "Me gusta",
      "No me gusta",
    ]);
    expect(items.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    await userEvent.tab();
    expect(document.activeElement).toBe(items[0]);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(items[2]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(items[3]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[0]);
    await userEvent.tab();
    expect(el.contains(document.activeElement)).toBe(false);
  });

  it("hides optional buttons until their attributes are set", () => {
    const host = mount(`<ui-message-actions text="hi"></ui-message-actions>`);
    const el = host.querySelector<UiMessageActions>("ui-message-actions")!;
    expect(buttons(el).length).toBe(1);
    el.setAttribute("regenerate", "");
    expect(buttons(el).length).toBe(2);
  });

  it("copies through the clipboard with label, icon and live feedback, then resets", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    const host = mount(`<ui-message-actions text="Hello **world**"></ui-message-actions>`);
    const el = host.querySelector<UiMessageActions>("ui-message-actions")!;
    const onCopy = vi.fn();
    el.addEventListener("copied", (e) => onCopy((e as CustomEvent).detail));
    const copy = el.querySelector<HTMLButtonElement>("[data-action=copy]")!;
    copy.click();
    await wait(30);
    expect(writeText).toHaveBeenCalledWith("Hello **world**");
    expect(onCopy).toHaveBeenCalledWith({ text: "Hello **world**" });
    expect(copy.getAttribute("aria-label")).toBe("Mensaje copiado");
    expect(el.querySelector("[role=status]")!.textContent).toBe("Mensaje copiado");
    expect(await ax("button", "Mensaje copiado")).toBeTruthy();
    await wait(1800);
    expect(copy.getAttribute("aria-label")).toBe("Copiar mensaje");
    expect(el.querySelector("[role=status]")!.textContent).toBe("");
  });

  it("falls back to the enclosing chat message content when no text is given", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    const host = mount(
      `<div data-ui="chat-message"><ui-message-actions></ui-message-actions></div>`,
    );
    (host.firstElementChild as HTMLElement & { content?: string }).content = "From the message";
    host.querySelector<HTMLButtonElement>("[data-action=copy]")!.click();
    await wait(30);
    expect(writeText).toHaveBeenCalledWith("From the message");
  });

  it("toggles feedback off on a second press and reports each value", () => {
    const host = mount(`<ui-message-actions text="x" feedbackable></ui-message-actions>`);
    const el = host.querySelector<UiMessageActions>("ui-message-actions")!;
    const values: unknown[] = [];
    el.addEventListener("feedback", (e) => values.push((e as CustomEvent).detail.value));
    const like = el.querySelector<HTMLButtonElement>("[data-action=like]")!;
    const dislike = el.querySelector<HTMLButtonElement>("[data-action=dislike]")!;
    like.click();
    expect(like.getAttribute("aria-pressed")).toBe("true");
    dislike.click();
    expect([like.getAttribute("aria-pressed"), dislike.getAttribute("aria-pressed")]).toEqual([
      "false",
      "true",
    ]);
    dislike.click();
    expect(el.feedback).toBe(null);
    expect(values).toEqual(["like", "dislike", null]);
  });

  it("copies the body of a message that has its content in children", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    const host = mount(
      `<div data-ui="chat-message"><div data-ui-part="body"> Rich <b>body</b> </div><ui-message-actions></ui-message-actions></div>`,
    );
    (host.firstElementChild as HTMLElement & { content?: string }).content = "";
    host.querySelector<HTMLButtonElement>("[data-action=copy]")!.click();
    await wait(30);
    expect(writeText).toHaveBeenCalledWith("Rich body");
  });
});
