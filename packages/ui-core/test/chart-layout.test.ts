// The layout maths is a port: these pin each entry to the React kit's sources, value for value,
// with seeded random inputs next to hand-picked edge cases.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as reactChord from "../../ui/src/charts/core/chord.ts";
import * as reactHierarchy from "../../ui/src/charts/core/hierarchy.ts";
import * as reactPolar from "../../ui/src/charts/core/polar.ts";
import * as reactSankey from "../../ui/src/charts/core/sankey.ts";
import * as reactTreeFit from "../../ui/src/charts/core/tree-fit.ts";
import * as reactTree from "../../ui/src/charts/core/tree-layout.ts";
import * as reactTreeRadial from "../../ui/src/charts/core/tree-radial.ts";
import * as reactUnits from "../../ui/src/charts/core/units.ts";
import { fitCenterText as reactFitCenterText } from "../../ui/src/charts/donut-chart/center-fit.ts";
import * as reactGauge from "../../ui/src/charts/gauge-chart/gauge-layout.ts";
import * as chord from "../src/chart/chord.ts";
import * as dendrogram from "../src/chart/dendrogram.ts";
import * as funnel from "../src/chart/funnel.ts";
import * as gauge from "../src/chart/gauge.ts";
import * as hierarchyModel from "../src/chart/hierarchy.ts";
import * as parliament from "../src/chart/parliament.ts";
import * as partition from "../src/chart/partition.ts";
import * as polar from "../src/chart/polar.ts";
import * as sankey from "../src/chart/sankey.ts";
import * as tree from "../src/chart/tree.ts";
import * as treeEdge from "../src/chart/tree-edge.ts";
import * as treeFit from "../src/chart/tree-fit.ts";
import * as treeNav from "../src/chart/tree-nav.ts";
import * as treeRadial from "../src/chart/tree-radial.ts";
import * as treemap from "../src/chart/treemap.ts";

const TAU = Math.PI * 2;
// Each React module became several independent entries; the tests read them as one surface.
const hierarchy = {
  ...hierarchyModel,
  ...treemap,
  ...partition,
  ...tree,
  ...treeEdge,
  ...treeFit,
  ...treeNav,
  ...treeRadial,
  ...dendrogram,
};

// niceRadarMax lives inside the radar component, whose import would drag the whole React kit
// into this package's typecheck. Its source is lifted from the file instead, so the parity
// still runs against the code React ships.
const reactNiceRadarMax = (() => {
  const source = readFileSync(
    new URL("../../ui/src/charts/radar-chart/radar-chart.tsx", import.meta.url),
    "utf8",
  );
  const body =
    /export function niceRadarMax\(value: number, levels: number\): number \{([\s\S]*?)\n\}\n/.exec(
      source,
    )?.[1];
  if (!body) throw new Error("niceRadarMax not found in the React radar chart");
  return new Function("value", "levels", body.replace(/: number/g, "")) as (
    value: number,
    levels: number,
  ) => number;
})();
let seed = 11;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
const times = <T>(n: number, make: (i: number) => T) =>
  Array.from({ length: n }, (_, i) => make(i));
const values = (n: number) =>
  times(n, () => pick([0, -3, Number.NaN, between(0.1, 500), between(1, 20)]));

