import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/rich-text/sanitize.ts";
import { htmlToText, isSafeUrl, sanitizeHtml } from "../src/sanitize-html.ts";

/** Known XSS payloads (OWASP cheat sheet shapes). None may leave an active construct behind. */
const VECTORS = [
  "<script>alert(1)</script>",
  "<SCRIPT SRC=//evil.example/x.js></SCRIPT>",
  "<scr<script>ipt>alert(1)</scr</script>ipt>",
  '<img src=x onerror="alert(1)">',
  "<svg/onload=alert(1)>",
  "<svg><script>alert(1)</script></svg>",
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="data:text/html,<script>alert(1)</script>"></object>',
  '<embed src="javascript:alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="  javascript:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="java&Tab;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="&#0000106avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="\u0001javascript:alert(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="javascript:alert(1)" onclick="alert(2)">x</a>',
  "<a href=javascript:alert(1)>x</a>",
  "<a href='javascript:alert(1)'>x</a>",
  '<a href="https://ok.example" onmouseover="alert(1)">x</a>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<p onclick="alert(1)">x</p>',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  "<input autofocus onfocus=alert(1)>",
  '<style>@import "javascript:alert(1)"</style>',
  '<link rel=stylesheet href="javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  "<template><script>alert(1)</script></template>",
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  "<textarea></textarea><img src=x onerror=alert(1)>",
  "<xmp><img src=x onerror=alert(1)></xmp>",
  "<!--><img src=x onerror=alert(1)>-->",
  "<![CDATA[<img src=x onerror=alert(1)>]]>",
  '<img src="x" onerror="alert(1)"',
  "<<img src=x onerror=alert(1)>",
  '<a href="https://ok.example"onclick="alert(1)">x</a>',
  "<video><source onerror=alert(1)></video>",
  "<details open ontoggle=alert(1)>x</details>",
];

const ACTIVE =
  /<(script|img|svg|iframe|object|embed|style|link|meta|base|form|input|video|details|math)\b|\son[a-z]+\s*=|javascript:|vbscript:|data:/i;

/** Unicode-whitespace prefixes: the React kit let these through (fixed upstream separately). */
const UNICODE_SPACE_VECTORS = [
  '<a href="&nbsp;javascript:alert(1)">x</a>',
  '<a href="&#160;javascript:alert(1)">x</a>',
  '<a href="&#xa0;vbscript:msgbox(1)">x</a>',
  '<a href="&#xA0;data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="&#x1680;javascript:alert(1)">x</a>',
  '<a href="&#x2003;javascript:alert(1)">x</a>',
  '<a href="&#x202f;javascript:alert(1)">x</a>',
  '<a href="&#x205f;javascript:alert(1)">x</a>',
  '<a href="&#x3000;javascript:alert(1)">x</a>',
  '<a href="\u00a0javascript:alert(1)">x</a>',
  '<a href="java\u00a0script:alert(1)">x</a>',
  '<a href="java&#x200b;script:alert(1)">x</a>',
  '<a href="java&#xad;script:alert(1)">x</a>',
  '<a href="&#x2060;javascript:alert(1)">x</a>',
];
VECTORS.push(...UNICODE_SPACE_VECTORS);

