/** Edge paths between laid out tree boxes (tidy, dendrogram). Apart from the radial rings so a tidy tree never carries them. */
import { isVertical } from "../internal/tree-shared.ts";
import type { TreeDirection, TreeEdgeStyle, TreeLayoutNode } from "../internal/tree-types.ts";

export type { TreeEdgeStyle };

type Box = Pick<TreeLayoutNode, "x" | "y" | "width" | "height">;

/** Point on the side of `box` that faces the next level (`far`) or the previous one. */
function anchor(box: Box, direction: TreeDirection, far: boolean): [number, number] {
  const sign = far ? 1 : -1;
  switch (direction) {
    case "top":
      return [box.x, box.y + (sign * box.height) / 2];
    case "bottom":
      return [box.x, box.y - (sign * box.height) / 2];
    case "left":
      return [box.x + (sign * box.width) / 2, box.y];
    default:
      return [box.x - (sign * box.width) / 2, box.y];
  }
}

/**
 * SVG path from a parent box to a child box. `curved` is a cubic S-curve,
 * `step` an orthogonal elbow with rounded corners (`radius`), `straight` a line.
 */
export function treeEdgePath(
  parent: Box,
  child: Box,
  direction: TreeDirection,
  style: TreeEdgeStyle = "curved",
  radius = 8,
): string {
  const [x0, y0] = anchor(parent, direction, true);
  const [x1, y1] = anchor(child, direction, false);
  const r = (n: number) => Math.round(n * 100) / 100;
  if (style === "straight") return `M${r(x0)},${r(y0)}L${r(x1)},${r(y1)}`;
  const vertical = isVertical(direction);
  if (style === "curved") {
    if (vertical) {
      const mid = (y0 + y1) / 2;
      return `M${r(x0)},${r(y0)}C${r(x0)},${r(mid)} ${r(x1)},${r(mid)} ${r(x1)},${r(y1)}`;
    }
    const mid = (x0 + x1) / 2;
    return `M${r(x0)},${r(y0)}C${r(mid)},${r(y0)} ${r(mid)},${r(y1)} ${r(x1)},${r(y1)}`;
  }
  // Step: along the depth axis to the middle, across, then on to the child.
  if (vertical) {
    const mid = (y0 + y1) / 2;
    const across = x1 - x0;
    const turn = Math.min(radius, Math.abs(across) / 2, Math.abs(mid - y0));
    if (turn < 0.5) return `M${r(x0)},${r(y0)}V${r(mid)}H${r(x1)}V${r(y1)}`;
    const sx = Math.sign(across);
    const sy = Math.sign(y1 - y0);
    return [
      `M${r(x0)},${r(y0)}`,
      `V${r(mid - sy * turn)}`,
      `Q${r(x0)},${r(mid)} ${r(x0 + sx * turn)},${r(mid)}`,
      `H${r(x1 - sx * turn)}`,
      `Q${r(x1)},${r(mid)} ${r(x1)},${r(mid + sy * turn)}`,
      `V${r(y1)}`,
    ].join("");
  }
  const mid = (x0 + x1) / 2;
  const across = y1 - y0;
  const turn = Math.min(radius, Math.abs(across) / 2, Math.abs(mid - x0));
  if (turn < 0.5) return `M${r(x0)},${r(y0)}H${r(mid)}V${r(y1)}H${r(x1)}`;
  const sy = Math.sign(across);
  const sx = Math.sign(x1 - x0);
  return [
    `M${r(x0)},${r(y0)}`,
    `H${r(mid - sx * turn)}`,
    `Q${r(mid)},${r(y0)} ${r(mid)},${r(y0 + sy * turn)}`,
    `V${r(y1 - sy * turn)}`,
    `Q${r(mid)},${r(y1)} ${r(mid + sx * turn)},${r(y1)}`,
    `H${r(x1)}`,
  ].join("");
}
