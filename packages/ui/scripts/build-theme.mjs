// Token generator: tokens.json -> tokens.css, theme.css, fonts.css, Theme.kt.
// Pure functions, no dependencies. Used by bin/ui-theme.mjs and the tests.

const PALETTE_ROLES = {
  fill: "accent",
  deep: "on-accent",
  ink: "accent-ink",
  word: "accent-word",
  soft: "accent-soft",
  line: "accent-line",
  2: "accent-2",
};

const isThemed = (value) => value !== null && typeof value === "object";

const valueFor = (token, theme, base) => {
  if (!isThemed(token.value)) return token.value;
  return token.value[theme] ?? token.value[base];
};

const themeOf = (tokens) => {
  const themes = tokens.color?.themes?.map((t) => t.id) ?? ["light", "dark"];
  return { base: themes[0], others: themes.slice(1) };
};

const allTokens = (tokens) => [
  ...(tokens.color?.tokens ?? []),
  ...(tokens.shadow?.tokens ?? []),
  ...(tokens.radius?.tokens ?? []),
  ...(tokens.spacing?.tokens ?? []),
  ...(tokens.size?.tokens ?? []),
  ...(tokens.styles?.tokens ?? []),
  ...(tokens.styles?.density?.tokens ?? []),
];

const typeStyles = (tokens) =>
  (tokens.type?.groups ?? []).flatMap((g) =>
    g.styles.map((s) => ({ ...s, family: s.family ?? g.family ?? "sans" })),
  );

/** Palettes are derived from color tokens named pal-<id>-<role>. */
export function palettesOf(tokens) {
  const out = new Map();
  for (const t of tokens.color?.tokens ?? []) {
    const m = /^pal-(.+)-(fill|deep|ink|word|soft|line|2)$/.exec(t.name);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], {});
    out.get(m[1])[m[2]] = t.name;
  }
  return out;
}

const decls = (list) => list.map(([k, v]) => `  --${k}: ${v};`).join("\n");

// ---------------------------------------------------------------- Styles
//
// Three orthogonal attributes remap custom properties: data-style (preset), data-density and
// data-radius. Each block declares every property its group governs, because a custom property
// that references another one is resolved where it is declared: a nested [data-style] must
// re-declare the whole set instead of relying on :root's already-computed values.
//
// Precedence on one element follows source order at equal specificity (:root[x] on the root,
// [x] on a nested element): themes < accents < presets < density < radius. A preset's dark
// values use :root[data-theme] in front of the attribute, so they outrank the theme block.
// data-radius also wins over a preset declared on a descendant: radius blocks set
// --<token>-override, and presets read their radius through var(--<token>-override, <own>).

const attrSelector = (attr, id) => `:root[${attr}="${id}"],\n[${attr}="${id}"]`;

const indent = (text) =>
  text
    .split("\n")
    .map((l) => (l ? `  ${l}` : l))
    .join("\n");

function variantBlocks(attr, id, entries, { base, others }) {
  const flat = entries.map(([name, v]) => [
    name,
    isThemed(v) ? (v[base] ?? Object.values(v)[0]) : v,
  ]);
  const out = [`${attrSelector(attr, id)} {\n${decls(flat)}\n}`];
  for (const theme of others) {
    const themed = entries
      .filter(([, v]) => isThemed(v) && theme in v)
      .map(([n, v]) => [n, v[theme]]);
    if (!themed.length) continue;
    const at = (root) => `${root}[${attr}="${id}"],\n${root} [${attr}="${id}"]`;
    if (theme === "dark") {
      const sel = at(`:root:not([data-theme="${base}"])`);
      out.push(
        `@media (prefers-color-scheme: dark) {\n${indent(`${sel} {\n${decls(themed)}\n}`)}\n}`,
      );
    }
    out.push(`${at(`:root[data-theme="${theme}"]`)} {\n${decls(themed)}\n}`);
  }
  return out;
}

