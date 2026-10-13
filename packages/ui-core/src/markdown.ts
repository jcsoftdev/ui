// Safe Markdown subset: a parser that produces a plain AST, and a renderer that builds DOM nodes
// with createElement and textContent. No input ever reaches innerHTML; raw tags stay literal text.

export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string | null; c: Inline[] }
  | { t: "br" };

export type TableAlign = "left" | "center" | "right" | null;

export interface ListItem {
  c: Inline[];
  children: Block[];
}

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { t: "code"; lang: string; v: string }
  | { t: "quote"; c: Block[] }
  | { t: "hr" }
  | { t: "table"; align: TableAlign[]; head: Inline[][]; rows: Inline[][][] };

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/** Returns the normalized URL when its protocol is http, https or mailto; otherwise null. */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

const ESCAPABLE = /[\\`*_[\]()#+\-.!|>~]/;

/** Deepest nesting of quotes and lists; deeper content is kept as plain text. */
export const MAX_MARKDOWN_DEPTH = 32;
/** Longest link label or destination scanned, so hostile `[](` runs stay linear. */
const MAX_LINK_SCAN = 2048;

/** Index of the `)` that closes a link destination, honoring balanced inner parentheses. */
function closingParen(src: string, from: number): number {
  let depth = 0;
  const stop = Math.min(src.length, from + MAX_LINK_SCAN);
  for (let i = from; i < stop; i += 1) {
    if (src[i] === "(") depth += 1;
    else if (src[i] === ")") {
      if (depth === 0) return i;
      depth -= 1;
    }
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  let i = 0;
  let midIndex = -2;
  while (i < src.length) {
    const ch = src[i] as string;
    const next = src[i + 1];
    if (ch === "\\" && next !== undefined && ESCAPABLE.test(next)) {
      buf += next;
      i += 2;
      continue;
    }
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (src.startsWith("**", i) || src.startsWith("__", i)) {
      const mark = src.slice(i, i + 2);
      const end = src.indexOf(mark, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (ch === "*" || ch === "_") {
      const end = src.indexOf(ch, i + 1);
      const intraword = ch === "_" && i > 0 && /\w/.test(src[i - 1] as string);
      if (
        end > i + 1 &&
        !intraword &&
        !/\s/.test(src[i + 1] as string) &&
        !/\s/.test(src[end - 1] as string)
      ) {
        flush();
        out.push({ t: "em", c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "[") {
      // The next "](" is cached: rescanning it for every "[" made "[[[[..." quadratic.
      if (midIndex === -2 || (midIndex !== -1 && midIndex < i + 1))
        midIndex = src.indexOf("](", i + 1);
      const mid = midIndex;
      const end = mid > i && mid - i <= MAX_LINK_SCAN ? closingParen(src, mid + 2) : -1;
      if (end > mid) {
        flush();
        out.push({
          t: "link",
          href: safeHref(src.slice(mid + 2, end)),
          c: parseInline(src.slice(i + 1, mid)),
        });
        i = end + 1;
        continue;
      }
    }
    if (ch === "\n") {
      buf = buf.replace(/ +$/, "");
      flush();
      out.push({ t: "br" });
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush();
  return out;
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function alignOf(cell: string): TableAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return left ? "left" : null;
}

function isTableStart(line: string, next: string | undefined): boolean {
  return line.includes("|") && !!next?.includes("-") && TABLE_RULE.test(next);
}

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    ITEM.test(line) ||
    /^\s{0,3}>/.test(line) ||
    isTableStart(line, next)
  );
}

function plain(text: string): Block[] {
  return text.trim() ? [{ t: "p", c: [{ t: "text", v: text }] }] : [];
}

/** Parses Markdown into blocks. An unclosed code fence runs to the end (streaming friendly). */
export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src, 0);
}

function parseBlocks(src: string, depth: number): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const at = (n: number) => lines[n] as string;
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = at(i);
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = (fence[1] as string).startsWith("`") ? "`" : "~";
      const size = (fence[1] as string).length;
      const closer = new RegExp(`^\\s{0,3}${marker}{${size},}\\s*$`);
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !closer.test(at(i))) {
        body.push(at(i));
        i += 1;
      }
      i += 1;
      blocks.push({ t: "code", lang: fence[2] ?? "", v: body.join("\n") });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({
        t: "heading",
        level: (heading[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6,
        c: parseInline(heading[2] as string),
      });
      i += 1;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(at(i))) {
        body.push(at(i).replace(/^\s{0,3}>\s?/, ""));
        i += 1;
      }
      const inner = body.join("\n");
      blocks.push({
        t: "quote",
        c: depth >= MAX_MARKDOWN_DEPTH ? plain(inner) : parseBlocks(inner, depth + 1),
      });
      continue;
    }
    if (isTableStart(line, lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(at(i + 1)).map(alignOf);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && at(i).trim() && at(i).includes("|")) {
        const cells = splitRow(at(i));
        rows.push(head.map((_, col) => parseInline(cells[col] ?? "")));
        i += 1;
      }
      blocks.push({
        t: "table",
        align: head.map((_, col) => align[col] ?? null),
        head: head.map((cell) => parseInline(cell)),
        rows,
      });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      const ordered = /\d/.test(item[2] as string);
      const start = ordered ? Number.parseInt(item[2] as string, 10) : 1;
      const baseIndent = (item[1] as string).length;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const current = ITEM.exec(at(i));
        if (!current || (current[1] as string).length > baseIndent + 1) break;
        if (/\d/.test(current[2] as string) !== ordered) break;
        const sub: string[] = [];
        i += 1;
        while (i < lines.length) {
          const l = at(i);
          const indent = (/^\s*/.exec(l) as RegExpExecArray)[0].length;
          if (!l.trim() || indent <= baseIndent + 1) break;
          sub.push(l.slice(Math.min(indent, baseIndent + 2)));
          i += 1;
        }
        items.push({
          c: parseInline(current[3] as string),
          children:
            depth >= MAX_MARKDOWN_DEPTH
              ? plain(sub.join("\n"))
              : parseBlocks(sub.join("\n"), depth + 1),
        });
      }
      blocks.push({ t: "list", ordered, start, items });
      continue;
    }
    const para: string[] = [line.trim()];
    i += 1;
    while (i < lines.length && at(i).trim() && !startsBlock(at(i), lines[i + 1])) {
      para.push(at(i).trim());
      i += 1;
    }
    blocks.push({ t: "p", c: parseInline(para.join("\n")) });
  }
  return blocks;
}

export interface MarkdownRenderOptions {
  /** Document used to create nodes (defaults to the global one). */
  document?: Document;
  /** Appends a caret after the last character, for streaming answers. */
  streaming?: boolean;
  /**
   * Replaces the default `<pre><code>` of a fenced block, for example with syntax highlighting.
   * It receives the RAW code, not escaped text: build the node with `textContent` or another safe
   * API, and escape it yourself if you ever serialize it to HTML.
   */
  renderCode?: (code: string, language: string, document: Document) => Node;
}

type Align = "left" | "center" | "right";

function create(doc: Document, tag: string, part: string): HTMLElement {
  const element = doc.createElement(tag);
  element.dataset.part = part;
  return element;
}

function caret(doc: Document): HTMLElement {
  const element = create(doc, "span", "caret");
  element.setAttribute("aria-hidden", "true");
  return element;
}

function appendInline(parent: Node, nodes: Inline[], doc: Document): void {
  for (const node of nodes) {
    switch (node.t) {
      case "text":
        parent.appendChild(doc.createTextNode(node.v));
        break;
      case "br":
        parent.appendChild(doc.createElement("br"));
        break;
      case "code": {
        const code = create(doc, "code", "inline-code");
        code.textContent = node.v;
        parent.appendChild(code);
        break;
      }
      case "strong":
      case "em": {
        const element = doc.createElement(node.t);
        appendInline(element, node.c, doc);
        parent.appendChild(element);
        break;
      }
      case "link": {
        const element = node.href ? create(doc, "a", "link") : doc.createElement("span");
        if (node.href) {
          element.setAttribute("href", node.href);
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer nofollow");
        }
        appendInline(element, node.c, doc);
        parent.appendChild(element);
        break;
      }
    }
  }
}

function cell(doc: Document, tag: "th" | "td", content: Inline[], align: TableAlign): HTMLElement {
  const element = create(doc, tag, tag === "th" ? "table-header-cell" : "table-cell");
  if (tag === "th") element.setAttribute("scope", "col");
  if (align) element.dataset.align = align satisfies Align;
  appendInline(element, content, doc);
  return element;
}

function appendBlocks(
  parent: Node,
  blocks: Block[],
  doc: Document,
  options: MarkdownRenderOptions,
  tail: boolean,
): void {
  blocks.forEach((block, index) => {
    const last = tail && index === blocks.length - 1;
    switch (block.t) {
      case "heading": {
        const element = create(doc, `h${block.level}`, "heading");
        appendInline(element, block.c, doc);
        if (last) element.appendChild(caret(doc));
        parent.appendChild(element);
        break;
      }
      case "p": {
        const element = create(doc, "p", "paragraph");
        appendInline(element, block.c, doc);
        if (last) element.appendChild(caret(doc));
        parent.appendChild(element);
        break;
      }
      case "list": {
        const element = create(doc, block.ordered ? "ol" : "ul", "list");
        if (block.ordered && block.start !== 1) element.setAttribute("start", String(block.start));
        block.items.forEach((item, at) => {
          const li = create(doc, "li", "list-item");
          const isLast = last && at === block.items.length - 1;
          appendInline(li, item.c, doc);
          if (isLast && item.children.length === 0) li.appendChild(caret(doc));
          if (item.children.length > 0) {
            const nested = create(doc, "div", "list-body");
            appendBlocks(nested, item.children, doc, options, isLast);
            li.appendChild(nested);
          }
          element.appendChild(li);
        });
        parent.appendChild(element);
        break;
      }
      case "code": {
        if (options.renderCode) {
          parent.appendChild(options.renderCode(block.v, block.lang, doc));
        } else {
          const pre = create(doc, "pre", "code-block");
          const code = doc.createElement("code");
          if (block.lang) code.dataset.language = block.lang;
          code.textContent = block.v;
          pre.appendChild(code);
          parent.appendChild(pre);
        }
        if (last) parent.appendChild(caret(doc));
        break;
      }
      case "quote": {
        const element = create(doc, "blockquote", "quote");
        appendBlocks(element, block.c, doc, options, last);
        parent.appendChild(element);
        break;
      }
      case "hr":
        parent.appendChild(create(doc, "hr", "rule"));
        break;
      case "table": {
        const wrapper = create(doc, "div", "table-wrapper");
        const table = create(doc, "table", "table");
        const head = create(doc, "thead", "table-head");
        const headRow = create(doc, "tr", "table-row");
        block.head.forEach((content, col) => {
          headRow.appendChild(cell(doc, "th", content, block.align[col] ?? null));
        });
        head.appendChild(headRow);
        const body = doc.createElement("tbody");
        for (const row of block.rows) {
          const tr = create(doc, "tr", "table-row");
          row.forEach((content, col) => {
            tr.appendChild(cell(doc, "td", content, block.align[col] ?? null));
          });
          body.appendChild(tr);
        }
        table.append(head, body);
        wrapper.appendChild(table);
        parent.appendChild(wrapper);
        break;
      }
    }
  });
}

/** Renders already parsed blocks into a fragment of safe DOM. */
export function blocksToDom(
  blocks: Block[],
  options: MarkdownRenderOptions = {},
): DocumentFragment {
  const doc = options.document ?? document;
  const fragment = doc.createDocumentFragment();
  appendBlocks(fragment, blocks, doc, options, Boolean(options.streaming));
  if (options.streaming && blocks.length === 0) {
    const p = create(doc, "p", "paragraph");
    p.appendChild(caret(doc));
    fragment.appendChild(p);
  }
  return fragment;
}

/**
 * Parses Markdown and returns safe DOM: elements are built with `createElement` and text with
 * `textContent`, so raw HTML in the source is displayed as text and only http, https and mailto
 * links are active. Each element carries `data-part` (heading, paragraph, list, list-item,
 * inline-code, link, quote, rule, table-wrapper, table, table-head, table-header-cell,
 * table-row, table-cell, code-block, caret) for styling.
 */
export function renderMarkdown(
  source: string,
  options: MarkdownRenderOptions = {},
): DocumentFragment {
  return blocksToDom(parseMarkdown(source), options);
}
