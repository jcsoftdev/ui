import assert from "node:assert/strict";
import { test } from "node:test";
import { createTheme } from "../dist/index.js";

// Just enough DOM for applyTheme: attributes, head.append, head.querySelector for the style lookup.
function fakeDocument() {
  const styles = new Set();
  const node = (tag) => {
    const attrs = new Map();
    return {
      tag,
      textContent: "",
      attrs,
      getAttribute: (n) => attrs.get(n) ?? null,
      setAttribute: (n, v) => attrs.set(n, v),
      removeAttribute: (n) => attrs.delete(n),
      remove() {
        styles.delete(this);
      },
    };
  };
  const doc = {
    createElement: node,
    head: {
      append: (el) => styles.add(el),
      querySelector(selector) {
        const m = /^style\[([\w-]+)="([^"]+)"\]$/.exec(selector);
        return [...styles].find((s) => m && s.getAttribute(m[1]) === m[2]) ?? null;
      },
    },
    styles,
  };
  const element = () => Object.assign(node("div"), { ownerDocument: doc });
  return { doc, element };
}

const theme = createTheme({ brand: "#6d28d9" });
const fresh = async (query) => (await import(`../dist/dom.js?${query}`)).applyTheme;

test("each applyTheme call owns its own style element and dispose removes only that one", async () => {
  const { doc, element } = fakeDocument();
  const applyTheme = await fresh("own");
  const a = element();
  const b = element();
  const disposeA = applyTheme(theme, a);
  const disposeB = applyTheme(theme, b);
  assert.equal(doc.styles.size, 2);
  assert.notEqual(a.getAttribute("data-ui-theme"), b.getAttribute("data-ui-theme"));
  disposeA();
  assert.equal(doc.styles.size, 1);
  assert.equal(a.getAttribute("data-ui-theme"), null);
  assert.ok(b.getAttribute("data-ui-theme"), "the other element keeps its theme");
  assert.match([...doc.styles][0].textContent, new RegExp(b.getAttribute("data-ui-theme")));
  disposeB();
  assert.equal(doc.styles.size, 0);
});

test("ids do not collide across separate copies of the module", async () => {
  const { doc, element } = fakeDocument();
  const [one, two] = [await fresh("copy-1"), await fresh("copy-2")];
  const a = element();
  const b = element();
  const disposeA = one(theme, a);
  const disposeB = two(theme, b);
  assert.notEqual(a.getAttribute("data-ui-theme"), b.getAttribute("data-ui-theme"));
  assert.equal(doc.styles.size, 2);
  disposeA();
  assert.equal(doc.styles.size, 1, "disposing one copy's theme leaves the other's style in place");
  disposeB();
});

test("re-applying to the same element replaces its theme; a stale dispose does not remove the new one", async () => {
  const { doc, element } = fakeDocument();
  const applyTheme = await fresh("reapply");
  const el = element();
  const disposeFirst = applyTheme(theme, el);
  const disposeSecond = applyTheme(createTheme({ brand: "#0e7490" }), el);
  assert.equal(doc.styles.size, 1);
  disposeFirst();
  assert.equal(doc.styles.size, 1);
  assert.ok(el.getAttribute("data-ui-theme"));
  disposeSecond();
  assert.equal(doc.styles.size, 0);
  assert.equal(el.getAttribute("data-ui-theme"), null);
});