/** Resolved style groups; throws on inconsistent definitions. Empty when the theme has none. */
export function stylesOf(tokens) {
  const styles = tokens.styles;
  if (!styles) return null;
  const byName = new Map(allTokens(tokens).map((t) => [t.name, t]));
  const known = (name, where) => {
    if (!byName.has(name)) throw new Error(`styles: unknown token "${name}" in ${where}`);
    return name;
  };

  const density = styles.density ?? { levels: [] };
  const densityGoverned = new Set(
    density.levels.length ? ["density", ...(density.scaled ?? [])] : [],
  );
  for (const name of densityGoverned) {
    known(name, "density");
    if (isThemed(byName.get(name).value))
      throw new Error(`styles: density token "${name}" is themed`);
  }

  for (const level of density.levels) {
    for (const name of Object.keys(level.values ?? {})) {
      if (!densityGoverned.has(name) || name === "density")
        throw new Error(`styles: density level "${level.id}" sets "${name}", which is not scaled`);
    }
  }

  const radiusLevels = styles.radius?.levels ?? [];
  const radiusGoverned = new Set(radiusLevels.flatMap((l) => Object.keys(l.values ?? {})));
  for (const name of radiusGoverned) known(name, "radius levels");

  const presets = styles.presets ?? [];
  const def = presets.find((p) => p.id === styles.default);
  if (presets.length && !def) throw new Error(`styles: default preset "${styles.default}" missing`);
  if (def && Object.keys(def.values ?? {}).length)
    throw new Error("styles: the default preset is the base tokens and must not override values");

  const presetGoverned = new Set([
    ...(styles.tokens ?? []).map((t) => t.name),
    ...(tokens.radius?.tokens ?? []).map((t) => t.name),
    ...(tokens.shadow?.tokens ?? []).map((t) => t.name),
  ]);
  for (const p of presets) {
    for (const [name, v] of Object.entries(p.values ?? {})) {
      known(name, `preset "${p.id}"`);
      if (densityGoverned.has(name))
        throw new Error(`styles: preset "${p.id}" sets "${name}", which belongs to data-density`);
      if (radiusGoverned.has(name) && isThemed(v))
        throw new Error(`styles: preset "${p.id}" themes radius "${name}"`);
      presetGoverned.add(name);
    }
  }
  const order = [...byName.keys()];
  const sorted = (set) => order.filter((n) => set.has(n));
  return {
    byName,
    presets,
    density,
    radiusLevels,
    presetGoverned: sorted(presetGoverned),
    densityGoverned: sorted(densityGoverned),
    radiusGoverned: sorted(radiusGoverned),
  };
}

function buildStyleBlocks(tokens) {
  const s = stylesOf(tokens);
  if (!s) return [];
  const themes = themeOf(tokens);
  const blocks = [];
  const radius = new Set(s.radiusGoverned);

  for (const p of s.presets) {
    const entries = s.presetGoverned.map((name) => {
      const v = p.values?.[name] ?? s.byName.get(name).value;
      return [name, radius.has(name) ? `var(--${name}-override, ${v})` : v];
    });
    blocks.push(...variantBlocks("data-style", p.id, entries, themes));
  }

  for (const level of s.density.levels) {
    const entries = s.densityGoverned.map((name) => {
      if (name === "density") return [name, String(level.density)];
      return [name, level.values?.[name] ?? `calc(${s.byName.get(name).value} * var(--density))`];
    });
    blocks.push(...variantBlocks("data-density", level.id, entries, themes));
  }

  for (const level of s.radiusLevels) {
    const entries = s.radiusGoverned.flatMap((name) => {
      const v = level.values?.[name] ?? s.byName.get(name).value;
      return [
        [`${name}-override`, v],
        [name, v],
      ];
    });
    blocks.push(...variantBlocks("data-radius", level.id, entries, themes));
  }
  return blocks;
}

const cssRule = (selector, body, depth = 1) => {
  const pad = "  ".repeat(depth);
  const lines = Object.entries(body).map(([k, v]) =>
    typeof v === "object" ? cssRule(k, v, depth + 1) : `${pad}${k}: ${v};`,
  );
  return `${"  ".repeat(depth - 1)}${selector} {\n${lines.join("\n")}\n${"  ".repeat(depth - 1)}}`;
};

