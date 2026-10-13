import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  definePromptInput,
  shouldSend,
  type UiPromptInput,
} from "../src/prompt-input/prompt-input.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  definePromptInput();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const setup = (attrs = "", inner = "") => {
  const host = mount(
    `<form><ui-prompt-input name="prompt" ${attrs}>${inner}</ui-prompt-input></form>`,
  );
  const el = host.querySelector<UiPromptInput>("ui-prompt-input")!;
  const sent = vi.fn();
  el.addEventListener("send", (e) => sent((e as CustomEvent).detail.value));
  return { host, el, sent, form: host.querySelector("form")!, area: el.textarea };
};

describe("shouldSend (golden)", () => {
  it.each([
    [{ key: "Enter", shiftKey: false, isComposing: false }, true],
    [{ key: "Enter", shiftKey: true, isComposing: false }, false],
    [{ key: "Enter", shiftKey: false, isComposing: true }, false],
    [{ key: "Enter", shiftKey: false, isComposing: false, keyCode: 229 }, false],
    [{ key: "a", shiftKey: false, isComposing: false }, false],
  ])("%j -> %s", (event, expected) => {
    expect(shouldSend(event)).toBe(expected);
  });
});

describe("ui-prompt-input", () => {
  it("exposes a named textbox and a labelled send button", async () => {
    setup();
    expect(await ax("textbox", "Mensaje")).toBeTruthy();
    expect(await ax("button", "Enviar mensaje")).toBeTruthy();
  });

  it("Enter sends the trimmed text and clears; Shift+Enter inserts a newline", async () => {
    const { el, sent, area } = setup();
    area.focus();
    await userEvent.keyboard("  hola  ");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}mundo");
    expect(area.value).toBe("  hola  \nmundo");
    expect(sent).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(sent).toHaveBeenCalledWith("hola  \nmundo");
    expect(el.value).toBe("");
    expect(area.value).toBe("");
  });

  it("does not send empty text, or while streaming or disabled", async () => {
    const { el, sent, area } = setup();
    area.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("   {Enter}");
    expect(sent).not.toHaveBeenCalled();
    await userEvent.keyboard("go");
    el.setAttribute("streaming", "");
    await userEvent.keyboard("{Enter}");
    expect(sent).not.toHaveBeenCalled();
    el.removeAttribute("streaming");
    el.setAttribute("disabled", "");
    expect(area.disabled).toBe(true);
  });

  it("never sends on the Enter that confirms an IME composition", () => {
    const { sent, area } = setup();
    area.value = "にほん";
    area.dispatchEvent(new Event("input", { bubbles: true }));
    area.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    area.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(sent).not.toHaveBeenCalled();
    area.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));
    // Safari order: compositionend first, then the confirming Enter keydown in the same tick.
    area.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
    );
    expect(sent).not.toHaveBeenCalled();
    area.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );
    expect(sent).not.toHaveBeenCalled();
  });

  it("keeps the draft when the send event is cancelled", async () => {
    const { el, area } = setup();
    el.addEventListener("send", (e) => e.preventDefault());
    area.focus();
    await userEvent.keyboard("keep me{Enter}");
    expect(el.value).toBe("keep me");
  });

  it("autosizes up to max-rows and then scrolls", async () => {
    const { el, area } = setup('max-rows="3"');
    const one = area.getBoundingClientRect().height;
    area.focus();
    await userEvent.keyboard("a{Shift>}{Enter}{/Shift}b");
    const two = area.getBoundingClientRect().height;
    expect(two).toBeGreaterThan(one);
    await userEvent.keyboard(
      "{Shift>}{Enter}{/Shift}c{Shift>}{Enter}{/Shift}d{Shift>}{Enter}{/Shift}e",
    );
    const capped = area.getBoundingClientRect().height;
    const line = Number.parseFloat(getComputedStyle(area).lineHeight);
    expect(capped).toBeLessThanOrEqual(line * 3 + 1);
    expect(area.style.overflowY).toBe("auto");
    el.value = "";
    expect(area.getBoundingClientRect().height).toBeCloseTo(one, 0);
  });

  it("is form-associated: FormData, reset to the value attribute, required validity", async () => {
    const { host, el, form, area } = setup('value="seed" required');
    expect(new FormData(form).get("prompt")).toBe("seed");
    area.focus();
    area.select();
    await userEvent.keyboard("{Delete}");
    expect(el.checkValidity()).toBe(false);
    expect(el.validity.valueMissing).toBe(true);
    await userEvent.keyboard("typed");
    expect(new FormData(form).get("prompt")).toBe("typed");
    form.reset();
    expect(el.value).toBe("seed");
    expect(area.value).toBe("seed");
    host
      .querySelector("form")!
      .insertAdjacentHTML(
        "afterbegin",
        "<fieldset disabled><ui-prompt-input></ui-prompt-input></fieldset>",
      );
    expect(host.querySelector<UiPromptInput>("fieldset ui-prompt-input")!.disabled).toBe(true);
  });

  it("swaps the send button for a stop button while streaming", async () => {
    const { el } = setup();
    const onStop = vi.fn();
    el.addEventListener("stop", onStop);
    el.setAttribute("streaming", "");
    expect(await ax("button", "Detener respuesta")).toBeTruthy();
    el.shadowRoot!.querySelector<HTMLButtonElement>("[part=stop]")!.click();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("shows the attachments row only when something is slotted and reports pasted files", () => {
    const { el, area } = setup("", '<span slot="attachments">file</span>');
    const row = el.shadowRoot!.querySelector<HTMLElement>("[part=attachments]")!;
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(row.hidden).toBe(false);
        const onAttach = vi.fn();
        el.addEventListener("attach", (e) => onAttach((e as CustomEvent).detail.files.length));
        const data = new DataTransfer();
        data.items.add(new File(["x"], "x.png", { type: "image/png" }));
        area.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
        expect(onAttach).toHaveBeenCalledWith(1);
        resolve();
      });
    });
  });
});
