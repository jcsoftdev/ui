/** Edge paths between laid out tree nodes: boxes (tidy, dendrogram) and rings (radial). */
export type { TreeEdgeStyle } from "../internal/tree-types.ts";
export { treeEdgePath } from "./tree-edge-box.ts";
export { radialEdgePath, toPolar } from "./tree-edge-radial.ts";
