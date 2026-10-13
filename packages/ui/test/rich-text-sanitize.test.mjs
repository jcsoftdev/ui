// Allowlist sanitizer behind the RichTextEditor: scripts, event handlers, hostile URLs and balance.
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

const { sanitizeHtml, isSafeUrl, htmlToText } = await load("../src/rich-text/sanitize.ts");

test("keeps the editor vocabulary", () => {
  const html =
    "<h2>Título</h2><p>Hola <strong>mundo</strong> <em>y</em> <u>todos</u> <s>x</s></p><ul><li>uno</li><li>dos</li></ul><ol><li>a</li></ol><blockquote>cita</blockquote>";
  assert.equal(sanitizeHtml(html), html);
});

test("drops script elements together with their content", () => {
  assert.equal(sanitizeHtml("<p>ok</p><script>alert(1)</script>"), "<p>ok</p>");
  assert.equal(sanitizeHtml("<SCRIPT SRC=//evil.js></SCRIPT>hola"), "hola");
  assert.equal(sanitizeHtml("<script>alert(1)"), "");
  assert.equal(sanitizeHtml("<style>p{x:y}</style><p>a</p>"), "<p>a</p>");
  assert.equal(sanitizeHtml("<iframe src=//evil></iframe>x"), "x");
  assert.equal(sanitizeHtml("<svg onload=alert(1)><script>1</script></svg>x"), "x");
});

test("strips onerror and other event handler attributes", () => {
  assert.equal(sanitizeHtml("<img src=x onerror=alert(1)>texto"), "texto");
  assert.equal(sanitizeHtml('<p onclick="alert(1)" style="color:red">hola</p>'), "<p>hola</p>");
  assert.equal(sanitizeHtml('<strong onmouseover="x()">hola</strong>'), "<strong>hola</strong>");
  assert.equal(sanitizeHtml("<body onload=alert(1)>hola"), "hola");
});

test("javascript: and other hostile URLs are removed from links", () => {
  const hostile = [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "java&#x09;script:alert(1)",
    "&#106;avascript:alert(1)",
    "&#x6A;avascript&colon;alert(1)",
    "jav&#x0A;ascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "\u0001javascript:alert(1)",
    "",
  ];
  for (const href of hostile) {
    const out = sanitizeHtml(`<a href="${href}">x</a>`);
    assert.ok(!/href/i.test(out), `${JSON.stringify(href)} -> ${out}`);
    assert.ok(!/javascript/i.test(out) || !out.includes("href"), out);
  }
  assert.equal(sanitizeHtml("<a href=javascript:alert(1)>x</a>"), "<a>x</a>");
  assert.equal(sanitizeHtml("<a href='javascript:alert(1)'>x</a>"), "<a>x</a>");
});

test("safe links get rel and target, and are re-escaped", () => {
  assert.equal(
    sanitizeHtml('<a href="https://barberia.pe/citas?a=1&b=2" onclick="x()">Reservar</a>'),
    '<a href="https://barberia.pe/citas?a=1&amp;b=2" rel="noopener noreferrer nofollow" target="_blank">Reservar</a>',
  );
  for (const href of [
    "http://a.pe",
    "mailto:hola@barberia.pe",
    "tel:+51999888777",
    "/citas",
    "#top",
  ]) {
    assert.ok(
      sanitizeHtml(`<a href="${href}">x</a>`).includes('rel="noopener noreferrer nofollow"'),
      href,
    );
  }
  assert.equal(
    sanitizeHtml('<a href="https://a.pe&quot; onmouseover=&quot;x">y</a>'),
    '<a href="https://a.pe&quot; onmouseover=&quot;x" rel="noopener noreferrer nofollow" target="_blank">y</a>',
  );
});

test("text is escaped; entity-encoded markup stays text", () => {
  assert.equal(
    sanitizeHtml("&lt;script&gt;alert(1)&lt;/script&gt;"),
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  );
  assert.equal(sanitizeHtml("a < b && c > d"), "a &lt; b &amp;&amp; c &gt; d");
  assert.equal(
    sanitizeHtml("<scr<script>ipt>alert(1)</scr</script>ipt>"),
    "ipt&gt;alert(1)ipt&gt;",
  );
});