describe("polar parity", () => {
  it("angles, slices and slots", () => {
    expect(polar.TAU).toBe(reactPolar.TAU);
    for (let i = 0; i < 300; i++) {
      const angle = between(-30, 30);
      const [cx, cy, r] = [between(-50, 50), between(-50, 50), between(0, 200)];
      expect(polar.polarPoint(cx, cy, r, angle)).toEqual(reactPolar.polarPoint(cx, cy, r, angle));
      expect(polar.normalizeAngle(angle)).toBe(reactPolar.normalizeAngle(angle));
      expect(polar.angleOf(cx, cy, r, angle)).toBe(reactPolar.angleOf(cx, cy, r, angle));
      expect(polar.degToRad(angle)).toBe(reactPolar.degToRad(angle));
      expect(polar.radToDeg(angle)).toBe(reactPolar.radToDeg(angle));
      const count = int(0, 9);
      expect(polar.slotAt(angle, count, r)).toBe(reactPolar.slotAt(angle, count, r));
      const options = {
        startAngle: between(-3, 3),
        endAngle: pick([undefined, between(3, 9), polar.TAU]),
        padAngle: pick([0, between(0, 0.3)]),
      };
      const data = values(int(0, 9));
      expect(polar.sliceAngles(data, options)).toEqual(reactPolar.sliceAngles(data, options));
    }
    expect(polar.sliceAngles([5])).toEqual(reactPolar.sliceAngles([5]));
    expect(polar.sliceAngles([])).toEqual(reactPolar.sliceAngles([]));
  });

  it("arc paths, arc lines and label spreading", () => {
    for (let i = 0; i < 400; i++) {
      const start = between(-3, 3);
      const spec = {
        cx: between(0, 300),
        cy: between(0, 300),
        innerRadius: pick([0, between(0, 80)]),
        outerRadius: between(0, 140),
        startAngle: start,
        endAngle: start + pick([between(-0.5, 7), polar.TAU, 1e-7, between(0.01, 0.4)]),
        cornerRadius: pick([undefined, 0, between(0, 30)]),
      };
      expect(polar.arcPath(spec)).toBe(reactPolar.arcPath(spec));
      const line: [number, number, number, number, number] = [
        spec.cx,
        spec.cy,
        spec.outerRadius,
        spec.startAngle,
        spec.endAngle,
      ];
      expect(polar.arcLine(...line)).toBe(reactPolar.arcLine(...line));
      const boxes = times(int(0, 12), () => ({ y: between(0, 300), height: between(8, 30) }));
      const range = [0, between(40, 400)] as const;
      expect(polar.spreadLabels(boxes, ...range)).toEqual(reactPolar.spreadLabels(boxes, ...range));
      expect(polar.spreadLabels(boxes, ...range, 5)).toEqual(
        reactPolar.spreadLabels(boxes, ...range, 5),
      );
    }
  });

  it("funnel stages", () => {
    for (let i = 0; i < 200; i++) {
      const options = {
        length: between(50, 600),
        thickness: between(50, 400),
        gap: pick([0, between(0, 12)]),
        variant: pick(["funnel", "pyramid"] as const),
        neck: pick([undefined, between(0.2, 1)]),
        tapered: pick([true, false, undefined]),
      };
      const data = values(int(0, 8));
      expect(funnel.funnelStages(data, options)).toEqual(reactPolar.funnelStages(data, options));
    }
  });

  it("donut centre text and gauge layout", () => {
    for (let i = 0; i < 300; i++) {
      const args = [between(10, 160), int(1, 12), int(0, 30), rand() > 0.5] as const;
      expect(polar.fitCenterText(...args)).toEqual(reactFitCenterText(...args));
      expect(polar.fitCenterText(...args, 28)).toEqual(reactFitCenterText(...args, 28));
      const input = {
        width: between(80, 600),
        height: between(60, 500),
        variant: pick(["semi", "three-quarter"] as const),
        mode: pick(["progress", "needle"] as const),
        thickness: between(4, 40),
        endLabels: rand() > 0.5,
        customCenter: rand() > 0.7,
        caption: rand() > 0.5,
        bandLabel: rand() > 0.5,
        valueChars: int(0, 14),
      };
      expect(gauge.layoutGauge(input)).toEqual(reactGauge.layoutGauge(input));
      const ticks = int(0, 6);
      expect(gauge.showEndLabels(input.endLabels, ticks)).toBe(
        reactGauge.showEndLabels(input.endLabels, ticks),
      );
    }
  });

  it("radar maximum", () => {
    for (let i = 0; i < 300; i++) {
      const value = pick([0, -4, between(0, 1e5), between(0, 3)]);
      const levels = int(1, 8);
      expect(polar.niceRadarMax(value, levels)).toBe(reactNiceRadarMax(value, levels));
    }
  });

  it("parliament seats", () => {
    for (let i = 0; i < 120; i++) {
      const total = pick([0, 1, 2, int(3, 600)]);
      const options = {
        rows: pick([undefined, int(1, 12)]),
        innerRatio: pick([undefined, between(0, 1)]),
      };
      expect(parliament.parliamentLayout(total, options)).toEqual(
        reactUnits.parliamentLayout(total, options),
      );
      expect(parliament.parliamentRows(total, options.innerRatio)).toBe(
        reactUnits.parliamentRows(total, options.innerRatio),
      );
      const weights = values(int(0, 8));
      expect(parliament.largestRemainder(weights, total)).toEqual(
        reactUnits.largestRemainder(weights, total),
      );
      const counts = times(int(0, 6), () => int(0, 9));
      expect(parliament.assignUnits(counts)).toEqual(reactUnits.assignUnits(counts));
    }
  });
});

