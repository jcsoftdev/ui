export interface Point {
  x: number;
  y: number;
}
export interface BoxEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Triangle-like area between the pointer leaving a submenu trigger and the submenu,
 * so the pointer can cross other items on its way without closing the submenu.
 */
export function graceArea(exit: Point, side: "left" | "right", box: BoxEdges): Point[] {
  const rightSide = side === "right";
  const bleed = rightSide ? -5 : 5;
  const near = rightSide ? box.left : box.right;
  const far = rightSide ? box.right : box.left;
  return [
    { x: exit.x + bleed, y: exit.y },
    { x: near, y: box.top },
    { x: far, y: box.top },
    { x: far, y: box.bottom },
    { x: near, y: box.bottom },
  ];
}

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
