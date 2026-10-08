"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { keyboardDelta, normalizeSizes, type PanelConstraint, resizePair } from "./model.js";

type Direction = "horizontal" | "vertical";

interface GroupContextValue {
  direction: Direction;
  sizes: number[];
  constraints: PanelConstraint[];
  baseId: string;
  startDrag: (event: ReactPointerEvent<HTMLElement>, index: number) => void;
  nudge: (index: number, delta: number) => void;
  toEdge: (index: number, edge: "min" | "max") => void;
}

const GroupContext = createContext<GroupContextValue | null>(null);
const IndexContext = createContext(0);

function useGroup(): GroupContextValue {
  const value = useContext(GroupContext);
  if (!value)
    throw new Error("ResizablePanel and ResizableHandle must be inside ResizablePanelGroup");
  return value;
}

export interface ResizablePanelProps extends Omit<ComponentPropsWithoutRef<"div">, "id"> {
  /** Initial size in percent. Panels without one share what is left. */
  defaultSize?: number;
  /** Percent, default 0. */
  minSize?: number;
  /** Percent, default 100. */
  maxSize?: number;
}

/** A panel of a ResizablePanelGroup. Sizes are percentages of the group. */
export function ResizablePanel({
  defaultSize: _d,
  minSize: _min,
  maxSize: _max,
  className,
  style,
  ...props
}: ResizablePanelProps) {
  const group = useGroup();
  const index = useContext(IndexContext);
  const size = group.sizes[index] ?? 0;
  return (
    <div
      id={`${group.baseId}-panel-${index}`}
      data-panel=""
      className={cn("min-h-0 min-w-0 overflow-auto", className)}
      style={{ flex: `${size} 1 0%`, ...style }}
      {...props}
    />
  );
}

export interface ResizableHandleProps extends Omit<ComponentPropsWithoutRef<"div">, "role"> {
  /** Accessible name; the default describes the two neighbouring panels. */
  label?: string;
}

/** Draggable and keyboard-resizable separator between two panels. */
export function ResizableHandle({ label, className, ...props }: ResizableHandleProps) {
  const group = useGroup();
  const index = useContext(IndexContext);
  const { direction, sizes, constraints } = group;
  const a = sizes[index];
  const b = sizes[index + 1];
  const ca = constraints[index];
  const cb = constraints[index + 1];
  const total = (a ?? 0) + (b ?? 0);
  const low = ca && cb ? Math.max(ca.min, total - cb.max) : 0;
  const high = ca && cb ? Math.min(ca.max, total - cb.min) : 100;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = keyboardDelta(event.key, direction, event.shiftKey);
    if (delta !== null) {
      event.preventDefault();
      group.nudge(index, delta);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      group.toEdge(index, event.key === "Home" ? "min" : "max");
    }
  };

  const vertical = direction === "horizontal";
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable, resizable separator is not an <hr>
    <div
      role="separator"
      tabIndex={0}
      data-resizable-handle=""
      aria-label={label ?? "Redimensionar paneles"}
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-controls={`${group.baseId}-panel-${index}`}
      aria-valuenow={Math.round(a ?? 0)}
      aria-valuemin={Math.round(low)}
      aria-valuemax={Math.round(high)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => group.startDrag(event, index)}
      className={cn(
        "group relative flex shrink-0 touch-none select-none items-center justify-center outline-none",
        vertical ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize",
        "focus-visible:focus-ring",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "rounded-badge bg-divider transition-colors duration-(--motion-duration) ease-style group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging]:bg-accent",
          vertical ? "h-full w-px" : "h-px w-full",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute rounded-badge border-control bg-surface-control",
          vertical ? "h-6 w-1.5" : "h-1.5 w-6",
        )}
      />
    </div>
  );
}

export interface ResizablePanelGroupProps extends ComponentPropsWithoutRef<"div"> {
  direction?: Direction;
  /** Called with the layout in percent after every change. */
  onLayout?: (sizes: number[]) => void;
  children: ReactNode;
}

