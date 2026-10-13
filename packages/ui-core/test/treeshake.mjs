// Bundles tiny consumers of each built entry and asserts what they pull in. Run after `pnpm build`.
// Behaviour entries must stay independent; the liquid tiers must load only their own modules eagerly
// (the rest stays behind dynamic import()).
import assert from "node:assert/strict";
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
  const entry = Object.keys(outputs).find((name) => outputs[name].entryPoint);
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

const behaviours = ["focus", "roving", "popper", "dismiss", "typeahead", "state"];
for (const name of behaviours) {
  const modules = await eagerModules(`export * from "./${name}.js";`);
  assert.deepEqual(modules, [name], `${name} pulls in only itself`);
}
console.log(`behaviours: ${behaviours.length} entries independent`);
