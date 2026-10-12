import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
    /@media \(prefers-color-scheme: dark\) \{\n {2}\.brand:not\(\[data-theme="light"\]\)/,
  );
  assert.match(auto, /\.brand\[data-theme="dark"\],\n\[data-theme="dark"\] \.brand \{/);
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