test("comments, doctype and processing instructions are dropped", () => {
  assert.equal(sanitizeHtml("<!-- <script>x</script> --><p>a</p>"), "<p>a</p>");
  assert.equal(sanitizeHtml("<!DOCTYPE html><?xml version='1.0'?><p>a</p>"), "<p>a</p>");
  assert.equal(sanitizeHtml("<p>a</p><!-- sin cierre"), "<p>a</p>");
});

test("unknown tags are unwrapped and aliases normalized", () => {
  assert.equal(sanitizeHtml("<font color=red><b>hola</b></font>"), "<strong>hola</strong>");
  assert.equal(sanitizeHtml("<div>uno</div><h1>dos</h1>"), "<p>uno</p><h2>dos</h2>");
  assert.equal(sanitizeHtml("<i>x</i>"), "<em>x</em>");
});

test("output is balanced and block elements do not nest in paragraphs", () => {
  assert.equal(sanitizeHtml("<p>a<strong>b"), "<p>a<strong>b</strong></p>");
  assert.equal(sanitizeHtml("</em>texto</p>"), "texto");
  assert.equal(sanitizeHtml("<p>uno<p>dos"), "<p>uno</p><p>dos</p>");
  assert.equal(sanitizeHtml("<li>uno<li>dos"), "<li>uno</li><li>dos</li>");
  assert.equal(sanitizeHtml("<a href='/x'>a<a href='/y'>b</a>").split("<a ").length - 1, 2);
  assert.equal(sanitizeHtml("uno<br/>dos<br>"), "uno<br>dos<br>");
});

test("tolerates garbage and non-strings", () => {
  assert.equal(sanitizeHtml(undefined), "");
  assert.equal(sanitizeHtml(null), "");
  assert.equal(sanitizeHtml("<"), "&lt;");
  assert.equal(sanitizeHtml("<p"), "");
  assert.equal(sanitizeHtml('<a href="x'), "");
});

test("isSafeUrl and htmlToText", () => {
  assert.equal(isSafeUrl("https://x.pe"), true);
  assert.equal(isSafeUrl("javascript:1"), false);
  assert.equal(isSafeUrl("data:text/plain,hola"), false);
  assert.equal(htmlToText("<p>Hola&nbsp;<strong>x</strong></p>"), "Hola x".trim());
  assert.equal(htmlToText("<p><br></p>"), "");
});

const UNICODE_SPACE_PAYLOADS = [
  "&nbsp;javascript:alert(1)",
  "&#160;&#160;vbscript:msgbox(1)",
  "&#xa0;data:text/html,<script>alert(1)</script>",
  " javascript:alert(1)",
  "　javascript:alert(1)",
  " javascript:alert(1)",
  " javascript:alert(1)",
  " javascript:alert(1)",
  " javascript:alert(1)",
  " javascript:alert(1)",
  "java script:alert(1)",
  "⁠javascript:alert(1)",
  "&#x3000;&#x2003;JaVaScRiPt:alert(1)",
];

test("unicode whitespace in front of a scheme cannot smuggle javascript: through trim()", () => {
  for (const href of UNICODE_SPACE_PAYLOADS) {
    const out = sanitizeHtml(`<a href="${href}">x</a>`);
    assert.equal(out, "<a>x</a>", `${JSON.stringify(href)} -> ${out}`);
    assert.equal(isSafeUrl(href), false, JSON.stringify(href));
  }
});

test("sanitizeHtml is idempotent over the hostile corpus and the unicode payloads", () => {
  const corpus = [
    ...UNICODE_SPACE_PAYLOADS.map((href) => `<a href="${href}">x</a>`),
    "<a href=javascript:alert(1)>x</a>",
    '<a href="https://barberia.pe/citas?a=1&b=2">y</a>',
    '<a href="&nbsp;https://a.pe/ok">trimmed</a>',
    "<script>alert(1)</script><p onclick=x>a</p>",
    "<scr<script>ipt>alert(1)</scr</script>ipt>",
    "&lt;script&gt;alert(1)&lt;/script&gt;",
    "<p>a<strong>b",
  ];
  for (const input of corpus) {
    const once = sanitizeHtml(input);
    assert.equal(sanitizeHtml(once), once, JSON.stringify(input));
  }
});

test("a safe link padded with unicode whitespace keeps working, trimmed", () => {
  assert.equal(
    sanitizeHtml('<a href="&nbsp;https://a.pe/x　">y</a>'),
    '<a href="https://a.pe/x" rel="noopener noreferrer nofollow" target="_blank">y</a>',
  );
});
