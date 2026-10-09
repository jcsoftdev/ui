"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { EASE_OUT, fadeKeyframes, useEntryAnimation } from "../core/motion.js";
import { type TreeFitMode, treeFitView } from "../core/tree-fit.js";
import {
  type TreeDirection,
  type TreeEdgeStyle,
  type TreeLayoutNode,
  treeEdgePath,
  treeKeyMove,
  treeLayout,
  treeNeighbor,
  treePathToRoot,
} from "../core/tree-layout.js";
import {
  dendrogramLayout,
  radialEdgePath,
  radialTreeLayout,
  type TreeLayoutKind,
} from "../core/tree-radial.js";
import { type ChartLabels, DEFAULT_LABELS } from "../core/types.js";
import { usePanZoom } from "../core/use-pan-zoom.js";
import { TreeCard, TreeChip, type TreeNodeState } from "./tree-card.js";
import {
  ancestorIds,
  buildTreeModel,
  edgeColorOf,
  groupLeaves,
  initialCollapsed,
  searchTree,
  subtreeSize,
  type TreeChartDatum,
  type TreeChartNode,
  type TreeEdgeColor,
  type TreeModel,
  visibleTree,
} from "./tree-model.js";
import { type TreePose, useTreeTransition } from "./use-tree-transition.js";

/** Visible strings of the tree chart. */
export interface TreeLabels extends ChartLabels {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  /** Accessible name of the zoom toolbar. */
  controls: string;
  /** Hint under the drawing about wheel zoom. */
  zoomHint: string;
  /** Data table header and spoken text: the subtitle column (e.g. "Role"). */
  subtitle: string;
  level: string;
  /** Data table header: the parent node. */
  parent: string;
  /** Data table header and spoken text: number of children. */
  children: string;
  /** Spoken state of a node whose children are hidden. */
  collapsed: string;
  /** Spoken position among siblings, e.g. "2 of 4". */
  of: string;
  /** Search box name and placeholder. */
  search: string;
  searchPrevious: string;
  searchNext: string;
  noMatches: string;
  /** Word after the count in a group of leaves: "5 more". */
  groupWord: string;
  /** Data table header and spoken text: every node below. */
  descendants: string;
  /** Spoken when children could not be loaded. */
  loadFailed: string;
}

export const DEFAULT_TREE_LABELS: TreeLabels = {
  ...DEFAULT_LABELS,
  explore:
    "Tree. Arrow keys move between parent, children and siblings; Enter expands or collapses; plus and minus zoom; 0 fits the view.",
  category: "Name",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fit: "Fit to view",
  controls: "Zoom controls",
  zoomHint: "Drag to pan · Ctrl + wheel to zoom",
  subtitle: "Role",
  level: "Level",
  parent: "Reports to",
  children: "Direct reports",
  collapsed: "collapsed",
  of: "of",
  search: "Search",
  searchPrevious: "Previous match",
  searchNext: "Next match",
  noMatches: "No matches",
  groupWord: "more",
  descendants: "Total below",
  loadFailed: "Could not load. Try again.",
};

