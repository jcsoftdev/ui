// The element entries of the package, discovered from the source tree: every `src/<name>/<name>.ts`
// (except `src/internal`) is the entry `@jcsoftdev/ui-elements/<name>`, served by the `./*` export
// pattern from `dist/<name>/<name>.js`. Adding an element is adding its folder; nothing to register.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `defineFooBar` for `foo-bar`. */
export const defineName = (name) =>
  `define${name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())}`;

/** @returns {{ name: string, source: string, dist: string, define: string, budget: number | null | undefined }[]} */
export function elementEntries() {
  const src = join(root, "src");
  return readdirSync(src, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory() && dirent.name !== "internal")
    .filter((dirent) => existsSync(join(src, dirent.name, `${dirent.name}.ts`)))
    .map(({ name }) => {
      const sizeFile = join(src, name, "size.json");
      const budget = existsSync(sizeFile)
        ? JSON.parse(readFileSync(sizeFile, "utf8")).maxGzip
        : undefined;
      return {
        name,
        source: `src/${name}/${name}.ts`,
        dist: `dist/${name}/${name}.js`,
        define: defineName(name),
        budget,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
