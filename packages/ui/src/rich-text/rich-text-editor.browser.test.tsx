/// <reference types="@vitest/browser-playwright" />
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vitest";
import { RichTextEditor } from "./rich-text-editor.js";
import { sanitizeHtml } from "./sanitize.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;
const changes: string[] = [];

async function mount() {
  host = document.body.appendChild(document.createElement("form"));
  root = createRoot(host);
  await act(async () => {
    root?.render(
      <>
        <input name="title" defaultValue="t" />
        <RichTextEditor
          aria-label="Contenido"
          defaultValue="<p>x</p>"
          onChange={(v) => changes.push(v)}
        />
      </>,
    );
  });
  const editor = host.querySelector<HTMLElement>('[role="textbox"]') as HTMLElement;
  editor.focus();
  return { form: host as HTMLFormElement, editor };
}

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  changes.length = 0;
});

describe("RichTextEditor transfer handling", () => {
  test("dropped HTML is sanitized: no fetch, clobbering or form injection", async () => {
    const { form, editor } = await mount();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(
      "text/html",
      '<img src="/beacon?drop"><span id="clob"></span><input name="role" value="admin"><p>kept</p>',
    );
    const rect = editor.getBoundingClientRect();
    await act(async () => {
      editor.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 2,
          clientY: rect.top + 2,
        }),
      );
    });
    expect(editor.querySelector("img, input, [id]")).toBeNull();
    expect(editor.innerHTML).toContain("kept");
    expect([...new FormData(form).keys()]).toEqual(["title"]);
    expect((window as unknown as { clob?: unknown }).clob).toBeUndefined();
  });

  test("beforeinput drop, paste and replacement are routed through the sanitizer", async () => {
    const { editor } = await mount();
    for (const inputType of ["insertFromDrop", "insertFromPaste", "insertReplacementText"]) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/html", `<img src=x onerror="window.__b=1"><b>${inputType}</b>`);
      const event = new InputEvent("beforeinput", {
        inputType,
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        editor.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    }
    expect(editor.querySelector("img")).toBeNull();
    expect(editor.innerHTML).toContain("insertFromDrop");
  });

  test("a drag started inside the editor moves its selection; one from elsewhere copies", async () => {
    const { editor } = await mount();
    await act(async () => {
      editor.innerHTML = "<p>move me</p><p>target</p>";
    });
    const [first, second] = Array.from(editor.querySelectorAll("p"));
    const range = document.createRange();
    range.selectNodeContents(first as HTMLElement);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    const rect = (second as HTMLElement).getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/html", "<b>move me</b>");
    await act(async () => {
      editor.dispatchEvent(new DragEvent("dragstart", { bubbles: true }));
      editor.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });
    expect(editor.innerHTML.split("move me").length - 1).toBe(1);
    expect(editor.innerHTML).toContain("target");
    await act(async () => {
      editor.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });
    expect(editor.innerHTML.split("move me").length - 1).toBe(2);
  });

  test("a paste or drop carrying only a file inserts nothing", async () => {
    const { editor } = await mount();
    const before = editor.innerHTML;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["x"], "a.png", { type: "image/png" }));
    await act(async () => {
      editor.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dataTransfer,
          bubbles: true,
          cancelable: true,
        }),
      );
      editor.dispatchEvent(
        new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }),
      );
    });
    expect(editor.innerHTML).toBe(before);
  });

  test("named entities survive a round trip", () => {
    expect(sanitizeHtml("<p>caf&eacute; &copy; &amp;eacute; &Eacute;</p>")).toBe(
      "<p>café © &amp;eacute; É</p>",
    );
  });
});
