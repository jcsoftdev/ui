/**
 * Sankey layout: nodes in columns, links as bands whose width is the flow.
 * Pure functions: no React, no DOM, unit tested in `test/charts-graph.test.mjs`.
 *
 * 1. Links are validated; links that would close a cycle are removed (a sankey
 *    reads left to right, so a feedback loop has nowhere to go) and reported.
 * 2. Each node goes to the column of its longest path from a source; with
 *    `align: "justify"` the sinks move to the last column.
 * 3. Nodes are stacked per column with a shared scale (`ky`, pixels per unit)
 *    and then relaxed: a few sweeps right-to-left and left-to-right pull each
 *    node towards the weighted centre of its neighbours, resolving overlaps
 *    after every sweep. That shortens links and removes most crossings.
 * 4. Links are ordered on both ends by the position of the node at the other
 *    end, so bands leave and arrive without crossing each other at the node.
 */

export interface SankeyNodeInput {
  id: string;
  name: string;
  /** CSS color, e.g. `var(--chart-cat-2)`; defaults to a palette slot. */
  color?: string;
  /**
   * Fixed column (0-based) instead of the longest path from a source. Used by the
   * alluvial layout, where a column is a moment in time. Links should point to a later column.
   */
  column?: number;
}

export interface SankeyLinkInput {
  source: string;
  target: string;
  value: number;
}

export interface SankeyOptions {
  width: number;
  height: number;
  /** Thickness of the node bars. */
  nodeWidth?: number;
  /** Vertical gap between nodes of a column (shrinks when the column is crowded). */
  nodePadding?: number;
  /** Relaxation sweeps. */
  iterations?: number;
  /** `justify` pushes the sinks to the last column; `left` keeps each node at its depth. */
  align?: "justify" | "left";
  /**
   * `false` skips the relaxation sweeps: nodes stay in input order inside their column
   * (alluvial diagrams, where the order of the categories must not change between stages).
   */
  relax?: boolean;
}

export interface SankeyNode {
  id: string;
  name: string;
  color?: string;
  /** Position in the input list. */
  index: number;
  column: number;
  /** Larger of the incoming and outgoing totals. */
  value: number;
  inValue: number;
  outValue: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  incoming: SankeyLink[];
  outgoing: SankeyLink[];
}

export interface SankeyLink {
  /** `source->target`, with a `~n` suffix for repeated pairs. */
  id: string;
  source: SankeyNode;
  target: SankeyNode;
  value: number;
  /** Band thickness in pixels. */
  width: number;
  /** Centre of the band where it leaves the source and where it reaches the target. */
  y0: number;
  y1: number;
}

export type SankeyRemovalReason = "cycle" | "self" | "unknown-node" | "invalid-value";

export interface SankeyGraph {
  /** Nodes with flow, in input order. */
  nodes: SankeyNode[];
  links: SankeyLink[];
  columns: number;
  /** Pixels per unit of value. */
  ky: number;
  /** Input links left out of the layout, and why. */
  removed: Array<{ link: SankeyLinkInput; reason: SankeyRemovalReason }>;
}

/**
 * Splits the links into an acyclic set and the links that close a cycle.
 * Orders the nodes with the greedy feedback-arc-set heuristic of Eades, Lin
 * and Smyth, weighted by value: sinks go to the end, sources to the front,
 * otherwise the node with the largest outflow minus inflow goes next. Links
 * that point backwards in that order are the ones removed, so a small return
 * flow (e.g. "comes back to book again") is cut rather than a main flow.
 */
export function breakCycles(
  nodeIds: readonly string[],
  links: readonly SankeyLinkInput[],
): { kept: SankeyLinkInput[]; cyclic: SankeyLinkInput[] } {
  const remaining = new Set(nodeIds);
  const outgoing = new Map<string, SankeyLinkInput[]>(nodeIds.map((id) => [id, []]));
  const incoming = new Map<string, SankeyLinkInput[]>(nodeIds.map((id) => [id, []]));
  for (const link of links) {
    outgoing.get(link.source)?.push(link);
    incoming.get(link.target)?.push(link);
  }
  const live = (list: readonly SankeyLinkInput[], end: "source" | "target") =>
    list.filter((link) => remaining.has(link[end]));
  const weight = (list: readonly SankeyLinkInput[]) =>
    list.reduce((sum, link) => sum + link.value, 0);

  const front: string[] = [];
  const back: string[] = [];
  while (remaining.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...remaining]) {
        if (live(outgoing.get(id) ?? [], "target").length === 0) {
          back.unshift(id);
          remaining.delete(id);
          changed = true;
        }
      }
      for (const id of [...remaining]) {
        if (live(incoming.get(id) ?? [], "source").length === 0) {
          front.push(id);
          remaining.delete(id);
          changed = true;
        }
      }
    }
    if (remaining.size === 0) break;
    let best = "";
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const id of remaining) {
      const score =
        weight(live(outgoing.get(id) ?? [], "target")) -
        weight(live(incoming.get(id) ?? [], "source"));
      if (score > bestScore) {
        best = id;
        bestScore = score;
      }
    }
    front.push(best);
    remaining.delete(best);
  }
  const position = new Map([...front, ...back].map((id, index) => [id, index]));
  const forward = (link: SankeyLinkInput) =>
    (position.get(link.source) ?? 0) < (position.get(link.target) ?? 0);
  return {
    kept: links.filter(forward),
    cyclic: links.filter((link) => !forward(link)),
  };
}

