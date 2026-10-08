// Markdown renderers for generated docs pages. Pure functions: manifest data in, strings out.
// The output is plain Markdown (no MDX) so the same body serves the HTML page and the `.md` variant.

export const CATEGORY_TITLES = {
  ai: "AI",
  atoms: "Atoms",
  brand: "Brand",
  calendar: "Calendar",
  charts: "Charts",
  containers: "Containers",
  dashboards: "Dashboards",
  forms: "Forms",
  navigation: "Navigation",
  overlays: "Overlays",
  palette: "Palette",
  "rich-text": "Rich text",
  shell: "Shell",
  states: "States",
  xlsx: "XLSX",
};

export const categoryTitle = (id) =>
  CATEGORY_TITLES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

export const yamlString = (s) => JSON.stringify(String(s));

export function frontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "object") {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 !== undefined && v2 !== null)
          lines.push(`  ${k2}: ${typeof v2 === "string" ? yamlString(v2) : v2}`);
      }
    } else lines.push(`${k}: ${typeof v === "string" ? yamlString(v) : v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

const cell = (s, max = 260) => {
  let t = String(s ?? "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  return t.replace(/\|/g, "\\|");
};
const code = (s, max) => (s ? `\`${cell(s, max).replace(/`/g, "'")}\`` : "");

export function firstSentence(text, max = 180) {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "";
  const m = flat.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (m ? m[0] : flat).trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

export function propsTable(props) {
  if (!props.length) return "";
  const rows = props.map(
    (p) =>
      `| ${code(p.name)}${p.required ? " *" : ""} | ${code(p.type, 220)} | ${p.default ? code(p.default, 60) : ""} | ${cell(p.description)}${p.deprecated ? " **Deprecated.**" : ""} |`,
  );
  return ["| Prop | Type | Default | Description |", "| --- | --- | --- | --- |", ...rows].join(
    "\n",
  );
}

/** Story URL in a (possibly relative) Storybook deployment. */
export const storyUrl = (base, id) => `${base.replace(/\/$/, "")}/?path=/story/${id}`;

/**
 * @param {object} c component from analyzePackage
 * @param {{ storybookUrl: string, stories: Array<{ id: string, name: string }>, usage: string | null, storySource: string | null, example: { file: string, story: string } | null }} ctx
 */
export function renderComponentPage(c, ctx) {
  const summary =
    c.summary ||
    `\`${c.name}\` is part of the ${categoryTitle(c.category)} set, imported from \`${c.importPath}\`.`;
  const description = firstSentence(summary) || `${c.name} component.`;
  const out = [];
  out.push(
    frontmatter({
      title: c.name,
      description,
      editUrl: false,
      category: c.category,
      componentSlug: c.slug,
      importPath: c.importPath,
      example: ctx.example ?? undefined,
    }),
  );
  out.push(summary, "");
  out.push("## Import", "", "```ts", `import { ${c.name} } from "${c.importPath}";`, "```", "");
  if (c.singleEntries.length) {
    out.push(
      `Single-component entry points tree-shake to just this component: ${c.singleEntries.map((e) => `\`${e}\``).join(", ")}.`,
      "",
    );
  }
  const usage = ctx.usage ?? ctx.storySource;
  if (usage) {
    out.push("## Usage", "", "```tsx", usage, "```", "");
    if (!ctx.usage) out.push("_Source of the Storybook story._", "");
  }
  out.push("## Props", "");
  if (c.props.length) {
    out.push(propsTable(c.props), "", "`*` marks a required prop.", "");
  } else {
    out.push("This component declares no props of its own.", "");
  }
  if (c.inheritsNativeProps) {
    out.push(
      "It also accepts the native props of the element or primitive it renders (for example `className`, `id`, `aria-*` and event handlers).",
      "",
    );
  }
  if (c.a11y.length) {
    out.push("## Accessibility", "", ...c.a11y.map((n) => `- ${n.replace(/\n+/g, " ")}`), "");
  }
  if (c.examples.length) {
    out.push("## Examples", "");
    for (const ex of c.examples) out.push("```tsx", ex, "```", "");
  }
  if (ctx.stories.length) {
    out.push("## Storybook stories", "");
    for (const s of ctx.stories) out.push(`- [${s.name}](${storyUrl(ctx.storybookUrl, s.id)})`);
    out.push("");
  }
  out.push("## Source", "", `\`packages/ui/src/${c.declarationFile}\``, "");
  return out.join("\n");
}

export function renderReferencePage(manifest) {
  const out = [
    frontmatter({
      title: "Exports reference",
      description:
        "Every public hook, function and constant of @jcsoftdev/ui that is not a React component.",
      editUrl: false,
    }),
    "Hooks, helpers and constants exported next to the components. React components have their own pages under Components.",
    "",
  ];
  const bySub = new Map();
  for (const o of manifest.others)
    (bySub.get(o.subpath) ?? bySub.set(o.subpath, []).get(o.subpath)).push(o);
  for (const [sub, list] of bySub) {
    out.push(
      `## ${manifest.packageName}/${sub}`,
      "",
      "| Export | Kind | Summary |",
      "| --- | --- | --- |",
    );
    for (const o of list)
      out.push(
        `| ${code(o.name)} | ${o.kind} | ${cell(firstSentence(o.summary) || code(o.signature, 120), 200)} |`,
      );
    out.push("");
  }
  return out.join("\n");
}

export function renderSubpathsTable(manifest) {
  const top = manifest.entries.filter((e) => e.depth === 1);
  const counts = {};
  for (const c of manifest.components) counts[c.subpath] = (counts[c.subpath] ?? 0) + 1;
  return [
    "| Import path | Components |",
    "| --- | --- |",
    ...top.map((e) => `| \`${e.importPath}\` | ${counts[e.subpath] ?? 0} |`),
  ].join("\n");
}

