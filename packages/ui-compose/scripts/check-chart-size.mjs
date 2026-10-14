// Size budget gate for the Compose chart artifacts. Measures per artifact, each against charts/<module>/size-budget.json:
//   dexBytes          the classes*.dex an artifact adds to an app: the R8 release dex of its :size-probe flavour minus the `none`
//                     flavour (a Compose activity on UiTheme). Each flavour renders its artifact's ProbeContent, so the delta is
//                     what that artifact costs an app that already uses Compose and the kit.
//   dexOverChartBytes (families only) the same against the `chart` flavour: what the family adds on top of the chart foundation.
//   aarClassesBytes   the raw classes.jar inside the artifact's release AAR (what a consumer's build reads before shrinking).
//   klibBytes         the iosArm64 klib, linkdata + ir only (macOS only: Apple targets do not compile elsewhere). The manifest,
//                     files.knf and debugInfo.knd hold absolute source paths and make the size depend on the checkout location.
//   node scripts/check-chart-size.mjs [--dex] [--aar] [--klib] [--update]
// No measure flag means --dex --aar. Build first: ./gradlew :size-probe:assembleRelease :<module>:assembleRelease (dex, aar)
// and :<module>:compileKotlinIosArm64 (klib). --update rewrites the budget files at measured +5% (at least +1 KiB, rounded up to
// 256 bytes) but never above HARD_CAPS, which come from the plan and change only by editing this file in a commit that says why.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KB = 1024;

// Probe flavour -> module. `none` is the baseline every other flavour is diffed against.
export const ARTIFACTS = [
  ["chartCore", "chart-core"],
  ["chart", "chart"],
  ["cartesian", "chart-cartesian"],
  ["race", "chart-race"],
  ["distribution", "chart-distribution"],
  ["plots", "chart-plots"],
  ["polar", "chart-polar"],
  ["hierarchy", "chart-hierarchy"],
  ["units", "chart-units"],
  ["gantt", "chart-gantt"],
  ["stock", "chart-stock"],
  ["crossfilter", "chart-crossfilter"],
  ["geo", "chart-geo"],
  ["geoWorld", "chart-geo-world"],
  ["geoPeru", "chart-geo-peru"],
  ["export", "chart-export"],
];

/** Entries of a zip as { name, size } with the uncompressed size, read from the central directory. */
export function zipEntries(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a zip file");
  let offset = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let n = buffer.readUInt16LE(end + 10); n > 0; n--) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const nameLength = buffer.readUInt16LE(offset + 28);
    entries.push({ name: buffer.toString("utf8", offset + 46, offset + 46 + nameLength), size: buffer.readUInt32LE(offset + 24) });
    offset += 46 + nameLength + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return entries;
}

const FAMILIES = new Set(
  ["cartesian", "race", "distribution", "plots", "polar", "hierarchy", "units", "gantt", "stock", "crossfilter", "geo"].map((n) => `chart-${n}`),
);

// The plan's ceilings, in bytes of R8 dex: chart-core <= 25 KB, chart <= 60 KB, families 40-90 KB (over the chart foundation),
// export <= 50 KB. Geo data modules hold primitive data and no code worth more than a few KB of dex.
export const HARD_CAPS = {
  "chart-core": 25 * KB,
  chart: 60 * KB,
  "chart-cartesian": 90 * KB,
  "chart-race": 40 * KB,
  "chart-distribution": 60 * KB,
  "chart-plots": 90 * KB,
  "chart-polar": 60 * KB,
  "chart-hierarchy": 90 * KB,
  "chart-units": 40 * KB,
  "chart-gantt": 40 * KB,
  "chart-stock": 60 * KB,
  "chart-crossfilter": 60 * KB,
  "chart-geo": 90 * KB,
  "chart-geo-world": 4 * KB,
  "chart-geo-peru": 4 * KB,
  "chart-export": 50 * KB,
};

/** The dex metric a cap bounds: a family is bounded over the chart foundation, everything else over the baseline. */
export const capKey = (module) => (FAMILIES.has(module) ? "dexOverChartBytes" : "dexBytes");

export const suggest = (measured) => Math.ceil(Math.max(measured * 1.05, measured + 1024) / 256) * 256;

function need(path, hint) {
  if (!existsSync(path)) throw new Error(`missing ${path}\n  build it first: ${hint}`);
  return path;
}

