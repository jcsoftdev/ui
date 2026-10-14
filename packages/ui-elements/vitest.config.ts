import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { axTree, reducedMotion } from "./test/commands.ts";

/**
 * Vite's dev server serves a JSON module as JavaScript, which the browser refuses for
 * `import(x, { with: { type: "json" } })`. ui-core's lazy map loader uses exactly that, so the
 * browser project drops the attribute there (a bundler build keeps it and is covered by `check:size`).
 */
const jsonModules = {
  name: "ui-core-json-modules",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!/ui-core\/(dist|src)\/geo\/maps\.[jt]s/.test(id)) return;
    return code.replace(/,\s*\{\s*with:\s*\{\s*type:\s*"json"\s*\}\s*\}/g, "");
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.browser.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [jsonModules],
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            commands: { axTree, reducedMotion },
          },
        },
      },
    ],
  },
});
