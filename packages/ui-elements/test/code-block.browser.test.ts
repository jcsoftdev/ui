import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineCodeBlock, type UiCodeBlock } from "../src/code-block/code-block.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineCodeBlock();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const make = (attrs: string, body = "") =>
  mount(`<ui-code-block ${attrs}>${body}</ui-code-block>`).firstElementChild as UiCodeBlock;
const lines = (block: UiCodeBlock) =>
  [...(block.shadowRoot?.querySelectorAll("[data-line]") ?? [])].map((l) => l.textContent);

describe("ui-code-block", () => {
  it("labels the figure with the language and exposes a named copy button", async () => {
    make('language="typescript" code="const a = 1;"');
    expect(await ax("figure", "TypeScript")).toBeTruthy();
    expect(await ax("button", "Copy code")).toBeTruthy();
  });

  it("filename wins over the language label; unknown languages are shown as given", async () => {
    make('language="typescript" filename="app.ts" code="x"');
    expect(await ax("figure", "app.ts")).toBeTruthy();
    make('language="cobol" code="x"');
    expect(await ax("figure", "cobol")).toBeTruthy();
  });

  it("takes its code from the attribute, the property or its own text, one element per line", () => {
    const block = make("", "\nfirst\n  second\n\nfourth\n");
    expect(lines(block)).toEqual(["first", "  second", "", "fourth"]);
    block.code = "a\nb";
    expect(block.getAttribute("code")).toBe("a\nb");
    expect(lines(block)).toEqual(["a", "b"]);
  });

  it("never parses code as markup", () => {
    const block = make("");
    block.code = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    expect(block.shadowRoot?.querySelector("img, script")).toBeNull();
    expect(block.shadowRoot?.querySelector("code")?.textContent).toContain("<img src=x");
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("numbers lines with CSS counters, outside the copied text", () => {
    const block = make('line-numbers code="a\nb\nc"');
    const all = [...(block.shadowRoot?.querySelectorAll("[data-line]") ?? [])];
    for (const line of all) {
      expect(getComputedStyle(line).counterIncrement).toBe("line 1");
      expect(getComputedStyle(line, "::before").content).toBe("counter(line)");
    }
    expect(block.shadowRoot?.querySelector("code")?.textContent).toBe("abc");
    block.removeAttribute("line-numbers");
    expect(getComputedStyle(all[0] as Element, "::before").content).toBe("none");
  });

  it("copies the raw code through the clipboard behaviour and confirms it", async () => {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const block = make('code="npm i @jcsoftdev/ui"');
    const copied = vi.fn();
    block.addEventListener("copied", (event) => copied((event as CustomEvent).detail));
    await userEvent.click(block.shadowRoot?.querySelector("button") as HTMLButtonElement);
    await vi.waitFor(() => expect(copied).toHaveBeenCalledWith({ code: "npm i @jcsoftdev/ui" }));
    expect(write).toHaveBeenCalledWith("npm i @jcsoftdev/ui");
    expect(await ax("button", "Code copied")).toBeTruthy();
    expect(block.shadowRoot?.querySelector("[aria-live=polite]")?.textContent).toBe("Copied");
  });

  it("keeps the scrollable code reachable by keyboard", () => {
    const block = make('code="x"');
    expect(block.shadowRoot?.querySelector("pre")?.tabIndex).toBe(0);
  });

  it("highlights only on opt-in, and the tokens always add up to the source", async () => {
    const source = 'const a = "x"; // note\nfn(1)';
    const plain = make(`language="ts" code='${source}'`);
    await new Promise((r) => setTimeout(r, 50));
    expect(plain.shadowRoot?.querySelector("[data-token]")).toBeNull();

    const lit = make(`language="ts" highlight code='${source}'`);
    await vi.waitFor(() =>
      expect(lit.shadowRoot?.querySelector('[data-token="keyword"]')?.textContent).toBe("const"),
    );
    expect(lit.shadowRoot?.querySelector('[data-token="string"]')?.textContent).toBe('"x"');
    expect(lit.shadowRoot?.querySelector('[data-token="comment"]')?.textContent).toBe("// note");
    expect(lines(lit).join("\n")).toBe(source);
  });

  it("keeps a multi-line token (block comment) split across lines", async () => {
    const lit = make('language="js" highlight code="/* a\nb */\nlet x"');
    await vi.waitFor(() => expect(lit.shadowRoot?.querySelector("[data-token]")).toBeTruthy());
    expect(lines(lit)).toEqual(["/* a", "b */", "let x"]);
  });

  it("registers under a custom prefix", () => {
    expect(defineCodeBlock({ prefix: "acme" })).toBe("acme-code-block");
  });
});
