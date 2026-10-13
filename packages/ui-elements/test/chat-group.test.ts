import { describe, expect, it } from "vitest";
import { groupByDate as reactGroupByDate } from "../../ui/src/ai/chat-list/group.ts";
import { groupByDate, groupOf } from "../src/internal/chat-group.ts";

const NOW = new Date(2026, 2, 15, 12);
const at = (daysBack: number, hour = 9) => new Date(2026, 2, 15 - daysBack, hour);

describe("chat-group parity with the React kit", () => {
  const items = [
    { id: "a", updatedAt: at(0, 8) },
    { id: "b", updatedAt: at(0, 11) },
    { id: "c", updatedAt: at(1) },
    { id: "d", updatedAt: at(2) },
    { id: "e", updatedAt: at(7) },
    { id: "f", updatedAt: at(8) },
    { id: "g", updatedAt: at(30) },
    { id: "h", updatedAt: at(31) },
    { id: "i", updatedAt: at(400).toISOString() },
    { id: "j", updatedAt: at(-3) },
  ];

  it("buckets and sorts exactly as the React implementation", () => {
    expect(groupByDate(items, NOW)).toEqual(reactGroupByDate(items, NOW));
  });

  it("golden boundaries", () => {
    expect([0, 1, 2, 7, 8, 30, 31].map((back) => groupOf(at(back), NOW))).toEqual([
      "today",
      "yesterday",
      "week",
      "week",
      "month",
      "month",
      "older",
    ]);
  });

  it("overrides group labels", () => {
    expect(groupByDate(items.slice(0, 1), NOW, { today: "Today" })[0]?.label).toBe("Today");
  });
});
