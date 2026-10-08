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
for (const banned of ["dialog", "dropdown-menu", "popover", "cmdk", "sonner", "lucide", "checkbox"]) {
  assert.ok(
    !single.files.some((f) => f.includes(banned)),
    `single-component bundle must not include "${banned}"`,
  );
}

const group = await inputsFor(
  `import { Chip } from "@jcsoftdev/ui/atoms"; console.log(Chip);`,
);
console.log(`atoms (group entry, only Chip used): ${group.bytes} bytes, ${group.files.length} modules`);
assert.ok(!group.files.some((f) => f.includes("react-dialog")), "group entry must tree-shake");
console.log("tree-shaking OK");
