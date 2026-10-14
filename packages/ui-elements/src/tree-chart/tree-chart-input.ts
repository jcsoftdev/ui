import type { TreeLayout, TreeLayoutNode } from "@jcsoftdev/ui-core/chart/tree";

// Pan and zoom, the keyboard moves, the layout tween, search, grouping, tooltip rows and the data
// table: fetched right after the first draw.
export { attachPanZoom } from "@jcsoftdev/ui-core/chart/pan-zoom";
export { treeKeyMove, treeNeighbor } from "@jcsoftdev/ui-core/chart/tree-nav";
export { default as stateCss } from "./tree-chart-state.css.js";
export { groupLeaves, searchTree, snapshotOf, tipRows } from "./tree-chart-tools.js";

/** A laid-out node as drawn in the current frame. */
export type Pose = TreeLayoutNode & { opacity: number };
type Track = {
  node: TreeLayoutNode;
  from: { x: number; y: number; opacity: number };
  to: { x: number; y: number; opacity: number };
};
export type Tween = { start: number; tracks: Track[]; final: Pose[] };

/**
 * Moves the drawn nodes from the previous layout to the next one: nodes that stay glide to their new
 * place, nodes that appear grow out of their closest visible ancestor and nodes that disappear fold
 * back into it. `undefined` when nothing moves.
 */
export function buildTween(
  previous: ReadonlyMap<string, Pose>,
  layout: TreeLayout,
  start: number,
  parentOf: (id: string) => string | undefined,
): Tween | undefined {
  const target = new Map(layout.nodes.map((node) => [node.id, node]));
  const nearest = <T>(id: string, among: ReadonlyMap<string, T>): T | undefined => {
    for (let parent = parentOf(id); parent; parent = parentOf(parent)) {
      const hit = among.get(parent);
      if (hit) return hit;
    }
    return undefined;
  };
  const tracks: Track[] = layout.nodes.map((node) => {
    const before = previous.get(node.id);
    const origin = before ?? nearest(node.id, previous);
    return {
      node,
      from: origin
        ? { x: origin.x, y: origin.y, opacity: before ? before.opacity : 0 }
        : { x: node.x, y: node.y, opacity: 0 },
      to: { x: node.x, y: node.y, opacity: 1 },
    };
  });
  for (const pose of previous.values()) {
    if (target.has(pose.id)) continue;
    const into = nearest(pose.id, target);
    tracks.push({
      node: pose,
      from: { x: pose.x, y: pose.y, opacity: pose.opacity },
      to: { x: into?.x ?? pose.x, y: into?.y ?? pose.y, opacity: 0 },
    });
  }
  const moved = tracks.some(
    ({ from, to }) => from.x !== to.x || from.y !== to.y || from.opacity !== to.opacity,
  );
  if (!moved) return undefined;
  return { start, tracks, final: layout.nodes.map((node) => ({ ...node, opacity: 1 })) };
}
