import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineCodeBlock } from "../src/code-block/code-block.ts";
import { defineMarkdown, type UiMarkdown } from "../src/markdown/markdown.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineMarkdown();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const make = (attrs = "", body = "") =>
  mount(`<ui-markdown ${attrs}>${body}</ui-markdown>`).firstElementChild as UiMarkdown;
const flag = () => (window as unknown as { __xss?: number }).__xss;

describe("ui-markdown", () => {
  it("renders the supported syntax through ui-core markdown", () => {
    const md = make();
    md.value = [
      "# Title",
      "",
      "Some **bold**, *em* and `code` with [a link](https://example.com).",
      "",
      "- one",
      "- two",
      "",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "> quote",
    ].join("\n");
    expect(md.querySelector("h1")?.textContent).toBe("Title");
    expect(md.querySelector("strong")?.textContent).toBe("bold");
    expect(md.querySelectorAll("ul > li").length).toBe(2);
    expect(md.querySelector("th[scope=col]")?.textContent).toBe("a");
    expect(md.querySelector("blockquote")?.textContent).toBe("quote");
    const link = md.querySelector("a") as HTMLAnchorElement;
    expect(link.href).toBe("https://example.com/");
    expect(link.rel).toBe("noopener noreferrer nofollow");
    expect(link.target).toBe("_blank");
  });

  it("uses its initial text content or the value attribute as the source", () => {
    expect(make("", "## From text").querySelector("h2")?.textContent).toBe("From text");
    expect(make('value="# From attribute"').querySelector("h1")).toBeTruthy();
  });

  it("re-renders on value changes and shows a caret with aria-busy while streaming", () => {
    const md = make("streaming");
    md.value = "Hello";
    expect(md.querySelector("[data-part=caret]")).toBeTruthy();
    expect(md.getAttribute("aria-busy")).toBe("true");
    md.removeAttribute("streaming");
    expect(md.querySelector("[data-part=caret]")).toBeNull();
    expect(md.hasAttribute("aria-busy")).toBe(false);
  });

  it("falls back to a plain pre, and uses the code-block of the same prefix when defined", () => {
    const md = make();
    md.value = "```ts\nconst a = 1;\n```";
    expect(md.querySelector("pre code")?.textContent).toBe("const a = 1;");
    expect(md.querySelector("ui-code-block")).toBeNull();

    defineCodeBlock({ prefix: "acme" });
    defineMarkdown({ prefix: "acme" });
    const host = mount("<acme-markdown highlight></acme-markdown>");
    const rich = host.firstElementChild as UiMarkdown;
    rich.value = "```ts\nconst a = 1;\n```";
    const block = rich.querySelector("acme-code-block");
    expect(block?.getAttribute("code")).toBe("const a = 1;");
    expect(block?.getAttribute("language")).toBe("ts");
    expect(block?.hasAttribute("highlight")).toBe(true);
  });

  describe("XSS", () => {
    const hrefs = (md: HTMLElement) =>
      [...md.querySelectorAll("a")].map((a) => new URL(a.href, document.baseURI).protocol);

    it("shows raw HTML as text and creates no active elements", async () => {
      const md = make();
      md.value = [
        '<img src=x onerror="window.__xss=1">',
        "",
        '<svg onload="window.__xss=1"></svg>',
        "",
        "<script>window.__xss=1</script>",
        "",
        '<a href="javascript:window.__xss=1" onclick="window.__xss=1">x</a>',
      ].join("\n");
      await new Promise((r) => setTimeout(r, 50));
      expect(md.querySelector("img, svg, script, iframe, style")).toBeNull();
      expect(md.querySelector("[onerror], [onload], [onclick]")).toBeNull();
      expect(md.querySelector("a")).toBeNull();
      expect(md.textContent).toContain("<img src=x");
      expect(md.textContent).toContain("<svg onload");
      expect(flag()).toBeUndefined();
    });

    it("blocks javascript: links hidden behind unicode whitespace and invisible characters", () => {
      const md = make();
      const evil = [
        "javascript:window.__xss=1",
        "java script:window.__xss=1",
        "java script:window.__xss=1",
        "java script:window.__xss=1",
        "java​script:window.__xss=1",
        " javascript:window.__xss=1",
        "JaVaScRiPt:window.__xss=1",
        "java\tscript:window.__xss=1",
        "data:text/html,<script>window.__xss=1</script>",
        "vbscript:msgbox(1)",
      ];
      md.value = evil.map((href, i) => `[l${i}](<${href}>)`).join("\n\n");
      expect(md.querySelector('a[href^="javascript" i], a[href*="script" i]')).toBeNull();
      for (const protocol of hrefs(md)) expect(["http:", "https:", "mailto:"]).toContain(protocol);
      expect(md.textContent).toContain("l0");
      expect(flag()).toBeUndefined();
    });

    it("blocks entity-encoded schemes", () => {
      const md = make();
      md.value = [
        "[a](&#106;avascript:window.__xss=1)",
        "[b](&#x6A;avascript:window.__xss=1)",
        "[c](javascript&colon;window.__xss=1)",
        "[d](java&#9;script:window.__xss=1)",
      ].join("\n\n");
      expect(md.querySelector('a[href*="script" i]')).toBeNull();
      for (const protocol of hrefs(md)) expect(["http:", "https:", "mailto:"]).toContain(protocol);
      expect(flag()).toBeUndefined();
    });

    it("keeps http, https and mailto links active", () => {
      const md = make();
      md.value = "[a](https://a.test) [b](http://b.test) [c](mailto:x@y.test)";
      expect(hrefs(md)).toEqual(["https:", "http:", "mailto:"]);
    });
  });
});

describe("ui-markdown template source", () => {
  it("reads an inert <template> child instead of the live children", () => {
    const md = mount("<ui-markdown><template># From &lt;template&gt;</template></ui-markdown>")
      .firstElementChild as HTMLElement;
    expect(md.querySelector("h1")?.textContent).toBe("From <template>");
    expect(md.querySelector("template")).toBeNull();
  });
});
