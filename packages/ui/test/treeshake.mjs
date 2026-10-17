// Bundles a tiny consumer that imports one component and asserts nothing else is pulled in.
// Run after `pnpm build`: node test/treeshake.mjs
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  "primitives/",
  "dropdown-menu",
  "popover",
  "lucide",
  "icons/",
  "checkbox",
  "confirm-action",
  "responsive-list",
  "toaster",
  "status-icons",
]) {
  assert.ok(
    !single.files.some((f) => f.includes(banned)),
    `single-component bundle must not include "${banned}"`,
  );
}

const confirm = await inputsFor(
  `import { ConfirmAction } from "@jcsoftdev/ui/containers/confirm-action"; console.log(ConfirmAction);`,
);
for (const banned of [
  "responsive-list",
  "table/",
  "dialog",
  "popover",
  "dropdown-menu",
  "primitives/command",
]) {
  assert.ok(
    !confirm.files.some((f) => f.includes(banned)),
    `ConfirmAction bundle must not include "${banned}"`,
  );
}
console.log(`containers/confirm-action: ${confirm.bytes} bytes, ${confirm.files.length} modules`);

for (const [entry, component] of [
  ["atoms/spinner", "Spinner"],
  ["atoms/kbd", "Kbd"],
]) {
  const small = await inputsFor(
    `import { ${component} } from "@jcsoftdev/ui/${entry}"; console.log(${component});`,
  );
  for (const banned of ["dialog", "primitives/", "popover", "dropdown-menu", "toaster", "icons/"]) {
    assert.ok(
      !small.files.some((f) => f.includes(banned)),
      `${component} bundle must not include "${banned}"`,
    );
  }
  console.log(`${entry}: ${small.bytes} bytes, ${small.files.length} modules`);
}

const iconButton = await inputsFor(
  `import { IconButton } from "@jcsoftdev/ui/atoms/icon-button"; console.log(IconButton);`,
);
for (const banned of ["dialog", "primitives/", "popover", "dropdown-menu", "toaster", "icons/"]) {
  assert.ok(
    !iconButton.files.some((f) => f.includes(banned)),
    `IconButton bundle must not include "${banned}"`,
  );
}
console.log(`atoms/icon-button: ${iconButton.bytes} bytes, ${iconButton.files.length} modules`);

const tooltipBundle = await inputsFor(
  `import { Tooltip } from "@jcsoftdev/ui/overlays/tooltip"; console.log(Tooltip);`,
);
for (const banned of [
  "primitives/dialog",
  "primitives/menu",
  "primitives/command",
  "dropdown-menu",
  "toaster",
]) {
  assert.ok(
    !tooltipBundle.files.some((f) => f.includes(banned)),
    `Tooltip bundle must not include "${banned}"`,
  );
}
console.log(
  `overlays/tooltip: ${tooltipBundle.bytes} bytes, ${tooltipBundle.files.length} modules`,
);

const alertBundle = await inputsFor(
  `import { AlertDialog } from "@jcsoftdev/ui/overlays/alert-dialog"; console.log(AlertDialog);`,
);
for (const banned of [
  "primitives/popover",
  "primitives/popper",
  "primitives/menu",
  "primitives/command",
  "dropdown-menu",
  "toaster",
  "responsive-list",
]) {
  assert.ok(
    !alertBundle.files.some((f) => f.includes(banned)),
    `AlertDialog bundle must not include "${banned}"`,
  );
}
console.log(
  `overlays/alert-dialog: ${alertBundle.bytes} bytes, ${alertBundle.files.length} modules`,
);

for (const [entry, component] of [
  ["forms/select-menu", "SelectMenu"],
  ["forms/combobox", "Combobox"],
  ["forms/date-picker", "DatePicker"],
  ["forms/date-picker", "DateTimePicker"],
  ["calendar/date-calendar", "DateCalendar"],
]) {
  const picker = await inputsFor(
    `import { ${component} } from "@jcsoftdev/ui/${entry}"; console.log(${component});`,
  );
  for (const banned of [
    "primitives/dialog",
    "primitives/menu",
    "primitives/command",
    "dropdown-menu",
    "toaster",
    "charts/",
  ]) {
    assert.ok(
      !picker.files.some((f) => f.includes(banned)),
      `${component} bundle must not include "${banned}"`,
    );
  }
  console.log(`${entry} (${component}): ${picker.bytes} bytes, ${picker.files.length} modules`);
}

