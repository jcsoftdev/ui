import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineRichTextView, type UiRichTextView } from "../src/rich-text-view/rich-text-view.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineRichTextView();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const make = (attrs = "") =>
  mount(`<ui-rich-text-view ${attrs}></ui-rich-text-view>`).firstElementChild as UiRichTextView;
const flag = () => (window as unknown as { __xss?: number }).__xss;
const tick = () => new Promise((r) => setTimeout(r, 50));
const protocols = (view: HTMLElement) =>
  [...view.querySelectorAll("a")].map((a) => new URL(a.href, document.baseURI).protocol);

describe("ui-rich-text-view", () => {
  it("renders the editor vocabulary and drops everything else", () => {
    const view = make();
    view.html =
      '<h2>Title</h2><p class="x" style="color:red">Hi <strong>there</strong> <u>u</u></p><ul><li>a</li></ul><blockquote>q</blockquote><div>unwrapped</div>';
    expect(view.querySelector("h2")?.textContent).toBe("Title");
    expect(view.querySelector("p")?.hasAttribute("class")).toBe(false);
    expect(view.querySelector("p")?.hasAttribute("style")).toBe(false);
    expect(view.querySelector("strong")?.textContent).toBe("there");
    expect(view.querySelector("div")).toBeNull();
    expect(view.textContent).toContain("unwrapped");
  });

  it("reads the html attribute, the property, and a template child", () => {
    expect(make('html="<p>attr</p>"').querySelector("p")?.textContent).toBe("attr");
    const view = make();
    view.html = "<p>one</p>";
    expect(view.html).toBe("<p>one</p>");
    view.html = "<p>two</p>";
    expect(view.querySelector("p")?.textContent).toBe("two");
    const host = mount("<ui-rich-text-view><template><p>tpl</p></template></ui-rich-text-view>");
    expect(host.firstElementChild?.querySelector("p")?.textContent).toBe("tpl");
  });

  describe("XSS", () => {
    it("removes <img onerror> and <svg onload> before they can run", async () => {
      const view = make();
      view.html =
        '<p>a</p><img src=x onerror="window.__xss=1"><svg onload="window.__xss=1"><circle/></svg><iframe src="javascript:window.__xss=1"></iframe><script>window.__xss=1</script><style>*{display:none}</style><math><mi xlink:href="javascript:window.__xss=1">x</mi></math>';
      await tick();
      expect(view.querySelector("img, svg, iframe, script, style, math, object, embed")).toBeNull();
      for (const element of view.querySelectorAll("*"))
        for (const attribute of element.attributes) expect(attribute.name).not.toMatch(/^on/i);
      expect(view.textContent).not.toContain("window.__xss");
      expect(flag()).toBeUndefined();
    });

    it("blocks javascript: hrefs with unicode whitespace and invisible characters", async () => {
      const view = make();
      const evil = [
        "javascript:window.__xss=1",
        "java script:window.__xss=1",
        "java script:window.__xss=1",
        "java script:window.__xss=1",
        "java​script:window.__xss=1",
        "  javascript:window.__xss=1",
        "jav&#x09;ascript:window.__xss=1",
        "data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194c3M9MTwvc2NyaXB0Pg==",
        "vbscript:msgbox(1)",
      ];
      view.html = evil.map((href, i) => `<a href="${href}">l${i}</a>`).join("");
      await tick();
      expect(view.querySelector('a[href*="script" i], a[href^="data" i]')).toBeNull();
      for (const protocol of protocols(view))
        expect(["http:", "https:", "mailto:", "tel:"]).toContain(protocol);
      expect(view.textContent).toContain("l0");
      expect(flag()).toBeUndefined();
    });

    it("blocks entity-encoded schemes", async () => {
      const view = make();
      view.html = [
        '<a href="&#106;avascript:window.__xss=1">a</a>',
        '<a href="&#x6A;avascript:window.__xss=1">b</a>',
        '<a href="javascript&colon;window.__xss=1">c</a>',
        '<a href="&#0000106avascript:window.__xss=1">d</a>',
        '<a href="java&Tab;script:window.__xss=1">e</a>',
        '<a href="&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A;window.__xss=1">f</a>',
      ].join("");
      await tick();
      expect(view.querySelector('a[href*="script" i]')).toBeNull();
      for (const protocol of protocols(view))
        expect(["http:", "https:", "mailto:", "tel:"]).toContain(protocol);
      expect(flag()).toBeUndefined();
    });

    it("keeps the allowlisted schemes and relative links", () => {
      const view = make();
      view.html =
        '<a href="https://a.test/x?y=1">a</a><a href="mailto:x@y.test">b</a><a href="tel:+51999">c</a><a href="/rel">d</a><a href="#frag">e</a>';
      expect([...view.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
        "https://a.test/x?y=1",
        "mailto:x@y.test",
        "tel:+51999",
        "/rel",
        "#frag",
      ]);
    });

    it("sanitizes again on every update, never trusting the previous render", async () => {
      const view = make();
      view.html = "<p>ok</p>";
      view.html = '<p onmouseover="window.__xss=1">x</p><img src=x onerror="window.__xss=1">';
      view.setAttribute("html", '<svg onload="window.__xss=1"></svg><b>hi</b>');
      await tick();
      expect(view.querySelector("svg, img, [onmouseover]")).toBeNull();
      expect(flag()).toBeUndefined();
    });
  });
});
