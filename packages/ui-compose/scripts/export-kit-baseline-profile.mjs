#!/usr/bin/env node
// Extracts the kit's own rules (com.jcsoftdev.ui.*, minus the sample app) from the sample's generated baseline profile
// into kit/src/androidMain/baseline-prof.txt, which AGP packages at the root of the kit AAR so consumers get it.
// Regenerate the source first: ./gradlew :sample:generateBaselineProfile (needs a device or emulator).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "sample/src/release/generated/baselineProfiles/baseline-prof.txt");
const target = join(root, "kit/src/androidMain/baseline-prof.txt");

const kitRule = /^[HSP]*Lcom\/jcsoftdev\/ui\/(?!sample\/)/;
const lines = readFileSync(source, "utf8")
  .split("\n")
  .filter((line) => kitRule.test(line));
const unique = [...new Set(lines)].sort();
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${unique.join("\n")}\n`);
console.log(`${unique.length} rules -> ${target}`);