export function renderSubpathsPage(manifest) {
  const single = manifest.entries.filter((e) => e.depth === 2);
  const counts = {};
  for (const c of manifest.components) counts[c.subpath] = (counts[c.subpath] ?? 0) + 1;
  const top = manifest.entries.filter((e) => e.depth === 1);
  const pkg = manifest.packageName;
  return [
    frontmatter({
      title: "Tree-shaking and subpaths",
      description: `Every ${pkg} subpath and single-component entry point, and how to keep bundles small.`,
      editUrl: false,
      section: "Guides",
    }),
    `The package is unbundled ESM with \`"sideEffects": ["**/*.css"]\`: one output file per source file, so a bundler can reduce an import to the component you use and its own dependencies.`,
    "",
    "## Subpaths",
    "",
    "| Import path | Components |",
    "| --- | --- |",
    ...top.map((e) => `| \`${e.importPath}\` | ${counts[e.subpath] ?? 0} |`),
    "",
    `Also available: \`${pkg}/styles/*\` (CSS) and \`${pkg}/tokens/*\` (the tokens JSON).`,
    "",
    "## Single-component entries",
    "",
    `Inside a group, components that live in their own folder also have an entry point. ${single.length} are available, for example:`,
    "",
    "```ts",
    ...single.slice(0, 6).map((e) => `import {} from "${e.importPath}";`),
    "```",
    "",
    "## Rules of thumb",
    "",
    "- Prefer the group entry (`@jcsoftdev/ui/atoms`) in application code: it tree-shakes and reads well.",
    "- Use a single-component entry when you need the smallest possible import graph, for example in an island that ships to the browser.",
    "- Heavy features load lazily: the DataGrid chart panel and the XLSX writer are imported on demand.",
    "- Add `@source` for the package `dist` folder so Tailwind generates the classes the components use.",
    "- Compile the TypeScript yourself with the `source` export condition, which points at `src/*/index.ts`.",
    "",
  ].join("\n");
}

const lightDark = (v) => (typeof v === "object" ? `${code(v.light)} / ${code(v.dark)}` : code(v));

/** Tokens reference generated from tokens/default.json. */
export function renderTokensPage(tokens) {
  const out = [
    frontmatter({
      title: "Design tokens",
      description: "Every design token of the default theme, generated from tokens/default.json.",
      editUrl: false,
    }),
    `Generated from \`tokens/default.json\` ("${tokens.name}", schema v${tokens.version}). Usage notes are kept in the language of the token file (Spanish).`,
    "",
    "## Color",
    "",
    "| Token | CSS variable | Light / dark | Usage |",
    "| --- | --- | --- | --- |",
    ...tokens.color.tokens.map(
      (t) =>
        `| ${code(t.name)} | ${code(`--${t.name}`)} | ${lightDark(t.value)} | ${cell(t.usage, 200)} |`,
    ),
    "",
  ];
  const simple = (title, list, prefix = "--") => {
    out.push(
      `## ${title}`,
      "",
      "| Token | CSS variable | Value | Usage |",
      "| --- | --- | --- | --- |",
    );
    for (const t of list)
      out.push(
        `| ${code(t.name)} | ${code(`${prefix}${t.name}`)} | ${lightDark(t.value)} | ${cell(t.usage, 200)} |`,
      );
    out.push("");
  };
  simple("Spacing", tokens.spacing.tokens);
  simple("Radius", tokens.radius.tokens);
  simple("Shadow", tokens.shadow.tokens);
  simple("Size", tokens.size.tokens);
  out.push("## Typography", "");
  for (const g of tokens.type.groups) {
    out.push(
      `### ${g.name}`,
      "",
      "| Style | Size / line height | Weight | Usage |",
      "| --- | --- | --- | --- |",
    );
    for (const s of g.styles)
      out.push(
        `| ${code(s.name)} | ${code(`${s.fontSize} / ${s.lineHeight}`)} | ${s.fontWeight} | ${cell(s.usage, 200)} |`,
      );
    out.push("");
  }
  out.push(
    "## Style presets",
    "",
    "Selected with `data-style` on any element. Each preset remaps the style tokens below.",
    "",
  );
  out.push("| Preset | Attribute | Description |", "| --- | --- | --- |");
  for (const p of tokens.styles.presets)
    out.push(`| ${p.name} | ${code(`data-style="${p.id}"`)} | ${cell(p.usage, 240)} |`);
  out.push(
    "",
    "### Style tokens",
    "",
    "| Token | CSS variable | Default (soft) | Usage |",
    "| --- | --- | --- | --- |",
  );
  for (const t of tokens.styles.tokens)
    out.push(
      `| ${code(t.name)} | ${code(`--${t.name}`)} | ${lightDark(t.value)} | ${cell(t.usage, 200)} |`,
    );
  out.push(
    "",
    "### Density tokens",
    "",
    "| Token | CSS variable | Default | Usage |",
    "| --- | --- | --- | --- |",
  );
  for (const t of tokens.styles.density.tokens)
    out.push(
      `| ${code(t.name)} | ${code(`--${t.name}`)} | ${lightDark(t.value)} | ${cell(t.usage, 200)} |`,
    );
  out.push("", "Density levels (`data-density`):", "");
  for (const l of tokens.styles.density.levels ?? [])
    out.push(
      `- ${code(`data-density="${l.id}"`)}: ${cell(l.name ?? "")}${l.usage ? ` - ${cell(l.usage, 200)}` : ""}`,
    );
  out.push("", "Radius levels (`data-radius`):", "");
  for (const l of tokens.styles.radius.levels)
    out.push(`- ${code(`data-radius="${l.id}"`)}: ${cell(l.name)}`);
  out.push("");
  return out.join("\n");
}