export function buildTokensCss(tokens) {
  const { base, others } = themeOf(tokens);
  const all = allTokens(tokens);
  const themedOnly = (theme) => all.filter((t) => isThemed(t.value) && theme in t.value);
  const blocks = [];

  const root = all.map((t) => [t.name, valueFor(t, base, base)]);
  for (const [k, v] of Object.entries(tokens.type?.families ?? {})) {
    root.push([`font-${k}`, v]);
  }
  blocks.push(`:root {\n  color-scheme: ${base};\n${decls(root)}\n}`);

  for (const theme of others) {
    const body = decls(themedOnly(theme).map((t) => [t.name, t.value[theme]]));
    const scheme = `  color-scheme: ${theme};\n`;
    if (theme === "dark") {
      blocks.push(
        `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="${base}"]) {\n${scheme
          .split("\n")
          .map((l) => (l ? `  ${l}` : l))
          .join("\n")}${body
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")}\n  }\n}`,
      );
    }
    blocks.push(`:root[data-theme="${theme}"] {\n${scheme}${body}\n}`);
  }

  for (const [id, roles] of palettesOf(tokens)) {
    const pairs = Object.entries(PALETTE_ROLES)
      .filter(([role]) => roles[role])
      .map(([role, target]) => [target, `var(--${roles[role]})`]);
    // A chart category color that looks like this accent yields to the reserve, so series 1
    // never repeats series 0 (which wears the accent).
    const swap = tokens.chartSwaps?.palettes?.[id];
    if (swap && tokens.chartSwaps.reserve)
      pairs.push([swap, `var(--${tokens.chartSwaps.reserve})`]);
    // :root keeps a palette above the light/dark blocks, which are also scoped to :root.
    blocks.push(`:root[data-accent="${id}"] {\n${decls(pairs)}\n}`);
  }

  blocks.push(...buildStyleBlocks(tokens));

  return `/* Generated by ui-theme from "${tokens.name}". Do not edit. */\n${blocks.join("\n\n")}\n`;
}

const stripPrefix = (name, prefix) =>
  name.startsWith(`${prefix}-`) ? name.slice(prefix.length + 1) : name;

export function buildThemeCss(tokens) {
  const lines = [];
  for (const t of tokens.color?.tokens ?? []) {
    lines.push(`  --color-${t.name}: var(--${t.name});`);
  }
  for (const t of tokens.radius?.tokens ?? []) {
    lines.push(`  --radius-${stripPrefix(t.name, "radius")}: var(--${t.name});`);
  }
  for (const t of tokens.shadow?.tokens ?? []) {
    lines.push(`  --shadow-${stripPrefix(t.name, "shadow")}: var(--${t.name});`);
  }
  for (const t of tokens.size?.tokens ?? []) {
    lines.push(`  --spacing-${t.name}: var(--${t.name});`);
  }
  for (const k of Object.keys(tokens.type?.families ?? {})) {
    lines.push(`  --font-${k}: var(--font-${k});`);
  }
  for (const s of typeStyles(tokens)) {
    lines.push(`  --text-${s.name}: ${s.fontSize};`);
    if (s.lineHeight !== undefined) {
      lines.push(`  --text-${s.name}--line-height: ${s.lineHeight};`);
    }
    if (s.fontWeight !== undefined) {
      lines.push(`  --text-${s.name}--font-weight: ${s.fontWeight};`);
    }
    if (s.letterSpacing !== undefined) {
      lines.push(`  --text-${s.name}--letter-spacing: ${s.letterSpacing};`);
    }
  }
  if ((tokens.type?.sizeScale ?? []).length > 0) {
    lines.push(
      "  /* Size-only scale (px x 10, no line-height or weight) for dense UI text that must not inherit a role's weight. */",
    );
  }
  for (const s of tokens.type?.sizeScale ?? []) {
    lines.push(`  --text-${s.name}: ${s.fontSize};`);
  }
  const styles = stylesOf(tokens);
  for (const [themeVar, name] of Object.entries(tokens.styles?.tailwind ?? {})) {
    if (!styles.byName.has(name)) throw new Error(`styles.tailwind: unknown token "${name}"`);
    lines.push(`  ${themeVar}: var(--${name});`);
  }
  const utilities = Object.entries(tokens.styles?.utilities ?? {}).map(([name, body]) =>
    cssRule(`@utility ${name}`, body),
  );
  const tail = utilities.length ? `\n${utilities.join("\n\n")}\n` : "";
  return `/* Generated by ui-theme from "${tokens.name}". Do not edit. */\n@theme inline {\n${lines.join("\n")}\n}\n${tail}`;
}

export function buildFontsCss(tokens) {
  const imports = (tokens.type?.fonts ?? [])
    .filter((f) => f.source === "google")
    .map((f) => `@import url("https://fonts.googleapis.com/css2?family=${f.spec}&display=swap");`);
  return `/* Generated by ui-theme. Optional: skip it when the app loads fonts itself (e.g. next/font). */\n${imports.join("\n")}\n`;
}

// ---------------------------------------------------------------- Kotlin

const camel = (name) =>
  name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^[0-9]/, "_$&");