describe("sanitizeHtml: XSS vectors", () => {
  for (const vector of VECTORS) {
    it(vector.slice(0, 60), () => {
      const out = sanitizeHtml(vector);
      expect(out).not.toMatch(ACTIVE);
      // Whatever survives is within the allowlist and has no attribute except a vetted <a>.
      for (const tag of out.matchAll(/<([a-z0-9]+)([^>]*)>/g)) {
        expect([
          "p",
          "br",
          "strong",
          "em",
          "u",
          "s",
          "ul",
          "ol",
          "li",
          "a",
          "h2",
          "h3",
          "blockquote",
        ]).toContain(tag[1]);
        if (tag[1] !== "a") expect(tag[2]).toBe("");
        else
          expect(tag[2]).toMatch(
            /^( href="(https?:|mailto:|tel:|[^":]*")[^"]*")? rel="noopener noreferrer nofollow" target="_blank"$|^$/,
          );
      }
    });
  }

  it("drops the link when the href hides a scheme behind Unicode whitespace", () => {
    for (const vector of UNICODE_SPACE_VECTORS) expect(sanitizeHtml(vector)).toBe("<a>x</a>");
  });

  it("emits exactly the string it validated", () => {
    for (const vector of VECTORS) {
      for (const [, href] of sanitizeHtml(vector).matchAll(/href="([^"]*)"/g)) {
        const text = (href as string).replace(/&amp;/g, "&");
        expect(isSafeUrl(text)).toBe(true);
        expect(text).toBe(text.trim());
      }
    }
  });

  it("is idempotent", () => {
    for (const vector of VECTORS) {
      const once = sanitizeHtml(vector);
      expect(sanitizeHtml(once)).toBe(once);
    }
  });

  it("keeps safe links and the editor vocabulary", () => {
    expect(
      sanitizeHtml('<p>Hi <b>there</b> <a href="https://a.example/?q=1&amp;r=2">go</a></p>'),
    ).toBe(
      '<p>Hi <strong>there</strong> <a href="https://a.example/?q=1&amp;r=2" rel="noopener noreferrer nofollow" target="_blank">go</a></p>',
    );
    expect(
      sanitizeHtml('<a href="mailto:a@b.co">m</a><a href="/rel">r</a><a href="#f">f</a>'),
    ).toContain('href="mailto:a@b.co"');
  });

  it("escapes text and balances tags", () => {
    expect(sanitizeHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
    expect(sanitizeHtml("<ul><li>a<li>b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("isSafeUrl allows only the vetted schemes", () => {
    for (const ok of [
      "https://a.example",
      "http://a",
      "mailto:x@y.z",
      "tel:+51999",
      "/x",
      "#y",
      "?q",
    ])
      expect(isSafeUrl(ok)).toBe(true);
    for (const bad of [
      "",
      "javascript:1",
      "data:text/html,x",
      "vbscript:1",
      "file:///etc/passwd",
      "blob:x",
      "ftp://a",
    ])
      expect(isSafeUrl(bad)).toBe(false);
  });
});

describe("sanitizeHtml: parity with the React kit", () => {
  const corpus = [
    ...VECTORS.filter((vector) => !UNICODE_SPACE_VECTORS.includes(vector)),
    "<h1>T</h1><h4>x</h4><div>d</div><strike>s</strike><del>d</del><i>i</i>",
    "<p>a<p>b<h2>c</h2>d",
    "<blockquote><p>q</p></blockquote>",
    "plain &amp; text &lt;b&gt; &copy; &#169; &#xA9; &nbsp;",
    '<a href="https://a.example">1</a><a href="https://b.example">2<a href="https://c.example">3</a>',
    "<ol><li>1<ul><li>2</li></ul></li></ol>",
    "<br><br/></br>",
    "",
  ];
  it("sanitizeHtml, htmlToText and isSafeUrl match for every input", () => {
    for (const input of corpus) {
      expect(sanitizeHtml(input)).toBe(react.sanitizeHtml(input));
      expect(htmlToText(input)).toBe(react.htmlToText(input));
      expect(isSafeUrl(input)).toBe(react.isSafeUrl(input));
    }
  });
});

describe("sanitizer: hostile nesting stays cheap", () => {
  const payloads: Record<string, string> = {
    openThenBlocks: "<b>".repeat(40000) + "<p>".repeat(40000),
    openThenStrayCloser: "<b>".repeat(70000) + "</p>".repeat(70000),
    scripts: "<script></script>".repeat(20000),
  };
  for (const [name, input] of Object.entries(payloads)) {
    it(`finishes ${name} under 200 ms and stays idempotent`, () => {
      const start = performance.now();
      const out = sanitizeHtml(input);
      expect(performance.now() - start).toBeLessThan(200);
      expect(sanitizeHtml(out)).toBe(out);
    });
  }

  it("unwraps elements nested deeper than 128 and keeps the text", () => {
    const out = sanitizeHtml(`${"<b>".repeat(300)}text${"</b>".repeat(300)}`);
    expect(out.match(/<strong>/g)?.length).toBe(128);
    expect(out).toContain("text");
    expect(sanitizeHtml(out)).toBe(out);
  });
});
