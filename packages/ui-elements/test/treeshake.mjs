// Each element entry loads only itself eagerly: no other element, and no liquid code (the material
// is behind import() and only fetched for `material="liquid"`). Run after `pnpm build`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const elements = Object.keys(pkg.exports).filter(
  (key) => key !== "." && !key.includes("*") && !key.endsWith(".json"),
);

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

const names = elements.map((key) => key.slice(2));
for (const key of elements) {
  const name = key.slice(2);
  const { inputs, lazy } = await graph(pkg.exports[key].import);
  const liquid = inputs.filter((file) => /liquid/.test(file));
  assert.deepEqual(liquid, [], `${name}: no liquid module loads eagerly`);
  for (const other of names.filter((n) => n !== name && !name.startsWith(`${n}-`)))
    assert.ok(
      !inputs.some((file) => file.includes(`/dist/${other}/`)),
      `${name}: does not pull ${other}`,
    );
  console.log(`${name.padEnd(12)} ${inputs.length} modules eager, ${lazy} lazy import(s)`);
}