const pascal = (name) => {
  const c = camel(name);
  return c[0].toUpperCase() + c.slice(1);
};

export function toKotlinColor(css) {
  const v = css.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    if (h.length === 6) return `Color(0xFF${h.toUpperCase()})`;
    return `Color(0x${(h.slice(6) + h.slice(0, 6)).toUpperCase()})`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgba) {
    const [r, g, b, a = "1"] = rgba[1].split(",").map((x) => x.trim());
    const hx = (n) => Math.round(Number(n)).toString(16).padStart(2, "0");
    const alpha = Math.round(Number(a) * 255)
      .toString(16)
      .padStart(2, "0");
    return `Color(0x${(alpha + hx(r) + hx(g) + hx(b)).toUpperCase()})`;
  }
  throw new Error(`Unsupported color for Kotlin: ${css}`);
}

const px = (value) => `${Number.parseFloat(value)}.dp`;

// ---------------------------------------------------------------- Glass

const GLASS_VARIANTS = ["regular", "clear"];

/**
 * Liquid Glass materials, derived from styles.tokens named glass-<variant>-<part>. Empty when the
 * theme declares none, so themes without glass generate exactly what they did before.
 */
export function glassOf(tokens) {
  const byName = new Map((tokens.styles?.tokens ?? []).map((t) => [t.name, t]));
  return GLASS_VARIANTS.filter((v) => byName.has(`glass-${v}-tint`)).map((id) => {
    const part = (name) => {
      const t = byName.get(`glass-${id}-${name}`);
      if (!t) throw new Error(`styles: glass variant "${id}" is missing "glass-${id}-${name}"`);
      return t;
    };
    return {
      id,
      tint: part("tint"),
      border: part("border"),
      edge: part("edge"),
      dim: part("dim"),
      blur: part("blur"),
      saturate: part("saturate"),
    };
  });
}

function glassKotlin(tokens, { library }) {
  const variants = glassOf(tokens);
  if (!variants.length) return [];
  const { base, others } = themeOf(tokens);
  const vis = library ? "public " : "";
  const out = [];
  if (library) out.push("@Immutable");
  out.push(
    `${vis}class GlassMaterial(`,
    `    ${vis}val tint: Color,`,
    `    ${vis}val border: Color,`,
    `    ${vis}val edge: Color,`,
    `    ${vis}val dim: Color,`,
    `    ${vis}val blur: ${library ? "Dp" : "androidx.compose.ui.unit.Dp"},`,
    `    ${vis}val saturate: Float,`,
    ")",
    "",
  );
  if (library) out.push("@Immutable");
  out.push(`${vis}object UiGlass {`);
  for (const theme of [base, ...others]) {
    for (const v of variants) {
      const c = (t) => toKotlinColor(valueFor(t, theme, base));
      const type = library ? ": GlassMaterial" : "";
      out.push(
        `    ${vis}val ${pascal(v.id)}${pascal(theme)}${type} = GlassMaterial(`,
        `        tint = ${c(v.tint)},`,
        `        border = ${c(v.border)},`,
        `        edge = ${c(v.edge)},`,
        `        dim = ${c(v.dim)},`,
        `        blur = ${px(valueFor(v.blur, theme, base))},`,
        `        saturate = ${Number.parseFloat(valueFor(v.saturate, theme, base))}f,`,
        "    )",
      );
    }
  }
  out.push("}", "");
  return out;
}

