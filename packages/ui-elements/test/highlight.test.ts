import { describe, expect, it } from "vitest";
import { tokenize } from "../src/internal/highlight.ts";

describe("highlight tokenizer", () => {
  it("stays linear on a hostile bash payload and joins back to the input", () => {
    const payload = "${".repeat(100_000);
    const start = performance.now();
    const tokens = tokenize(payload, "bash");
    const elapsed = performance.now() - start;
    expect(tokens.map((t) => t.text).join("")).toBe(payload);
    expect(elapsed).toBeLessThan(200);
  });

  it("stays linear on other pathological inputs", () => {
    for (const [language, payload] of [
      ["json", '"a"'.repeat(60_000)],
      ["ts", "1e".repeat(100_000)],
      ["bash", "${a".repeat(60_000)],
    ] as const) {
      const start = performance.now();
      const tokens = tokenize(payload, language);
      expect(performance.now() - start).toBeLessThan(200);
      expect(tokens.map((t) => t.text).join("")).toBe(payload);
    }
  });

  it("keeps real bash variables and numbers", () => {
    const tokens = tokenize("echo ${HOME} $USER 0x1F -3", "bash");
    expect(tokens.filter((t) => t.type === "variable").map((t) => t.text)).toEqual([
      "${HOME}",
      "$USER",
    ]);
    expect(tokenize("-3.5e2", "json")[0]).toEqual({ type: "number", text: "-3.5e2" });
  });
});
