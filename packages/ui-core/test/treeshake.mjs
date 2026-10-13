// Bundles tiny consumers of each built entry and asserts what they pull in. Run after `pnpm build`.
// Behaviour entries must stay independent; the liquid tiers must load only their own modules eagerly
// (the rest stays behind dynamic import()).
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

/** Source modules (relative to dist, without extension) a consumer of `code` loads eagerly. */
export async function eagerModules(code, resolveDir = dist) {
  const result = await build({
    stdin: { contents: code, resolveDir, loader: "js" },
    bundle: true,
    splitting: true,
    format: "esm",
    write: false,
    metafile: true,
    outdir: join(dist, ".treeshake"),
    logLevel: "silent",
  });
  const outputs = result.metafile.outputs;
  // Dynamic-import chunks also carry `entryPoint`; the consumer is the stdin one.
  const entry = Object.keys(outputs).find((name) => outputs[name].entryPoint === "<stdin>");
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
      if (!input.startsWith("<stdin>"))
        inputs.add(relative(dist, resolve(input)).replace(/\.js$/, ""));
  return [...inputs].sort();
}

// Behaviours are the top-level modules (src/<name>.ts), discovered so a new one needs no edit here.
// The phase-1 set is fully independent; any behaviour may build on other behaviours, never on the
// liquid engine.
const independent = new Set(["focus", "roving", "popper", "dismiss", "typeahead", "state"]);
// Chart entries may build on each other only as listed; everything else stays separate.
const chartDeps = {
  "chart/color-scale": ["chart/palette"],
  "chart/category-axis": ["chart/axis", "chart/scale"],
  "chart/category-axis-time": [
    "chart/axis",
    "chart/category-axis",
    "chart/scale",
    "chart/scale-time",
  ],
};
const behaviours = [
  ...readdirSync(join(dist, "..", "src"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
    .map((file) => file.slice(0, -3)),
  ...readdirSync(join(dist, "..", "src", "chart"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
    .map((file) => `chart/${file.slice(0, -3)}`),
];
for (const name of behaviours) {
  const modules = await eagerModules(`export * from "./${name}.js";`);
  if (independent.has(name)) assert.deepEqual(modules, [name], `${name} pulls in only itself`);
  if (name.startsWith("chart/"))
    assert.deepEqual(
      modules.filter((module) => module !== name && !module.startsWith("internal/")),
      chartDeps[name] ?? [],
      `${name}: eager modules besides itself and internal/*`,
    );
  assert.ok(modules.includes(name), `${name} is built`);
  assert.deepEqual(
    modules.filter((module) => module.startsWith("liquid/")),
    [],
    `${name}: no liquid module`,
  );
}
console.log(`behaviours: ${behaviours.length} entries checked`);

// Liquid tiers: an entry pulls only its own tier eagerly; the rest is behind import().
const tiers = {
  "liquid/attach": ["liquid/attach", "liquid/options", "liquid/support"],
  "liquid/lens": [
    "liquid/lens",
    "liquid/lens-map",
    "liquid/options",
    "liquid/raster",
    "liquid/support",
  ],
  "liquid/specular": ["liquid/lens-map", "liquid/raster", "liquid/specular"],
  "liquid/dispersion": ["liquid/dispersion"],
  "liquid/crystal": ["liquid/crystal", "liquid/lens-map", "liquid/raster"],
  "liquid/motion": ["liquid/motion", "liquid/options", "liquid/spring"],
  "liquid/presets/crystal": ["liquid/presets/crystal"],
  "liquid/options": ["liquid/options"],
};
for (const [entry, expected] of Object.entries(tiers)) {
  const modules = await eagerModules(`export * from "./${entry}.js";`);
  assert.deepEqual(modules, expected, `${entry} eager modules`);
}
// What attachLiquid can fetch lazily, and nothing more.
const lazy = await build({
  entryPoints: [join(dist, "liquid/attach.js")],
  bundle: true,
  splitting: true,
  format: "esm",
  write: false,
  metafile: true,
  outdir: join(dist, ".treeshake"),
  logLevel: "silent",
});
const dynamic = new Set();
for (const output of Object.values(lazy.metafile.outputs))
  for (const dep of output.imports) if (dep.kind === "dynamic-import") dynamic.add(dep.path);
assert.equal(dynamic.size, 5, "attachLiquid: lens + 4 features are separate lazy chunks");
console.log(
  `liquid: ${Object.keys(tiers).length} tier entries pull only their own modules; ${dynamic.size} lazy chunks`,
);