function centre(node: SankeyNode): number {
  return (node.y0 + node.y1) / 2;
}

/** Sorts a column by position and pushes nodes apart, keeping them inside 0..height. */
function resolveCollisions(column: SankeyNode[], height: number, padding: number): void {
  column.sort((a, b) => a.y0 - b.y0 || a.index - b.index);
  let y = 0;
  for (const node of column) {
    const shift = y - node.y0;
    if (shift > 0) {
      node.y0 += shift;
      node.y1 += shift;
    }
    y = node.y1 + padding;
  }
  y = height;
  for (let i = column.length - 1; i >= 0; i--) {
    const node = column[i] as SankeyNode;
    const shift = node.y1 - y;
    if (shift > 0) {
      node.y0 -= shift;
      node.y1 -= shift;
    }
    y = node.y0 - padding;
  }
}

/** Lays out a sankey diagram in a `width` x `height` box. */
export function sankeyLayout(
  nodesInput: readonly SankeyNodeInput[],
  linksInput: readonly SankeyLinkInput[],
  options: SankeyOptions,
): SankeyGraph {
  const { width, height, nodeWidth = 12, nodePadding = 12, iterations = 6 } = options;
  const align = options.align ?? "justify";
  const removed: SankeyGraph["removed"] = [];
  const known = new Set(nodesInput.map((node) => node.id));

  const valid = linksInput.filter((link) => {
    const reason: SankeyRemovalReason | null =
      !known.has(link.source) || !known.has(link.target)
        ? "unknown-node"
        : link.source === link.target
          ? "self"
          : !(Number.isFinite(link.value) && link.value > 0)
            ? "invalid-value"
            : null;
    if (reason) removed.push({ link, reason });
    return reason == null;
  });
  const { kept, cyclic } = breakCycles(
    nodesInput.map((node) => node.id),
    valid,
  );
  for (const link of cyclic) removed.push({ link, reason: "cycle" });

  const all = new Map<string, SankeyNode>();
  nodesInput.forEach((input, index) => {
    if (all.has(input.id)) return;
    all.set(input.id, {
      id: input.id,
      name: input.name,
      color: input.color,
      index,
      column: 0,
      value: 0,
      inValue: 0,
      outValue: 0,
      x0: 0,
      x1: 0,
      y0: 0,
      y1: 0,
      incoming: [],
      outgoing: [],
    });
  });

  const pairCount = new Map<string, number>();
  const links: SankeyLink[] = kept.map((input) => {
    const source = all.get(input.source) as SankeyNode;
    const target = all.get(input.target) as SankeyNode;
    const key = `${source.id}->${target.id}`;
    const count = pairCount.get(key) ?? 0;
    pairCount.set(key, count + 1);
    const link: SankeyLink = {
      id: count ? `${key}~${count}` : key,
      source,
      target,
      value: input.value,
      width: 0,
      y0: 0,
      y1: 0,
    };
    source.outgoing.push(link);
    target.incoming.push(link);
    source.outValue += input.value;
    target.inValue += input.value;
    return link;
  });

  const nodes = [...all.values()].filter((node) => node.inValue > 0 || node.outValue > 0);
  for (const node of nodes) node.value = Math.max(node.inValue, node.outValue);
  if (nodes.length === 0) return { nodes, links, columns: 0, ky: 0, removed };

  // Longest path from a source, in topological order (the graph is acyclic now).
  const pending = new Map(nodes.map((node) => [node.id, node.incoming.length]));
  const queue = nodes.filter((node) => node.incoming.length === 0);
  while (queue.length > 0) {
    const node = queue.shift() as SankeyNode;
    for (const link of node.outgoing) {
      link.target.column = Math.max(link.target.column, node.column + 1);
      const left = (pending.get(link.target.id) as number) - 1;
      pending.set(link.target.id, left);
      if (left === 0) queue.push(link.target);
    }
  }
  const fixed = new Map(nodesInput.map((input) => [input.id, input.column]));
  for (const node of nodes) {
    const column = fixed.get(node.id);
    if (column != null && column >= 0) node.column = Math.floor(column);
  }
  let last = 0;
  for (const node of nodes) last = Math.max(last, node.column);
  if (align === "justify") {
    for (const node of nodes) {
      if (node.outgoing.length === 0 && fixed.get(node.id) == null) node.column = last;
    }
  }
  const columns: SankeyNode[][] = Array.from({ length: last + 1 }, () => []);
  for (const node of nodes) columns[node.column]?.push(node);

  const step = last > 0 ? (width - nodeWidth) / last : 0;
  for (const node of nodes) {
    node.x0 = node.column * step;
    node.x1 = node.x0 + nodeWidth;
  }

  const crowded = Math.max(...columns.map((column) => column.length));
  const padding = Math.min(nodePadding, crowded > 1 ? (height * 0.4) / (crowded - 1) : nodePadding);
  const ky = Math.min(
    ...columns
      .filter((column) => column.length > 0)
      .map(
        (column) =>
          (height - (column.length - 1) * padding) /
          column.reduce((sum, node) => sum + node.value, 0),
      ),
  );

  for (const column of columns) {
    let y = 0;
    for (const node of column) {
      node.y0 = y;
      node.y1 = y + node.value * ky;
      y = node.y1 + padding;
    }
    // Centre the column's free space.
    const free = height - (y - padding);
    for (const node of column) {
      node.y0 += free / 2;
      node.y1 += free / 2;
    }
  }

  for (let i = 0; i < (options.relax === false ? 0 : iterations); i++) {
    const alpha = 0.99 ** i;
    const strength = Math.max(1 - alpha, 0.5);
    for (let c = columns.length - 2; c >= 0; c--) {
      const column = columns[c] as SankeyNode[];
      for (const node of column) {
        if (node.outgoing.length === 0) continue;
        let weight = 0;
        let sum = 0;
        for (const link of node.outgoing) {
          sum += centre(link.target) * link.value;
          weight += link.value;
        }
        const shift = (sum / weight - centre(node)) * strength;
        node.y0 += shift;
        node.y1 += shift;
      }
      resolveCollisions(column, height, padding);
    }
    for (let c = 1; c < columns.length; c++) {
      const column = columns[c] as SankeyNode[];
      for (const node of column) {
        if (node.incoming.length === 0) continue;
        let weight = 0;
        let sum = 0;
        for (const link of node.incoming) {
          sum += centre(link.source) * link.value;
          weight += link.value;
        }
        const shift = (sum / weight - centre(node)) * strength;
        node.y0 += shift;
        node.y1 += shift;
      }
      resolveCollisions(column, height, padding);
    }
  }

  for (const link of links) link.width = link.value * ky;
  for (const node of nodes) {
    node.outgoing.sort((a, b) => a.target.y0 - b.target.y0 || a.target.index - b.target.index);
    node.incoming.sort((a, b) => a.source.y0 - b.source.y0 || a.source.index - b.source.index);
    let y = node.y0;
    for (const link of node.outgoing) {
      link.y0 = y + link.width / 2;
      y += link.width;
    }
    y = node.y0;
    for (const link of node.incoming) {
      link.y1 = y + link.width / 2;
      y += link.width;
    }
  }

  return { nodes, links, columns: columns.length, ky, removed };
}

