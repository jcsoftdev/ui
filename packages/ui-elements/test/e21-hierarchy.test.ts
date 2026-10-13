// The hierarchy helpers against the React kit's `core/hierarchy-chart`, value for value.
import { buildHierarchy, descendants } from "@jcsoftdev/ui-core/chart/hierarchy";
import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import { describe, expect, it } from "vitest";
import {
  branchColor,
  describeNode,
  fitLabel,
  HIERARCHY_STRINGS,
  hierarchyNav,
  levelStrength,
  NAV_DOWN,
  NAV_RIGHT,
  nodePath,
  nodeTooltipRows,
} from "../src/internal/e21-hierarchy-model.ts";

const tree = buildHierarchy({
  name: "Company",
  children: [
    {
      name: "Engineering",
      children: [
        { name: "Platform", value: 400 },
        { name: "Mobile", value: 300 },
      ],
    },
    { name: "Sales", value: 250, color: "red" },
    { name: "Support", value: 120 },
  ],
});
const format = (v: number) => `${v}`;

describe("hierarchy helpers match the React kit", async () => {
  const reactPath = new URL("../../ui/src/charts/core/hierarchy-chart.tsx", import.meta.url)
    .pathname;
  // biome-ignore lint/suspicious/noExplicitAny: the React module is loaded by path at run time
  const react: any = await import(/* @vite-ignore */ reactPath);
  const nodes = descendants(tree);

  it("branchColor, levelStrength, nodePath, fitLabel and describeNode", () => {
    for (const node of nodes) {
      expect(branchColor(node, tree, seriesColor)).toBe(react.branchColor(node, tree));
      expect(levelStrength(node, tree)).toBe(react.levelStrength(node, tree));
      expect(nodePath(node, tree)).toBe(react.nodePath(node, tree));
      expect(describeNode(node, tree, format)).toBe(react.describeNode(node, tree, format));
    }
    for (const w of [10, 40, 80, 200])
      expect(fitLabel("Engineering", w)).toBe(react.fitLabel("Engineering", w));
  });

  it("tooltip rows", () => {
    const labels = { ...react.DEFAULT_HIERARCHY_LABELS, drillHint: HIERARCHY_STRINGS.drillHint };
    for (const node of nodes.slice(1))
      expect(nodeTooltipRows(node, tree, format, HIERARCHY_STRINGS, "c")).toEqual(
        react.nodeTooltipRows(node, tree, format, labels, "c"),
      );
  });
});

describe("hierarchyNav", () => {
  const visible = nodes();
  function nodes() {
    return descendants(tree).slice(1);
  }
  const at = (name: string) => visible.findIndex((n) => n.name === name);
  const go = (
    from: string,
    intent: Parameters<typeof hierarchyNav>[4],
    keys = NAV_DOWN,
    out = () => {},
  ) => visible[hierarchyNav(visible, tree, keys, at(from), intent, out) ?? -1]?.name;

  it("moves across siblings, to the first child and to the parent", () => {
    expect(go("Engineering", "right")).toBe("Sales");
    expect(go("Sales", "left")).toBe("Engineering");
    expect(go("Support", "right")).toBeUndefined();
    expect(go("Engineering", "down")).toBe("Platform");
    expect(go("Platform", "up")).toBe("Engineering");
    expect(go("Mobile", "home")).toBe("Platform");
    expect(go("Platform", "end")).toBe("Mobile");
    expect(go("Engineering", "right", NAV_RIGHT)).toBe("Platform");
    expect(go("Engineering", "down", NAV_RIGHT)).toBe("Sales");
    expect(go("Engineering", "child", NAV_RIGHT)).toBe("Platform");
  });

  it("asks the chart to zoom out when parent leaves the open node", () => {
    const child = buildHierarchy({
      name: "r",
      children: [{ name: "a", children: [{ name: "b", value: 1 }] }],
    });
    const open = child.children[0];
    if (!open) throw new Error("no node");
    let out = 0;
    const list = descendants(open).slice(1);
    expect(hierarchyNav(list, open, NAV_DOWN, 0, "up", () => out++)).toBeUndefined();
    expect(out).toBe(1);
  });
});