for (const [entry, component] of [
  ["atoms/seal", "Seal"],
  ["forms/chip-group", "ChipGroup"],
  ["navigation/tabs", "TabsNav"],
  ["atoms/due-chip", "DueChip"],
]) {
  const atom = await inputsFor(
    `import { ${component} } from "@jcsoftdev/ui/${entry}"; console.log(${component});`,
  );
  for (const banned of [
    "primitives/",
    "dialog",
    "popover",
    "dropdown-menu",
    "toaster",
    "charts/",
    "responsive-list",
  ]) {
    assert.ok(
      !atom.files.some((f) => f.includes(banned)),
      `${component} bundle must not include "${banned}"`,
    );
  }
  console.log(`${entry} (${component}): ${atom.bytes} bytes, ${atom.files.length} modules`);
}

const wiz = await inputsFor(
  `import { Wizard } from "@jcsoftdev/ui/navigation/wizard"; console.log(Wizard);`,
);
for (const banned of ["primitives/", "dialog", "popover", "dropdown-menu", "toaster", "charts/"]) {
  assert.ok(
    !wiz.files.some((f) => f.includes(banned)),
    `Wizard bundle must not include "${banned}"`,
  );
}
console.log(`navigation/wizard: ${wiz.bytes} bytes, ${wiz.files.length} modules`);

