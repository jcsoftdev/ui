/** Dendrogram (cluster) layout: every leaf on the last level. */
import { flatten, type Walk, walk } from "../internal/tree-shared.ts";
import type {
  TreeLayout,
  TreeLayoutInput,
  TreeLayoutNode,
  TreeLayoutOptions,
} from "../internal/tree-types.ts";

/**
 * Dendrogram (cluster layout): like the tidy tree, but every leaf is drawn on
 * the last level, so the leaves line up and the branches read as a hierarchy
 * of groupings. Internal nodes are centred over their first and last child.
 */
export function dendrogramLayout(
  root: TreeLayoutInput,
  { direction = "top", siblingGap = 20, levelGap = 48 }: TreeLayoutOptions = {},
): TreeLayout {
  const vertical = direction === "top" || direction === "bottom";
  const tree = walk(root, 0, null);
  const all = flatten(tree);
  const maxDepth = Math.max(...all.map((node) => node.depth));
  const breadthOf = (node: Walk) => (vertical ? node.input.width : node.input.height);
  const alongOf = (node: Walk) => (vertical ? node.input.height : node.input.width);

  const centre = new Map<Walk, number>();
  let cursor = 0;
  const place = (node: Walk) => {
    if (node.children.length === 0) {
      const size = breadthOf(node);
      centre.set(node, cursor + size / 2);
      cursor += size + siblingGap;
      return;
    }
    for (const child of node.children) place(child);
    const first = centre.get(node.children[0] as Walk) as number;
    const last = centre.get(node.children[node.children.length - 1] as Walk) as number;
    centre.set(node, (first + last) / 2);
  };
  place(tree);

  const levelOf = (node: Walk) => (node.children.length === 0 ? maxDepth : node.depth);
  const levelSize: number[] = [];
  for (const node of all) {
    const level = levelOf(node);
    levelSize[level] = Math.max(levelSize[level] ?? 0, alongOf(node));
  }
  const levelStart: number[] = [0];
  for (let level = 1; level <= maxDepth; level += 1) {
    levelStart[level] = (levelStart[level - 1] as number) + (levelSize[level - 1] ?? 0) + levelGap;
  }

  const flip = direction === "bottom" || direction === "right" ? -1 : 1;
  const nodes: TreeLayoutNode[] = all.map((node) => {
    const level = levelOf(node);
    const along = ((levelStart[level] as number) + (levelSize[level] ?? 0) / 2) * flip;
    const across = centre.get(node) as number;
    return {
      id: node.input.id,
      parentId: node.parentId,
      depth: node.depth,
      x: vertical ? across : along,
      y: vertical ? along : across,
      width: node.input.width,
      height: node.input.height,
    };
  });

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }
  for (const node of nodes) {
    node.x -= minX;
    node.y -= minY;
  }
  return { nodes, width: maxX - minX, height: maxY - minY };
}
