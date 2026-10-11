"use client";

import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "../../utils/compose.js";
import { Slot } from "../../utils/slot.js";
import {
  type Align,
  type ArrowGeometry,
  computePlacement,
  type Direction,
  intersectRects,
  type Padding,
  type Rect,
  type Side,
} from "./geometry.js";

/**
 * Anchored positioning primitive: `Root` > `Anchor` + `Content` (+ `Arrow`).
 *
 * `Content` renders a fixed-position wrapper (`[data-ui-popper-wrapper]`) holding
 * the element you style. It exposes `data-side`/`data-align` on that element and
 * these CSS variables, inherited from the wrapper:
 * `--ui-popper-available-width`, `--ui-popper-available-height`,
 * `--ui-popper-anchor-width`, `--ui-popper-anchor-height`, `--ui-popper-transform-origin`.
 */

interface PopperContextValue {
  anchor: HTMLElement | null;
  setAnchor: (node: HTMLElement | null) => void;
  arrow: ArrowGeometry | null;
  setArrow: (arrow: ArrowGeometry | null) => void;
}

const PopperContext = createContext<PopperContextValue | null>(null);

function usePopperContext(part: string): PopperContextValue {
  const context = useContext(PopperContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Popper.Root>`);
  return context;
}

export function Root({ children }: { children?: ReactNode }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [arrow, setArrow] = useState<ArrowGeometry | null>(null);
  const value = useMemo(() => ({ anchor, setAnchor, arrow, setArrow }), [anchor, arrow]);
  return <PopperContext.Provider value={value}>{children}</PopperContext.Provider>;
}

export interface PopperAnchorProps extends ComponentProps<"div"> {
  asChild?: boolean;
}

/** The element the content is positioned against. */
export function Anchor({ asChild, ref, ...props }: PopperAnchorProps) {
  const { setAnchor } = usePopperContext("PopperAnchor");
  const composedRef = useComposedRefs<HTMLDivElement>(ref, setAnchor);
  const Comp = asChild ? Slot : "div";
  return <Comp {...props} ref={composedRef as never} />;
}

interface ContentContextValue {
  side: Side;
  arrowX: number | undefined;
  arrowY: number | undefined;
  arrowHidden: boolean;
}

const ContentContext = createContext<ContentContextValue | null>(null);

export interface PopperContentProps extends ComponentProps<"div"> {
  side?: Side;
  align?: Align;
  /** Gap between the anchor and the content, in px. */
  sideOffset?: number;
  /** Shift along the edge, in px. Follows the reading direction for `start`/`end`. */
  alignOffset?: number;
  /** Distance kept from the boundary edges. */
  collisionPadding?: Padding;
  /** Element(s) the content must stay inside, intersected with the viewport. Keep the reference stable. */
  collisionBoundary?: Element | null | Array<Element | null>;
  /** Flip and shift to avoid the boundary. Defaults to true. */
  avoidCollisions?: boolean;
  /** `partial` keeps the content touching the anchor while shifting. Defaults to `partial`. */
  sticky?: "partial" | "always";
  /** Hide the content while the anchor is scrolled out of the boundary. */
  hideWhenDetached?: boolean;
  /** Minimum distance between the arrow and the content corners. */
  arrowPadding?: number;
  /** Reading direction; read from the anchor element when omitted. */
  dir?: Direction;
}

interface Placed {
  side: Side;
  align: Align;
  positioned: boolean;
  arrowX: number | undefined;
  arrowY: number | undefined;
  arrowHidden: boolean;
}

const samePlaced = (a: Placed, b: Placed) =>
  a.side === b.side &&
  a.align === b.align &&
  a.positioned === b.positioned &&
  a.arrowX === b.arrowX &&
  a.arrowY === b.arrowY &&
  a.arrowHidden === b.arrowHidden;

function paddingKey(padding: Padding): string {
  return typeof padding === "number" ? String(padding) : JSON.stringify(padding);
}

function boundaryRect(boundary: PopperContentProps["collisionBoundary"]): Rect {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const rects: Rect[] = [
    viewport
      ? {
          x: viewport.offsetLeft,
          y: viewport.offsetTop,
          width: viewport.width,
          height: viewport.height,
        }
      : { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight },
  ];
  for (const element of [boundary].flat()) {
    if (!element) continue;
    const { left, top, width, height } = element.getBoundingClientRect();
    rects.push({ x: left, y: top, width, height });
  }
  return intersectRects(rects);
}

/**
 * Top-left of the closest ancestor that becomes the containing block of fixed
 * descendants (transform, filter, contain, will-change...), in viewport coordinates.
 */
function containingBlockOrigin(node: HTMLElement): { x: number; y: number } {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const creates =
      style.transform !== "none" ||
      style.perspective !== "none" ||
      style.filter !== "none" ||
      (style.backdropFilter !== undefined && style.backdropFilter !== "none") ||
      /paint|layout|strict|content/.test(style.contain) ||
      /transform|perspective|filter/.test(style.willChange) ||
      (style.containerType !== undefined && !["", "normal"].includes(style.containerType));
    if (creates) {
      const box = parent.getBoundingClientRect();
      // A scrolled containing block carries its fixed descendants along with its content.
      return {
        x: box.left + parent.clientLeft - parent.scrollLeft,
        y: box.top + parent.clientTop - parent.scrollTop,
      };
    }
  }
  return { x: 0, y: 0 };
}

export function Content({
  side = "bottom",
  align = "center",
  sideOffset = 0,
  alignOffset = 0,
  collisionPadding = 0,
  collisionBoundary,
  avoidCollisions = true,
  sticky = "partial",
  hideWhenDetached = false,
  arrowPadding = 0,
  dir,
  ref,
  style,
  ...props
}: PopperContentProps) {
  const { anchor, arrow } = usePopperContext("PopperContent");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs<HTMLDivElement>(ref, setContent);
  const [placed, setPlaced] = useState<Placed>({
    side,
    align,
    positioned: false,
    arrowX: undefined,
    arrowY: undefined,
    arrowHidden: false,
  });
  const boundaryRef = useRef(collisionBoundary);
  boundaryRef.current = collisionBoundary;
  const padding = paddingKey(collisionPadding);
  const paddingRef = useRef(collisionPadding);
  paddingRef.current = collisionPadding;

  // The wrapper owns the stacking context; the styled content decides its z-index.
  useLayoutEffect(() => {
    if (content && wrapperRef.current) {
      wrapperRef.current.style.zIndex = getComputedStyle(content).zIndex;
    }
  }, [content]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `padding` is the stable key of `collisionPadding`, read through a ref
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !content || !anchor) return;
    let frame = 0;

    const update = () => {
      const anchorBox = anchor.getBoundingClientRect();
      const anchorRect: Rect = {
        x: anchorBox.left,
        y: anchorBox.top,
        width: anchorBox.width,
        height: anchorBox.height,
      };
      // The content is portaled, so the anchor is the one that sits inside the app's `dir`.
      const direction = dir ?? (getComputedStyle(anchor).direction === "rtl" ? "rtl" : "ltr");
      wrapper.setAttribute("dir", direction);
      const boundary = boundaryRect(boundaryRef.current);
      const place = () =>
        computePlacement({
          anchor: anchorRect,
          content: { width: content.offsetWidth, height: content.offsetHeight },
          boundary,
          side,
          align,
          sideOffset,
          alignOffset,
          collisionPadding: paddingRef.current,
          avoidCollisions,
          sticky,
          dir: direction,
          ...(arrow ? { arrow: { ...arrow, padding: arrowPadding } } : {}),
        });
      const set = (name: string, value: string) => wrapper.style.setProperty(name, value);
      const publish = (placement: ReturnType<typeof place>) => {
        set("--ui-popper-available-width", `${placement.availableWidth}px`);
        set("--ui-popper-available-height", `${placement.availableHeight}px`);
        set("--ui-popper-anchor-width", `${anchorRect.width}px`);
        set("--ui-popper-anchor-height", `${anchorRect.height}px`);
        set("--ui-popper-transform-origin", placement.transformOrigin);
      };
      let result = place();
      publish(result);
      // The available-size variables usually drive max-height/max-width: measure again
      // with them applied so the first frame is not placed for the unlimited size.
      for (let pass = 0; pass < 2; pass++) {
        const again = place();
        if (again.x === result.x && again.y === result.y && again.side === result.side) break;
        result = again;
        publish(result);
      }
      const ratio = window.devicePixelRatio || 1;
      const snap = (value: number) => Math.round(value * ratio) / ratio;
      const origin = containingBlockOrigin(wrapper);
      wrapper.style.transform = `translate3d(${snap(result.x - origin.x)}px, ${snap(result.y - origin.y)}px, 0)`;
      const hidden = hideWhenDetached && result.anchorHidden;
      wrapper.style.visibility = hidden ? "hidden" : "";
      wrapper.style.pointerEvents = hidden ? "none" : "";
      const next: Placed = {
        side: result.side,
        align: result.align,
        positioned: true,
        arrowX: result.arrow?.x,
        arrowY: result.arrow?.y,
        arrowHidden: result.arrow?.shouldHide ?? false,
      };
      setPlaced((current) => (samePlaced(current, next) ? current : next));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => update());
    observer?.observe(anchor);
    observer?.observe(content);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      observer?.disconnect();
    };
  }, [
    anchor,
    content,
    arrow,
    side,
    align,
    sideOffset,
    alignOffset,
    padding,
    avoidCollisions,
    sticky,
    hideWhenDetached,
    arrowPadding,
    dir,
  ]);

  const contentValue = useMemo(
    () => ({
      side: placed.side,
      arrowX: placed.arrowX,
      arrowY: placed.arrowY,
      arrowHidden: placed.arrowHidden,
    }),
    [placed.side, placed.arrowX, placed.arrowY, placed.arrowHidden],
  );

  return (
    <div
      data-ui-popper-wrapper=""
      ref={wrapperRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        // Parked off-screen until the first measurement lands, so nothing flashes.
        transform: "translate3d(0px, -200%, 0)",
        minWidth: "max-content",
        willChange: "transform",
      }}
    >
      <ContentContext.Provider value={contentValue}>
        <div
          data-side={placed.side}
          data-align={placed.align}
          {...props}
          ref={composedRef}
          style={placed.positioned ? style : { ...style, animation: "none" }}
        />
      </ContentContext.Provider>
    </div>
  );
}

export interface PopperArrowProps extends ComponentProps<"span"> {
  /** Length of the base along the content edge, in px. */
  width?: number;
  /** Protrusion from the content edge, in px; it is added to `sideOffset`. */
  height?: number;
}

const BASE_SIDE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};
const OUTWARD: Record<Side, string> = {
  top: "translateY(-100%)",
  bottom: "translateY(100%)",
  left: "translateX(-100%)",
  right: "translateX(100%)",
};

/** Triangle inside a `w` x `h` box, pointing back at the anchor from the content's `side`. */
function arrowPoints(side: Side, w: number, h: number): string {
  if (side === "bottom") return `0,${h} ${w},${h} ${w / 2},0`;
  if (side === "top") return `0,0 ${w},0 ${w / 2},${h}`;
  if (side === "right") return `${w},0 ${w},${h} 0,${h / 2}`;
  return `0,0 0,${h} ${w},${h / 2}`;
}

/**
 * Pointer towards the anchor. Renders a triangle filled with `currentColor`
 * unless you pass children. Place it as the last child of `Content`.
 */
export function Arrow({ width = 10, height = 5, children, style, ...props }: PopperArrowProps) {
  const { setArrow } = usePopperContext("PopperArrow");
  const content = useContext(ContentContext);
  useLayoutEffect(() => {
    setArrow({ width, height });
    return () => setArrow(null);
  }, [width, height, setArrow]);
  if (!content) throw new Error("<PopperArrow> must be rendered inside <Popper.Content>");
  const { side, arrowX, arrowY, arrowHidden } = content;
  const vertical = side === "top" || side === "bottom";
  const base = BASE_SIDE[side];
  const boxWidth = vertical ? width : height;
  const boxHeight = vertical ? height : width;
  return (
    <span
      data-side={side}
      {...props}
      style={{
        position: "absolute",
        [base]: 0,
        ...(vertical ? { left: arrowX } : { top: arrowY }),
        transform: OUTWARD[base],
        lineHeight: 0,
        pointerEvents: "none",
        ...(arrowHidden ? { visibility: "hidden" } : null),
        ...style,
      }}
    >
      {children ?? (
        <svg
          aria-hidden="true"
          width={boxWidth}
          height={boxHeight}
          viewBox={`0 0 ${boxWidth} ${boxHeight}`}
          fill="currentColor"
          style={{ display: "block" }}
        >
          <polygon points={arrowPoints(side, boxWidth, boxHeight)} />
        </svg>
      )}
    </span>
  );
}
