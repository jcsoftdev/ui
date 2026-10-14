import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { axTree, reducedMotion, timezone, touch } from "./test/commands.ts";

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
        test: {
          name: "browser",
          include: ["test/**/*.browser.test.ts"],
          // Lazy parts load through the network and the module graph: polls wait for the
          // observable state, up to ten seconds on a loaded machine.
          testTimeout: 30_000,
          expect: { poll: { timeout: 10_000, interval: 20 } },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            commands: { axTree, reducedMotion, timezone, touch },
          },
        },
      },
    ],
  },
});
