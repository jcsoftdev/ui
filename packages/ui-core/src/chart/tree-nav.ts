/** Keyboard navigation and root paths over laid out tree nodes. */
import { isVertical } from "../internal/tree-shared.ts";
import type { TreeDirection, TreeLayoutNode, TreeMove } from "../internal/tree-types.ts";

export type { TreeMove };

/** Ids from the root down to `id` (inclusive), following `parentId`. */
export function treePathToRoot(
  nodes: readonly Pick<TreeLayoutNode, "id" | "parentId">[],
  id: string,
): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: string[] = [];
  for (let current = byId.get(id); current; ) {
    path.unshift(current.id);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Maps an arrow key to a tree move relative to the drawing: in a top-down
 * chart Down goes to the first child and Right to the next sibling; in a
 * left-to-right chart Right goes to the child and Down to the next sibling.
 */
export function treeKeyMove(key: string, direction: TreeDirection): TreeMove | null {
  const towardsChild: Record<TreeDirection, string> = {
    top: "ArrowDown",
    bottom: "ArrowUp",
    left: "ArrowRight",
    right: "ArrowLeft",
  };
  const towardsParent: Record<TreeDirection, string> = {
    top: "ArrowUp",
    bottom: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  };
  if (key === towardsChild[direction]) return "child";
  if (key === towardsParent[direction]) return "parent";
  const vertical = isVertical(direction);
  if (key === (vertical ? "ArrowRight" : "ArrowDown")) return "next";
  if (key === (vertical ? "ArrowLeft" : "ArrowUp")) return "previous";
  return null;
}

/**
 * Node reached from `id` by `move` among the laid-out (visible) nodes.
 * Siblings stop at the ends; `child` goes to the middle child, which sits
 * right under the parent. Returns `id` itself when there is nowhere to go.
 */
export function treeNeighbor(
  nodes: readonly Pick<TreeLayoutNode, "id" | "parentId">[],
  id: string,
  move: TreeMove,
): string {
  const current = nodes.find((node) => node.id === id);
  if (!current) return id;
  if (move === "parent") return current.parentId ?? id;
  if (move === "child") {
    const children = nodes.filter((node) => node.parentId === id);
    return children[Math.floor((children.length - 1) / 2)]?.id ?? id;
  }
  if (current.parentId == null) return id;
  const siblings = nodes.filter((node) => node.parentId === current.parentId);
  const index = siblings.findIndex((node) => node.id === id);
  const next = siblings[index + (move === "next" ? 1 : -1)];
  return next?.id ?? id;
}
