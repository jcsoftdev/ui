// Registry of the parity fixtures the Compose chart modules assert against. Each entry runs the React chart math
// (packages/ui/src/charts, the parity target) on seeded inputs and edge cases and writes JSON into the module's test resources:
//   charts/<module>/src/commonTest/resources/fixtures/<name>.json
//
// {
//   module: "chart-core",                              // a directory under packages/ui-compose/charts
//   name: "scale-linear",                              // kebab-case file name
//   source: "packages/ui/src/charts/core/scale.ts",    // TS entry, bundled with esbuild and handed to run()
//   run: (mod) => ({ ...JSON-serialisable value... }), // seeded and deterministic: no Date.now, no Math.random
// }
//
// Non-finite numbers cannot be JSON: NaN, Infinity and -Infinity become the strings "NaN", "Infinity" and "-Infinity", and -0
// becomes "-0". Kotlin tests decode the same four tokens. Regenerate with `pnpm chart:fixtures`; CI runs `pnpm check:chart-fixtures`
// and fails on any drift. Each KC batch registers its fixtures here and ships the generated JSON in the same commit.
export const fixtures = [];
