import { describe, expect, it } from "vitest";
import * as reactVirtual from "../../ui/src/containers/data-grid/virtual.ts";
import * as reactTree from "../../ui/src/containers/file-tree/model.ts";
import * as reactKanban from "../../ui/src/containers/kanban/model.ts";
import { dropIndex, keyboardTarget, moveItem, type SortableList } from "../src/sortable.ts";
import {
  ancestorsOf,
  branchIds,
  flattenTree,
  type TreeKey,
  treeStep,
  treeTypeahead,
} from "../src/tree.ts";
import * as core from "../src/virtual-list.ts";

const nodes = [
  {
    id: "src",
    name: "src",
    children: [
      { id: "a", name: "app.ts" },
      { id: "lib", name: "lib", children: [{ id: "u", name: "util.ts" }] },
    ],
  },
  { id: "readme", name: "README.md" },
];

describe("tree (parity with the React file-tree model)", () => {
  const keys: TreeKey[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
  for (const open of [[], ["src"], ["src", "lib"]]) {
    it(`matches for expanded=${JSON.stringify(open)}`, () => {
      const set = new Set(open);
      const rows = flattenTree(nodes, set);
      const ref = reactTree.flattenTree(nodes, set);
      expect(
        rows.map((r) => [r.node.id, r.depth, r.parentId, r.position, r.setSize, r.expanded]),
      ).toEqual(
        ref.map((r) => [r.node.id, r.depth, r.parentId, r.position, r.setSize, r.expanded]),
      );
      for (const row of rows) {
        for (const key of keys) {
          expect(treeStep(rows, row.node.id, key)).toEqual(
            reactTree.treeStep(ref, row.node.id, key),
          );
        }
        expect(treeTypeahead(rows, row.node.id, "u")).toBe(
          reactTree.typeahead(ref, row.node.id, "u"),
        );
      }
    });
  }
  it("lists branches and ancestors", () => {
    expect(branchIds(nodes)).toEqual(reactTree.folderIds(nodes));
    expect(ancestorsOf(nodes, "u")).toEqual(["src", "lib"]);
  });
});

describe("virtual-list (parity with the React window math)", () => {
  it("fixed window and reveal match", () => {
    for (const scrollTop of [0, 95, 1000, 99999]) {
      const input = { count: 500, rowHeight: 32, viewportHeight: 300, scrollTop };
      expect(core.computeVirtualWindow(input)).toEqual(reactVirtual.computeVirtualWindow(input));
      expect(core.scrollTopToReveal(40, 32, 300, scrollTop)).toBe(
        reactVirtual.scrollTopToReveal(40, 32, 300, scrollTop),
      );
    }
    expect(core.pageStep(32, 300)).toBe(reactVirtual.pageStep(32, 300));
  });
  it("variable window matches and covers every row", () => {
    const heights = Array.from({ length: 200 }, (_, i) => 20 + (i % 7) * 9);
    for (const scrollTop of [0, 777, 3000]) {
      const input = { heights, viewportHeight: 400, scrollTop };
      expect(core.computeVariableWindow(input)).toEqual(reactVirtual.computeVariableWindow(input));
    }
  });
  it("renders nothing for an empty list", () => {
    expect(
      core.computeVirtualWindow({ count: 0, rowHeight: 32, viewportHeight: 300, scrollTop: 0 }).end,
    ).toBe(0);
  });
});

describe("sortable (parity with the React kanban model)", () => {
  const board = [
    { id: "todo", limit: 2, cards: ["a", "b"] },
    { id: "doing", cards: ["c"] },
    { id: "done", cards: [] as string[] },
  ];
  const lists: SortableList<string>[] = board.map(({ cards, ...rest }) => ({
    ...rest,
    items: cards,
  }));
  const refBoard = board.map(({ id, limit, cards }) => ({
    id,
    title: id,
    ...(limit === undefined ? {} : { wipLimit: limit }),
    cards: cards.map((c) => ({ id: c, title: c })),
  }));
  const id = (x: string) => x;
  const flat = (l: readonly SortableList<string>[]) => l.map((x) => [x.id, [...x.items]]);
  const refFlat = (b: typeof refBoard) => b.map((x) => [x.id, x.cards.map((c) => c.id)]);

  it("moves like the kanban, including clamping, no-ops and limits", () => {
    const cases: [string, string, number, boolean][] = [
      ["a", "todo", 1, false],
      ["a", "doing", 0, false],
      ["c", "todo", 5, true],
      ["a", "done", 0, true],
      ["b", "todo", 1, false],
      ["zzz", "todo", 0, false],
    ];
    for (const [card, to, at, enforceLimit] of cases) {
      const got = moveItem(lists, card, to, at, id, { enforceLimit });
      const ref = reactKanban.moveCard(refBoard, card, to, at, { enforceLimit });
      expect(got ? flat(got.lists) : null).toEqual(ref ? refFlat(ref.columns) : null);
      expect(got?.move ?? null).toEqual(
        (ref && {
          itemId: ref.move.cardId,
          fromListId: ref.move.fromColumnId,
          fromIndex: ref.move.fromIndex,
          toListId: ref.move.toColumnId,
          toIndex: ref.move.toIndex,
        }) ??
          null,
      );
    }
  });
  it("keyboard targets and drop index match", () => {
    for (const card of ["a", "b", "c"]) {
      for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const) {
        const got = keyboardTarget(lists, card, key, id);
        const ref = reactKanban.keyboardTarget(refBoard, card, key);
        expect(got && { columnId: got.listId, index: got.index }).toEqual(ref);
      }
    }
    expect(dropIndex([10, 30, 50], 35)).toBe(reactKanban.dropIndex([10, 30, 50], 35));
  });
});
