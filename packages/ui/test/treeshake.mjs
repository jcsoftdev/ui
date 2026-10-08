// Bundles a tiny consumer that imports one component and asserts nothing else is pulled in.
// Run after `pnpm build`: node test/treeshake.mjs
import assert from "node:assert/strict";
import { build } from "esbuild";

async function inputsFor(code) {
  const result = await build({
    stdin: { contents: code, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    metafile: true,
    external: ["react", "react-dom", "react/jsx-runtime"],
  });
  const files = Object.keys(result.metafile.inputs);
  const bytes = result.outputFiles[0].contents.length;
  return { files, bytes };
}

const single = await inputsFor(
  `import { Button } from "@jcsoftdev/ui/atoms/button"; console.log(Button);`,
);
console.log(`atoms/button: ${single.bytes} bytes, ${single.files.length} modules`);
for (const f of single.files) console.log(`  ${f}`);
for (const banned of [
  "dialog",
  "dropdown-menu",
  "popover",
  "cmdk",
  "sonner",
  "lucide",
  "checkbox",
]) {
  assert.ok(
    !single.files.some((f) => f.includes(banned)),
    `single-component bundle must not include "${banned}"`,
  );
}

const group = await inputsFor(`import { Chip } from "@jcsoftdev/ui/atoms"; console.log(Chip);`);
console.log(
  `atoms (group entry, only Chip used): ${group.bytes} bytes, ${group.files.length} modules`,
);
assert.ok(!group.files.some((f) => f.includes("react-dialog")), "group entry must tree-shake");
console.log("tree-shaking OK");

// Maps: each data set is its own module, and a chart pulls in neither dataset nor its sibling chart.
const world = await inputsFor(
  `import { worldMap } from "@jcsoftdev/ui/charts/maps/data/world"; console.log(worldMap);`,
);
assert.ok(
  world.files.some((f) => f.includes("data/world")),
  "world data is included",
);
assert.ok(!world.files.some((f) => f.includes("data/peru")), "world map must not include Peru");
const peru = await inputsFor(
  `import { peruMap } from "@jcsoftdev/ui/charts/maps/data/peru"; console.log(peruMap);`,
);
assert.ok(!peru.files.some((f) => f.includes("data/world")), "Peru map must not include the world");
const choropleth = await inputsFor(
  `import { ChoroplethMap } from "@jcsoftdev/ui/charts/choropleth-map"; console.log(ChoroplethMap);`,
);
for (const banned of ["data/peru", "data/world", "bubble-map", "build-topology"]) {
  assert.ok(
    !choropleth.files.some((f) => f.includes(banned)),
    `ChoroplethMap must not include "${banned}"`,
  );
}
console.log(
  `maps: world ${world.bytes} bytes, peru ${peru.bytes} bytes, ChoroplethMap ${choropleth.bytes} bytes`,
);
console.log("maps tree-shaking OK");

// XLSX export: the writer is its own subpath with no React and no grid; the writer module is only
// reached from DataGrid through a dynamic import.
const writer = await inputsFor(
  `import { buildXlsx } from "@jcsoftdev/ui/xlsx"; console.log(buildXlsx);`,
);
for (const banned of ["react", "containers", "lucide", "radix"]) {
  assert.ok(
    !writer.files.some((f) => f.includes(banned)),
    `@jcsoftdev/ui/xlsx must not include "${banned}"`,
  );
}
console.log(`xlsx writer: ${writer.bytes} bytes, ${writer.files.length} modules`);
const grid = await build({
  stdin: {
    contents: `import { DataGrid } from "@jcsoftdev/ui/containers/data-grid"; console.log(DataGrid);`,
    resolveDir: process.cwd(),
    loader: "js",
  },
  bundle: true,
  splitting: true,
  outdir: "out",
  minify: true,
  format: "esm",
  write: false,
  metafile: true,
  external: ["react", "react-dom", "react/jsx-runtime"],
});
const entryOutputs = Object.entries(grid.metafile.outputs);
const mainChunk = entryOutputs.find(([, output]) => output.entryPoint);
assert.ok(
  mainChunk && !Object.keys(mainChunk[1].inputs).some((f) => f.includes("xlsx/")),
  "the DataGrid entry chunk must not contain the XLSX writer",
);
assert.ok(
  entryOutputs.some(([, output]) =>
    Object.keys(output.inputs).some((f) => f.includes("xlsx/xlsx")),
  ),
  "the XLSX writer is emitted as its own lazy chunk",
);
for (const banned of ["bar-chart/", "pie-chart/", "line-chart/", "area-chart/"]) {
  assert.ok(
    !Object.keys(mainChunk[1].inputs).some((f) => f.includes(banned)),
    `the DataGrid entry chunk must not contain "${banned}" (integrated charts load on demand)`,
  );
}
console.log("xlsx and integrated charts tree-shaking OK");

// Logo Forge: the generator is pure; importing it from the brand barrel must not drag in the
// editor, React, Radix or icons.
const brandBuild = await build({
  stdin: {
    contents: `import { generateMark, serializeMark } from "@jcsoftdev/ui/brand"; console.log(generateMark, serializeMark);`,
    resolveDir: process.cwd(),
    loader: "js",
  },
  bundle: true,
  minify: true,
  format: "esm",
  write: false,
  metafile: true,
  external: ["react", "react-dom", "react/jsx-runtime"],
});
// Dropped modules still appear in `inputs`; `outputs` lists what survived tree-shaking.
const brandKept = Object.keys(Object.values(brandBuild.metafile.outputs)[0].inputs);
for (const banned of ["react", "radix", "lucide", "logo-forge", "logo-mark", "atoms"]) {
  assert.ok(
    !brandKept.some((f) => f.includes(banned)),
    `brand generateMark must not include "${banned}"`,
  );
}
console.log(
  `brand generator: ${brandBuild.outputFiles[0].contents.length} bytes, ${brandKept.length} modules`,
);
console.log("brand tree-shaking OK");
