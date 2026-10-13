import { afterEach, describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/markdown.ts";
import { createRichText, type RichTextCommand } from "../src/rich-text.ts";
import { sanitizeHtml, setSafeHtml } from "../src/sanitize-html.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

/** Serializes a fragment without the styling hooks, to compare structure only. */
function html(fragment: DocumentFragment): string {
  const host = document.createElement("div");
  host.append(fragment);
  for (const el of host.querySelectorAll("[data-part]")) el.removeAttribute("data-part");
  return host.innerHTML;
}

describe("renderMarkdown", () => {
  it("renders headings, emphasis, lists, quotes and links as DOM", () => {
    const out = html(
      renderMarkdown("# T\n\nHi **b** *i* `c` [l](https://a.example)\n\n- x\n- y\n\n> q\n\n3. n"),
    );
    expect(out).toBe(
      '<h1>T</h1><p>Hi <strong>b</strong> <em>i</em> <code>c</code> <a href="https://a.example/" target="_blank" rel="noopener noreferrer nofollow">l</a></p>' +
        '<ul><li>x</li><li>y</li></ul><blockquote><p>q</p></blockquote><ol start="3"><li>n</li></ol>',
    );
  });

  it("renders tables with scope and alignment, and fenced code as text", () => {
    const out = html(renderMarkdown("| a | b |\n|:-:|--:|\n| 1 | 2 |\n\n```ts\nx < y\n```"));
    expect(out).toContain('<th scope="col" data-align="center">a</th>');
    expect(out).toContain('<td data-align="right">2</td>');
    expect(out).toContain('<pre><code data-language="ts">x &lt; y</code></pre>');
  });

  it("turns hostile input into inert DOM", () => {
    const host = document.createElement("div");
    host.append(
      renderMarkdown(
        [
          "<script>window.__pwned = 1</script>",
          "<img src=x onerror='window.__pwned = 2'>",
          "[a](javascript:window.__pwned=3) [b](data:text/html,x) [c](java\tscript:1)",
          "`<b>`",
          "| <i>h</i> |\n|--|\n| <svg onload=1> |",
          "```\n</pre><script>1</script>\n```",
        ].join("\n\n"),
      ),
    );
    document.body.append(host);
    expect(host.querySelector("script,img,svg,i,b")).toBeNull();
    expect(host.querySelectorAll("[onerror],[onload]")).toHaveLength(0);
    for (const link of host.querySelectorAll("a"))
      expect(link.getAttribute("href")).toMatch(/^https?:|^mailto:/);
    expect(host.textContent).toContain("<script>window.__pwned = 1</script>");
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("shows a caret on the last block while streaming and supports a code renderer", () => {
    const streaming = html(renderMarkdown("one\n\ntwo", { streaming: true }));
    expect(streaming.match(/aria-hidden/g)).toHaveLength(1);
    expect(streaming.endsWith('<span aria-hidden="true"></span></p>')).toBe(true);
    expect(html(renderMarkdown("", { streaming: true }))).toContain("<p><span");
    const custom = html(
      renderMarkdown("```js\nlet a\n```", {
        renderCode: (code, lang, doc) =>
          Object.assign(doc.createElement("figure"), { textContent: `${lang}:${code}` }),
      }),
    );
    expect(custom).toBe("<figure>js:let a</figure>");
  });
});

describe("setSafeHtml", () => {
  it("sanitizes before it touches the DOM", () => {
    const host = document.body.appendChild(document.createElement("div"));
    setSafeHtml(
      host,
      '<p onclick="1">a</p><img src=x onerror="window.__x=1"><script>window.__x=2</script>',
    );
    expect(host.innerHTML).toBe("<p>a</p>");
  });
});

function editable(initial = ""): {
  el: HTMLElement;
  out: string[];
  rich: ReturnType<typeof createRichText>;
  active: Set<RichTextCommand>[];
} {
  const el = document.body.appendChild(document.createElement("div"));
  el.contentEditable = "true";
  const out: string[] = [];
  const active: Set<RichTextCommand>[] = [];
  const rich = createRichText(el, {
    html: initial,
    onChange: (value) => out.push(value),
    onActiveChange: (set) => active.push(new Set(set)),
  });
  return { el, out, rich, active };
}

function selectAll(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = getSelection() as Selection;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("createRichText", () => {
  it("seeds with sanitized HTML and reports emptiness", () => {
    const { el, rich } = editable('<p onclick="x">hi</p><script>1</script>');
    expect(el.innerHTML).toBe("<p>hi</p>");
    expect(rich.getHtml()).toBe("<p>hi</p>");
    rich.setHtml("<p><br></p>");
    expect(rich.isEmpty()).toBe(true);
  });

  it("applies commands to the selection and emits only real changes", () => {
    const { el, out, rich } = editable("<p>hello</p>");
    selectAll(el);
    rich.exec("bold");
    expect(rich.getHtml()).toBe("<p><strong>hello</strong></p>");
    expect(out).toEqual(["<p><strong>hello</strong></p>"]);
    selectAll(el);
    rich.exec("ul");
    expect(rich.getHtml()).toContain("<ul><li>");
    selectAll(el);
    rich.exec("h2");
    expect(rich.getHtml()).toContain("<h2>");
  });

  it("tracks active commands from the selection", async () => {
    const { el, rich, active } = editable("<p><strong>b</strong> plain</p>");
    const range = document.createRange();
    range.selectNodeContents(el.querySelector("strong") as Element);
    el.focus();
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rich.isActive("bold")).toBe(true);
    expect(active.at(-1)?.has("bold")).toBe(true);
  });

  it("sanitizes pasted HTML and plain text", () => {
    const { el, rich } = editable();
    el.focus();
    for (const [type, data] of [
      [
        "text/html",
        '<p>ok</p><img src=x onerror="window.__p=1"><script>window.__p=2</script><a href="javascript:window.__p=3">l</a>',
      ],
      ["text/plain", "<b>x</b> & y"],
    ] as const) {
      const clipboardData = new DataTransfer();
      clipboardData.setData(type, data);
      el.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
      );
    }
    const out = rich.getHtml();
    expect(out).not.toMatch(/<img|<script|javascript:|onerror/);
    expect(out).toContain("ok");
    expect(out).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
    expect((window as unknown as { __p?: number }).__p).toBeUndefined();
  });

  it("sanitizes dropped HTML: nothing is fetched, clobbered or injected into the form", () => {
    const form = document.body.appendChild(document.createElement("form"));
    const field = form.appendChild(document.createElement("input"));
    field.name = "title";
    const el = form.appendChild(document.createElement("div"));
    el.contentEditable = "true";
    el.style.minHeight = "40px";
    const rich = createRichText(el, { html: "<p>x</p>" });
    el.focus();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData(
      "text/html",
      '<img src="/beacon?drop"><span id="clob"></span><input name="role" value="admin"><p>kept</p>',
    );
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer,
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 2,
        clientY: rect.top + 2,
      }),
    );
    expect(el.querySelector("img, input, [id]")).toBeNull();
    expect(rich.getHtml()).toContain("kept");
    expect([...new FormData(form).keys()]).toEqual(["title"]);
    expect((window as unknown as { clob?: unknown }).clob).toBeUndefined();
    form.remove();
  });

  it("sanitizes what beforeinput would insert for drop, paste and replacement", () => {
    const { el, rich } = editable("<p>a</p>");
    el.focus();
    for (const inputType of ["insertFromDrop", "insertFromPaste", "insertReplacementText"]) {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/html", `<img src=x onerror="window.__b=1"><b>${inputType}</b>`);
      const event = new InputEvent("beforeinput", {
        inputType,
        dataTransfer,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(el.querySelector("img")).toBeNull();
    expect(rich.getHtml()).toContain("insertFromDrop");
  });

  it("ignores a paste or drop that carries only a file", () => {
    const { el, rich } = editable();
    el.focus();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["x"], "a.png", { type: "image/png" }));
    el.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dataTransfer, bubbles: true, cancelable: true }),
    );
    el.dispatchEvent(new DragEvent("drop", { dataTransfer, bubbles: true, cancelable: true }));
    expect(rich.getHtml()).toBe("");
    expect(el.innerHTML).not.toContain("<p>");
  });

  it("builds the link on a collapsed selection with DOM APIs", () => {
    const { el, rich } = editable("<p>x</p>");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    rich.saveSelection();
    expect(rich.applyLink('https://a.pe/?a=1&b="2"&c=<d>')).toBe(true);
    const link = el.querySelector("a");
    expect(link?.getAttribute("href")).toBe('https://a.pe/?a=1&b="2"&c=<d>');
    expect(link?.textContent).toBe('https://a.pe/?a=1&b="2"&c=<d>');
  });

  it("keeps named entities through a round trip", () => {
    const { rich } = editable();
    rich.setHtml("<p>caf&eacute; &copy; &amp;eacute; &Eacute;</p>");
    expect(rich.getHtml()).toBe("<p>café © &amp;eacute; É</p>");
  });

  it("links selected text, refuses unsafe URLs and unlinks", () => {
    const { el, rich } = editable("<p>site</p>");
    selectAll(el);
    rich.saveSelection();
    expect(rich.applyLink("javascript:alert(1)")).toBe(false);
    expect(rich.getHtml()).toBe("<p>site</p>");
    expect(rich.applyLink("https://a.example")).toBe(true);
    expect(rich.getHtml()).toContain('href="https://a.example"');
    expect(rich.getHtml()).toContain('rel="noopener noreferrer nofollow"');
    const range = document.createRange();
    range.selectNodeContents(el.querySelector("a") as Element);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    rich.saveSelection();
    expect(rich.linkAtSelection()).toBe("https://a.example");
    rich.removeLink();
    expect(rich.getHtml()).not.toContain("<a");
  });

  it("calls onLinkShortcut on Ctrl+K and stops listening after destroy", () => {
    const el = document.body.appendChild(document.createElement("div"));
    el.contentEditable = "true";
    let calls = 0;
    const rich = createRichText(el, { onLinkShortcut: () => calls++ });
    const press = () =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }),
      );
    press();
    expect(calls).toBe(1);
    rich.destroy();
    press();
    expect(calls).toBe(1);
  });
});

describe("sanitizeHtml in a real parser", () => {
  it("round-trips through innerHTML without creating active nodes", () => {
    const host = document.body.appendChild(document.createElement("div"));
    for (const vector of [
      '<svg><a xlink:href="javascript:1"><text>x</text></a></svg>',
      "<math><mtext><table><mglyph><style><img src=x onerror=1>",
      '<a href="&#x6A;avascript:1">x</a>',
      '<noscript><p title="</noscript><img src=x onerror=1>">',
    ]) {
      host.innerHTML = sanitizeHtml(vector);
      expect(host.querySelector("img,svg,math,style,script")).toBeNull();
      expect(host.querySelector("[onerror]")).toBeNull();
      expect(host.querySelector("a[href^='javascript' i]")).toBeNull();
    }
  });
});
