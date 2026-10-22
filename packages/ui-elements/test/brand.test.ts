// The brand generator is a port: pin its output to the React kit's sources, value for value.
import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/brand/generate.ts";
import * as mine from "../src/internal/e15-brand.ts";

const CASES: react.MarkOptions[] = [
  { name: "Barbería Don Lucho", tagline: "Corte y navaja desde 1998" },
  {
    name: "Acme",
    shape: "badge",
    monogram: "initials",
    initialsCount: 3,
    fill: "gradient",
    seed: 7,
  },
  {
    name: "Ñandú & Co",
    shape: "ribbon",
    layout: "stacked",
    palette: "menta",
    fill: "outline",
    ring: true,
  },
  { name: "X", shape: "none", layout: "icon", glyph: "mustache", seed: 41 },
  {
    name: "Custom",
    palette: { id: "custom", label: "c", primary: "#2f6f5e", secondary: "#e3b04b", ink: "#10211c" },
    wordmark: { weight: 800, tracking: 0.12, uppercase: false },
    background: "#16161b",
    wordmarkColor: "#f4f4f6",
  },
];

describe("brand generator parity with the React kit", () => {
  it.each(CASES)("generateMark and serializeMark match for %o", (options) => {
    expect(mine.generateMark(options)).toEqual(react.generateMark(options));
    expect(mine.serializeMark(mine.generateMark(options))).toBe(
      react.serializeMark(react.generateMark(options)),
    );
  });

  it("variations match page for page", () => {
    for (const page of [0, 1, 5])
      expect(mine.generateVariations(CASES[0]!, 12, page)).toEqual(
        react.generateVariations(CASES[0]!, 12, page),
      );
  });
});
