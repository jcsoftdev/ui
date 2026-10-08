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
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
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
import { type ChartLabels, DEFAULT_LABELS } from "../core/types.js";
import { usePanZoom } from "../core/use-pan-zoom.js";
import { TreeCard, type TreeNodeState } from "./tree-card.js";
import {
  buildTreeModel,
  initialCollapsed,
  type TreeChartDatum,
  type TreeChartNode,
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
};

export interface TreeChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; `null` shows the empty state. */
  data: TreeChartDatum | null;
  /** Where the root sits: `top` (default), `bottom`, `left` or `right`. */
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
  const model = useMemo(() => (data ? buildTreeModel(data) : null), [data]);
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
            {...rest}
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
  extends Omit<TreeChartProps, "data" | "height" | "aspectRatio" | "loading" | "labels"> {
  model: TreeModel;
  width: number;
  height: number;
  labels: TreeLabels;
}

const ZOOM_STEP = 1.25;
const TOOLBAR_BAND = 36;

/** Point of a node box that faces its children, where the toggle button sits. */
function toggleAnchor(pose: TreeLayoutNode, direction: TreeDirection): [number, number] {
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
  direction = "top",
  edgeStyle = "curved",
  nodeWidth = 196,
  nodeHeight = 64,
  siblingGap = 20,
  levelGap = 56,
  initialDepth = Number.POSITIVE_INFINITY,
  collapsible = true,
  highlightPath = true,
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
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(model, initialDepth));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // New data: start again from its own collapsed flags.
  const [seenModel, setSeenModel] = useState(model);
  if (seenModel !== model) {
    setSeenModel(model);
    setCollapsed(initialCollapsed(model, initialDepth));
    setActiveId(null);
  }

  const layout = useMemo(
    () =>
      treeLayout(
        visibleTree(model.root, collapsed, () => ({ width: nodeWidth, height: nodeHeight })),
        { direction, siblingGap, levelGap },
      ),
    [model, collapsed, direction, nodeWidth, nodeHeight, siblingGap, levelGap],
  );
  const parentOf = useCallback((id: string) => model.byId.get(id)?.parent?.id ?? null, [model]);
  const poses = useTreeTransition(layout, parentOf, { disabled: !animate });

  const panZoom = usePanZoom<HTMLDivElement>({ minZoom, maxZoom, wheel: wheelZoom });
  const { view, setView, userMoved } = panZoom;
  // The zoom toolbar keeps a band at the top, so a fitted tree never sits under it.
  const toolbarBand = controls ? TOOLBAR_BAND : 0;
  // The fit button flips between the whole tree and the readable view; `null` follows `fit`.
  const [fitChoice, setFitChoice] = useState<TreeFitMode | null>(null);
  const appliedFit = useRef<TreeFitMode>("contain");
  const fit = useCallback(() => {
    const next = treeFitView(layout, width, height, direction, {
      inset: toolbarBand,
      mode: fitChoice ?? fitProp,
      minZoom,
    });
    appliedFit.current = next.mode;
    setView(next.view, { user: false });
  }, [layout, width, height, direction, toolbarBand, minZoom, fitChoice, fitProp, setView]);
  // Follow the container and the expanding tree until the user pans or zooms.
  useEffect(() => {
    if (!userMoved.current) fit();
  }, [fit, userMoved]);
  const refit = () => {
    const moved = userMoved.current;
    userMoved.current = false;
    // After panning or zooming, the button restores the current fit; on a fitted view it switches.
    if (moved) fit();
    else setFitChoice(appliedFit.current === "contain" ? "readable" : "contain");
  };

  const toggle = (node: TreeChartNode) => {
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

  const highlightId = highlightPath ? (hoverId ?? activeId) : null;
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
        element.animate([{ opacity: 0 }, { opacity: 1 }], {
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
              model={model}
            />
          </svg>
          <div aria-hidden="true">
            {poses.map((pose) => {
              const node = model.byId.get(pose.id);
              if (!node) return null;
              const hasChildren = node.children.length > 0;
              const state: TreeNodeState = {
                highlighted: path.has(node.id),
                dimmed: path.size > 0 && !path.has(node.id),
                active: activeId === node.id,
                collapsed: collapsed.has(node.id),
                hasChildren,
              };
              const [tx, ty] = toggleAnchor(pose, direction);
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
                      if (onNodeClick) onNodeClick(node);
                      else toggle(node);
                    }}
                  >
                    {renderNode ? renderNode(node, state) : <TreeCard node={node} state={state} />}
                    {state.active ? (
                      <span className="pointer-events-none absolute -inset-1 rounded-[calc(var(--radius-tile)+4px)] border-2 border-ink" />
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
                      className="absolute top-0 left-0 grid h-5 min-w-5 cursor-pointer place-items-center rounded-pill border border-line bg-surface px-1 font-bold text-[10px] text-ink-2 tabular-nums shadow-flat hover:text-ink"
                      style={{
                        transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%)`,
                        opacity: pose.opacity,
                        borderColor: state.highlighted ? node.color : undefined,
                      }}
                    >
                      {state.collapsed ? node.children.length : "−"}
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
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) {
            setActiveId((current) => current ?? model.root.id);
          }
        }}
        onBlur={() => setActiveId(null)}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:-outline-offset-2"
      />

      {controls ? (
        <div
          role="toolbar"
          aria-label={labels.controls}
          className="absolute top-2 right-2 flex items-center gap-1 rounded-control border border-line bg-surface p-0.5 shadow-flat"
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
  model: TreeModel;
}

/** Parent-child links; the highlighted path is drawn last, on top, in the branch color. */
function TreeEdges({ poses, byPose, path, direction, edgeStyle, model }: TreeEdgesProps) {
  const edges = poses.flatMap((pose) => {
    const parent = pose.parentId ? byPose.get(pose.parentId) : undefined;
    if (!parent) return [];
    const on = path.has(pose.id) && path.has(parent.id);
    return [{ pose, parent, on }];
  });
  edges.sort((a, b) => Number(a.on) - Number(b.on));
  return (
    <g fill="none">
      {edges.map(({ pose, parent, on }) => (
        <path
          key={pose.id}
          d={treeEdgePath(parent, pose, direction, edgeStyle)}
          strokeWidth={on ? 2.5 : 1.5}
          strokeLinecap="round"
          className="motion-safe:transition-[stroke-width] motion-safe:duration-150"
          style={{
            stroke: on
              ? (model.byId.get(pose.id)?.color ?? "var(--accent-word)")
              : "var(--line-strong)",
            opacity: Math.min(pose.opacity, parent.opacity),
          }}
        />
      ))}
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
  }
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
      ]}
    />
  );
}
