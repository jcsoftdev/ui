import { describe, expect, it } from "vitest";
import { EMOJI_CATEGORIES as reactData } from "../../ui/src/forms/emoji-picker/emoji-data.ts";
import * as reactModel from "../../ui/src/forms/emoji-picker/model.ts";
import { EMOJI_CATEGORIES as elementsData } from "../../ui-elements/src/emoji-picker/emoji-data.ts";
import { gridMove, searchEmojis } from "../src/emoji.ts";
import { graceArea, isPointInPolygon } from "../src/hover-intent.ts";

describe("emoji (parity with the React emoji picker model)", () => {
  it("ships the same dataset as the React kit", () => {
    expect(elementsData).toEqual(reactData);
  });

  const queries = [
    "",
    "  ",
    "guiño",
    "GUINO",
    "cara feliz",
    "sonrisa",
    "corazon",
    "xyz",
    "pulgar arriba",
  ];
  it.each(queries)("searches %j like the React kit", (query) => {
    expect(searchEmojis(reactData, query)).toEqual(reactModel.searchEmojis(reactData, query));
  });

  it("returns an emoji listed in two categories once", () => {
    const entry = { emoji: "⭐", name: "estrella" };
    const found = searchEmojis(
      [
        { id: "a", label: "A", icon: "a", emojis: [entry] },
        {
          id: "b",
          label: "B",
          icon: "b",
          emojis: [entry, { emoji: "🌟", name: "estrella brillante" }],
        },
      ],
      "estrella",
    );
    expect(found.map((item) => item.emoji)).toEqual(["⭐", "🌟"]);
  });

  const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End", "Tab"];
  it("moves in the grid like the React kit, including short last rows and empty grids", () => {
    for (const count of [0, 1, 7, 8, 20, 23])
      for (const columns of [1, 3, 8])
        for (let index = 0; index < Math.max(1, count); index++)
          for (const key of keys)
            expect(gridMove(key, index, columns, count)).toBe(
              reactModel.gridMove(key, index, columns, count),
            );
  });
});

describe("grace area on the vertical axis", () => {
  const trigger = { left: 100, right: 160, top: 40, bottom: 60 };
  const below = { left: 90, right: 380, top: 70, bottom: 200 };

  it("covers the gap between a trigger and a card below it", () => {
    const area = graceArea({ x: 130, y: 60 }, "bottom", below);
    expect(area).toEqual([
      { x: 130, y: 55 },
      { x: 90, y: 70 },
      { x: 90, y: 200 },
      { x: 380, y: 200 },
      { x: 380, y: 70 },
    ]);
    expect(isPointInPolygon({ x: 135, y: 66 }, area)).toBe(true);
    expect(isPointInPolygon({ x: 130, y: 120 }, area)).toBe(true);
    expect(isPointInPolygon({ x: 20, y: 66 }, area)).toBe(false);
    expect(isPointInPolygon({ x: 130, y: 20 }, area)).toBe(false);
    expect(trigger.bottom).toBeLessThan(below.top);
  });

  it("mirrors for a card above, and leaves the left and right areas untouched", () => {
    const above = { left: 90, right: 380, top: -150, bottom: 30 };
    expect(graceArea({ x: 130, y: 40 }, "top", above)).toEqual([
      { x: 130, y: 45 },
      { x: 90, y: 30 },
      { x: 90, y: -150 },
      { x: 380, y: -150 },
      { x: 380, y: 30 },
    ]);
    expect(
      graceArea({ x: 190, y: 100 }, "right", { left: 200, right: 400, top: 50, bottom: 250 })[0],
    ).toEqual({
      x: 185,
      y: 100,
    });
  });
});
