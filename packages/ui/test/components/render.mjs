import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** Bundles a TSX entry (React included, one copy) and returns its exports. */
export async function loadCases(entry) {
  const outfile = join(mkdtempSync(join(tmpdir(), "ui-cases-")), "cases.cjs");
  await build({
    entryPoints: [join(here, entry)],
    outfile,
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    logLevel: "error",
  });
  return require(outfile);
}