interface Datum {
  id?: string;
  name: string;
  value?: number;
  children?: Datum[];
}

const randomTree = (depth: number, label = "n"): Datum => {
  const children =
    depth > 0 && rand() > 0.15
      ? times(int(1, 5), (i) => randomTree(depth - 1, `${label}${i}`))
      : undefined;
  return {
    name: label,
    id: pick([undefined, `id${label}`]),
    value: children ? undefined : pick([0, -1, Number.NaN, between(1, 100), int(1, 9)]),
    children,
  };
};

/** Nodes link to their parent, which `toEqual` handles, but ids keep failures readable. */
const flat = (node: hierarchyModel.HierarchyNode): unknown =>
  hierarchy.descendants(node).map((n) => ({
    ...n,
    parent: n.parent?.id,
    children: n.children.map((c) => c.id),
    data: undefined,
  }));

describe("hierarchy parity", () => {
  it("builds the same nodes and traversals", () => {
    for (let i = 0; i < 80; i++) {
      const datum = randomTree(int(0, 4));
      const sort = pick([true, false, undefined]);
      const ours = hierarchy.buildHierarchy(datum, { sort });
      const theirs = reactHierarchy.buildHierarchy(datum, { sort });
      expect(flat(ours)).toEqual(flat(theirs as never));
      const id = pick(hierarchy.descendants(ours)).id;
      expect(hierarchy.findNode(ours, id)?.id).toBe(reactHierarchy.findNode(theirs, id)?.id);
      expect(hierarchy.heightOf(ours)).toBe(reactHierarchy.heightOf(theirs));
      expect(hierarchy.ancestors(hierarchy.findNode(ours, id) as never).map((n) => n.id)).toEqual(
        reactHierarchy.ancestors(reactHierarchy.findNode(theirs, id) as never).map((n) => n.id),
      );
    }
  });

  it("squarify, treemap, partition and sector paths", () => {
    for (let i = 0; i < 150; i++) {
      const rect = {
        x0: between(0, 20),
        y0: between(0, 20),
        x1: between(40, 700),
        y1: between(40, 500),
      };
      const data = values(int(0, 14));
      expect(hierarchy.squarify(data, rect)).toEqual(reactHierarchy.squarify(data, rect));
      expect(hierarchy.aspectRatio(rect)).toBe(reactHierarchy.aspectRatio(rect));
      const datum = randomTree(int(1, 4));
      const ours = hierarchy.buildHierarchy(datum);
      const theirs = reactHierarchy.buildHierarchy(datum);
      const options = pick([
        undefined,
        {
          maxDepth: int(1, 4),
          gap: between(0, 6),
          padding: between(0, 8),
          headerHeight: between(10, 30),
          minGroupSize: between(20, 120),
        },
      ]);
      const cells = (layout: treemap.TreemapCell[]) =>
        layout.map((cell) => ({ ...cell, node: cell.node.id }));
      expect(cells(hierarchy.treemapLayout(ours, rect, options))).toEqual(
        cells(reactHierarchy.treemapLayout(theirs, rect, options)),
      );
      expect(hierarchy.partitionLayout(ours)).toEqual(reactHierarchy.partitionLayout(theirs));

      const view = { x0: between(0, 0.4), x1: between(0.5, 1), depth: int(0, 3) };
      const span = { x0: between(0, 0.5), x1: between(0.5, 1) };
      expect(hierarchy.projectSpan(span, 2, view)).toEqual(
        reactHierarchy.projectSpan(span, 2, view),
      );
      const t = rand();
      expect(hierarchy.interpolateView(view, { x0: 0, x1: 1, depth: 0 }, t)).toEqual(
        reactHierarchy.interpolateView(view, { x0: 0, x1: 1, depth: 0 }, t),
      );
      const sector = [
        between(0, 300),
        between(0, 300),
        pick([0, between(0, 60)]),
        between(0, 140),
        between(-3, 3),
        pick([between(-3, 9), TAU]),
        pick([0, between(0, 0.3)]),
      ] as const;
      expect(hierarchy.sectorPath(...sector)).toBe(reactHierarchy.sectorPath(...sector));
    }
  });

  const randomBoxes = (depth: number, label = "t"): reactTree.TreeLayoutInput => ({
    id: label,
    width: between(40, 160),
    height: between(20, 90),
    children:
      depth > 0 && rand() > 0.2
        ? times(int(1, 4), (i) => randomBoxes(depth - 1, `${label}.${i}`))
        : undefined,
  });

  it("tidy, radial and dendrogram tree layouts with fitting and edges", () => {
    const directions = ["top", "bottom", "left", "right"] as const;
    const styles = ["curved", "step", "straight"] as const;
    for (let i = 0; i < 120; i++) {
      const root = randomBoxes(int(0, 4));
      const direction = pick(directions);
      const options = {
        direction,
        siblingGap: pick([undefined, between(0, 30)]),
        levelGap: pick([undefined, between(10, 90)]),
      };
      const tidy = hierarchy.treeLayout(root, options);
      expect(tidy).toEqual(reactTree.treeLayout(root, options));
      expect(hierarchy.dendrogramLayout(root, options)).toEqual(
        reactTreeRadial.dendrogramLayout(root, options),
      );
      const radialOptions = pick([
        undefined,
        {
          levelGap: between(40, 140),
          siblingGap: between(0, 20),
          startAngle: between(-1, 1),
          sweep: pick([TAU, between(1, 5)]),
        },
      ]);
      const radial = hierarchy.radialTreeLayout(root, radialOptions);
      expect(radial).toEqual(reactTreeRadial.radialTreeLayout(root, radialOptions));

      const fitOptions = pick([
        undefined,
        {
          inset: between(0, 40),
          padding: between(0, 30),
          mode: pick(["contain", "readable", "auto"] as const),
          centerRoot: rand() > 0.5,
          minReadable: between(0.3, 0.9),
        },
      ]);
      const [w, h] = [between(200, 900), between(150, 700)];
      expect(hierarchy.treeFitView(tidy, w, h, direction, fitOptions)).toEqual(
        reactTreeFit.treeFitView(tidy, w, h, direction, fitOptions),
      );
      expect(hierarchy.treeFitView(radial, w, h, direction, fitOptions)).toEqual(
        reactTreeFit.treeFitView(radial, w, h, direction, fitOptions),
      );

      const [parent, child] = [pick(tidy.nodes), pick(tidy.nodes)];
      const style = pick(styles);
      const radius = pick([undefined, 3, 14]);
      expect(hierarchy.treeEdgePath(parent, child, direction, style, radius)).toBe(
        reactTree.treeEdgePath(parent, child, direction, style, radius),
      );
      const center = radial.center as { x: number; y: number };
      const [from, to] = [pick(radial.nodes), pick(radial.nodes)];
      expect(hierarchy.radialEdgePath(from, to, center, style)).toBe(
        reactTreeRadial.radialEdgePath(from, to, center, style),
      );
      expect(hierarchy.toPolar(from, center)).toEqual(reactTreeRadial.toPolar(from, center));

      const id = pick(tidy.nodes).id;
      expect(hierarchy.treePathToRoot(tidy.nodes, id)).toEqual(
        reactTree.treePathToRoot(tidy.nodes, id),
      );
      for (const move of ["parent", "child", "previous", "next"] as const)
        expect(hierarchy.treeNeighbor(tidy.nodes, id, move)).toBe(
          reactTree.treeNeighbor(tidy.nodes, id, move),
        );
      for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"])
        expect(hierarchy.treeKeyMove(key, direction)).toBe(reactTree.treeKeyMove(key, direction));
    }
  });
});

