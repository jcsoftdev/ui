// Helpers shared by the tree layouts, so no entry pulls another in.
import { TAU } from "./polar-math.ts";
import type { TreeDirection, TreeLayoutInput } from "./tree-types.ts";

export function isVertical(direction: TreeDirection): boolean {
  return direction === "top" || direction === "bottom";
}

export interface Walk {
  input: TreeLayoutInput;
  depth: number;
  parentId: string | null;
  children: Walk[];
  /** Index range of the leaves below (inclusive). */
  lo: number;
  hi: number;
}

export function walk(input: TreeLayoutInput, depth: number, parentId: string | null): Walk {
  return {
    input,
    depth,
    parentId,
    children: (input.children ?? []).map((child) => walk(child, depth + 1, input.id)),
    lo: 0,
    hi: 0,
  };
}

export function flatten(root: Walk): Walk[] {
  const out: Walk[] = [];
  const visit = (node: Walk) => {
    out.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return out;
}

/** Point at `angle` (0 at twelve o'clock, clockwise) and `radius` around (0, 0). */
export function polar(angle: number, radius: number): { x: number; y: number } {
  return { x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
}

export { TAU };
