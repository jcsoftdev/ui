"use client";

import { cn } from "../../utils/cn.js";
import { tint } from "../core/color-scale.js";
import { initials, type TreeChartNode } from "./tree-model.js";

/** State of a node passed to the card template. */
export interface TreeNodeState {
  /** On the highlighted path (hover or keyboard) from the root. */
  highlighted: boolean;
  /** Something else is highlighted: the card may fade back. */
  dimmed: boolean;
  /** Keyboard cursor. */
  active: boolean;
  /** Children are hidden. */
  collapsed: boolean;
  hasChildren: boolean;
  /** Nodes below this one, at any depth. */
  descendants: number;
  /** `showCounts` is on: the template should display `descendants`. */
  showCount: boolean;
  /** Children are being fetched. */
  loading: boolean;
  /** Matches the search box. */
  matched: boolean;
  /** Chosen with a click or the search box; its path to the root stays lit. */
  selected: boolean;
}

export interface TreeCardProps {
  node: TreeChartNode;
  state: TreeNodeState;
}

/**
 * Default node template: a card with a color rail, an avatar (image or
 * initials), the name, a subtitle and an optional badge. Fills its box.
 */
export function TreeCard({ node, state }: TreeCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-tile border bg-surface-card pr-2.5 pl-3.5 text-left shadow-control",
        node.group && "border-dashed",
        "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150",
        state.highlighted ? "shadow-raised" : "border-line",
      )}
      style={state.highlighted ? { borderColor: node.color } : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: node.color }}
      />
      <span
        className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-avatar font-bold text-fs-120 text-ink"
        style={{ background: tint(node.color, 24) }}
      >
        {node.image ? (
          <img src={node.image} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          initials(node.name)
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold text-fs-130 text-ink leading-tight">
          {node.name}
        </span>
        {node.subtitle || node.badge ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {node.subtitle ? (
              <span className="min-w-0 flex-1 truncate text-fs-110 text-ink-3 leading-tight">
                {node.subtitle}
              </span>
            ) : null}
            {node.badge ? (
              <span
                className="max-w-[60%] shrink-0 truncate rounded-badge px-1.5 font-bold text-fs-100 text-ink-2 leading-4"
                style={{ background: tint(node.color, 16) }}
              >
                {node.badge}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <CountBadge state={state} color={node.color} />
    </div>
  );
}

/** Descendant count pill, shared by the card and the chip. */
function CountBadge({ state, color }: { state: TreeNodeState; color: string }) {
  if (!state.showCount || state.descendants === 0) return null;
  return (
    <span
      className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-badge px-1 font-bold text-fs-100 text-ink tabular-nums"
      style={{ background: tint(color, 22) }}
      title={`+${state.descendants}`}
    >
      {state.descendants}
    </span>
  );
}

/**
 * Compact node template for the radial and dendrogram layouts: a pill with a
 * color dot, the name and, optionally, the descendant count.
 */
export function TreeChip({ node, state }: TreeCardProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center gap-1.5 overflow-hidden rounded-badge border bg-surface px-2 text-left shadow-control",
        "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-150",
        node.group && "border-dashed",
        state.highlighted ? "shadow-raised" : "border-line",
      )}
      style={state.highlighted ? { borderColor: node.color } : undefined}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-pill"
        style={{ background: node.color }}
      />
      <span className="min-w-0 flex-1 truncate font-semibold text-fs-110 text-ink leading-none">
        {node.name}
      </span>
      <CountBadge state={state} color={node.color} />
    </div>
  );
}
