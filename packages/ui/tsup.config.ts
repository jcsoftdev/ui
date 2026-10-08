import { defineConfig } from "tsup";

// Unbundled ESM: one output file per source file keeps the module graph intact,
// so bundlers can tree-shake down to a single component.
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}", "!src/**/*.test.*", "!src/**/*.stories.*"],
  bundle: false,
  format: ["esm"],
  outDir: "dist",
  target: "es2022",
  clean: true,
  dts: false,
  sourcemap: false,
});