function dexBytes(flavour) {
  const apk = join(root, `size-probe/build/outputs/apk/${flavour}/release/size-probe-${flavour}-release.apk`);
  const entries = zipEntries(readFileSync(need(apk, "./gradlew :size-probe:assembleRelease")));
  return entries.filter((e) => /^classes\d*\.dex$/.test(e.name)).reduce((sum, e) => sum + e.size, 0);
}

function aarClassesBytes(module) {
  const aar = join(root, `charts/${module}/build/outputs/aar/${module}-release.aar`);
  const entry = zipEntries(readFileSync(need(aar, `./gradlew :${module}:assembleRelease`))).find((e) => e.name === "classes.jar");
  if (!entry) throw new Error(`${aar} has no classes.jar`);
  return entry.size;
}

function directoryBytes(dir, skip = () => false) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, item) => {
    if (skip(item.name)) return sum;
    return sum + (item.isDirectory() ? directoryBytes(join(dir, item.name), skip) : statSync(join(dir, item.name)).size);
  }, 0);
}

// The compiler leaves the klib unpacked. Only the code-bearing parts count: path-bearing metadata is left out (see the header).
export const KLIB_SKIPPED = new Set(["files.knf", "debugInfo.knd"]);

function klibBytes(module) {
  const klib = join(root, `charts/${module}/build/classes/kotlin/iosArm64/main/klib/${module}/default`);
  need(klib, `./gradlew :${module}:compileKotlinIosArm64 (macOS)`);
  return ["linkdata", "ir"].reduce((sum, part) => sum + directoryBytes(join(klib, part), (name) => KLIB_SKIPPED.has(name)), 0);
}

const budgetPath = (module) => join(root, `charts/${module}/size-budget.json`);
const readBudget = (module) => (existsSync(budgetPath(module)) ? JSON.parse(readFileSync(budgetPath(module), "utf8")) : {});

function main() {
  const flags = new Set(process.argv.slice(2));
  const update = flags.delete("--update");
  const measures = ["--dex", "--aar", "--klib"].filter((f) => flags.has(f)).map((f) => f.slice(2));
  const selected = measures.length ? measures : ["dex", "aar"];
  const baseline = selected.includes("dex") ? dexBytes("none") : 0;
  const chart = selected.includes("dex") ? dexBytes("chart") : 0;
  const failures = [];
  for (const [flavour, module] of ARTIFACTS) {
    const measured = {};
    if (selected.includes("dex")) {
      const dex = dexBytes(flavour);
      measured.dexBytes = dex - baseline;
      if (FAMILIES.has(module)) measured.dexOverChartBytes = Math.max(0, dex - chart);
    }
    if (selected.includes("aar")) measured.aarClassesBytes = aarClassesBytes(module);
    if (selected.includes("klib")) measured.klibBytes = klibBytes(module);
    const budget = readBudget(module);
    for (const [key, value] of Object.entries(measured)) {
      const cap = key === capKey(module) ? HARD_CAPS[module] : undefined;
      if (cap !== undefined && value > cap) failures.push(`${module} ${key}: ${value} bytes exceeds the hard cap ${cap}`);
      if (cap !== undefined && budget[key] > cap) failures.push(`${module} ${key}: budget ${budget[key]} is above the hard cap ${cap}`);
      const status = budget[key] === undefined ? "NO BUDGET" : value <= budget[key] ? "ok" : "OVER";
      console.log(`${module.padEnd(20)} ${key.padEnd(18)} ${String(value).padStart(8)} / ${String(budget[key] ?? "-").padStart(8)}  ${status}`);
      if (!update && status !== "ok") failures.push(`${module} ${key}: ${value} bytes, budget ${budget[key] ?? "missing"}`);
      if (update && cap === undefined) budget[key] = suggest(value);
      if (update && cap !== undefined) budget[key] = Math.min(suggest(value), cap);
    }
    if (update) {
      mkdirSync(dirname(budgetPath(module)), { recursive: true });
      writeFileSync(budgetPath(module), `${JSON.stringify(budget, null, 2)}\n`);
    }
  }
  if (failures.length) {
    console.error(`\n${failures.length} problem(s):\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
  if (update) console.log("\nBudget files rewritten (charts/<module>/size-budget.json). Commit them with the reason.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
