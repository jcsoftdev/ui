import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildTheme, toKotlinColor } from "../scripts/build-theme.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, "fixture.tokens.json"), "utf8"));
const update = process.env.UPDATE_GOLDEN === "1";

for (const [name, content] of Object.entries(buildTheme(tokens))) {
  test(`golden output: ${name}`, () => {
    const file = join(here, "golden", name);
    if (update || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    assert.equal(content, readFileSync(file, "utf8"));
  });
}

test("kotlin color conversion", () => {
  assert.equal(toKotlinColor("#000"), "Color(0xFF000000)");
  assert.equal(toKotlinColor("#faa2a2"), "Color(0xFFFAA2A2)");
  assert.equal(toKotlinColor("rgba(0,0,0,.11)"), "Color(0x1C000000)");
});