export interface TreeChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; `null` shows the empty state. */
  data: TreeChartDatum | null;
  /**
   * `tidy` (default) is the org-chart layout; `radial` puts the root in the centre with one ring per
   * level; `dendrogram` aligns every leaf on the last level. The last two default to compact chips.
   */
  layout?: TreeLayoutKind;
  /** Where the root sits: `top` (default), `bottom`, `left` or `right`. Ignored by `radial`. */
  direction?: TreeDirection;
  edgeStyle?: TreeEdgeStyle;
  /** Drawing height in pixels, or `"fill"` to take the parent's height. */
  height?: number | "fill";
  /** Width / height ratio of the drawing; ignored with `"fill"`. */
  aspectRatio?: number;
  /** Size of every node box (the card template fills it). */
  nodeWidth?: number;
  nodeHeight?: number;
  /** Gap between neighbouring boxes of one level. */
  siblingGap?: number;
  /** Gap between levels. */
  levelGap?: number;
  /** Depth (root = 0) from which nodes start collapsed: `2` shows the root, its children and theirs. */
  initialDepth?: number;
  /** Show the expand/collapse buttons (Enter still toggles from the keyboard). */
  collapsible?: boolean;
  /** Highlight the path to the root of the hovered or keyboard-active node. */
  highlightPath?: boolean;
  /** Edge colors: `neutral` (default), by `depth` or by top-level `branch`. */
  edgeColor?: TreeEdgeColor;
  /** Search box over the drawing: matches are ringed, Enter steps through them and pans to each. */
  searchable?: boolean;
  /** Clicking a node selects it and keeps its path to the root lit. */
  selectable?: boolean;
  /** Controlled selection (a node id), `null` for none. */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (node: TreeChartNode | null) => void;
  /** Show how many nodes hang below each one. */
  showCounts?: boolean;
  /** Fold nodes with at least this many leaf children into one expandable group node. */
  groupLeaves?: number;
  /**
   * Fetches the children of a `lazy` node the first time it is expanded; a spinner shows meanwhile.
   * Resolve with the child data (an empty array makes the node a leaf).
   */
  loadChildren?: (node: TreeChartNode) => Promise<readonly TreeChartDatum[]>;
  onLoadError?: (node: TreeChartNode, error: unknown) => void;
  /**
   * Initial view. `auto` (default) shows the whole tree and, when that would shrink the cards
   * below a readable size (narrow containers), centres the root at a readable scale so you pan
   * to the rest. `contain` always fits the whole tree; `readable` always keeps cards legible.
   * The fit button toggles between the two views.
   */
  fit?: "auto" | "contain" | "readable";
  /** Zoom buttons over the drawing. */
  controls?: boolean;
  /** See `usePanZoom`: wheel zoom only with Ctrl/⌘ (default), always, or off. */
  wheelZoom?: "modifier" | "always" | "off";
  minZoom?: number;
  maxZoom?: number;
  /** Custom node template; receives the node and its state, fills the node box. */
  renderNode?: (node: TreeChartNode, state: TreeNodeState) => ReactNode;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<TreeLabels>;
  onNodeClick?: (node: TreeChartNode) => void;
  /** Called after a node is expanded (`true`) or collapsed (`false`). */
  onToggle?: (node: TreeChartNode, expanded: boolean) => void;
  className?: string;
}

/**
 * Org chart / hierarchy tree: tidy layout in four directions, card templates,
 * curved, step or straight edges, animated expand/collapse, pan and zoom,
 * and the path to the root highlighted on hover or keyboard focus.
 */
export function TreeChart({
  title,
  data,
  height = 480,
  aspectRatio,
  loading,
  labels: labelsProp,
  className,
  ...rest
}: TreeChartProps) {
  const labels = useMemo(
    () => (labelsProp ? { ...DEFAULT_TREE_LABELS, ...labelsProp } : DEFAULT_TREE_LABELS),
    [labelsProp],
  );
  const { groupLeaves: groupMin, ...plotProps } = rest;
  const grouped = useMemo(
    () =>
      data && groupMin
        ? groupLeaves(data, groupMin, (count) => `${count} ${labels.groupWord}`)
        : data,
    [data, groupMin, labels.groupWord],
  );
  const [loaded, setLoaded] = useState<ReadonlyMap<string, readonly TreeChartDatum[]>>(
    () => new Map(),
  );
  // New data forgets what was fetched for the old one.
  const [seenData, setSeenData] = useState(data);
  if (seenData !== data) {
    setSeenData(data);
    setLoaded(new Map());
  }
  const model = useMemo(
    () => (grouped ? buildTreeModel(grouped, loaded) : null),
    [grouped, loaded],
  );
  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={!model}
      skeleton="bars"
      className={className}
      table={model ? <TreeTable model={model} caption={title} labels={labels} /> : null}
    >
      {(width, drawingHeight) =>
        model ? (
          <TreePlot
            {...plotProps}
            dataKey={data}
            onLoaded={(id, children) => setLoaded((current) => new Map(current).set(id, children))}
            title={title}
            model={model}
            width={width}
            height={drawingHeight}
            labels={labels}
          />
        ) : null
      }
    </ChartFrame>
  );
}

