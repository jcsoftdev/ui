// Types of the tree layouts, shared by chart/tree, tree-radial, dendrogram, tree-edge, tree-nav and tree-fit.

/** Where the root sits: `top` grows downwards, `left` grows to the right. */
export type TreeDirection = "top" | "bottom" | "left" | "right";

/** Input of the layout: a node box and the children that are visible. */
export interface TreeLayoutInput {
  id: string;
  /** Box size on screen, in pixels. */
  width: number;
  height: number;
  children?: readonly TreeLayoutInput[];
}

export interface TreeLayoutOptions {
  direction?: TreeDirection;
  /** Minimum gap between neighbouring boxes on the same level. */
  siblingGap?: number;
  /** Gap between levels (from the far side of a level to the near side of the next). */
  levelGap?: number;
}

export interface TreeLayoutNode {
  id: string;
  parentId: string | null;
  depth: number;
  /** Centre of the box, in pixels; the bounds start at 0, 0. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radial layouts: angle in radians, 0 at twelve o'clock, clockwise. */
  angle?: number;
}

export interface TreeLayout {
  /** Pre-order: parents before their children, siblings in input order. */
  nodes: TreeLayoutNode[];
  /** Size of the whole drawing. */
  width: number;
  height: number;
  /** Radial layouts: the root's centre, where the rings are centred. */
  center?: { x: number; y: number };
}

/** Edge drawing style between a parent and a child. */
export type TreeEdgeStyle = "curved" | "step" | "straight";

/** What an arrow key means in a given direction. */
export type TreeMove = "parent" | "child" | "previous" | "next";

export interface RadialLayoutOptions {
  /** Minimum distance between rings (centre to centre). */
  levelGap?: number;
  /** Minimum gap between neighbouring boxes on one ring. */
  siblingGap?: number;
  /** Angle where the first leaf starts, radians, 0 at twelve o'clock clockwise. */
  startAngle?: number;
  /** Angular span in radians; a full circle by default. */
  sweep?: number;
}

/** Layout kinds the tree chart can draw. */
export type TreeLayoutKind = "tidy" | "radial" | "dendrogram";

/** `contain` shows the whole tree, `readable` keeps cards legible and puts the root in view. */
export type TreeFitMode = "contain" | "readable";

export interface TreeFitOptions {
  /** Pixels reserved at the top (the zoom toolbar). */
  inset?: number;
  padding?: number;
  /** `auto` falls back to `readable` when `contain` would scale below `minReadable`. */
  mode?: TreeFitMode | "auto";
  /** Smallest scale at which a fitted tree still counts as legible. */
  minReadable?: number;
  /** Scale range of the `readable` view. */
  readableMin?: number;
  readableMax?: number;
  minZoom?: number;
  /** Centre the root in the `readable` view (radial layouts), instead of pinning it to an edge. */
  centerRoot?: boolean;
}
