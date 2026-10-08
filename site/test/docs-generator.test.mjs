import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { generateDocs } from "../scripts/build-docs.mjs";
import { analyzePackage, discoverEntries } from "../scripts/lib/analyze.mjs";
import {
  buildLlmsFull,
  buildLlmsTxt,
  pageMarkdown,
  validateLlmsTxt,
} from "../scripts/lib/llms.mjs";
import { renderComponentPage } from "../scripts/lib/render.mjs";
import {
  parseStoriesFile,
  storyNameFromExport,
  toStoryId,
  usageSnippet,
} from "../scripts/lib/stories.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(here, "fixtures/ui");
const fixtureSrc = path.join(fixtureRoot, "src");
const realUi = path.resolve(here, "../../packages/ui");

const analysis = analyzePackage({ srcDir: fixtureSrc, packageName: "@fixture/ui" });
const byName = (n) => analysis.components.find((c) => c.name === n);

describe("entry discovery", () => {
  it("finds package subpaths and single-component entries", () => {
    const entries = discoverEntries(fixtureSrc);
    assert.deepEqual(entries.map((e) => `${e.depth}:${e.subpath}`).sort(), [
      "1:ai",
      "1:atoms",
      "1:charts",
      "2:atoms/button",
      "2:charts/spark",
    ]);
  });
});

describe("export resolution", () => {
  it("follows `export *` chains and re-exports into the right subpath", () => {
    assert.equal(byName("Button").importPath, "@fixture/ui/atoms");
    assert.equal(byName("Spark").importPath, "@fixture/ui/charts");
    assert.equal(byName("Chat").importPath, "@fixture/ui/ai");
  });

  it("reports single-component entries that export the component", () => {
    assert.deepEqual(byName("Button").singleEntries, ["@fixture/ui/atoms/button"]);
    assert.deepEqual(byName("Spark").singleEntries, ["@fixture/ui/charts/spark"]);
    assert.deepEqual(byName("Chat").singleEntries, []);
  });

  it("keeps components and non-components apart", () => {
    assert.deepEqual(analysis.components.map((c) => c.name).sort(), ["Button", "Chat", "Spark"]);
    const hook = analysis.others.find((o) => o.name === "useThing");
    assert.equal(hook.kind, "hook");
    assert.equal(hook.importPath, "@fixture/ui/charts");
    assert.equal(analysis.others.find((o) => o.name === "CHART_LIMIT").kind, "constant");
  });

  it("does not list type-only exports as values", () => {
    assert.ok(!analysis.others.some((o) => o.name === "ButtonProps"));
    assert.ok(analysis.typeCount >= 3);
  });
});

describe("props extraction", () => {
  const props = Object.fromEntries(byName("Button").props.map((p) => [p.name, p]));

  it("lists own props only and flags inherited native props", () => {
    assert.deepEqual(Object.keys(props).sort(), ["label", "loading", "variant"]);
    assert.equal(byName("Button").inheritsNativeProps, true);
    assert.equal(byName("Chat").inheritsNativeProps, false);
  });

  it("extracts type, requiredness and JSDoc", () => {
    assert.equal(props.label.required, true);
    assert.equal(props.variant.required, false);
    assert.equal(props.variant.type, '"primary" | "secondary" | "danger"');
    assert.equal(props.label.description, "Text shown inside the button.");
    assert.equal(props.loading.type, "boolean");
  });

  it("reads defaults from destructuring and from @default", () => {
    assert.equal(props.variant.default, '"secondary"');
    assert.equal(props.loading.default, "false");
    assert.equal(props.label.default, null);
  });

  it("reads defaults through forwardRef", () => {
    const width = byName("Spark").props.find((p) => p.name === "width");
    assert.equal(width.default, "2");
    assert.equal(
      byName("Spark").props.find((p) => p.name === "data").type,
      "readonly (number | null)[]",
    );
  });

  it("collects the summary and accessibility notes", () => {
    assert.match(byName("Button").summary, /^A pressable action\./);
    assert.ok(byName("Button").a11y.some((n) => n.startsWith("Keyboard: Enter and Space")));
    assert.ok(byName("Button").a11y.includes("Tab moves focus to the button."));
  });
});

describe("stories", () => {
  const stories = parseStoriesFile(path.join(fixtureSrc, "atoms/button/button.stories.tsx"));

  it("computes Storybook ids", () => {
    assert.equal(storyNameFromExport("WithIcon"), "With Icon");
    assert.equal(toStoryId("Atoms/Button", "Default"), "atoms-button--default");
    assert.equal(
      toStoryId("Charts/LineChart", "Downsampled100K"),
      "charts-linechart--downsampled-100-k",
    );
    assert.deepEqual(
      stories.stories.map((s) => s.id),
      [
        "atoms-button--default",
        "atoms-button--loading",
        "atoms-button--downsampled-100-k",
        "atoms-button--with-icon",
      ],
    );
  });

  it("keeps the explicit story name for display only", () => {
    assert.equal(stories.stories[2].name, "Large series");
    assert.equal(stories.component, "Button");
  });

  it("synthesizes a usage snippet from args", () => {
    const loading = stories.stories[1];
    assert.equal(
      usageSnippet("Button", stories, loading),
      '<Button\n  label="Reservar corte"\n  variant="primary"\n  loading\n  aria-label="Guardando"\n/>',
    );
  });
});

