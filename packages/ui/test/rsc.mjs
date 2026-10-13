// React Server Components check over the built dist. Run after `pnpm build`: node test/rsc.mjs
//
// A module without a "use client" directive may be imported by a server component, so it must
// not call hooks. The kit ships unbundled, so the check walks the relative import graph of every
// such module, stops at "use client" boundaries (a bundler replaces those with references) and
// fails when a server-side module reaches a React hook, or imports a `use*` binding from a
// client module (calling a client reference on the server throws). It then imports every
// server-side module for real with the `react-server` export condition, with client modules
// stubbed the way a bundler stubs them.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist");

if (process.argv[2] === "--import") {
  const files = JSON.parse(process.argv[3]);
  for (const file of files) await import(pathToFileURL(file).href);
  console.log(`rsc: ${files.length} server-side modules import under react-server`);
  process.exit(0);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });

const isClient = (code) => /^\s*(?:\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(code);
const HOOKS =
  /\b(useState|useEffect|useLayoutEffect|useReducer|useRef|useContext|createContext|useImperativeHandle|useSyncExternalStore|useTransition|useDeferredValue|useInsertionEffect)\b/;
const files = walk(dist);
const source = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const clients = new Set(files.filter((f) => isClient(source.get(f))));
// Story and site demos (`*.demos.*`, `showcase/`) are not package entries and are never imported
// from a server component, so they are not part of the contract.
const demo = (f) => /\.demos\.js$|[\\/]showcase[\\/]/.test(f);
// Component modules (they render JSX) are the entries a server component may import; plain hook
// modules without a directive are only a problem when such a module reaches them.
const server = files.filter(
  (f) => !clients.has(f) && !demo(f) && source.get(f).includes('"react/jsx-runtime"'),
);

const importRe = /(?:^|\n)\s*import\s+(?:([\s\S]*?)\s+from\s+)?["']([^"']+)["']/g;
const problems = [];
const seenFrom = new Map();
function visit(file, root, trail) {
  if (seenFrom.get(file) === root) return;
  seenFrom.set(file, root);
  const code = source.get(file);
  const shown = relative(dist, file);
  for (const m of code.matchAll(importRe)) {
    const [, clause = "", spec] = m;
    if (spec === "react") {
      const hook = HOOKS.exec(clause);
      if (hook) problems.push(`${relative(dist, root)}: imports ${hook[1]} from react (${trail})`);
      continue;
    }
    if (!spec.startsWith(".")) continue;
    const target = resolve(dirname(file), spec);
    if (!source.has(target)) continue;
    if (clients.has(target)) {
      // Re-exporting a client hook is fine; calling one on the server is not.
      for (const name of clause.match(/\buse[A-Z]\w*/g) ?? [])
        if (new RegExp(`\\b${name}\\(`).test(code))
          problems.push(`${shown}: calls ${name}() from client module ${relative(dist, target)}`);
      continue;
    }
    visit(target, root, `${trail} > ${relative(dist, target)}`);
  }
}
for (const file of server) visit(file, file, relative(dist, file));
assert.deepEqual(problems, [], `server-side modules use client-only APIs:\n${problems.join("\n")}`);

// Real import under react-server, client modules stubbed.
const loader = `
import { readFileSync } from "node:fs";
export async function load(url, context, next) {
  if (url.startsWith("file:") && url.endsWith(".js")) {
    const code = readFileSync(new URL(url), "utf8");
    if (/^\\s*(?:\\/\\*[\\s\\S]*?\\*\\/\\s*)?["']use client["']/.test(code)) {
      const names = new Set();
      for (const m of code.matchAll(/export\\s+(?:async\\s+)?(?:function\\*?|const|let|class)\\s+(\\w+)/g)) names.add(m[1]);
      for (const m of code.matchAll(/export\\s*\\{([^}]*)\\}/g))
        for (const part of m[1].split(",")) {
          const name = part.trim().split(/\\s+as\\s+/).pop();
          if (name && name !== "default") names.add(name);
        }
      const body = [...names].map((n) => "export const " + n + " = () => null;").join("\\n");
      return { format: "module", shortCircuit: true, source: body };
    }
  }
  return next(url, context);
}`;
const register = `import { register } from "node:module";
register("data:text/javascript,${encodeURIComponent(loader)}");`;
const result = spawnSync(
  process.execPath,
  [
    "--conditions=react-server",
    "--import",
    `data:text/javascript,${encodeURIComponent(register)}`,
    fileURLToPath(import.meta.url),
    "--import",
    JSON.stringify(server),
  ],
  { encoding: "utf8" },
);
process.stdout.write(result.stdout);
assert.equal(result.status, 0, `react-server import failed:\n${result.stderr}`);
console.log(
  `rsc: ${clients.size} client modules, ${server.length} server modules, no hooks on the server`,
);
