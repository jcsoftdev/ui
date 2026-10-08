// Generates the docs content of the site from the @jcsoftdev/ui source:
//   src/generated/manifest.json   machine-readable description of every public component
//   src/generated/sidebar.json    Starlight sidebar groups, one per category
//   src/content/docs/docs/components/<slug>.md   one page per component
//   src/content/docs/docs/reference/exports.md   hooks, helpers and constants
//   src/content/docs/docs/theming/tokens.md      tokens table from tokens/default.json
// Usage: node scripts/build-docs.mjs   (runs automatically before `dev` and `build`)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzePackage } from "./lib/analyze.mjs";
import {
  categoryTitle,
  renderComponentPage,
  renderReferencePage,
  renderSubpathsPage,
  renderTokensPage,
} from "./lib/render.mjs";
import { parseStoriesFile, pickDefaultStory, usageSnippet } from "./lib/stories.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(here, "..");

function walk(dir, test, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}

const write = (file, text) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

/** Stories that document a component: same `meta.component`, else a stories file next to the declaration. */
export function storiesFor(component, storyFiles, srcDir) {
  const declDir = path.dirname(path.join(srcDir, component.declarationFile));
  const exact = storyFiles.filter((f) => f.component === component.name);
  const sibling = storyFiles.filter((f) => path.dirname(f.filePath) === declDir);
  return exact.length ? exact : sibling;
}

/**
 * @param {{ uiRoot: string, siteRoot?: string, storybookUrl?: string }} opts
 * @returns the manifest that was written
 */
export function generateDocs({ uiRoot, outRoot = siteRoot, storybookUrl = "/storybook" }) {
  const srcDir = path.join(uiRoot, "src");
  const pkg = JSON.parse(readFileSync(path.join(uiRoot, "package.json"), "utf8"));
  const analysis = analyzePackage({ srcDir, packageName: pkg.name });

  const storyFiles = walk(srcDir, (p) => p.endsWith(".stories.tsx"))
    .map((f) => parseStoriesFile(f))
    .filter(Boolean);

  const componentsDir = path.join(outRoot, "src/content/docs/docs/components");
  rmSync(componentsDir, { recursive: true, force: true });
  rmSync(path.join(outRoot, "src/generated"), { recursive: true, force: true });

  const used = new Set();
  const manifestComponents = [];
  for (const c of analysis.components) {
    let slug = c.slug;
    if (used.has(slug)) slug = `${c.category}-${slug}`;
    used.add(slug);
    c.slug = slug;

    const linked = storiesFor(c, storyFiles, srcDir);
    const primary = linked.find((f) => f.component === c.name) ?? linked[0];
    const story = primary ? pickDefaultStory(primary) : undefined;
    const usage = primary && story ? usageSnippet(c.name, primary, story) : null;
    const stories = linked.flatMap((f) => f.stories.map((s) => ({ id: s.id, name: s.name })));
    const example =
      primary && story
        ? {
            file: path.relative(srcDir, primary.filePath).split(path.sep).join("/"),
            story: story.exportName,
          }
        : null;

    write(
      path.join(componentsDir, `${slug}.md`),
      renderComponentPage(c, {
        storybookUrl,
        stories,
        usage,
        storySource: !usage && story ? story.source : null,
        example,
      }),
    );
    manifestComponents.push({
      name: c.name,
      slug,
      category: c.category,
      subpath: c.subpath,
      page: `/docs/components/${slug}`,
      importPath: c.importPath,
      singleEntries: c.singleEntries,
      summary: c.summary,
      declarationFile: c.declarationFile,
      props: c.props,
      inheritsNativeProps: c.inheritsNativeProps,
      a11y: c.a11y,
      stories,
      example,
    });
  }

  const manifest = {
    packageName: pkg.name,
    version: pkg.version,
    counts: {
      components: manifestComponents.length,
      entries: analysis.entries.filter((e) => e.depth === 1).length,
      stories: storyFiles.reduce((n, f) => n + f.stories.length, 0),
      hooksAndHelpers: analysis.others.length,
    },
    entries: analysis.entries,
    categories: [...new Set(manifestComponents.map((c) => c.category))].map((id) => ({
      id,
      title: categoryTitle(id),
      count: manifestComponents.filter((c) => c.category === id).length,
    })),
    components: manifestComponents,
    others: analysis.others,
  };
  write(
    path.join(outRoot, "src/generated/manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const sidebar = manifest.categories.map((cat) => ({
    label: cat.title,
    collapsed: true,
    items: manifestComponents
      .filter((c) => c.category === cat.id)
      .map((c) => ({ label: c.name, slug: `docs/components/${c.slug}` })),
  }));
  write(path.join(outRoot, "src/generated/sidebar.json"), `${JSON.stringify(sidebar, null, 2)}\n`);

  write(path.join(outRoot, "src/content/docs/docs/subpaths.md"), renderSubpathsPage(manifest));
  write(
    path.join(outRoot, "src/content/docs/docs/reference/exports.md"),
    renderReferencePage(analysis),
  );
  const tokensFile = path.join(uiRoot, "tokens/default.json");
  if (existsSync(tokensFile)) {
    write(
      path.join(outRoot, "src/content/docs/docs/theming/tokens.md"),
      renderTokensPage(JSON.parse(readFileSync(tokensFile, "utf8"))),
    );
  }
  return manifest;
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const uiRoot = path.resolve(siteRoot, "../packages/ui");
  const storybookUrl = process.env.PUBLIC_STORYBOOK_URL || "/storybook";
  const started = Date.now();
  const manifest = generateDocs({ uiRoot, storybookUrl });
  const pages = readdirSync(path.join(siteRoot, "src/content/docs/docs/components")).length;
  console.log(
    `docs: ${manifest.counts.components} components, ${pages} component pages, ${manifest.counts.stories} stories, ${manifest.categories.length} categories (${Date.now() - started} ms)`,
  );
}
