// The layouts a plain tidy tree never needs: one lazy chunk, loaded when `layout` asks for them.
export { dendrogramLayout } from "@jcsoftdev/ui-core/chart/dendrogram";
export { radialEdgePath } from "@jcsoftdev/ui-core/chart/tree-edge-radial";
export { radialTreeLayout } from "@jcsoftdev/ui-core/chart/tree-radial";

/** Where the toggle sits on a radial node: the point of its box that faces away from the center. */
export function radialAnchor(pose: {
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
}) {
  const dx = Math.sin(pose.angle ?? 0);
  const dy = -Math.cos(pose.angle ?? 0);
  const reach = Math.min(
    pose.width / 2 / Math.max(1e-6, Math.abs(dx)),
    pose.height / 2 / Math.max(1e-6, Math.abs(dy)),
  );
  return { x: pose.x + dx * reach, y: pose.y + dy * reach };
}
