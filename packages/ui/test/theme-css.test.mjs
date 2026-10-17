import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const require = createRequire(join(root, "package.json"));
const { compile } = require("tailwindcss");

const themeCss = readFileSync(join(root, "styles/theme.css"), "utf8");

// `--radius-input: var(--radius-input)` and its indirect forms (a -> b -> a).
function selfReferences(css) {
  const edges = new Map();
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*var\(\s*(--[\w-]+)\s*[,)]/g)) {
    edges.set(m[1], [...(edges.get(m[1]) ?? []), m[2]]);
  }
  const cyclic = [];
  for (const start of edges.keys()) {
    const seen = new Set();
    const stack = [...(edges.get(start) ?? [])];
    while (stack.length) {
      const next = stack.pop();
      if (next === start) {
        cyclic.push(start);
        break;
      }
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(edges.get(next) ?? []));
    }
  }
  return cyclic;
}

const stylesheet = (id) =>
  readFileSync(require.resolve(id.endsWith(".css") ? id : `${id}.css`), "utf8");

async function build(theme) {
  const compiler = await compile(
    `@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
${theme}`,
    {
      base: root,
      loadStylesheet: async (id, base) => ({ path: id, base, content: stylesheet(id) }),
    },
  );
  // One utility per mapped token, so everything the theme declares is emitted if Tailwind emits it.
  const prefix = { color: "bg", radius: "rounded", shadow: "shadow", font: "font" };
  const candidates = [...themeCss.matchAll(/^\s*--(color|radius|shadow|font)-([\w-]+):/gm)].map(
    ([, kind, name]) => `${prefix[kind]}-${name}`,
  );
  return compiler.build(candidates);
}

test("the cycle detector flags direct and indirect self references", () => {
  assert.deepEqual(selfReferences(":root{--a:var(--a)}"), ["--a"]);
  assert.deepEqual(selfReferences(":root{--a:var(--b);--b:var(--a)}").sort(), ["--a", "--b"]);
  assert.deepEqual(selfReferences(":root{--color-x:var(--x);--x:#fff}"), []);
});

test("the built theme CSS has no self-referencing custom property", async () => {
  const css = await build(themeCss);
  assert.match(css, /\.rounded-input\s*\{[^}]*var\(--radius-input\)/);
  assert.match(css, /\.shadow-pop\b/);
  assert.deepEqual(selfReferences(css), []);
});

test("theme.css keeps the self-named tokens out of the emitted theme layer", () => {
  assert.match(themeCss, /@theme reference inline \{[^}]*--radius-input: var\(--radius-input\);/);
  const inline = themeCss.match(/@theme inline \{([^}]*)\}/)?.[1] ?? "";
  assert.deepEqual(selfReferences(`:root{${inline}}`), []);
});

test("theme.css still resolves raw tokens when tokens.css loads below the theme layer", async () => {
  const css = await build(themeCss);
  const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
  // The raw value only needs to exist somewhere; the utility reads it directly.
  assert.match(tokens, /--radius-input:/);
  assert.doesNotMatch(css, /--radius-input:\s*var\(--radius-input\)/);
});