function isPanel(child: ReactNode): child is ReactElement<ResizablePanelProps> {
  return isValidElement(child) && child.type === ResizablePanel;
}

/** Row or column of resizable panels. Put a ResizableHandle between every two panels. */
export function ResizablePanelGroup({
  direction = "horizontal",
  onLayout,
  className,
  children,
  ...props
}: ResizablePanelGroupProps) {
  const baseId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const nodes = Children.toArray(children);
  const panels = nodes.filter(isPanel);
  const constraints = panels.map((p) => ({
    min: p.props.minSize ?? 0,
    max: p.props.maxSize ?? 100,
  }));

  const [sizes, setSizes] = useState(() =>
    normalizeSizes(
      panels.map((p) => p.props.defaultSize),
      constraints,
    ),
  );
  // Panels added or removed: start over from the declared defaults.
  const [count, setCount] = useState(panels.length);
  let current = sizes;
  if (count !== panels.length) {
    current = normalizeSizes(
      panels.map((p) => p.props.defaultSize),
      constraints,
    );
    setCount(panels.length);
    setSizes(current);
  }

  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;
  const sizesRef = useRef(current);
  sizesRef.current = current;

  const apply = (next: number[]) => {
    if (next === sizesRef.current) return;
    sizesRef.current = next;
    setSizes(next);
    onLayout?.(next);
  };

  const context: GroupContextValue = {
    direction,
    sizes: current,
    constraints,
    baseId,
    nudge: (index, delta) =>
      apply(resizePair(sizesRef.current, constraintsRef.current, index, delta)),
    toEdge: (index, edge) => {
      const cs = constraintsRef.current;
      const now = sizesRef.current;
      const ca = cs[index];
      const cb = cs[index + 1];
      const a = now[index];
      const b = now[index + 1];
      if (!ca || !cb || a === undefined || b === undefined) return;
      const total = a + b;
      const target =
        edge === "min" ? Math.max(ca.min, total - cb.max) : Math.min(ca.max, total - cb.min);
      apply(resizePair(now, cs, index, target - a));
    },
    startDrag: (event, index) => {
      if (event.button !== 0) return;
      const group = ref.current;
      if (!group) return;
      event.preventDefault();
      const handle = event.currentTarget;
      const horizontal = direction === "horizontal";
      const rect = group.getBoundingClientRect();
      const handleSpace = Array.from(
        group.querySelectorAll<HTMLElement>("[data-resizable-handle]"),
      ).reduce((sum, el) => {
        const r = el.getBoundingClientRect();
        return sum + (horizontal ? r.width : r.height);
      }, 0);
      const available = Math.max(1, (horizontal ? rect.width : rect.height) - handleSpace);
      const start = horizontal ? event.clientX : event.clientY;
      const startSizes = sizesRef.current;
      handle.setAttribute("data-dragging", "");
      const onMove = (e: PointerEvent) => {
        const delta = (((horizontal ? e.clientX : e.clientY) - start) / available) * 100;
        apply(resizePair(startSizes, constraintsRef.current, index, delta));
      };
      const onUp = () => {
        handle.removeAttribute("data-dragging");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
  };

  let panelIndex = -1;
  return (
    <GroupContext.Provider value={context}>
      <div
        ref={ref}
        data-direction={direction}
        className={cn(
          "@container/resizable flex h-full min-h-0 w-full min-w-0 overflow-hidden rounded-card border-card surface-card",
          direction === "horizontal" ? "flex-row" : "flex-col",
          className,
        )}
        {...props}
      >
        {nodes.map((node, i) => {
          if (isPanel(node)) panelIndex += 1;
          const key = isValidElement(node) && node.key !== null ? node.key : i;
          return (
            <IndexContext.Provider key={key} value={Math.max(0, panelIndex)}>
              {node}
            </IndexContext.Provider>
          );
        })}
      </div>
    </GroupContext.Provider>
  );
}
