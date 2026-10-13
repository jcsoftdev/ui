// Polar basics shared by chart/polar and chart/chord, so neither entry pulls the other in.

export interface Point {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

/** Point at `radius` from (cx, cy) in the direction of `angle` (0 at 12 o'clock, clockwise). */
export function polarPoint(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.sin(angle), y: cy - radius * Math.cos(angle) };
}
