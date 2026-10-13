// Each element entry loads only itself eagerly: no other element, and no liquid code (the material
// is behind import() and only fetched for `material="liquid"`). Run after `pnpm build`.
import assert from "node:assert/strict";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { elementEntries } from "../scripts/entries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const elements = elementEntries();

async function graph(file) {
  const result = await build({
    entryPoints: [join(root, file)],
    absWorkingDir: root,
    bundle: true,
    splitting: true,
    format: "esm",
    write: false,
    metafile: true,
    outdir: join(root, ".treeshake"),
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  // Dynamic-import chunks also carry `entryPoint`; pick the chunk of the entry file itself.
  const entry = Object.keys(outputs).find(
    (name) => outputs[name].entryPoint === file.replace(/^\.\//, ""),
  );
  const eager = new Set();
  const visit = (name) => {
    if (eager.has(name)) return;
    eager.add(name);
    for (const dep of outputs[name].imports) if (dep.kind === "import-statement") visit(dep.path);
  };
  visit(entry);
  const inputs = new Set();
  for (const name of eager)
    for (const input of Object.keys(outputs[name].inputs))
      inputs.add(relative(root, resolve(root, input)));
  let lazy = 0;
  for (const name of eager)
    for (const dep of outputs[name].imports) if (dep.kind === "dynamic-import") lazy++;
  return { inputs: [...inputs], lazy };
}

const names = elements.map((element) => element.name);
for (const { name, dist, define, budget } of elements) {
  const module = await import(join(root, dist));
  assert.equal(typeof module[define], "function", `${name}: exports ${define}()`);
  assert.ok(budget !== undefined, `${name}: has src/${name}/size.json`);
  const { inputs, lazy } = await graph(dist);
  const liquid = inputs.filter((file) => /liquid/.test(file));
  assert.deepEqual(liquid, [], `${name}: no liquid module loads eagerly`);
  for (const other of names.filter((n) => n !== name && !name.startsWith(`${n}-`)))
    assert.ok(
      !inputs.some((file) => file.startsWith(`dist/${other}/`)),
      `${name}: does not pull ${other}`,
    );
  console.log(`${name.padEnd(12)} ${inputs.length} modules eager, ${lazy} lazy import(s)`);
}

// Static icons: `icon` plus `icons/<name>` is the whole eager graph. No registry, no other glyph.
{
  const result = await build({
    stdin: {
      contents:
        'import { defineIcon } from "./dist/icon/icon.js"; defineIcon(); import "./dist/icon/glyphs/x.js"; import "./dist/icon/glyphs/bell.js";',
      resolveDir: root,
    },
    absWorkingDir: root,
    bundle: true,
    splitting: true,
    format: "esm",
    write: false,
    metafile: true,
    outdir: join(root, ".treeshake"),
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find((name) => outputs[name].entryPoint === "<stdin>");
  const eager = new Set();
  const visit = (name) => {
    if (eager.has(name)) return;
    eager.add(name);
    for (const dep of outputs[name].imports) if (dep.kind === "import-statement") visit(dep.path);
  };
  visit(entry);
  const inputs = [...eager].flatMap((name) => Object.keys(outputs[name].inputs));
  assert.ok(
    inputs.some((file) => file.endsWith("icon/icon.js")),
    "icon is bundled",
  );
  assert.ok(
    inputs.some((file) => file.endsWith("icon/glyphs/x.js")),
    "static x is bundled",
  );
  assert.ok(
    !inputs.some((file) => file.endsWith("icon/registry.js")),
    "static icons do not load the registry",
  );
  assert.ok(
    !inputs.some((file) => /icon\/glyphs\/(?!x\.js|bell\.js)/.test(file)),
    "static icons pull no other glyph",
  );
  console.log("icons/x + icons/bell: no registry, no other glyph in the eager graph");
}
