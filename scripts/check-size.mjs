// Size budget gate. Bundles each JS entry (react external, minified) or reads each CSS file,
// gzips it and fails when it exceeds the budget in size-budgets.json. Run after `pnpm build`.
//   node scripts/check-size.mjs [--update]   --update prints suggested budgets (+8%, rounded up).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { build } = createRequire(join(root, "packages/ui/package.json"))("esbuild");
const budgets = JSON.parse(readFileSync(join(root, "size-budgets.json"), "utf8")).entries;

async function measure({ file, kind }) {
  const path = join(root, file);
  let code;
  if (kind === "css") {
    code = readFileSync(path);
  } else {
    const result = await build({
      entryPoints: [path],
      bundle: true,
      minify: true,
      format: "esm",
      platform: "browser",
      write: false,
      external: ["react", "react-dom", "react/jsx-runtime", "react-dom/*"],
      logLevel: "silent",
    });
    code = Buffer.from(result.outputFiles[0].contents);
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
  const over = size > entry.maxGzip;
  failed ||= over;
  const suggested = Math.ceil((size * 1.08) / 50) * 50;
  rows.push(
    `${over ? "FAIL" : "ok  "}  ${entry.id.padEnd(34)} ${String(size).padStart(7)} B gzip / budget ${String(entry.maxGzip).padStart(7)} B${update ? `  suggested ${suggested}` : ""}`,
  );
}
console.log(rows.join("\n"));
if (failed) {
  console.error("\ncheck:size failed: an entry is over budget. Shrink it or raise its budget in size-budgets.json with a reason in the PR.");
  process.exit(1);
}
