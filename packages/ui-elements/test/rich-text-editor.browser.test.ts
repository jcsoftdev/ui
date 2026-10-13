import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  defineRichTextEditor,
  type UiRichTextEditor,
} from "../src/rich-text-editor/rich-text-editor.ts";
import { clearStrings, setStrings } from "../src/strings/strings.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineRichTextEditor();
});

afterEach(() => {
  document.body.innerHTML = "";
  clearStrings();
});

const make = (attrs = "", inner = "") => {
  const host = mount(
    `<form><ui-rich-text-editor name="body" aria-label="Notes" ${attrs}>${inner}</ui-rich-text-editor></form>`,
  );
  const form = host.querySelector("form") as HTMLFormElement;
  const editor = host.querySelector("ui-rich-text-editor") as UiRichTextEditor;
  return { form, editor, surface: editor.editor as HTMLElement };
};

const paste = (target: HTMLElement, data: Record<string, string>) => {
  const transfer = new DataTransfer();
  for (const [type, value] of Object.entries(data)) transfer.setData(type, value);
  target.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }),
  );
};

describe("ui-rich-text-editor", () => {
  it("exposes a named textbox and a toolbar with one roving tab stop", async () => {
    const { editor } = make();
    expect(await ax("textbox", "Notes")).toBeTruthy();
    expect(await ax("toolbar", "Formatting")).toBeTruthy();
    const tools = [...editor.querySelectorAll<HTMLButtonElement>("button[data-tool]")].filter(
      (b) => b.dataset.tool !== "unlink",
    );
    expect(tools).toHaveLength(7);
    expect(tools.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    expect(tools[0]?.getAttribute("aria-label")).toBe("Bold (Ctrl+B)");

    tools[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tools[1]);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(tools[6]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tools[0]);
    expect(tools.filter((b) => b.tabIndex === 0)).toEqual([tools[0]]);
  });

  it("formats with the toolbar, reflects it in aria-pressed and submits sanitized HTML", async () => {
    const { form, editor, surface } = make();
    const events = vi.fn();
    editor.addEventListener("input", events);
    surface.focus();
    await userEvent.keyboard("hello");
    const range = document.createRange();
    range.selectNodeContents(surface);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    editor.querySelector<HTMLButtonElement>('[data-tool="bold"]')?.click();
    expect(editor.value).toMatch(/<(b|strong)>hello<\/(b|strong)>/);
    expect(events).toHaveBeenCalled();
    expect(new FormData(form).get("body")).toBe(editor.value);
    expect(editor.querySelector('[data-tool="bold"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("sanitizes value, the value attribute, initial markup and form restore (XSS)", () => {
    const hostile =
      '<p>ok</p><img src=x onerror="window.__pwn=1"><script>window.__pwn=2</script><a href="javascript:window.__pwn=3">x</a>';
    const { form, editor, surface } = make();
    editor.value = hostile;
    for (const html of [editor.value, surface.innerHTML, String(new FormData(form).get("body"))]) {
      expect(html).toContain("<p>ok</p>");
      expect(html).not.toMatch(/onerror|<script|javascript:|<img/i);
    }
    expect((window as unknown as { __pwn?: number }).__pwn).toBeUndefined();

    editor.formStateRestoreCallback(hostile);
    expect(editor.value).not.toMatch(/onerror|<script|javascript:/i);

    const seeded = make(`value='${hostile}'`).editor;
    expect(seeded.value).not.toMatch(/onerror|<script|javascript:/i);
    expect(seeded.value).toContain("<p>ok</p>");
  });

  it("sanitizes pasted HTML and escapes pasted plain text", () => {
    const { editor, surface } = make();
    surface.focus();
    paste(surface, {
      "text/html":
        '<p>safe</p><img src=x onerror="window.__pwn=4"><svg onload="window.__pwn=5"></svg><b style="x">b</b>',
    });
    expect(surface.innerHTML).toContain("safe");
    expect(surface.innerHTML).not.toMatch(/onerror|onload|<svg|<img|style=/i);
    expect(editor.value).not.toMatch(/onerror|onload/i);

    paste(surface, { "text/plain": "<script>window.__pwn=6</script>" });
    expect(surface.querySelector("script")).toBeNull();
    expect(surface.textContent).toContain("<script>");
    expect((window as unknown as { __pwn?: number }).__pwn).toBeUndefined();
  });

  it("links through the shortcut with URL validation", async () => {
    const { editor, surface } = make("value='<p>site</p>'");
    surface.focus();
    const range = document.createRange();
    range.selectNodeContents(surface.firstElementChild as Node);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    await userEvent.keyboard("{Control>}k{/Control}");
    const row = editor.querySelector<HTMLElement>('[data-ui-part="link-row"]');
    const input = editor.querySelector<HTMLInputElement>('[data-ui-part="link-input"]');
    expect(row?.hidden).toBe(false);
    expect(editor.querySelector('[data-tool="link"]')?.getAttribute("aria-pressed")).toBe("true");

    input!.value = "javascript:alert(1)";
    await userEvent.keyboard("{Enter}");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(editor.value).not.toContain("javascript:");

    input!.value = "https://example.com";
    await userEvent.keyboard("{Enter}");
    expect(row?.hidden).toBe(true);
    expect(editor.value).toContain('<a href="https://example.com"');
  });

  it("participates in forms: required, reset, disabled and restore", async () => {
    const { form, editor, surface } = make("required value='<p>start</p>'");
    expect(editor.checkValidity()).toBe(true);
    editor.value = "<p></p>";
    expect(editor.value).toBe("");
    expect(editor.validity.valueMissing).toBe(true);
    expect(new FormData(form).has("body")).toBe(false);
    surface.focus();
    await userEvent.keyboard("typed");
    expect(editor.checkValidity()).toBe(true);
    expect(new FormData(form).get("body")).toContain("typed");

    form.reset();
    expect(editor.value).toBe("<p>start</p>");
    expect(surface.innerHTML).toBe("<p>start</p>");

    const fieldset = document.createElement("fieldset");
    form.append(fieldset);
    fieldset.append(editor);
    fieldset.disabled = true;
    expect(editor.disabled).toBe(true);
    expect(surface.contentEditable).toBe("false");
    expect(editor.querySelector<HTMLButtonElement>("button[data-tool]")?.disabled).toBe(true);
  });

  it("fires change on blur with a new value", async () => {
    const { editor, surface } = make();
    const change = vi.fn();
    editor.addEventListener("change", change);
    surface.focus();
    await userEvent.keyboard("abc");
    expect(change).not.toHaveBeenCalled();
    surface.blur();
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("resolves labels: attribute, then registry by lang, then English", () => {
    const { editor } = make('bold-label="Strong"');
    const label = (tool: string) =>
      editor.querySelector(`[data-tool="${tool}"]`)?.getAttribute("aria-label");
    expect(label("bold")).toBe("Strong (Ctrl+B)");
    expect(label("italic")).toBe("Italic (Ctrl+I)");
    document.documentElement.lang = "fr";
    setStrings("fr", { "richText.italic": "Italique" });
    expect(label("italic")).toBe("Italique (Ctrl+I)");
    document.documentElement.lang = "";
  });

  it("seeds from a template and drops live children, whichever order it is defined in", async () => {
    // Defined before parsing: children arrive after connectedCallback ran.
    const early = document.createElement("ui-rich-text-editor") as UiRichTextEditor;
    document.body.append(early);
    expect(early.value).toBe("");
    const template = document.createElement("template");
    template.innerHTML = "<p>seeded</p>";
    const live = document.createElement("b");
    live.textContent = "raw";
    early.append(template, live);
    await Promise.resolve();
    expect(early.value).toBe("<p>seeded</p>");
    expect(early.editor?.innerHTML).toBe("<p>seeded</p>");
    expect([...early.children].map((c) => c.getAttribute("data-ui-part"))).toEqual([
      "toolbar",
      "body",
    ]);

    // Defined after parsing (upgrade): children already exist.
    const host = mount(
      '<acme-rich-text-editor><template><p>late</p></template><img src=x onerror="window.__pwn=9"></acme-rich-text-editor>',
    );
    defineRichTextEditor({ prefix: "acme" });
    const late = host.firstElementChild as UiRichTextEditor;
    expect(late.value).toBe("<p>late</p>");
    expect(late.querySelector("img, template")).toBeNull();
    expect([...late.children].map((c) => c.getAttribute("data-ui-part"))).toEqual([
      "toolbar",
      "body",
    ]);

    // The value attribute wins over a template.
    const both = make("value='<p>attr</p>'", "<template><p>tpl</p></template>").editor;
    expect(both.value).toBe("<p>attr</p>");
  });

  it("does not fire change for focus and blur after a programmatic value", () => {
    const { editor, surface } = make();
    const change = vi.fn();
    editor.addEventListener("change", change);
    editor.value = "<p>set from code</p>";
    surface.focus();
    surface.blur();
    expect(change).not.toHaveBeenCalled();
  });

  it("closes an open link field with Escape from the surface first", async () => {
    const { editor, surface } = make("value='<p>x</p>'");
    surface.focus();
    await userEvent.keyboard("{Control>}k{/Control}");
    const row = editor.querySelector<HTMLElement>('[data-ui-part="link-row"]');
    expect(row?.hidden).toBe(false);
    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    surface.dispatchEvent(esc);
    document.removeEventListener("keydown", outer);
    expect(row?.hidden).toBe(true);
    expect(esc.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
  });

  it("does not resolve labels on every input", async () => {
    const { editor, surface } = make();
    const seen = vi.fn();
    editor.addEventListener("ui-context-request", seen);
    surface.focus();
    await userEvent.keyboard("abc");
    expect(seen).not.toHaveBeenCalled();
  });
});