describe("generated pages", () => {
  const out = mkdtempSync(path.join(tmpdir(), "ui-site-docs-"));
  const manifest = generateDocs({
    uiRoot: fixtureRoot,
    outRoot: out,
    storybookUrl: "https://sb.example",
  });

  it("writes a page per component with Storybook links and a live example reference", () => {
    const md = readFileSync(path.join(out, "src/content/docs/docs/components/button.md"), "utf8");
    assert.match(md, /^---\ntitle: "Button"/);
    assert.match(md, /import \{ Button \} from "@fixture\/ui\/atoms";/);
    assert.match(md, /\| `label` \* \| `string` \|/);
    assert.match(md, /\[Default\]\(https:\/\/sb\.example\/\?path=\/story\/atoms-button--default\)/);
    assert.match(
      md,
      /example:\n {2}file: "atoms\/button\/button\.stories\.tsx"\n {2}story: "Default"/,
    );
    assert.equal(manifest.components.find((c) => c.name === "Button").stories.length, 4);
  });

  it("escapes pipes in the props table", () => {
    const md = renderComponentPage(
      { ...byName("Button"), singleEntries: [] },
      { storybookUrl: "/storybook", stories: [], usage: null, storySource: null, example: null },
    );
    assert.match(md, /`"primary" \\\| "secondary" \\\| "danger"`/);
  });
});

describe("llms.txt", () => {
  const pages = [
    {
      path: "/docs/getting-started",
      title: "Getting started",
      description: "Install and import.",
      section: "Guides",
      body: "## Install\n\nRun it.",
    },
    {
      path: "/docs/components/button",
      title: "Button",
      description: "A pressable action.",
      section: "Atoms",
      body: "## Props\n\n| a | b |",
    },
  ];
  const input = {
    name: "@jcsoftdev/ui",
    summary: "Token-driven React components.",
    baseUrl: "https://ui.example",
    pages,
    sectionOrder: ["Guides", "Atoms"],
  };

  it("follows the llmstxt.org layout and links to .md pages", () => {
    const txt = buildLlmsTxt({
      ...input,
      optional: [{ title: "Storybook", url: "https://ui.example/storybook/" }],
    });
    assert.deepEqual(validateLlmsTxt(txt), []);
    assert.match(txt, /^# @jcsoftdev\/ui\n\n> Token-driven React components\.\n/);
    assert.match(
      txt,
      /- \[Button\]\(https:\/\/ui\.example\/docs\/components\/button\.md\): A pressable action\./,
    );
    assert.ok(
      txt.indexOf("## Guides") < txt.indexOf("## Atoms") &&
        txt.indexOf("## Atoms") < txt.indexOf("## Optional"),
    );
  });

  it("rejects malformed files", () => {
    assert.ok(validateLlmsTxt("no heading\n").length > 0);
    assert.ok(
      validateLlmsTxt("# T\n\nno quote\n\n## S\n\n- [a](b)\n").some((e) => /blockquote/.test(e)),
    );
    assert.ok(
      validateLlmsTxt("# T\n\n> s\n\n## S\n\nfree text\n").some((e) => /invalid list item/.test(e)),
    );
  });

  it("concatenates every page into llms-full.txt", () => {
    const full = buildLlmsFull(input);
    for (const p of pages)
      assert.ok(full.includes(pageMarkdown(p, { baseUrl: input.baseUrl }).trim()));
  });

  it("renders a standalone page", () => {
    const md = pageMarkdown(pages[1], { baseUrl: "https://ui.example" });
    assert.match(
      md,
      /^# Button\n\n> A pressable action\.\n\nSource: https:\/\/ui\.example\/docs\/components\/button\n\n## Props/,
    );
  });
});

describe("real @jcsoftdev/ui", { timeout: 120_000 }, () => {
  const out = mkdtempSync(path.join(tmpdir(), "ui-site-real-"));
  const manifest = generateDocs({ uiRoot: realUi, outRoot: out });
  const dir = path.join(out, "src/content/docs/docs/components");

  it("documents every public component exactly once", () => {
    assert.ok(manifest.components.length > 200);
    const slugs = manifest.components.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.deepEqual(readdirSync(dir).sort(), slugs.map((s) => `${s}.md`).sort());
  });

  it("gives every component a page that renders to Markdown", () => {
    for (const c of manifest.components) {
      const file = path.join(dir, `${c.slug}.md`);
      assert.ok(existsSync(file), c.name);
      const body = readFileSync(file, "utf8").replace(/^---[\s\S]*?\n---\n/, "");
      const md = pageMarkdown({ path: c.page, title: c.name, description: "", body });
      assert.match(md, new RegExp(`^# ${c.name}\\n`));
      assert.ok(
        body.includes(`import { ${c.name} } from "${c.importPath}"`),
        `${c.name} import line`,
      );
    }
  });

  it("covers the subpath entries and the brand set", () => {
    const subpaths = manifest.entries.filter((e) => e.depth === 1).map((e) => e.subpath);
    for (const s of ["atoms", "charts", "containers", "ai", "rich-text", "brand"])
      assert.ok(subpaths.includes(s), s);
    assert.ok(
      manifest.components.some(
        (c) => c.name === "DataGrid" && c.importPath === "@jcsoftdev/ui/containers",
      ),
    );
    assert.ok(
      manifest.components.some(
        (c) => c.name === "LogoForge" && c.importPath === "@jcsoftdev/ui/brand",
      ),
    );
  });

  it("emits a valid llms.txt over the real pages", () => {
    const pages = manifest.components.map((c) => ({
      path: c.page,
      title: c.name,
      description: c.summary,
      section: c.category,
      body: "",
    }));
    const txt = buildLlmsTxt({
      name: "@jcsoftdev/ui",
      summary: "Components.",
      pages,
      sectionOrder: [],
    });
    assert.deepEqual(validateLlmsTxt(txt), []);
    assert.equal((txt.match(/\.md\)/g) ?? []).length, manifest.components.length);
  });
});
