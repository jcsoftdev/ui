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
const behaviours = readdirSync(join(dist, "..", "src"))
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
  .map((file) => file.slice(0, -3));
for (const name of behaviours) {
  const modules = await eagerModules(`export * from "./${name}.js";`);
  if (independent.has(name)) assert.deepEqual(modules, [name], `${name} pulls in only itself`);
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

// Geo (C7): every entry is usable alone. Topology data is JSON behind import(), never eager.
const geoExpected = {
  "geo-projection": ["geo-projection"],
  "geo-simplify": ["geo-simplify"],
  "geo-cluster": ["geo-cluster"],
  "geo-view": ["geo-view"],
  "geo-routes": ["geo-routes"],
  "geo-match": ["geo-match"],
  "geo-globe": ["geo-globe"],
  "geo-hex": ["geo-hex"],
  "geo-topology": ["geo-topology"],
  "geo-path": ["geo-path", "geo-topology"],
  "geo-maps": ["geo-maps"],
};
for (const [entry, expected] of Object.entries(geoExpected)) {
  const modules = await eagerModules(`export * from "./${entry}.js";`);
  assert.deepEqual(modules, expected, `${entry} eager modules`);
}
const geoLazy = await build({
  entryPoints: [join(dist, "geo-maps.js")],
  bundle: true,
  splitting: true,
  format: "esm",
  write: false,
  metafile: true,
  outdir: join(dist, ".treeshake"),
  logLevel: "silent",
});
const geoOutputs = Object.entries(geoLazy.metafile.outputs);
const geoEntry = geoOutputs.find(([, output]) => output.entryPoint?.endsWith("geo-maps.js"));
assert.ok(geoEntry, "geo-maps entry chunk");
assert.deepEqual(
  Object.keys(geoEntry[1].inputs).filter((input) => input.includes("geo-data")),
  [],
  "geo-maps: no topology in the entry chunk",
);
const geoChunks = geoOutputs.filter(
  ([name, output]) =>
    name !== geoEntry[0] && Object.keys(output.inputs).some((i) => i.includes("geo-data")),
);
assert.equal(geoChunks.length, 2, "world and peru are separate lazy chunks");
console.log(
  `geo: ${Object.keys(geoExpected).length} entries independent; ${geoChunks.length} lazy topology chunks`,
);