for (const [entry, component] of [
  ["containers/section", "Section"],
  ["containers/note", "Note"],
  ["containers/aside", "Aside"],
  ["containers/description-list", "DescriptionListItem"],
  ["containers/list-detail", "ListDetail"],
  ["containers/feed", "Feed"],
  ["containers/shortcuts", "Shortcuts"],
]) {
  const block = await inputsFor(
    `import { ${component} } from "@jcsoftdev/ui/${entry}"; console.log(${component});`,
  );
  for (const banned of [
    "primitives/",
    "dialog",
    "popover",
    "dropdown-menu",
    "toaster",
    "charts/",
    "responsive-list",
  ]) {
    assert.ok(
      !block.files.some((f) => f.includes(banned)),
      `${component} bundle must not include "${banned}"`,
    );
  }
  console.log(`${entry} (${component}): ${block.bytes} bytes, ${block.files.length} modules`);
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

// Icons: each icon is its own module; a Button bundle has none, a single icon bundles only itself.
// Dropped modules still appear in `metafile.inputs`; `bytesInOutput` tells what survived.
async function keptFor(code) {
  const result = await build({
    stdin: { contents: code, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    metafile: true,
    external: ["react", "react-dom", "react/jsx-runtime"],
  });
  const [output] = Object.values(result.metafile.outputs);
  const kept = Object.entries(output.inputs)
    .filter(([, input]) => input.bytesInOutput > 0)
    .map(([file]) => file);
  return { kept, bytes: result.outputFiles[0].contents.length };
}
const oneIcon = await keptFor(`import { Check } from "@jcsoftdev/ui/icons"; console.log(Check);`);
const keptIcons = oneIcon.kept.filter((f) => f.includes("icons/"));
assert.deepEqual(
  keptIcons.map((f) => f.split("icons/").pop()).sort(),
  ["check.js", "icon-base.js"],
  "a single icon bundles only its own module and the shared base",
);
const allIcons = await keptFor(`import * as icons from "@jcsoftdev/ui/icons"; console.log(icons);`);
assert.ok(
  allIcons.kept.filter((f) => f.includes("icons/")).length > 100,
  "the full namespace import keeps every icon",
);
console.log(`icons: one icon ${oneIcon.bytes} bytes, full set ${allIcons.bytes} bytes`);
console.log("icons tree-shaking OK");

// Primitives: each primitive is its own module graph. Dropped modules stay in `inputs`, so check
// `bytesInOutput`. A single primitive must not drag in its siblings.
const only = (kept, name) => kept.some((f) => f.includes(`primitives/${name}/`));
const popover = await keptFor(
  `import { PopoverPrimitive } from "@jcsoftdev/ui/primitives"; console.log(PopoverPrimitive);`,
);
assert.ok(only(popover.kept, "popover") && only(popover.kept, "popper"), "popover bundles popper");
for (const sibling of ["dialog", "menu", "command"]) {
  assert.ok(
    !only(popover.kept, sibling),
    `PopoverPrimitive must not include primitives/${sibling}`,
  );
}
const dialog = await keptFor(
  `import { DialogPrimitive } from "@jcsoftdev/ui/primitives"; console.log(DialogPrimitive);`,
);
for (const sibling of ["popover", "popper", "menu", "command"]) {
  assert.ok(!only(dialog.kept, sibling), `DialogPrimitive must not include primitives/${sibling}`);
}
const menu = await keptFor(
  `import { MenuPrimitive } from "@jcsoftdev/ui/primitives"; console.log(MenuPrimitive);`,
);
for (const sibling of ["dialog", "popover", "command"]) {
  assert.ok(!only(menu.kept, sibling), `MenuPrimitive must not include primitives/${sibling}`);
}
const scorer = await keptFor(
  `import { commandScore } from "@jcsoftdev/ui/primitives"; console.log(commandScore);`,
);
assert.ok(
  !scorer.kept.some((f) => /primitives\/(dialog|menu|popover|popper|portal)/.test(f)) &&
    !scorer.kept.some((f) => f.includes("react")),
  "commandScore is pure and pulls no component",
);
const geometry = await keptFor(
  `import { computePlacement } from "@jcsoftdev/ui/primitives"; console.log(computePlacement);`,
);
assert.ok(
  !geometry.kept.some((f) => f.includes("popper/popper")),
  "computePlacement does not pull the popper component",
);
// A styled component that wraps a primitive keeps only the primitive it uses.
const styledPopover = await keptFor(
  `import { Popover } from "@jcsoftdev/ui/overlays/popover"; console.log(Popover);`,
);
for (const sibling of ["dialog", "menu", "command"]) {
  assert.ok(!only(styledPopover.kept, sibling), `Popover must not include primitives/${sibling}`);
}
console.log(
  `primitives: popover ${popover.bytes}, dialog ${dialog.bytes}, menu ${menu.bytes}, commandScore ${scorer.bytes} bytes`,
);
console.log("primitives tree-shaking OK");

// Liquid Glass is opt-in. A page that does not use it carries no liquid code and has nothing it
// could fetch for it later: no chunk of these entries, eager or lazy, holds a glass module, so no
// liquid surface, `material` value or preference can make the page load one at run time.
async function splitBuild(code) {
  const result = await build({
    stdin: { contents: code, resolveDir: process.cwd(), loader: "js" },
    bundle: true,
    splitting: true,
    outdir: "out",
    minify: true,
    format: "esm",
    write: false,
    metafile: true,
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/*"],
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find((name) => outputs[name].entryPoint);
  // `lazy` also follows `import()`: every chunk the page can fetch at run time.
  const closure = (name, seen = new Set(), lazy = false) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const dep of outputs[name].imports)
      if (
        !dep.external &&
        (dep.kind === "import-statement" || (lazy && dep.kind === "dynamic-import"))
      )
        closure(dep.path, seen, lazy);
    return seen;
  };
  const kept = (names) =>
    [...names].flatMap((name) =>
      Object.entries(outputs[name].inputs)
        .filter(([, input]) => input.bytesInOutput > 0)
        .map(([file]) => file),
    );
  const holder = (module) =>
    Object.keys(outputs).find((name) =>
      Object.entries(outputs[name].inputs).some(
        ([input, { bytesInOutput }]) => input.endsWith(module) && bytesInOutput > 0,
      ),
    );
  return {
    all: kept(Object.keys(outputs)),
    eager: kept(closure(entry)),
    reachable: kept(closure(entry, new Set(), true)),
    holder,
    closureOf: (module) => kept(closure(holder(module))),
  };
}
// Every public JS entry except the two liquid ones, read from package.json and dist so a new entry
// is covered without editing this list.
const exportsMap = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).exports;
const named = Object.keys(exportsMap)
  .filter((key) => /^\.\/[a-z-]+$/.test(key) && exportsMap[key])
  .map((key) => key.slice(2));
const wildcard = exportsMap["./*"]
  ? readdirSync(new URL("../dist/", import.meta.url), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(new URL(`../dist/${name}/index.js`, import.meta.url)))
  : [];
const nonLiquid = [...new Set([...named, ...wildcard])]
  .filter((name) => name !== "glass" && name !== "liquid")
  .sort();
assert.ok(nonLiquid.length >= 15, `found the public entries (${nonLiquid.join(", ")})`);
for (const path of nonLiquid) {
  const { all } = await splitBuild(`import * as m from "@jcsoftdev/ui/${path}"; console.log(m);`);
  const liquid = all.filter((f) => f.includes("/glass/"));
  assert.deepEqual(liquid, [], `@jcsoftdev/ui/${path} must not hold or fetch any glass module`);
}
console.log(
  `liquid glass: ${nonLiquid.length} non-liquid entries hold and fetch no glass module OK`,
);

// Liquid Glass tiers: each step brings only its own feature. `liquidStyle` is the option mapping
// alone; `<LiquidGlass />` adds the watcher and fetches the engine lazily; the engine does not hold
// the crystal layer or the dispersion passes, which are lazy chunks of their own.
{
  const style = await splitBuild(
    `import { liquidStyle } from "@jcsoftdev/ui/liquid"; console.log(liquidStyle);`,
  );
  for (const banned of ["glass/liquid-glass", "glass/refraction", "glass/displacement-map"])
    assert.ok(
      !style.reachable.some((f) => f.includes(banned)),
      `liquidStyle must not hold or fetch "${banned}"`,
    );

  const lens = await splitBuild(
    `import { LiquidGlass } from "@jcsoftdev/ui/liquid"; console.log(LiquidGlass);`,
  );
  assert.ok(
    lens.eager.some((f) => f.includes("glass/liquid-glass")),
    "the watcher is eager",
  );
  for (const banned of ["glass/refraction", "glass/displacement-map", "glass/liquid-motion"])
    assert.ok(
      !lens.eager.some((f) => f.includes(banned)),
      `<LiquidGlass /> must load "${banned}" lazily`,
    );
  assert.ok(lens.holder("glass/refraction.js"), "<LiquidGlass /> emits the engine as a lazy chunk");
  for (const banned of ["glass/lens-crystal", "glass/crystal-map", "glass/lens-dispersion"])
    assert.ok(
      !lens.closureOf("glass/refraction.js").some((f) => f.includes(banned)),
      `the engine must not hold "${banned}"`,
    );
  assert.ok(
    !lens.closureOf("glass/lens-dispersion.js").some((f) => f.includes("glass/crystal-map")),
    "dispersion must not hold the crystal map",
  );
  for (const module of ["glass/lens-crystal.js", "glass/lens-dispersion.js"])
    assert.ok(
      lens.holder(module) && lens.holder(module) !== lens.holder("glass/refraction.js"),
      `${module} is its own lazy chunk`,
    );
}
const preset = await keptFor(
  `import { LIQUID_PRESET_CRYSTAL } from "@jcsoftdev/ui/glass"; console.log(LIQUID_PRESET_CRYSTAL);`,
);
for (const banned of [
  "glass/refraction",
  "glass/liquid-motion",
  "glass/displacement-map",
  "glass/crystal-map",
])
  assert.ok(
    !preset.kept.some((f) => f.includes(banned)),
    `a preset import must not include "${banned}"`,
  );
const plainMap = await keptFor(
  `import { createDisplacementMap } from "@jcsoftdev/ui/glass"; console.log(createDisplacementMap);`,
);
for (const banned of ["glass/crystal-map", "glass/specular-map", "glass/refraction"])
  assert.ok(
    !plainMap.kept.some((f) => f.includes(banned)),
    `createDisplacementMap must not include "${banned}"`,
  );
console.log(
  `liquid glass tiers OK (preset ${preset.bytes} bytes, displacement map ${plainMap.bytes} bytes)`,
);
