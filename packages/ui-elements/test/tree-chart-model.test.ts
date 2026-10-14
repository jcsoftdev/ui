import { describe, expect, it } from "vitest";
import type { TreeChartDatum, TreeChartNode, TreeModel } from "../src/internal/tree-model.ts";
import * as model from "../src/internal/tree-model.ts";
import * as tools from "../src/tree-chart/tree-chart-tools.ts";

const mine = { ...model, ...tools };

// The React kit's tree model, loaded by path at run time so the two can never drift apart.
const react = (await import("../../ui/src/charts/tree-chart/tree-model.ts")) as typeof mine;

const DATA: TreeChartDatum = {
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
const LOADED = new Map<string, readonly TreeChartDatum[]>([["root/Rita", [{ name: "Fetched" }]]]);

/** A model without parent cycles, comparable by value. */
const plain = (model: TreeModel) =>
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
      const other = b.nodes[i] as TreeChartNode;
      expect(mine.ancestorIds(node)).toEqual(react.ancestorIds(other));
      for (const mode of ["neutral", "depth", "branch"] as const)
        expect(mine.edgeColorOf(node, mode)).toBe(react.edgeColorOf(other, mode));
    });
  });
});

describe("tree model hardening", () => {
  it("keeps color syntax and drops anything that could leave the declaration", () => {
    for (const ok of [
      "red",
      "#0af",
      "#00aaff80",
      "rgb(0 0 0 / 50%)",
      "var(--accent)",
      "oklch(60% 0.2 30)",
    ])
      expect(model.safeColor(ok)).toBe(ok);
    for (const bad of [
      "red; background: url(//evil)",
      "url(//evil)",
      "red}[data-x]{display:none",
      "var(--a, url(x))",
      "expression(alert(1))",
      "red /* x */",
      "",
      42,
      null,
    ])
      expect(model.safeColor(bad)).toBeUndefined();
    const built = model.buildTreeModel({
      name: "Root",
      color: "red;position:fixed",
      children: [
        { name: "A", color: "#123456" },
        { name: "B", color: "url(x)" },
      ],
    });
    const [a, b] = built.root.children;
    expect(built.root.color).not.toContain(";");
    expect(a?.color).toBe("#123456");
    expect(b?.color).not.toContain("url");
  });

  it("turns a non-string name into text, so keys, search and initials never throw", () => {
    const data = {
      name: 7,
      children: [{ name: 8 }, { name: null }, { name: { toString: () => "obj" } }],
    };
    const built = model.buildTreeModel(data as never);
    expect(built.nodes.map((node) => node.name)).toEqual(["7", "8", "", "obj"]);
    expect(tools.searchTree(built, "8").map((node) => node.name)).toEqual(["8"]);
    expect(model.initials(built.root.name)).toBe("7");
  });

  it("walks a deep tree without recursion and ignores a node that is its own ancestor", () => {
    let deep: TreeChartDatum = { name: "leaf" };
    for (let i = 0; i < 20_000; i += 1) deep = { name: `n${i}`, children: [deep] };
    const built = model.buildTreeModel(deep);
    expect(built.nodes).toHaveLength(model.MAX_DEPTH + 1);
    expect(model.subtreeSize(built.root)).toBe(model.MAX_DEPTH);
    expect(() =>
      model.visibleTree(built.root, new Set(), () => ({ width: 1, height: 1 })),
    ).not.toThrow();

    const loop: { name: string; children: unknown[] } = { name: "loop", children: [] };
    loop.children.push(loop, { name: "kid", children: [loop] });
    const cyclic = model.buildTreeModel(loop as never);
    expect(cyclic.nodes.map((node) => node.id)).toEqual(["root", "root/kid"]);
    expect(() => tools.groupLeaves(loop as never, 2)).not.toThrow();
  });
});
