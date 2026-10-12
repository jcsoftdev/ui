// Release planning for the lockstep multi-package publish. Pure: no network, no publish.
//   node scripts/release-plan.mjs <tag>   prints the enabled package dirs, one per line, or exits 1.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Public packages, which are versioned in lockstep. */
export function lockstepPackages(workspaceDirs, read = (d) => readJson(join(root, d, "package.json"))) {
  return workspaceDirs
    .map((dir) => ({ dir, pkg: read(dir) }))
    .filter(({ pkg }) => !pkg.private)
    .map(({ dir, pkg }) => ({ dir, name: pkg.name, version: pkg.version }));
}

export function planRelease({ tag, enabled, packages }) {
  const errors = [];
  const versions = new Set(packages.map((p) => p.version));
  if (versions.size > 1) {
    errors.push(`packages are not in lockstep: ${packages.map((p) => `${p.name}@${p.version}`).join(", ")}`);
  }
  // With diverging versions the lockstep error above already says what is wrong; comparing the tag
  // against an arbitrary first version would add a misleading second error.
  if (versions.size === 1) {
    const [version] = versions;
    if (tag !== `v${version}`) errors.push(`tag ${tag} does not match package version v${version}`);
  }
  const known = new Map(packages.map((p) => [p.dir, p]));
  for (const dir of enabled) {
    if (!known.has(dir)) errors.push(`publish list names "${dir}", which is not a public package`);
  }
  if (enabled.length === 0) errors.push("publish list is empty");
  return { errors, publish: enabled.filter((d) => known.has(d)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  const workspaceDirs = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")
    .split("\n")
    .map((l) => /^\s*-\s*"?(packages\/[^"\s]+)"?/.exec(l)?.[1])
    .filter(Boolean);
  const { packages: enabled } = readJson(join(root, ".github/publish-packages.json"));
  const { errors, publish } = planRelease({ tag, enabled, packages: lockstepPackages(workspaceDirs) });
  if (errors.length) {
    for (const e of errors) console.error(`::error::${e}`);
    process.exit(1);
  }
  console.log(publish.join("\n"));
}