/** Centre line of a link band, drawn with `stroke-width = link.width`. */
export function sankeyLinkPath(link: Pick<SankeyLink, "source" | "target" | "y0" | "y1">): string {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const mid = (x0 + x1) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `M${r(x0)},${r(link.y0)}C${r(mid)},${r(link.y0)} ${r(mid)},${r(link.y1)} ${r(x1)},${r(link.y1)}`;
}

/** Ids of the links and nodes upstream and downstream of a node (the node included). */
export function sankeyFlowOf(node: SankeyNode): { nodes: Set<string>; links: Set<string> } {
  const nodes = new Set<string>([node.id]);
  const linkIds = new Set<string>();
  const walk = (start: SankeyNode, forward: boolean) => {
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as SankeyNode;
      for (const link of forward ? current.outgoing : current.incoming) {
        if (linkIds.has(link.id)) continue;
        linkIds.add(link.id);
        const next = forward ? link.target : link.source;
        nodes.add(next.id);
        stack.push(next);
      }
    }
  };
  walk(node, true);
  walk(node, false);
  return { nodes, links: linkIds };
}

/**
 * The path through a link: the link itself, everything that feeds its source
 * (upstream) and everything its target feeds (downstream).
 */
export function sankeyTraceOf(link: SankeyLink): { nodes: Set<string>; links: Set<string> } {
  const nodes = new Set<string>([link.source.id, link.target.id]);
  const linkIds = new Set<string>([link.id]);
  const walk = (start: SankeyNode, forward: boolean) => {
    const stack = [start];
    const seen = new Set<string>([start.id]);
    while (stack.length > 0) {
      const current = stack.pop() as SankeyNode;
      for (const next of forward ? current.outgoing : current.incoming) {
        linkIds.add(next.id);
        const node = forward ? next.target : next.source;
        nodes.add(node.id);
        if (!seen.has(node.id)) {
          seen.add(node.id);
          stack.push(node);
        }
      }
    }
  };
  walk(link.source, false);
  walk(link.target, true);
  return { nodes, links: linkIds };
}

