import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const browser = {
  enabled: true,
  headless: true,
  // A desktop viewport: the dock only follows a phone-sized viewport or a coarse pointer.
  viewport: { width: 1280, height: 800 },
  provider: playwright(),
  instances: [{ browser: "chromium" as const }],
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          tailwindcss(),
          storybookTest({ configDir: path.join(dirname, ".storybook"), tags: { exclude: ["no-test"] } }),
        ],
        test: { name: "stories", browser },
      },
      {
        plugins: [tailwindcss()],
        test: {
          name: "glass",
          include: ["src/**/*.browser.test.tsx"],
          browser,
        },
      },
    ],
  },
});
