// Named-entity decoding in the sanitizer: Trusted Types, case sensitivity and the no-DOM table.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));

// The module caches its decoder, so every test bundles and imports a fresh copy.
let n = 0;
async function load() {
  const bundle = await build({
    entryPoints: [join(here, "../src/rich-text/sanitize.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
  });
  const code = `${Buffer.from(bundle.outputFiles[0].contents).toString()}\n//${n++}`;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

function fakeDocument(throws) {
  const calls = [];
  globalThis.document = {
    createElement: () => {
      let value = "";
      return {
        set innerHTML(v) {
          calls.push(v);
          if (throws) throw new TypeError("This document requires 'TrustedHTML' assignment.");
          value = v === "&Colon;" ? "∷" : v;
        },
        get value() {
          return value;
        },
      };
    },
  };
  return calls;
}

afterEach(() => {
  delete globalThis.document;
});

test("an entity stays undecoded and escaped when innerHTML throws (Trusted Types)", async () => {
  fakeDocument(true);
  const { sanitizeHtml } = await load();
  assert.equal(sanitizeHtml("<p>caf&eacute; &amp; x</p>"), "<p>caf&amp;eacute; &amp; x</p>");
});

test("entity names are case-sensitive: &Colon; is not &colon;", async () => {
  const calls = fakeDocument(false);
  const { sanitizeHtml } = await load();
  assert.equal(sanitizeHtml("<p>a&colon;b a&Colon;b</p>"), "<p>a:b a∷b</p>");
  assert.deepEqual(calls, ["&Colon;"]);
});

test("without a DOM only the small table applies", async () => {
  const { sanitizeHtml } = await load();
  assert.equal(
    sanitizeHtml("<p>&AMP; &Colon; &eacute;</p>"),
    "<p>&amp; &amp;Colon; &amp;eacute;</p>",
  );
});