/** One flow in two periods. */
export interface SankeyDiffLink extends SankeyLinkInput {
  /** The layout value: the larger of the two periods, so both fit. */
  value: number;
  before: number;
  after: number;
  /** `after - before`. */
  delta: number;
}

/**
 * Merges the flows of two periods by `source -> target` (repeated pairs are
 * summed). A flow missing in a period counts as 0 there. The merged `value` is
 * the larger one, which is what the layout reserves; `before`/`after` are
 * what is drawn on top of it.
 */
export function sankeyDiff(
  before: readonly SankeyLinkInput[],
  after: readonly SankeyLinkInput[],
): SankeyDiffLink[] {
  const merged = new Map<string, SankeyDiffLink>();
  const add = (links: readonly SankeyLinkInput[], period: "before" | "after") => {
    for (const link of links) {
      if (!(Number.isFinite(link.value) && link.value > 0)) continue;
      const key = `${link.source}->${link.target}`;
      const entry = merged.get(key) ?? {
        source: link.source,
        target: link.target,
        value: 0,
        before: 0,
        after: 0,
        delta: 0,
      };
      entry[period] += link.value;
      merged.set(key, entry);
    }
  };
  add(before, "before");
  add(after, "after");
  for (const entry of merged.values()) {
    entry.value = Math.max(entry.before, entry.after);
    entry.delta = entry.after - entry.before;
  }
  return [...merged.values()];
}

export interface AlluvialInput {
  /** Moments in time, left to right: "Jun", "Jul", ... */
  stages: readonly string[];
  /** The categories that flow; their order is the order top to bottom in every stage. */
  categories: ReadonlyArray<{ id: string; name: string; color?: string }>;
  /**
   * `flows[s]` moves people from stage `s` to stage `s + 1`:
   * `{ from: categoryId, to: categoryId, value }`.
   */
  flows: ReadonlyArray<ReadonlyArray<{ from: string; to: string; value: number }>>;
}

/** Node id of a category at a stage: `"2:vip"`. */
export function alluvialNodeId(stage: number, category: string): string {
  return `${stage}:${category}`;
}

/**
 * Turns stage-by-stage category flows into sankey nodes and links: one node per
 * category per stage (pinned to its column), the same color across stages, in
 * category order. Categories with no flow at a stage are left out. Draw with
 * `relax: false` and `align: "left"` to keep the order.
 */
export function alluvialGraph(input: AlluvialInput): {
  nodes: SankeyNodeInput[];
  links: SankeyLinkInput[];
} {
  const used = new Set<string>();
  const links: SankeyLinkInput[] = [];
  input.flows.forEach((stage, s) => {
    for (const flow of stage) {
      if (!(flow.value > 0)) continue;
      used.add(alluvialNodeId(s, flow.from));
      used.add(alluvialNodeId(s + 1, flow.to));
      links.push({
        source: alluvialNodeId(s, flow.from),
        target: alluvialNodeId(s + 1, flow.to),
        value: flow.value,
      });
    }
  });
  const nodes: SankeyNodeInput[] = [];
  input.stages.forEach((_, s) => {
    for (const category of input.categories) {
      const id = alluvialNodeId(s, category.id);
      if (used.has(id)) {
        nodes.push({ id, name: category.name, color: category.color, column: s });
      }
    }
  });
  return { nodes, links };
}
