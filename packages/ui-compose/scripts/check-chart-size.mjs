// Size budget gate for the Compose chart artifacts. Three measures per artifact, each against size-budgets.json:
//   dexBytes         the classes*.dex an artifact adds to an app: the R8 release dex of its :size-probe flavour minus the `none`
//                    flavour. Each flavour reaches only its artifact, so the delta is what that artifact costs an app.
//   aarClassesBytes  the raw classes.jar inside the artifact's release AAR (what a consumer's build reads before shrinking).
//   klibBytes        the iosArm64 klib (macOS only: Apple targets do not compile elsewhere).
//   node scripts/check-chart-size.mjs [--dex] [--aar] [--klib] [--update]
// No measure flag means --dex --aar. Build first: ./gradlew :size-probe:assembleRelease :<module>:assembleRelease (dex, aar)
// and :<module>:compileKotlinIosArm64 (klib). --update prints the measured sizes and suggested budgets (+5%, at least +1 KiB,
// rounded up to 256 bytes); a budget is raised only by a commit that says why.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budgetFile = join(root, "size-budgets.json");

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

// The compiler leaves the klib unpacked, so its size is the sum of its files.
function directoryBytes(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, item) => sum + (item.isDirectory() ? directoryBytes(join(dir, item.name)) : statSync(join(dir, item.name)).size),
    0,
  );
}

function klibBytes(module) {
  const klib = join(root, `charts/${module}/build/classes/kotlin/iosArm64/main/klib/${module}`);
  return directoryBytes(need(klib, `./gradlew :${module}:compileKotlinIosArm64 (macOS)`));
}

function main() {
  const flags = new Set(process.argv.slice(2));
  const update = flags.delete("--update");
  const measures = ["--dex", "--aar", "--klib"].filter((f) => flags.has(f)).map((f) => f.slice(2));
  const selected = measures.length ? measures : ["dex", "aar"];
  const budgets = JSON.parse(readFileSync(budgetFile, "utf8")).artifacts;
  const baseline = selected.includes("dex") ? dexBytes("none") : 0;
  const failures = [];
  const suggested = {};
  for (const [flavour, module] of ARTIFACTS) {
    const measured = {};
    if (selected.includes("dex")) measured.dexBytes = dexBytes(flavour) - baseline;
    if (selected.includes("aar")) measured.aarClassesBytes = aarClassesBytes(module);
    if (selected.includes("klib")) measured.klibBytes = klibBytes(module);
    suggested[module] = Object.fromEntries(Object.entries(measured).map(([key, value]) => [key, suggest(value)]));
    for (const [key, value] of Object.entries(measured)) {
      const budget = budgets[module]?.[key];
      const status = budget === undefined ? "NO BUDGET" : value <= budget ? "ok" : "OVER";
      console.log(`${module.padEnd(20)} ${key.padEnd(16)} ${String(value).padStart(8)} / ${String(budget ?? "-").padStart(8)}  ${status}`);
      if (status !== "ok") failures.push(`${module} ${key}: ${value} bytes, budget ${budget ?? "missing"}`);
    }
  }
  if (update) {
    console.log("\nSuggested budgets (merge into size-budgets.json):");
    console.log(JSON.stringify({ artifacts: suggested }, null, 2));
    return;
  }
  if (failures.length) {
    console.error(`\n${failures.length} artifact(s) over budget:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
