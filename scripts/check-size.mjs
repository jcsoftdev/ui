// Size budget gate. Bundles each JS entry (react external, minified) or reads each CSS file,
// gzips it and fails when it exceeds the budget in size-budgets.json. Run after `pnpm build`.
// A JS entry is measured as a consumer's bundler loads it: the entry chunk plus the chunks it
// imports statically. A dynamic `import()` (the Liquid Glass lens engine) becomes its own lazy
// chunk and is not counted, since it is only fetched when a surface needs it.
//   node scripts/check-size.mjs [--update]   --update prints suggested budgets (+8%, rounded up).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { build } = createRequire(join(root, "packages/ui/package.json"))("esbuild");
const budgets = JSON.parse(readFileSync(join(root, "size-budgets.json"), "utf8")).entries;
// Each ui-elements entry keeps its budget next to its source (src/<name>/size.json), so adding an
// element never touches this list.
const { elementEntries } = await import("../packages/ui-elements/scripts/entries.mjs");
for (const element of elementEntries())
  budgets.push({
    id: `ui-elements/${element.name}`,
    kind: "js",
    file: `packages/ui-elements/${element.dist}`,
    maxGzip: element.budget ?? null,
    budgetFile: `packages/ui-elements/src/${element.name}/size.json`,
  });

async function measure({ file, kind }) {
  const path = join(root, file);
  let code;
  if (kind === "css") {
    code = readFileSync(path);
  } else {
    const outdir = join(root, ".size-check");
    const result = await build({
      entryPoints: [path],
      absWorkingDir: root,
      bundle: true,
      splitting: true,
      minify: true,
      format: "esm",
      platform: "browser",
      write: false,
      metafile: true,
      outdir,
      external: ["react", "react-dom", "react/jsx-runtime", "react-dom/*"],
      logLevel: "silent",
    });
    const files = new Map(result.outputFiles.map((out) => [out.path, out.contents]));
    const outputs = result.metafile.outputs;
    // Dynamic-import chunks also carry `entryPoint`; pick the chunk of the measured file itself.
    const entry = Object.keys(outputs).find((name) => outputs[name].entryPoint === file.replace(/^\.\//, ""));
    const eager = new Set();
    const visit = (name) => {
      if (eager.has(name)) return;
      eager.add(name);
      for (const dep of outputs[name].imports)
        if (dep.kind === "import-statement" && !dep.external) visit(dep.path);
    };
    visit(entry);
    code = Buffer.concat([...eager].map((name) => Buffer.from(files.get(join(root, name)))));
  }
  return gzipSync(code, { level: 9 }).length;
}

const update = process.argv.includes("--update");
const rows = [];
let failed = false;
for (const entry of budgets) {
  let size;
  try {
    size = await measure(entry);
  } catch (error) {
    rows.push(`FAIL  ${entry.id}: cannot measure ${entry.file} (${error.message.split("\n")[0]})`);
    failed = true;
    continue;
  }
  const suggested = Math.ceil((size * 1.08) / 50) * 50;
  if (typeof entry.maxGzip !== "number") {
    // New entries start at +5%, rounded up to 50 B.
    const initial = Math.ceil((size * 1.05) / 50) * 50;
    rows.push(`FAIL  ${entry.id}: no budget yet; measured ${size} B, set "maxGzip": ${initial} in ${entry.budgetFile ?? "size-budgets.json"}`);
    failed = true;
    continue;
  }
  const over = size > entry.maxGzip;
  failed ||= over;
  rows.push(
    `${over ? "FAIL" : "ok  "}  ${entry.id.padEnd(34)} ${String(size).padStart(7)} B gzip / budget ${String(entry.maxGzip).padStart(7)} B${update ? `  suggested ${suggested}` : ""}`,
  );
}
console.log(rows.join("\n"));
if (failed) {
  console.error("\ncheck:size failed: an entry is over budget. Shrink it, or set or raise its budget (size-budgets.json or the element's size.json) with a reason in the PR.");
  process.exit(1);
}