describe("sankey parity", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const randomGraph = () => {
    const nodes = ids.slice(0, int(2, 8)).map((id) => ({
      id,
      name: id.toUpperCase(),
      column: pick([undefined, undefined, int(0, 3)]),
    }));
    const links = times(int(0, 18), () => ({
      source: pick([...nodes.map((n) => n.id), "ghost"]),
      target: pick([...nodes.map((n) => n.id), "ghost"]),
      value: pick([between(1, 100), 0, -2, Number.NaN, int(1, 9)]),
    }));
    return { nodes, links };
  };

  it("lays out random graphs, cycles and invalid links alike", () => {
    for (let i = 0; i < 200; i++) {
      const { nodes, links } = randomGraph();
      const options = {
        width: between(200, 900),
        height: between(120, 600),
        nodeWidth: pick([undefined, between(4, 24)]),
        nodePadding: pick([undefined, between(2, 24)]),
        iterations: pick([undefined, 0, int(1, 12)]),
        align: pick([undefined, "justify", "left"] as const),
        relax: pick([undefined, true, false]),
      };
      const ours = sankey.sankeyLayout(nodes, links, options);
      const theirs = reactSankey.sankeyLayout(nodes, links, options);
      // Nodes and links point at each other; compare them by id.
      const plain = (graph: sankey.SankeyGraph) => ({
        ...graph,
        nodes: graph.nodes.map((n) => ({
          ...n,
          incoming: n.incoming.map((l) => l.id),
          outgoing: n.outgoing.map((l) => l.id),
        })),
        links: graph.links.map((l) => ({ ...l, source: l.source.id, target: l.target.id })),
      });
      expect(plain(ours)).toEqual(plain(theirs));
      // breakCycles takes validated links, exactly as sankeyLayout hands them over.
      const known = new Set(nodes.map((n) => n.id));
      const valid = links.filter(
        (l) => known.has(l.source) && known.has(l.target) && l.source !== l.target && l.value > 0,
      );
      const nodeIds = nodes.map((n) => n.id);
      expect(sankey.breakCycles(nodeIds, valid)).toEqual(reactSankey.breakCycles(nodeIds, valid));
      for (const link of ours.links.slice(0, 3)) {
        expect(sankey.sankeyLinkPath(link)).toBe(sankey.sankeyLinkPath(link));
        const mate = theirs.links.find((l) => l.id === link.id) as reactSankey.SankeyLink;
        expect(sankey.sankeyLinkPath(link)).toBe(reactSankey.sankeyLinkPath(mate));
        expect(sankey.sankeyTraceOf(link)).toEqual(reactSankey.sankeyTraceOf(mate));
      }
      for (const node of ours.nodes.slice(0, 3)) {
        const mate = theirs.nodes.find((n) => n.id === node.id) as reactSankey.SankeyNode;
        expect(sankey.sankeyFlowOf(node)).toEqual(reactSankey.sankeyFlowOf(mate));
      }
    }
  });

  it("breakCycles terminates on any input and skips links that carry no flow", () => {
    const nodeIds = ["a", "b", "c"];
    const bad = [
      { source: "a", target: "ghost", value: 5 },
      { source: "ghost", target: "a", value: 5 },
      { source: "a", target: "a", value: 5 },
      { source: "a", target: "b", value: Number.NaN },
      { source: "b", target: "c", value: -1 },
      { source: "c", target: "a", value: Number.POSITIVE_INFINITY },
      { source: "a", target: "b", value: 0 },
    ];
    expect(sankey.breakCycles(nodeIds, bad)).toEqual({ kept: [], cyclic: [] });
    expect(sankey.breakCycles([], bad)).toEqual({ kept: [], cyclic: [] });
    expect(sankey.breakCycles(nodeIds, [])).toEqual({ kept: [], cyclic: [] });
    // Duplicate ids and a real cycle mixed with junk: only the valid links are classified.
    const mixed = [
      ...bad,
      { source: "a", target: "b", value: 9 },
      { source: "b", target: "a", value: 1 },
    ];
    const result = sankey.breakCycles(["a", "b", "a", "c"], mixed);
    expect(result.kept).toEqual([{ source: "a", target: "b", value: 9 }]);
    expect(result.cyclic).toEqual([{ source: "b", target: "a", value: 1 }]);
    // Random junk never hangs and never leaks an invalid link.
    for (let i = 0; i < 300; i++) {
      const links = times(int(0, 25), () => ({
        source: pick(["a", "b", "c", "d", "ghost"]),
        target: pick(["a", "b", "c", "d", "ghost"]),
        value: pick([between(1, 50), 0, -3, Number.NaN, Number.POSITIVE_INFINITY]),
      }));
      const out = sankey.breakCycles(["a", "b", "c", "d"], links);
      expect(out.kept.length + out.cyclic.length).toBeLessThanOrEqual(links.length);
      for (const link of [...out.kept, ...out.cyclic]) {
        expect(link.source).not.toBe(link.target);
        expect(link.value).toBeGreaterThan(0);
        expect(Number.isFinite(link.value)).toBe(true);
      }
    }
  });

  it("diffs two periods and builds alluvial graphs", () => {
    for (let i = 0; i < 100; i++) {
      const before = randomGraph().links;
      const after = randomGraph().links;
      expect(sankey.sankeyDiff(before, after)).toEqual(reactSankey.sankeyDiff(before, after));
      const categories = times(int(1, 4), (c) => ({
        id: `c${c}`,
        name: `C${c}`,
        color: pick([undefined, "red"]),
      }));
      const stages = times(int(2, 5), (s) => `s${s}`);
      const flows = times(stages.length - 1, () =>
        times(int(0, 6), () => ({
          from: pick(categories).id,
          to: pick(categories).id,
          value: pick([0, -1, between(1, 50)]),
        })),
      );
      const input = { stages, categories, flows };
      expect(sankey.alluvialGraph(input)).toEqual(reactSankey.alluvialGraph(input));
    }
    expect(sankey.alluvialNodeId(2, "vip")).toBe(reactSankey.alluvialNodeId(2, "vip"));
  });
});

