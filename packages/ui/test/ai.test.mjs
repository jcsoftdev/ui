// Pure logic behind the AI set: markdown parser (incl. XSS), highlighter, stick-to-bottom,
// date grouping and the submit key rule.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

async function load(file) {
  const bundle = await build({
    entryPoints: [join(here, file)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`
  );
}

const md = await load("../src/ai/markdown/parse.ts");
const hl = await load("../src/ai/code-block/highlight.ts");
const stick = await load("../src/ai/conversation/stick.ts");
const group = await load("../src/ai/chat-list/group.ts");
const keys = await load("../src/ai/prompt-input/keys.ts");

const flat = (inlines) => inlines.map((n) => (n.v ?? "") + (n.c ? flat(n.c) : "")).join("");

test("markdown: headings, paragraphs and inline marks", () => {
  const blocks = md.parseMarkdown("## Hola\n\nUn **corte** con *estilo* y `fade`.");
  assert.equal(blocks[0].t, "heading");
  assert.equal(blocks[0].level, 2);
  const inline = blocks[1].c;
  assert.deepEqual(
    inline.map((n) => n.t),
    ["text", "strong", "text", "em", "text", "code", "text"],
  );
});

test("markdown: lists, nesting and ordered start", () => {
  const [ul] = md.parseMarkdown("- uno\n- dos\n  - hijo\n- tres");
  assert.equal(ul.t, "list");
  assert.equal(ul.items.length, 3);
  assert.equal(ul.items[1].children[0].t, "list");
  const [ol] = md.parseMarkdown("3. a\n4. b");
  assert.equal(ol.ordered, true);
  assert.equal(ol.start, 3);
});

test("markdown: code fences, including an unclosed one while streaming", () => {
  const [closed] = md.parseMarkdown("```ts\nconst a = 1;\n```");
  assert.deepEqual([closed.t, closed.lang, closed.v], ["code", "ts", "const a = 1;"]);
  const [open] = md.parseMarkdown("texto\n\n```sql\nSELECT 1");
  assert.equal(md.parseMarkdown("texto\n\n```sql\nSELECT 1")[1].v, "SELECT 1");
  assert.equal(open.t, "p");
});

test("markdown: tables with alignment", () => {
  const [table] = md.parseMarkdown("| Servicio | Precio |\n| :-- | --: |\n| Corte | S/ 35 |");
  assert.equal(table.t, "table");
  assert.deepEqual(table.align, ["left", "right"]);
  assert.equal(flat(table.rows[0][1]), "S/ 35");
});

test("markdown XSS: dangerous protocols never become links", () => {
  for (const url of [
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example",
    "/relativo",
  ]) {
    assert.equal(md.safeHref(url), null, url);
  }
  assert.equal(md.safeHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(md.safeHref("mailto:hola@example.com"), "mailto:hola@example.com");
  const [p] = md.parseMarkdown("[clic](javascript:alert(1))");
  assert.equal(p.c[0].t, "link");
  assert.equal(p.c[0].href, null);
  assert.equal(flat(p.c), "clic");
});

test("markdown XSS: raw HTML stays literal text, never a node type", () => {
  const blocks = md.parseMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].t, "p");
  assert.equal(flat(blocks[0].c), '<img src=x onerror="alert(1)"><script>alert(1)</script>');
  const allowed = new Set(["text", "code", "strong", "em", "link", "br"]);
  assert.ok(blocks[0].c.every((n) => allowed.has(n.t)));
});

test("highlight: tokens reassemble the input and classify basics", () => {
  const samples = {
    ts: "const total: number = items.map((x) => x.price).reduce(sum, 0); // suma\nclass Corte {}",
    js: "async function f() { return `a` + 1; } /* x */",
    json: '{"nombre": "Ana", "edad": -3.5e2, "ok": true, "x": null}',
    bash: 'echo "hola $USER" # saludo\nif [ -f "$1" ]; then exit 1; fi',
    go: 'func main() { fmt.Println("hola", 42) }',
    sql: "SELECT name, COUNT(*) FROM clientes WHERE activo = 1 -- activos\nORDER BY name;",
  };
  for (const [lang, code] of Object.entries(samples)) {
    const tokens = hl.tokenize(code, lang);
    assert.equal(tokens.map((t) => t.text).join(""), code, lang);
  }
  const types = (code, lang) => new Map(hl.tokenize(code, lang).map((t) => [t.text, t.type]));
  assert.equal(types("const a = 'x'", "ts").get("const"), "keyword");
  assert.equal(types("const a = 'x'", "ts").get("'x'"), "string");
  assert.equal(types("// nota", "go").get("// nota"), "comment");
  assert.equal(types('{"k": 1}', "json").get('"k"'), "property");
  assert.equal(types("select 1 from t", "sql").get("select"), "keyword");
  assert.equal(types("echo $HOME", "bash").get("$HOME"), "variable");
  assert.equal(hl.tokenize("<b>x</b>", "unknown").length, 1);
  assert.equal(hl.resolveLanguage("TypeScript"), "ts");
});

test("stick-to-bottom decisions", () => {
  const m = (scrollTop, scrollHeight = 1000, clientHeight = 400) => ({
    scrollTop,
    scrollHeight,
    clientHeight,
  });
  assert.equal(stick.distanceFromBottom(m(600)), 0);
  assert.equal(stick.distanceFromBottom(m(900)), 0);
  assert.equal(stick.isNearBottom(m(560)), true);
  assert.equal(stick.isNearBottom(m(500)), false);
  // User scrolls up: unstick.
  assert.equal(stick.nextStuck(true, m(300), 600), false);
  // Content grew while stuck (scrollTop unchanged): stays stuck.
  assert.equal(stick.nextStuck(true, m(600, 1400), 600), true);
  // Unstuck and idle: stays unstuck.
  assert.equal(stick.nextStuck(false, m(300, 1400), 300), false);
  // Back to the bottom: sticks again.
  assert.equal(stick.nextStuck(false, m(600), 300), true);
  assert.equal(stick.showJumpToLatest(false, m(300)), true);
  assert.equal(stick.showJumpToLatest(true, m(300)), false);
  assert.equal(stick.showJumpToLatest(false, m(600)), false);
});

test("chat list grouping by date", () => {
  const now = new Date(2026, 5, 15, 12, 0);
  const at = (days, h = 9) => new Date(2026, 5, 15 - days, h, 0);
  assert.equal(group.groupOf(at(0, 1), now), "today");
  assert.equal(group.groupOf(at(1, 23), now), "yesterday");
  assert.equal(group.groupOf(at(5), now), "week");
  assert.equal(group.groupOf(at(20), now), "month");
  assert.equal(group.groupOf(at(90), now), "older");
  const items = [
    { id: "a", updatedAt: at(90) },
    { id: "b", updatedAt: at(0, 8) },
    { id: "c", updatedAt: at(0, 10) },
  ];
  const groups = group.groupByDate(items, now);
  assert.deepEqual(
    groups.map((g) => g.id),
    ["today", "older"],
  );
  assert.deepEqual(
    groups[0].items.map((i) => i.id),
    ["c", "b"],
  );
  assert.equal(groups[0].label, "Hoy");
});

test("prompt input submit key", () => {
  assert.equal(keys.shouldSubmit({ key: "Enter", shiftKey: false, isComposing: false }), true);
  assert.equal(keys.shouldSubmit({ key: "Enter", shiftKey: true, isComposing: false }), false);
  assert.equal(keys.shouldSubmit({ key: "Enter", shiftKey: false, isComposing: true }), false);
  assert.equal(keys.shouldSubmit({ key: "a", shiftKey: false, isComposing: false }), false);
});

test("markdown: pathological nesting and link scans stay bounded", () => {
  const cases = {
    quotes: `${">".repeat(20000)}x`,
    lists: Array.from({ length: 2000 }, (_, n) => `${"  ".repeat(n)}- item`).join("\n"),
    links: "[](".repeat(10000),
    brackets: "[".repeat(20000),
  };
  for (const [name, src] of Object.entries(cases)) {
    const start = performance.now();
    assert.doesNotThrow(() => md.parseMarkdown(src), name);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 200, `${name} took ${elapsed.toFixed(0)}ms`);
  }
});

test("markdown: nesting beyond the cap degrades to literal text", () => {
  const depthOf = (blocks) => {
    let depth = 0;
    let level = blocks;
    while (level[0]?.t === "quote") {
      depth += 1;
      level = level[0].c;
    }
    return depth;
  };
  assert.equal(depthOf(md.parseMarkdown(`${">".repeat(10)}x`)), 10);
  assert.equal(depthOf(md.parseMarkdown(`${">".repeat(500)}x`)), 33);
});
