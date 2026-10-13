import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/ai/markdown/parse.ts";
import { parseInline, parseMarkdown, safeHref } from "../src/markdown.ts";

const SOURCES = [
  "# Title\n\nSome **bold**, *em*, __strong__, _em_ and `code` with a [link](https://a.example/p_(x)) and a [bad](javascript:alert(1)).",
  "- a\n- b\n  - nested\n  - two\n- c\n\n1. one\n2. two\n\n3) three",
  "> quote\n> more\n\n---\n\n***",
  "| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n| x \\| y | z |",
  "```ts\nconst a = 1;\n```\n\n~~~\nraw <b>tag</b>\n~~~\n\n```unclosed\nstill code",
  "line one  \nline two\\*not em\\*\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>",
  "![img](https://a.example/x.png) [a](<b>) [x]( ) []() [t](mailto:a@b.co) [u](data:text/html,x)",
  "#no space\n####### seven\n###### six ######",
  "",
];

describe("markdown parser: parity with the React kit", () => {
  it("builds the same AST for every source", () => {
    for (const source of SOURCES) {
      expect(parseMarkdown(source)).toEqual(react.parseMarkdown(source));
      expect(parseInline(source)).toEqual(react.parseInline(source));
    }
  });

  it("safeHref matches and only passes http, https and mailto", () => {
    for (const raw of [
      "https://a.example",
      "http://a.example/x y",
      "mailto:a@b.co",
      "javascript:alert(1)",
      " JAVASCRIPT:1",
      "data:text/html,x",
      "tel:1",
      "/rel",
      "",
      "  ",
    ]) {
      expect(safeHref(raw)).toBe(react.safeHref(raw));
    }
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref("https://a.example")).toBe("https://a.example/");
  });

  it("never emits an active link from a hostile href", () => {
    const blocks = parseMarkdown(
      "[a](javascript:alert(1)) [b](java\tscript:alert(1)) [c](&#106;avascript:1) [d](JaVa\nScRiPt:1)",
    );
    const links = JSON.stringify(blocks).match(/"href":(null|"[^"]*")/g) ?? [];
    for (const link of links) expect(link).not.toMatch(/script/i);
  });
});
