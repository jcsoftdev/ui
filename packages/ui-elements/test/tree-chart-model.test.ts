import { describe, expect, it } from "vitest";
import * as mine from "../src/internal/tree-model.ts";

// The React kit's tree model, loaded by path at run time so the two can never drift apart.
const react = (await import("../../ui/src/charts/tree-chart/tree-model.ts")) as typeof mine;

const DATA: mine.TreeChartDatum = {
  name: "Ana Rojas",
  subtitle: "CEO",
  children: [
    {
      name: "Luis Paredes",
      collapsed: true,
      badge: "Lima",
      children: [
        { name: "Mia" },
        { name: "Mia" },
        { name: "Noa", id: "n" },
        { name: "Lazy", lazy: true },
      ],
    },
    {
      name: "Kevin Salas",
      color: "red",
      children: [{ name: "Óscar Álvarez", subtitle: "Ingeniería" }],
    },
    { name: "Rita", lazy: true, childCount: 3 },
    { name: "Solo" },
  ],
};
const LOADED = new Map<string, readonly mine.TreeChartDatum[]>([
  ["root/Rita", [{ name: "Fetched" }]],
]);

/** A model without parent cycles, comparable by value. */
const plain = (model: mine.TreeModel) =>
  model.nodes.map(({ parent, children, data, ...node }) => ({
    ...node,
    parent: parent?.id ?? null,
    children: children.map((child) => child.id),
    name: data.name,
  }));

describe("tree model parity with the React kit", () => {
  for (const [label, loaded] of [
    ["without lazy children", undefined],
    ["with fetched children", LOADED],
  ] as const) {
    it(`builds the same nodes, ids and colors ${label}`, () => {
      expect(plain(mine.buildTreeModel(DATA, loaded))).toEqual(
        plain(react.buildTreeModel(DATA, loaded)),
      );
    });
  }

  it("collapses, sizes and folds like the original", () => {
    const [a, b] = [mine.buildTreeModel(DATA), react.buildTreeModel(DATA)];
    for (const depth of [0, 1, 2, Number.POSITIVE_INFINITY]) {
      expect([...mine.initialCollapsed(a, depth)]).toEqual([...react.initialCollapsed(b, depth)]);
    }
    const collapsed = mine.initialCollapsed(a, 1);
    const size = () => ({ width: 100, height: 40 });
    expect(mine.visibleTree(a.root, collapsed, size)).toEqual(
      react.visibleTree(b.root, collapsed, size),
    );
    expect(a.nodes.map(mine.subtreeSize)).toEqual(b.nodes.map(react.subtreeSize));
    for (const min of [1, 2, 3]) {
      const label = (count: number) => `${count} more`;
      expect(mine.groupLeaves(DATA, min, label)).toEqual(react.groupLeaves(DATA, min, label));
    }
  });

  it("searches, folds text, names initials and colors edges like the original", () => {
    const [a, b] = [mine.buildTreeModel(DATA, LOADED), react.buildTreeModel(DATA, LOADED)];
    for (const query of ["", "  ", "mia", "oscar alvarez", "ingenieria", "lima ana", "zzz"]) {
      expect(mine.searchTree(a, query).map((node) => node.id)).toEqual(
        react.searchTree(b, query).map((node) => node.id),
      );
    }
    expect(mine.foldText("Ñandú ÁÉ")).toBe(react.foldText("Ñandú ÁÉ"));
    for (const name of ["Ana Rojas", "kevin", "  ", "a b c", "Óscar Álvarez"])
      expect(mine.initials(name)).toBe(react.initials(name));
    a.nodes.forEach((node, i) => {
      const other = b.nodes[i] as mine.TreeChartNode;
      expect(mine.ancestorIds(node)).toEqual(react.ancestorIds(other));
      for (const mode of ["neutral", "depth", "branch"] as const)
        expect(mine.edgeColorOf(node, mode)).toBe(react.edgeColorOf(other, mode));
    });
  });
});
