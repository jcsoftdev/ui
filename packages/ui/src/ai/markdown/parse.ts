// Safe Markdown subset parser. It produces a plain AST and never HTML: raw tags stay literal
// text and the renderer escapes them through React.

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

/** Table columns beyond this are dropped, so cells stay bounded by rows x MAX_COLUMNS. */
const MAX_COLUMNS = 64;
const NO_INLINES: Inline[] = [];

/** Deeper blockquotes and list items are kept as literal text, so input cannot exhaust the stack. */
const MAX_NESTING = 32;
/** A link destination longer than this is not a link, which keeps the scan for `)` bounded. */
const MAX_LINK_TARGET = 1024;

/** Index of the `)` that closes a link destination, honoring balanced inner parentheses. */
function closingParen(src: string, from: number): number {
  let depth = 0;
  const stop = Math.min(src.length, from + MAX_LINK_TARGET);
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
  let nextMid = -2;
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
      // The first "](" after any earlier "[" is still the first one after this "[" while it lies ahead.
      if (nextMid !== -1 && nextMid <= i) nextMid = src.indexOf("](", i + 1);
      const mid = nextMid;
      const end = mid > i ? closingParen(src, mid + 2) : -1;
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
      let end = buf.length;
      while (end > 0 && buf[end - 1] === " ") end -= 1;
      buf = buf.slice(0, end);
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
// Only space and tab count as whitespace here, and `s` lets `.` cross U+2028/U+2029: both keep matching linear.
const HEADING = /^[ \t]{0,3}(#{1,6})[ \t](.*)$/s;

/** Heading level and text; the optional closing `#` run is stripped in code to keep matching linear. */
function matchHeading(line: string): { level: 1 | 2 | 3 | 4 | 5 | 6; text: string } | null {
  const m = HEADING.exec(line);
  if (!m) return null;
  let text = (m[2] as string).trim();
  let end = text.length;
  while (end > 0 && text[end - 1] === "#") end -= 1;
  if (end > 0 && end < text.length && /\s/.test(text[end - 1] as string)) {
    text = text.slice(0, end).trimEnd();
  }
  return { level: (m[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6, text };
}
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/s;
const TABLE_CELL_RULE = /^:?-+:?$/;

function isTableRule(line: string): boolean {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row !== "" && row.split("|").every((cell) => TABLE_CELL_RULE.test(cell.trim()));
}

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
  return line.includes("|") && !!next?.includes("-") && isTableRule(next);
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

/** Parses Markdown into blocks. An unclosed code fence runs to the end (streaming friendly). */
export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src, 0);
}

function literal(src: string): Block[] {
  return [{ t: "p", c: [{ t: "text", v: src }] }];
}

/** List markers indented past what the nesting cap can honor lose the excess, so deep input stays linear. */
const EXCESS_INDENT = new RegExp(`^\\s{${2 * MAX_NESTING + 4},}(?=([-*+]|\\d{1,9}[.)])\\s)`);

function parseBlocks(src: string, depth: number): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  if (depth === 0) {
    for (let n = 0; n < lines.length; n += 1) {
      lines[n] = (lines[n] as string).replace(EXCESS_INDENT, " ".repeat(2 * MAX_NESTING + 4));
    }
  }
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
    const heading = matchHeading(line);
    if (heading) {
      blocks.push({ t: "heading", level: heading.level, c: parseInline(heading.text) });
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
        c: depth >= MAX_NESTING ? literal(inner) : parseBlocks(inner, depth + 1),
      });
      continue;
    }
    if (isTableStart(line, lines[i + 1])) {
      const head = splitRow(line).slice(0, MAX_COLUMNS);
      const align = splitRow(at(i + 1)).map(alignOf);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && at(i).trim() && at(i).includes("|")) {
        const cells = splitRow(at(i));
        rows.push(
          head.map((_, col) =>
            col < cells.length ? parseInline(cells[col] as string) : NO_INLINES,
          ),
        );
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
            depth >= MAX_NESTING ? literal(sub.join("\n")) : parseBlocks(sub.join("\n"), depth + 1),
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
