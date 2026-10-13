import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/primitives/command/score.ts";
import { commandScore } from "../src/command-score.ts";

describe("commandScore", () => {
  it.each([
    ["Calendar", "cal", undefined, 0.989901],
    ["Calendar", "clndr", undefined, 0.004897785906513592],
    ["Open file", "of", undefined, 0.8909109000000001],
    ["Open file", "OF", undefined, 0.8909109000000001],
    ["new-file.ts", "nf", undefined, 0.891],
    ["Search emoji", "emj", undefined, 0.15131853],
    ["Save as", "sva", undefined, 0.15130339814700003],
    ["Settings", "zz", undefined, 0],
    ["Profile settings", "ps", ["account"], 0.8909109000000001],
    ["Profile", "acct", ["account"], 0.15254145884700002],
    ["aaa", "aa", undefined, 0.99],
    ["src/utils/index.ts", "sui", undefined, 0.6336],
  ])("%s / %s keeps the golden score", (value, search, keywords, expected) => {
    expect(commandScore(value, search, keywords)).toBeCloseTo(expected, 12);
  });

  it("matches everything for an empty search and nothing for an unmatched one", () => {
    expect(commandScore("anything", "")).toBe(1);
    expect(commandScore("abc", "abcd")).toBe(0);
  });

  it("ranks prefixes above scattered matches", () => {
    expect(commandScore("Calendar", "cal")).toBeGreaterThan(commandScore("Escalate", "cal"));
  });

  it("equals the React kit for random values and searches", () => {
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const alphabet = "abcdeAB -_./xyz";
    const word = (max: number) =>
      Array.from({ length: 1 + Math.floor(rand() * max) }, () =>
        alphabet.charAt(Math.floor(rand() * alphabet.length)),
      ).join("");
    for (let i = 0; i < 400; i++) {
      const value = word(18);
      const search = word(5);
      const keywords = rand() > 0.7 ? [word(6)] : undefined;
      expect(commandScore(value, search, keywords)).toBe(
        react.commandScore(value, search, keywords),
      );
    }
  });
});
