import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditTheme,
  CONTRAST_PAIRS,
  contrastRatio,
  createTheme,
  hexToOklch,
  oklchToHex,
  toCss,
  withTheme,
} from "../dist/index.js";
import { buildTheme } from "../scripts/build-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const defaults = JSON.parse(readFileSync(join(here, "../tokens/default.json"), "utf8"));
const update = process.env.UPDATE_GOLDEN === "1";

// mulberry32: a tiny seeded PRNG so the property test is reproducible.
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hex = (r) =>
  `#${Math.floor(r() * 0x1000000)
    .toString(16)
    .padStart(6, "0")}`;
const report = (theme) =>
  auditTheme(theme)
    .slice(0, 3)
    .map((v) => `${v.scheme} ${v.fg}/${v.bg} ${v.ratio.toFixed(2)} < ${v.min}`)
    .join("; ");

test("color math round-trips and matches known WCAG ratios", () => {
  assert.equal(oklchToHex(hexToOklch("#6d28d9")), "#6d28d9");
  assert.equal(oklchToHex({ l: 0, c: 0, h: 0 }), "#000000");
  assert.equal(oklchToHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#767676", "#ffffff").toFixed(2), "4.54");
  // out-of-gamut chroma is reduced, never producing an invalid color
  assert.match(oklchToHex({ l: 0.7, c: 0.5, h: 145 }), /^#[0-9a-f]{6}$/);
});

test("every declared pair meets its WCAG ratio for 1500 random seed sets", () => {
  const r = rng(20261012);
  for (let i = 0; i < 1500; i++) {
    const seeds = { brand: hex(r) };
    if (r() < 0.5) seeds.accent = hex(r);
    if (r() < 0.5) seeds.neutral = hex(r);
    if (r() < 0.3) seeds.danger = hex(r);
    const theme = createTheme({ ...seeds, contrast: "AA" });
    assert.equal(report(theme), "", `seeds ${JSON.stringify(seeds)}`);
  }
});

test("edge-case seeds still meet every pair", () => {
  const edges = [
    "#000000",
    "#ffffff",
    "#808080",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
    "#00ffff",
    "#ff00ff",
    "#fff",
    "#123",
  ];
  for (const brand of edges) {
    for (const extra of [{}, { neutral: brand, danger: brand, accent: brand }]) {
      assert.equal(report(createTheme({ brand, ...extra })), "", `brand ${brand}`);
    }
  }
});

test("auditTheme detects a violation (the check can fail)", () => {
  const theme = createTheme({ brand: "#6d28d9" });
  const broken = structuredClone(theme);
  broken.color.tokens.find((t) => t.name === "ink-2").value.light = "#cccccc";
  const found = auditTheme(broken);
  assert.ok(found.some((v) => v.fg === "ink-2" && v.scheme === "light"));
  assert.ok(CONTRAST_PAIRS.length > 50);
});

test("output is deterministic and matches the golden file", () => {
  const a = JSON.stringify(
    createTheme({ brand: "#6d28d9", accent: "#0ea5e9", neutral: "#64748b" }),
    null,
    2,
  );
  const b = JSON.stringify(
    createTheme({ brand: "#6d28d9", accent: "#0ea5e9", neutral: "#64748b" }),
    null,
    2,
  );
  assert.equal(a, b);
  const file = join(here, "golden", "create-theme.json");
  if (update || !existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${a}\n`);
  }
  assert.equal(`${a}\n`, readFileSync(file, "utf8"));
});

test("same token shape as default.json and a superset of its semantic color names", () => {
  const theme = createTheme({ brand: "#0e7490" });
  assert.equal(theme.version, defaults.version);
  assert.deepEqual(
    theme.color.themes.map((t) => t.id),
    defaults.color.themes.map((t) => t.id),
  );
  const names = new Set(theme.color.tokens.map((t) => t.name));
  for (const t of defaults.color.tokens.filter((t) => !t.name.startsWith("pal-"))) {
    assert.ok(names.has(t.name), `missing token ${t.name}`);
  }
  for (const t of theme.color.tokens) {
    assert.deepEqual(Object.keys(t).sort(), ["name", "usage", "value"]);
    assert.deepEqual(Object.keys(t.value).sort(), ["dark", "light"]);
  }
});

test("a generated theme merges into default.json and builds through the same pipeline", () => {
  const merged = withTheme(defaults, createTheme({ brand: "#0e7490" }));
  assert.ok(
    merged.color.tokens.some((t) => t.name === "pal-menta-fill"),
    "accent presets are kept",
  );
  assert.equal(merged.color.tokens.filter((t) => t.name === "accent").length, 1);
  const files = buildTheme(merged);
  assert.match(files["tokens.css"], /--accent: #0e7490;/);
  assert.match(files["tokens.css"], /\[data-accent="menta"\]/);
});

test("toCss emits light, dark media and forced-dark blocks, or one scheme", () => {
  const theme = createTheme({ brand: "#6d28d9" });
  const auto = toCss(theme, { selector: ".brand" });
  assert.match(auto, /^\.brand \{\n {2}--bg: #/);
  assert.match(
    auto,
    /@media \(prefers-color-scheme: dark\) \{\n {2}\.brand:where\(:not\(\[data-theme="light"\]\)/,
  );
  assert.match(
    auto,
    /\.brand:where\(\[data-theme="dark"\]\),\n:where\(\[data-theme="dark"\]\) \.brand \{/,
  );
  const dark = toCss(theme, { scheme: "dark" });
  assert.match(dark, /^:root \{\n {2}--bg: #000000;/);
  assert.doesNotMatch(dark, /@media/);
  const lightBg = theme.color.tokens.find((t) => t.name === "bg").value.light;
  assert.match(toCss(theme, { scheme: "light" }), new RegExp(`--bg: ${lightBg};`));
});

test("invalid input is rejected with a clear error", () => {
  assert.throws(() => createTheme({ brand: "purple" }), /hex color/);
  assert.throws(() => createTheme({}), TypeError);
  assert.throws(() => createTheme({ brand: "#6d28d9", contrast: "AAA" }), /only "AA"/);
  assert.throws(() => createTheme({ brand: "#6d28d9", neutral: "#zzz" }), TypeError);
});

test("existing data-accent presets: on-fill, ink and soft pairs meet AA; known word/bg exceptions are pinned", () => {
  const tok = Object.fromEntries(defaults.color.tokens.map((t) => [t.name, t.value]));
  const palettes = [
    ...new Set(
      defaults.color.tokens.map((t) => /^pal-(.+)-fill$/.exec(t.name)?.[1]).filter(Boolean),
    ),
  ];
  const belowThreeOnPage = [];
  for (const p of palettes) {
    for (const s of ["light", "dark"]) {
      const v = (role) => tok[`pal-${p}-${role}`][s];
      assert.ok(contrastRatio(v("deep"), v("fill")) >= 4.5, `${p} ${s} deep on fill`);
      assert.ok(contrastRatio(v("ink"), tok.surface[s]) >= 4.5, `${p} ${s} ink on surface`);
      assert.ok(contrastRatio(v("ink"), v("soft")) >= 4.5, `${p} ${s} ink on soft`);
      assert.ok(contrastRatio(v("word"), tok.surface[s]) >= 3, `${p} ${s} word on surface`);
      if (contrastRatio(v("word"), tok.bg[s]) < 3) belowThreeOnPage.push(`${p}/${s}`);
    }
  }
  // Pinned so a palette edit cannot make it worse unnoticed; createTheme itself requires 3:1 on bg too.
  assert.deepEqual(belowThreeOnPage, ["menta/light"]);
});

test("tree-shaking and SSR: the main entry never imports the DOM module and runs without a DOM", () => {
  const dist = join(here, "../dist");
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(join(dist, file), "utf8");
    for (const m of code.matchAll(/from\s+"\.\/([^"]+)"/g)) visit(m[1]);
  };
  visit("index.js");
  assert.ok(!seen.has("dom.js"), "index.js must not reach dom.js");
  for (const file of seen) {
    assert.doesNotMatch(
      readFileSync(join(dist, file), "utf8"),
      /\b(document|window|navigator|HTMLElement)\b/,
      file,
    );
  }
  const out = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `if (typeof document !== "undefined" || typeof window !== "undefined") throw new Error("DOM present");
       const { createTheme, toCss } = await import(${JSON.stringify(join(dist, "index.js"))});
       console.log(toCss(createTheme({ brand: "#6d28d9" })).length > 1000);`,
    ],
    { encoding: "utf8" },
  );
  assert.equal(out.trim(), "true");
  assert.ok(readdirSync(dist).includes("dom.js"));
});

test("ui-theme generate writes tokens.json and the css outputs", () => {
  const out = mkdtempSync(join(tmpdir(), "ui-gen-"));
  execFileSync(
    process.execPath,
    [
      join(here, "../bin/ui-theme.mjs"),
      "generate",
      "--brand",
      "#0e7490",
      "--neutral",
      "#64748b",
      "--out",
      out,
      "--no-kotlin",
    ],
    { stdio: "pipe" },
  );
  assert.deepEqual(readdirSync(out).sort(), [
    "fonts.css",
    "tailwind.css",
    "theme.css",
    "tokens.css",
    "tokens.json",
  ]);
  const json = JSON.parse(readFileSync(join(out, "tokens.json"), "utf8"));
  assert.equal(report({ color: json.color }), "");
  assert.throws(() =>
    execFileSync(process.execPath, [join(here, "../bin/ui-theme.mjs"), "generate", "--out", out], {
      stdio: "pipe",
    }),
  );
});

// Minimal CSS specificity calculator for the selector shapes toCss emits (a, b, c).
function specificity(selector) {
  let a = 0;
  let b = 0;
  let c = 0;
  const walk = (sel) => {
    let rest = sel;
    for (;;) {
      const fn = /:(where|not|is)\(/.exec(rest);
      if (!fn) break;
      let depth = 1;
      let i = fn.index + fn[0].length;
      const start = i;
      while (depth && i < rest.length) {
        if (rest[i] === "(") depth++;
        else if (rest[i] === ")") depth--;
        i++;
      }
      const inner = rest.slice(start, i - 1);
      if (fn[1] !== "where") {
        const [x, y, z] = specificity(inner);
        a += x;
        b += y;
        c += z;
      }
      rest = rest.slice(0, fn.index) + rest.slice(i);
    }
    b += (rest.match(/\[[^\]]*\]/g) ?? []).length;
    rest = rest.replace(/\[[^\]]*\]/g, "");
    b += (rest.match(/[.:](?!:)[\w-]+/g) ?? []).length;
    a += (rest.match(/#[\w-]+/g) ?? []).length;
    rest = rest.replace(/[.#:][\w-]+/g, "");
    c += (rest.match(/(?:^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  };
  walk(selector);
  return [a, b, c];
}
const selectorsOf = (css) =>
  css
    .replace(/@media[^{]*\{/g, "")
    .split("}")
    .map((chunk) => chunk.split("{")[0].trim())
    .filter(Boolean)
    .flatMap((list) => list.split(",").map((s) => s.trim()));

test("the specificity helper itself is right", () => {
  assert.deepEqual(specificity(":root"), [0, 1, 0]);
  assert.deepEqual(specificity(':root[data-accent="x"]'), [0, 2, 0]);
  assert.deepEqual(
    specificity(':root:not([data-theme="light"]):not([data-theme="light"] *)'),
    [0, 3, 0],
  );
  assert.deepEqual(specificity(':root:where(:not([data-theme="light"]))'), [0, 1, 0]);
});

test("generated selectors never outweigh :root, so data-accent presets keep precedence in dark mode", () => {
  const css = toCss(createTheme({ brand: "#6d28d9" }));
  const preset = specificity(':root[data-accent="menta"]');
  const found = selectorsOf(css).filter((s) => s.includes("data-theme"));
  assert.ok(found.length >= 5, "dark selectors were found");
  for (const selector of selectorsOf(css)) {
    const [a, b, c] = specificity(selector);
    assert.ok(
      a === preset[0] && (b < preset[1] || (b === preset[1] && c <= preset[2])),
      `${selector} weighs (${a},${b},${c}), a data-accent preset must beat it`,
    );
  }
});

test("a forced scheme on a descendant is re-declared so it does not inherit the opposite scheme", () => {
  const theme = createTheme({ brand: "#6d28d9" });
  const css = toCss(theme, { selector: ".brand" });
  const bg = (scheme) => theme.color.tokens.find((t) => t.name === "bg").value[scheme];
  const block = (selector) =>
    new RegExp(`${selector.replace(/[.[\]()"]/g, "\\$&")} \\{\\n[^}]*--bg: ([^;]+);`).exec(css);
  assert.equal(block('.brand :where([data-theme="light"])')?.[1], bg("light"));
  assert.equal(block('.brand :where([data-theme="dark"])')?.[1], bg("dark"));
});

test("CONTRAST_PAIRS covers the pairs the kit renders on surface-2 and float", () => {
  const has = (fg, bg, kind) =>
    CONTRAST_PAIRS.some((p) => p.fg === fg && p.bg === bg && p.kind === kind);
  assert.ok(has("accent-ink", "surface-2", "text"));
  assert.ok(has("line-control", "surface-2", "ui"));
  assert.ok(has("line-control", "float", "ui"));
  assert.ok(has("accent-word", "float", "ui"));
});

test("the solver keeps a margin above the AA floor (4.55 text, 3.05 non-text) on 800 seeds", () => {
  const r = rng(424242);
  for (let i = 0; i < 800; i++) {
    const theme = createTheme({ brand: hex(r), neutral: r() < 0.5 ? hex(r) : undefined });
    const margin = auditTheme(
      theme,
      CONTRAST_PAIRS.map((p) => ({ ...p, min: p.kind === "text" ? 4.54 : 3.04 })),
    );
    assert.deepEqual(
      margin.map((v) => `${v.scheme} ${v.fg}/${v.bg} ${v.ratio.toFixed(3)}`),
      [],
      `brand/neutral seed ${i}`,
    );
  }
});

test("ui-theme generate with a bad hex prints a clean error and exits 1", () => {
  const out = mkdtempSync(join(tmpdir(), "ui-bad-"));
  const run = () =>
    spawnSync(
      process.execPath,
      [join(here, "../bin/ui-theme.mjs"), "generate", "--brand", "purple", "--out", out],
      { encoding: "utf8" },
    );
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ui-theme: .*hex color/m);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});