describe("chord parity", () => {
  it("lays out random matrices with every ordering", () => {
    const sorts = ["input", "ascending", "descending"] as const;
    for (let i = 0; i < 250; i++) {
      const size = int(0, 8);
      const matrix = times(size, () =>
        times(size, () => pick([0, 0, between(0, 60), int(1, 9), -4, Number.NaN])),
      );
      const options = pick([
        undefined,
        {
          padAngle: between(0, 0.2),
          startAngle: between(-2, 2),
          sortGroups: pick(sorts),
          sortSubgroups: pick(sorts),
        },
      ]);
      const ours = chord.chordLayout(matrix, options);
      const theirs = reactChord.chordLayout(matrix, options);
      expect(ours).toEqual(theirs);
      const radius = between(20, 200);
      const [cx, cy] = [between(0, 300), between(0, 300)];
      for (const ribbon of ours.chords) {
        expect(chord.ribbonPath(ribbon, radius, cx, cy)).toBe(
          reactChord.ribbonPath(ribbon, radius, cx, cy),
        );
        expect(chord.ribbonPath(ribbon, radius)).toBe(reactChord.ribbonPath(ribbon, radius));
      }
      for (let group = 0; group < size; group++)
        expect(chord.chordsOf(ours, group)).toEqual(reactChord.chordsOf(theirs, group));
      for (let probe = 0; probe < 6; probe++) {
        const angle = between(-8, 8);
        expect(chord.groupAt(ours, angle)).toBe(reactChord.groupAt(theirs, angle));
      }
    }
  });
});
