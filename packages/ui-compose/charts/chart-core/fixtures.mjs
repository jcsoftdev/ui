// Parity fixtures of this module, run by packages/ui-compose/scripts/chart-fixtures.mjs (`pnpm chart:fixtures`; CI: `pnpm check:chart-fixtures`).
// Each module owns its own fixtures.mjs, so parallel batches never touch a shared registry. An entry runs the React chart math
// (packages/ui/src/charts, the parity target) on seeded inputs and edge cases and writes src/commonTest/resources/fixtures/<name>.json:
//   { name: "scale-linear",                              // kebab-case file name
//     source: "packages/ui/src/charts/core/scale.ts",    // TS entry bundled with esbuild and handed to run(); omit for pure data
//     run: (mod) => ({ ... }) }                          // JSON-serialisable, seeded, no Date.now or Math.random
// Non-finite numbers and -0 are written as {"$f": "NaN" | "Infinity" | "-Infinity" | "-0"}; Kotlin decodes them with
// chart-testing/common/FixtureJson.kt (compiled into every module's tests). Ship the generated JSON in the same commit.
export const fixtures = [
  {
    // Pins the encoding itself: FixtureJsonTest decodes this file, so a change on either side fails a test.
    name: "encoding",
    run: () => ({
      numbers: [NaN, Infinity, -Infinity, -0, 0, 1.5, -2],
      strings: ["NaN", "Infinity", "-Infinity", "-0"],
      nested: { values: [NaN, { deep: -Infinity }] },
    }),
  },
];