export function buildThemeKt(tokens, pkg = "com.jcsoftdev.ui.theme", { library = false } = {}) {
  if (library) return buildLibraryThemeKt(tokens, pkg);
  const { base, others } = themeOf(tokens);
  const themes = [base, ...others];
  const colors = (tokens.color?.tokens ?? []).filter((t) => !t.name.startsWith("pal-"));
  const out = [
    `// Generated by ui-theme from "${tokens.name}". Do not edit.`,
    `package ${pkg}`,
    "",
    "import androidx.compose.foundation.shape.RoundedCornerShape",
    "import androidx.compose.ui.graphics.Color",
    "import androidx.compose.ui.text.TextStyle",
    "import androidx.compose.ui.text.font.FontWeight",
    "import androidx.compose.ui.unit.dp",
    "import androidx.compose.ui.unit.em",
    "import androidx.compose.ui.unit.sp",
    "",
    "class ThemeColors(",
    ...colors.map((t) => `    val ${camel(t.name)}: Color,`),
    ")",
    "",
    "object UiColors {",
  ];
  for (const theme of themes) {
    out.push(`    val ${pascal(theme)} = ThemeColors(`);
    for (const t of colors) {
      out.push(`        ${camel(t.name)} = ${toKotlinColor(valueFor(t, theme, base))},`);
    }
    out.push("    )");
  }
  out.push("}", "");

  const palettes = palettesOf(tokens);
  if (palettes.size) {
    out.push("class AccentPalette(");
    for (const target of Object.values(PALETTE_ROLES)) {
      out.push(`    val ${camel(target)}: Color,`);
    }
    out.push(")", "", "object UiPalettes {");
    for (const theme of themes) {
      out.push(`    val ${pascal(theme)}: Map<String, AccentPalette> = mapOf(`);
      for (const [id, roles] of palettes) {
        const byName = new Map(tokens.color.tokens.map((t) => [t.name, t]));
        const args = Object.entries(PALETTE_ROLES).map(([role]) => {
          const tok = byName.get(roles[role]);
          return tok ? toKotlinColor(valueFor(tok, theme, base)) : "Color.Unspecified";
        });
        out.push(`        "${id}" to AccentPalette(${args.join(", ")}),`);
      }
      out.push("    )");
    }
    out.push("}", "");
  }

  out.push("object UiShapes {");
  for (const t of tokens.radius?.tokens ?? []) {
    const n = camel(stripPrefix(t.name, "radius"));
    const pill = Number.parseFloat(t.value) >= 999;
    out.push(`    val ${n} = RoundedCornerShape(${pill ? "50" : px(t.value)})`);
  }
  out.push("}", "", "object UiSizes {");
  for (const t of [...(tokens.spacing?.tokens ?? []), ...(tokens.size?.tokens ?? [])]) {
    out.push(`    val ${camel(t.name)} = ${px(t.value)}`);
  }
  out.push("}", "");

  const family = (tokens.type?.fonts ?? [])[0]?.family ?? "";
  out.push(`const val UiFontFamilyName = "${family}"`, "", "object UiTypography {");
  for (const s of typeStyles(tokens)) {
    const size = Number.parseFloat(s.fontSize);
    const parts = [`fontSize = ${size}.sp`];
    if (s.fontWeight !== undefined) parts.push(`fontWeight = FontWeight(${s.fontWeight})`);
    if (s.lineHeight !== undefined) {
      const lh = String(s.lineHeight).endsWith("px")
        ? Number.parseFloat(s.lineHeight)
        : Number((size * Number(s.lineHeight)).toFixed(2));
      parts.push(`lineHeight = ${lh}.sp`);
    }
    if (s.letterSpacing) parts.push(`letterSpacing = (${Number.parseFloat(s.letterSpacing)}).em`);
    out.push(`    val ${camel(s.name)} = TextStyle(${parts.join(", ")})`);
  }
  out.push("}", "");
  const sizeScale = tokens.type?.sizeScale ?? [];
  if (sizeScale.length > 0) {
    out.push("object UiFontSizes {");
    for (const s of sizeScale)
      out.push(`    val ${camel(s.name)} = ${Number.parseFloat(s.fontSize)}.sp`);
    out.push("}", "");
  }
  out.push(...glassKotlin(tokens, { library: false }));
  return out.join("\n");
}

/**
 * Library flavour of Theme.kt: explicit `public` + types (the kit compiles with explicitApi),
 * @Immutable token holders, and no Map in the API (Compose treats Map as unstable), so accent
 * palettes are resolved with a `when` lookup.
 */