interface TreePlotProps
  extends Omit<
    TreeChartProps,
    "data" | "height" | "aspectRatio" | "loading" | "labels" | "groupLeaves"
  > {
  model: TreeModel;
  /** The caller's data: a new one resets the collapsed state and the selection. */
  dataKey: unknown;
  onLoaded: (id: string, children: readonly TreeChartDatum[]) => void;
  width: number;
  height: number;
  labels: TreeLabels;
}

const ZOOM_STEP = 1.25;
const TOOLBAR_BAND = 36;

/** Point of a node box that faces its children, where the toggle button sits. */
function toggleAnchor(
  pose: TreeLayoutNode,
  direction: TreeDirection,
  radial: boolean,
): [number, number] {
  if (radial && pose.angle != null) {
    const dx = Math.sin(pose.angle);
    const dy = -Math.cos(pose.angle);
    const reach = Math.min(
      pose.width / 2 / Math.max(1e-6, Math.abs(dx)),
      pose.height / 2 / Math.max(1e-6, Math.abs(dy)),
    );
    return [pose.x + dx * reach, pose.y + dy * reach];
  }
  switch (direction) {
    case "top":
      return [pose.x, pose.y + pose.height / 2];
    case "bottom":
      return [pose.x, pose.y - pose.height / 2];
    case "left":
      return [pose.x + pose.width / 2, pose.y];
    default:
      return [pose.x - pose.width / 2, pose.y];
  }
}