function buildLibraryThemeKt(tokens, pkg) {
  const { base, others } = themeOf(tokens);
  const themes = [base, ...others];
  const colors = (tokens.color?.tokens ?? []).filter((t) => !t.name.startsWith("pal-"));
  const out = [
    `// Generated by ui-theme from "${tokens.name}". Do not edit.`,
    "",
    `package ${pkg}`,
    "",
    "import androidx.compose.foundation.shape.RoundedCornerShape",
    "import androidx.compose.runtime.Immutable",
    "import androidx.compose.ui.graphics.Color",
    "import androidx.compose.ui.text.TextStyle",
    "import androidx.compose.ui.text.font.FontWeight",
    "import androidx.compose.ui.unit.Dp",
    "import androidx.compose.ui.unit.TextUnit",
    "import androidx.compose.ui.unit.dp",
    "import androidx.compose.ui.unit.em",
    "import androidx.compose.ui.unit.sp",
    "",
    "@Immutable",
    "public class ThemeColors(",
    ...colors.map((t) => `    public val ${camel(t.name)}: Color,`),
    ")",
    "",
    "public object UiColors {",
  ];
  for (const theme of themes) {
    out.push(`    public val ${pascal(theme)}: ThemeColors = ThemeColors(`);
    for (const t of colors) {
      out.push(`        ${camel(t.name)} = ${toKotlinColor(valueFor(t, theme, base))},`);
    }
    out.push("    )");
  }
  out.push("}", "");

  const palettes = palettesOf(tokens);
  if (palettes.size) {
    const byName = new Map(tokens.color.tokens.map((t) => [t.name, t]));
    out.push("@Immutable", "public class AccentPalette(");
    for (const target of Object.values(PALETTE_ROLES)) {
      out.push(`    public val ${camel(target)}: Color,`);
    }
    out.push(")", "", "@Immutable", "public object UiPalettes {");
    out.push(
      `    public val ids: List<String> = listOf(${[...palettes.keys()].map((id) => `"${id}"`).join(", ")})`,
    );
    for (const theme of themes) {
      out.push("");
      for (const [id, roles] of palettes) {
        const args = Object.keys(PALETTE_ROLES).map((role) => {
          const tok = byName.get(roles[role]);
          return tok ? toKotlinColor(valueFor(tok, theme, base)) : "Color.Unspecified";
        });
        out.push(`    private val ${camel(`${theme}-${id}`)} = AccentPalette(${args.join(", ")})`);
      }
      out.push(
        "",
        `    public fun ${camel(theme)}(id: String): AccentPalette? =`,
        "        when (id) {",
      );
      for (const id of palettes.keys()) {
        out.push(`            "${id}" -> ${camel(`${theme}-${id}`)}`);
      }
      out.push("            else -> null", "        }");
    }
    out.push("}", "");
  }

  out.push("public object UiShapes {");
  for (const t of tokens.radius?.tokens ?? []) {
    const n = camel(stripPrefix(t.name, "radius"));
    const pill = Number.parseFloat(t.value) >= 999;
    out.push(
      `    public val ${n}: RoundedCornerShape = RoundedCornerShape(${pill ? "50" : px(t.value)})`,
    );
  }
  out.push("}", "", "public object UiSizes {");
  for (const t of [...(tokens.spacing?.tokens ?? []), ...(tokens.size?.tokens ?? [])]) {
    out.push(`    public val ${camel(t.name)}: Dp = ${px(t.value)}`);
  }
  out.push("}", "");

  const family = (tokens.type?.fonts ?? [])[0]?.family ?? "";
  out.push(
    `public const val UiFontFamilyName: String = "${family}"`,
    "",
    "public object UiTypography {",
  );
  for (const s of typeStyles(tokens)) {
    const size = Number.parseFloat(s.fontSize);
    const parts = [`fontSize = ${size}.sp`];
    if (s.fontWeight !== undefined) parts.push(`fontWeight = FontWeight(${s.fontWeight})`);
    if (s.lineHeight !== undefined) {
      const lh = String(s.lineHeight).endsWith("px")
        ? Number.parseFloat(s.lineHeight)
        : Number((size * Number(s.lineHeight)).toFixed(2));
      parts.push(`lineHeight = ${lh}.sp`);
    }
    if (s.letterSpacing) parts.push(`letterSpacing = (${Number.parseFloat(s.letterSpacing)}).em`);
    out.push(`    public val ${camel(s.name)}: TextStyle = TextStyle(${parts.join(", ")})`);
  }
  out.push("}", "");
  const sizeScale = tokens.type?.sizeScale ?? [];
  if (sizeScale.length > 0) {
    out.push("public object UiFontSizes {");
    for (const s of sizeScale)
      out.push(`    public val ${camel(s.name)}: TextUnit = ${Number.parseFloat(s.fontSize)}.sp`);
    out.push("}", "");
  }
  out.push(...glassKotlin(tokens, { library: true }));
  return out.join("\n");
}

export function buildTheme(tokens, { kotlinPackage, kotlinLibrary = false } = {}) {
  return {
    "tokens.css": buildTokensCss(tokens),
    "theme.css": buildThemeCss(tokens),
    "fonts.css": buildFontsCss(tokens),
    "Theme.kt": buildThemeKt(tokens, kotlinPackage, { library: kotlinLibrary }),
  };
}