function TreePlot({
  title,
  model,
  width,
  height,
  labels,
  dataKey,
  onLoaded,
  layout: layoutKind = "tidy",
  direction = "top",
  edgeStyle = "curved",
  nodeWidth: nodeWidthProp,
  nodeHeight: nodeHeightProp,
  siblingGap = 20,
  levelGap: levelGapProp,
  initialDepth = Number.POSITIVE_INFINITY,
  collapsible = true,
  highlightPath = true,
  edgeColor = "neutral",
  searchable = false,
  selectable = false,
  selectedId: selectedProp,
  defaultSelectedId = null,
  onSelect,
  showCounts = false,
  loadChildren,
  onLoadError,
  fit: fitProp = "auto",
  controls = true,
  wheelZoom = "modifier",
  minZoom = 0.1,
  maxZoom = 2.5,
  renderNode,
  animate = true,
  onNodeClick,
  onToggle,
}: TreePlotProps) {
  const compact = layoutKind !== "tidy";
  const radial = layoutKind === "radial";
  const nodeWidth = nodeWidthProp ?? (compact ? 132 : 196);
  const nodeHeight = nodeHeightProp ?? (compact ? 28 : 64);
  const levelGap = levelGapProp ?? (radial ? 112 : compact ? 76 : 56);
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(model, initialDepth));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(defaultSelectedId);
  const selectedId = selectedProp !== undefined ? selectedProp : selectedState;
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  // New data: start again from its own collapsed flags.
  const [seenData, setSeenData] = useState(dataKey);
  if (seenData !== dataKey) {
    setSeenData(dataKey);
    setCollapsed(initialCollapsed(model, initialDepth));
    setActiveId(null);
    setSelectedState(defaultSelectedId);
    setQuery("");
  }

  const layout = useMemo(() => {
    const sized = (scale: number) =>
      visibleTree(model.root, collapsed, () => ({
        width: Math.round(nodeWidth * scale),
        height: nodeHeight,
      }));
    if (radial) {
      // Chips shrink a little (to 85%) before the readable view takes over: names stay legible.
      let best = radialTreeLayout(sized(1), { levelGap, siblingGap });
      for (const scale of [1, 0.85]) {
        best = radialTreeLayout(sized(scale), { levelGap, siblingGap });
        const zoom = Math.min(width / best.width, height / best.height);
        if (zoom >= 0.8 || width <= 0 || height <= 0) break;
      }
      return best;
    }
    const input = sized(1);
    if (layoutKind === "dendrogram") {
      return dendrogramLayout(input, { direction, siblingGap, levelGap });
    }
    return treeLayout(input, { direction, siblingGap, levelGap });
  }, [
    model,
    collapsed,
    layoutKind,
    radial,
    direction,
    nodeWidth,
    nodeHeight,
    siblingGap,
    levelGap,
    width,
    height,
  ]);
  const parentOf = useCallback((id: string) => model.byId.get(id)?.parent?.id ?? null, [model]);
  const poses = useTreeTransition(layout, parentOf, { disabled: !animate });

  const panZoom = usePanZoom<HTMLDivElement>({ minZoom, maxZoom, wheel: wheelZoom });
  const { view, setView, userMoved } = panZoom;
  // The zoom toolbar keeps a band at the top, so a fitted tree never sits under it.
  const toolbarBand = controls || searchable ? TOOLBAR_BAND : 0;
  // The fit button flips between the whole tree and the readable view; `null` follows `fit`.
  const [fitChoice, setFitChoice] = useState<TreeFitMode | null>(null);
  const appliedFit = useRef<TreeFitMode>("contain");
  const fit = useCallback(() => {
    const next = treeFitView(layout, width, height, radial ? "left" : direction, {
      inset: toolbarBand,
      mode: fitChoice ?? fitProp,
      minZoom,
      centerRoot: radial,
    });
    appliedFit.current = next.mode;
    setView(next.view, { user: false });
  }, [layout, width, height, direction, radial, toolbarBand, minZoom, fitChoice, fitProp, setView]);
  // Follow the container and the expanding tree until the user pans or zooms.
  useEffect(() => {
    if (!userMoved.current) fit();
  }, [fit, userMoved]);
  // After lazy children arrive, bring the view back to the tree if the new nodes fall outside it.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) return;
    loadedRef.current = false;
    if (!userMoved.current || width <= 0 || height <= 0) return;
    const { x, y, k } = view;
    const outside = layout.nodes.some(
      (node) =>
        x + (node.x - node.width / 2) * k < 0 ||
        x + (node.x + node.width / 2) * k > width ||
        y + (node.y - node.height / 2) * k < toolbarBand ||
        y + (node.y + node.height / 2) * k > height,
    );
    if (!outside) return;
    userMoved.current = false;
    fit();
  }, [layout, view, width, height, toolbarBand, fit, userMoved]);
  const refit = () => {
    const moved = userMoved.current;
    userMoved.current = false;
    // After panning or zooming, the button restores the current fit; on a fitted view it switches.
    if (moved) fit();
    else setFitChoice(appliedFit.current === "contain" ? "readable" : "contain");
  };

  const load = async (node: TreeChartNode) => {
    if (!loadChildren || busy.has(node.id)) return;
    setBusy((current) => new Set(current).add(node.id));
    setFailed((current) => {
      const next = new Set(current);
      next.delete(node.id);
      return next;
    });
    try {
      const children = await loadChildren(node);
      loadedRef.current = true;
      onLoaded(node.id, children);
      onToggle?.(node, true);
    } catch (error) {
      setFailed((current) => new Set(current).add(node.id));
      onLoadError?.(node, error);
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(node.id);
        return next;
      });
    }
  };

  const toggle = (node: TreeChartNode) => {
    if (node.lazy) {
      void load(node);
      return;
    }
    if (node.children.length === 0) return;
    const expanding = collapsed.has(node.id);
    setCollapsed((current) => {
      const next = new Set(current);
      if (expanding) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    onToggle?.(node, expanding);
  };

  const select = (id: string | null) => {
    if (selectedProp === undefined) setSelectedState(id);
    onSelect?.(id ? (model.byId.get(id) ?? null) : null);
  };

  const matches = useMemo(() => searchTree(model, query), [model, query]);
  const matchSet = useMemo(() => new Set(matches.map((node) => node.id)), [matches]);

  // Pans the view so a node sits in the middle, once the layout includes it.
  const pending = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the layout changes after a reveal request.
  useEffect(() => {
    const id = pending.current;
    const node = id ? layout.nodes.find((candidate) => candidate.id === id) : undefined;
    if (!node) return;
    pending.current = null;
    const k = Math.min(1.4, Math.max(0.8, panZoom.view.k));
    setView({
      k,
      x: width / 2 - node.x * k,
      y: toolbarBand + (height - toolbarBand) / 2 - node.y * k,
    });
  }, [layout]);

  /** Opens the ancestors of a node, selects it and brings it to the middle of the view. */
  const focusNode = (node: TreeChartNode) => {
    const hidden = ancestorIds(node).filter((id) => collapsed.has(id));
    if (hidden.length > 0) {
      setCollapsed((current) => {
        const next = new Set(current);
        for (const id of hidden) next.delete(id);
        return next;
      });
    }
    pending.current = node.id;
    select(node.id);
    setActiveId(node.id);
    // Already visible: the layout will not change, so center now.
    if (hidden.length === 0) {
      const placed = layout.nodes.find((candidate) => candidate.id === node.id);
      if (placed) {
        pending.current = null;
        const k = Math.min(1.4, Math.max(0.8, panZoom.view.k));
        setView({
          k,
          x: width / 2 - placed.x * k,
          y: toolbarBand + (height - toolbarBand) / 2 - placed.y * k,
        });
      }
    }
  };

  const onSearch = (value: string) => {
    setQuery(value);
    setMatchIndex(0);
    const first = searchTree(model, value)[0];
    if (first) focusNode(first);
  };
  const stepMatch = (delta: number) => {
    if (matches.length === 0) return;
    const next = (matchIndex + delta + matches.length) % matches.length;
    setMatchIndex(next);
    const node = matches[next];
    if (node) focusNode(node);
  };

  const highlightId =
    hoverId && highlightPath ? hoverId : (selectedId ?? (highlightPath ? activeId : null));
  const path = useMemo(
    () => new Set(highlightId ? treePathToRoot(layout.nodes, highlightId) : []),
    [layout.nodes, highlightId],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  useEntryAnimation(
    stageRef,
    (root) => {
      root.querySelectorAll<HTMLElement>("[data-tree-card]").forEach((element) => {
        const depth = Number(element.dataset.depth ?? 0);
        element.animate(
          [
            { opacity: 0, scale: "0.92" },
            { opacity: 1, scale: "1" },
          ],
          { duration: 420, delay: Math.min(depth * 90, 360), easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-tree-edges]").forEach((element) => {
        element.animate(fadeKeyframes(element), {
          duration: 500,
          delay: 160,
          easing: "ease-out",
          fill: "backwards",
        });
      });
    },
    { disabled: !animate, replayKey: model },
  );

  const byPose = useMemo(() => new Map(poses.map((pose) => [pose.id, pose])), [poses]);
  const descendants = useMemo(
    () => (showCounts ? new Map(model.nodes.map((node) => [node.id, subtreeSize(node)])) : null),
    [showCounts, model],
  );
  const activeNode = activeId ? model.byId.get(activeId) : undefined;

  /** Pans just enough to bring a node fully into the viewport. */
  const reveal = (id: string) => {
    const node = layout.nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    const margin = 12;
    const { k, x, y } = panZoom.view;
    const left = x + (node.x - node.width / 2) * k;
    const right = x + (node.x + node.width / 2) * k;
    const top = y + (node.y - node.height / 2) * k;
    const bottom = y + (node.y + node.height / 2) * k;
    let dx = 0;
    let dy = 0;
    if (left < margin) dx = margin - left;
    else if (right > width - margin) dx = width - margin - right;
    if (top < margin) dy = margin - top;
    else if (bottom > height - margin) dy = height - margin - bottom;
    if (dx || dy) setView({ k, x: x + dx, y: y + dy });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = activeId ?? model.root.id;
    const move = treeKeyMove(event.key, direction);
    let handled = true;
    if (move) {
      const next = activeId ? treeNeighbor(layout.nodes, current, move) : model.root.id;
      setActiveId(next);
      setHoverId(null);
      reveal(next);
    } else if (event.key === "Home") {
      setActiveId(model.root.id);
      reveal(model.root.id);
    } else if (event.key === "Enter" || event.key === " ") {
      const node = model.byId.get(current);
      if (node) toggle(node);
      if (!activeId) setActiveId(current);
    } else if (event.key === "+" || event.key === "=") panZoom.zoomBy(ZOOM_STEP);
    else if (event.key === "-" || event.key === "_") panZoom.zoomBy(1 / ZOOM_STEP);
    else if (event.key === "0") refit();
    else if (event.key === "Escape") setActiveId(null);
    else handled = false;
    if (handled) event.preventDefault();
  };

  const valueText = activeNode ? describe(activeNode, collapsed, labels) : title;
  const transitionOn = animate && !panZoom.interacting;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ width, height }}>
      <div
        ref={panZoom.ref}
        {...panZoom.handlers}
        className={cn(
          "absolute inset-0 touch-none select-none",
          panZoom.interacting ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div
          ref={stageRef}
          role="img"
          aria-label={title}
          className={cn(
            "absolute top-0 left-0 origin-top-left",
            transitionOn && "motion-safe:transition-transform motion-safe:duration-300",
          )}
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transitionTimingFunction: EASE_OUT,
          }}
        >
          <svg
            aria-hidden="true"
            data-tree-edges=""
            width={layout.width}
            height={layout.height}
            className="absolute top-0 left-0 overflow-visible"
          >
            <TreeEdges
              poses={poses}
              byPose={byPose}
              path={path}
              direction={direction}
              edgeStyle={edgeStyle}
              edgeColor={edgeColor}
              center={radial ? layout.center : undefined}
              model={model}
            />
          </svg>
          <div aria-hidden="true">
            {poses.map((pose) => {
              const node = model.byId.get(pose.id);
              if (!node) return null;
              const hasChildren = node.children.length > 0 || node.lazy;
              const loading = busy.has(node.id);
              const state: TreeNodeState = {
                highlighted: path.has(node.id),
                dimmed: path.size > 0 && !path.has(node.id),
                active: activeId === node.id,
                collapsed: node.lazy || collapsed.has(node.id),
                hasChildren,
                descendants: descendants?.get(node.id) ?? 0,
                showCount: showCounts,
                loading,
                matched: matchSet.has(node.id),
                selected: selectedId === node.id,
              };
              const [tx, ty] = toggleAnchor(pose, direction, radial);
              return (
                <div key={node.id}>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; the keyboard uses the focusable explorer below. */}
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: same as above. */}
                  <div
                    data-tree-card=""
                    data-depth={node.depth}
                    className={cn(
                      "absolute top-0 left-0",
                      onNodeClick || hasChildren ? "cursor-pointer" : undefined,
                      "motion-safe:transition-[filter,opacity] motion-safe:duration-200",
                    )}
                    style={{
                      width: pose.width,
                      height: pose.height,
                      transform: `translate(${pose.x - pose.width / 2}px, ${pose.y - pose.height / 2}px)`,
                      opacity: pose.opacity * (state.dimmed ? 0.55 : 1),
                    }}
                    onPointerEnter={() => setHoverId(node.id)}
                    onPointerLeave={() =>
                      setHoverId((current) => (current === node.id ? null : current))
                    }
                    onClick={() => {
                      if (panZoom.wasDrag()) return;
                      setActiveId(node.id);
                      if (selectable) select(selectedId === node.id ? null : node.id);
                      if (onNodeClick) onNodeClick(node);
                      else toggle(node);
                    }}
                  >
                    {renderNode ? (
                      renderNode(node, state)
                    ) : compact ? (
                      <TreeChip node={node} state={state} />
                    ) : (
                      <TreeCard node={node} state={state} />
                    )}
                    {state.active ? (
                      <span className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-tile)+4px)] border-2 border-ink" />
                    ) : state.matched ? (
                      <span className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-tile)+4px)] border-2 border-accent-word" />
                    ) : null}
                  </div>
                  {collapsible && hasChildren ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!panZoom.wasDrag()) toggle(node);
                      }}
                      className="absolute top-0 left-0 grid h-5 min-w-5 cursor-pointer place-items-center rounded-badge border-divider bg-surface-control px-1 font-bold text-[10px] text-ink-2 tabular-nums shadow-control hover:text-ink"
                      style={{
                        transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%)`,
                        opacity: pose.opacity,
                        borderColor: state.highlighted ? node.color : undefined,
                      }}
                    >
                      {loading ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          className="motion-safe:animate-spin"
                        >
                          <path d="M12 3a9 9 0 1 0 9 9" />
                        </svg>
                      ) : failed.has(node.id) ? (
                        <span title={labels.loadFailed}>!</span>
                      ) : node.lazy ? (
                        (node.data.childCount ?? "+")
                      ) : state.collapsed ? (
                        node.children.length
                      ) : (
                        "−"
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, layout.nodes.length)}
        aria-valuenow={Math.max(1, layout.nodes.findIndex((node) => node.id === activeId) + 1)}
        aria-valuetext={valueText}
        aria-busy={busy.size > 0}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            setActiveId((current) => current ?? model.root.id);
          }
        }}
        onBlur={() => setActiveId(null)}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:-outline-offset-2"
      />

      <p role="status" className="sr-only">
        {busy.size > 0 ? labels.loading : failed.size > 0 ? labels.loadFailed : ""}
      </p>
      {searchable ? (
        <search
          className="absolute top-2 left-2 flex items-center gap-0.5 rounded-control border-divider bg-surface-control p-0.5 shadow-control"
          style={{ width: "min(17rem, calc(100% - 9.5rem))" }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="ml-1.5 shrink-0 text-ink-3"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder={labels.search}
            aria-label={labels.search}
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                stepMatch(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") onSearch("");
            }}
            className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[12px] text-ink outline-none placeholder:text-ink-3"
          />
          {query ? (
            <>
              <span
                aria-live="polite"
                className="hidden shrink-0 px-1 text-[11px] text-ink-3 tabular-nums @sm/chart:inline"
              >
                {matches.length > 0
                  ? `${matchIndex + 1} ${labels.of} ${matches.length}`
                  : labels.noMatches}
              </span>
              <button
                type="button"
                aria-label={labels.searchPrevious}
                disabled={matches.length === 0}
                onClick={() => stepMatch(-1)}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label={labels.searchNext}
                disabled={matches.length === 0}
                onClick={() => stepMatch(1)}
                className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-2 hover:bg-surface-2 disabled:opacity-40"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </>
          ) : null}
        </search>
      ) : null}
      {controls ? (
        <div
          role="toolbar"
          aria-label={labels.controls}
          className="absolute top-2 right-2 flex items-center gap-1 rounded-control border-divider bg-surface-control p-0.5 shadow-control"
        >
          <span className="hidden px-1.5 font-semibold text-[11px] text-ink-3 tabular-nums @sm/chart:inline">
            {Math.round(view.k * 100)}%
          </span>
          <ToolButton label={labels.zoomOut} onClick={() => panZoom.zoomBy(1 / ZOOM_STEP)}>
            <path d="M5 12h14" />
          </ToolButton>
          <ToolButton label={labels.zoomIn} onClick={() => panZoom.zoomBy(ZOOM_STEP)}>
            <path d="M5 12h14M12 5v14" />
          </ToolButton>
          <ToolButton label={labels.fit} onClick={refit}>
            <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
          </ToolButton>
        </div>
      ) : null}
      {wheelZoom === "modifier" ? (
        <p className="pointer-events-none absolute bottom-1.5 left-2 m-0 hidden text-[11px] text-ink-3 @md/chart:block">
          {labels.zoomHint}
        </p>
      ) : null}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 cursor-pointer place-items-center rounded-xs border-0 bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent-ink @sm/chart:size-8"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

interface TreeEdgesProps {
  poses: readonly TreePose[];
  byPose: Map<string, TreePose>;
  path: ReadonlySet<string>;
  direction: TreeDirection;
  edgeStyle: TreeEdgeStyle;
  edgeColor: TreeEdgeColor;
  /** Radial layouts: where the rings are centred. */
  center?: { x: number; y: number };
  model: TreeModel;
}

/** Parent-child links; the highlighted path is drawn last, on top, in the branch color. */
function TreeEdges({
  poses,
  byPose,
  path,
  direction,
  edgeStyle,
  edgeColor,
  center,
  model,
}: TreeEdgesProps) {
  const edges = poses.flatMap((pose) => {
    const parent = pose.parentId ? byPose.get(pose.parentId) : undefined;
    if (!parent) return [];
    const on = path.has(pose.id) && path.has(parent.id);
    return [{ pose, parent, on }];
  });
  edges.sort((a, b) => Number(a.on) - Number(b.on));
  return (
    <g fill="none">
      {edges.map(({ pose, parent, on }) => {
        const node = model.byId.get(pose.id);
        const colored = edgeColor !== "neutral" && node;
        const stroke = colored
          ? edgeColorOf(node, edgeColor)
          : on
            ? (node?.color ?? "var(--accent-word)")
            : "var(--line-strong)";
        return (
          <path
            key={pose.id}
            d={
              center
                ? radialEdgePath(parent, pose, center, edgeStyle)
                : treeEdgePath(parent, pose, direction, edgeStyle)
            }
            strokeWidth={on ? 2.5 : 1.5}
            strokeLinecap="round"
            className="motion-safe:transition-[stroke-width,opacity] motion-safe:duration-150"
            style={{
              stroke,
              opacity: Math.min(pose.opacity, parent.opacity) * (path.size > 0 && !on ? 0.35 : 1),
            }}
          />
        );
      })}
    </g>
  );
}

function describe(node: TreeChartNode, collapsed: ReadonlySet<string>, labels: TreeLabels): string {
  const parts = [node.name];
  if (node.subtitle) parts.push(node.subtitle);
  if (node.badge) parts.push(node.badge);
  parts.push(`${labels.level} ${node.depth + 1}`);
  if (node.parent) {
    parts.push(`${node.index + 1} ${labels.of} ${node.parent.children.length}`);
  }
  if (node.children.length > 0) {
    const state = collapsed.has(node.id) ? `, ${labels.collapsed}` : "";
    parts.push(`${labels.children}: ${node.children.length}${state}`);
    parts.push(`${labels.descendants}: ${subtreeSize(node)}`);
  } else if (node.lazy) parts.push(labels.collapsed);
  return parts.join(". ");
}

function TreeTable({
  model,
  caption,
  labels,
}: {
  model: TreeModel;
  caption: string;
  labels: TreeLabels;
}) {
  const nodes = model.nodes;
  return (
    <ChartDataTable
      caption={caption}
      categoryHeader={labels.category}
      categories={nodes.map((node) => node.name)}
      columns={[
        { id: "subtitle", name: labels.subtitle, values: nodes.map((node) => node.subtitle ?? "") },
        { id: "level", name: labels.level, values: nodes.map((node) => `${node.depth + 1}`) },
        { id: "parent", name: labels.parent, values: nodes.map((node) => node.parent?.name ?? "") },
        {
          id: "children",
          name: labels.children,
          values: nodes.map((node) => `${node.children.length}`),
        },
        {
          id: "descendants",
          name: labels.descendants,
          values: nodes.map((node) => `${subtreeSize(node)}`),
        },
      ]}
    />
  );
}
