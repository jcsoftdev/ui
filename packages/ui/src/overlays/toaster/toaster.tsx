"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useUiStrings } from "../../i18n/ui-strings-provider.js";
import { Portal } from "../../primitives/portal.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import {
  dismiss,
  getServerSnapshot,
  getSnapshot,
  remove,
  selectVisible,
  subscribe,
  type ToastRecord,
} from "./toast-store.js";

export type { ToastAction, ToastOptions } from "./toast.js";
export { toast } from "./toast.js";

export type ToasterPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToasterProps {
  position?: ToasterPosition;
  /** Default auto dismiss delay in ms; `Infinity` disables it. */
  duration?: number;
  /** Toasts shown at once; older ones wait until a newer one leaves. */
  visibleToasts?: number;
  className?: string;
  /** Accessible name of the region. Defaults to the `notifications` UI string. */
  label?: string;
  /**
   * Element the region is portaled into. Defaults to `document.body`, which sits outside
   * wrapper-scoped CSS variables, theme classes and `dir`; pass the themed root to inherit them.
   */
  container?: HTMLElement | null;
  /** Text direction of the region. Defaults to the `dir` of the `<html>` element. */
  dir?: "ltr" | "rtl";
}

const EXIT_MS = 200;
const SWIPE_THRESHOLD = 60;

const POSITION: Record<ToasterPosition, string> = {
  "top-left": "top-4 left-4 items-start",
  "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
  "top-right": "top-4 right-4 items-end",
  "bottom-left": "bottom-4 left-4 items-start",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
  "bottom-right": "bottom-4 right-4 items-end",
};

function documentDir(): "ltr" | "rtl" | undefined {
  if (typeof document === "undefined") return undefined;
  const value = document.documentElement.getAttribute("dir");
  return value === "rtl" || value === "ltr" ? value : undefined;
}

function useDocumentHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return hidden;
}

/** Auto dismiss that keeps its remaining time while paused. */
function useDismissTimer(record: ToastRecord, duration: number, paused: boolean) {
  const remaining = useRef(duration);
  const lastRevision = useRef(record.revision);
  if (lastRevision.current !== record.revision) {
    lastRevision.current = record.revision;
    remaining.current = duration;
  }
  const { id, revision, state } = record;
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision restarts the timer on update.
  useEffect(() => {
    if (state !== "open" || paused || !Number.isFinite(duration)) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismiss(id), Math.max(0, remaining.current));
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [id, revision, state, paused, duration]);
}

interface ToastItemProps {
  record: ToastRecord;
  duration: number;
  reducedMotion: boolean;
}

function ToastItem({ record, duration, reducedMotion }: ToastItemProps) {
  const { id, state, tone } = record;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; pointerId: number } | null>(null);
  const hidden = useDocumentHidden();
  const effectiveDuration = record.duration ?? duration;

  useDismissTimer(record, effectiveDuration, hovered || focused || hidden);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (state !== "closed") return;
    if (reducedMotion) {
      remove(id);
      return;
    }
    const timer = setTimeout(() => remove(id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [state, id, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismiss(id);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    drag.current = { x: event.clientX, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setDragX(event.clientX - drag.current.x);
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    drag.current = null;
    setDragX(0);
    if (Math.abs(dx) >= SWIPE_THRESHOLD) dismiss(id);
  };

  const isError = tone === "error";
  const closed = state === "closed";
  const swiping = dragX !== 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role is status/alert; handlers only pause the timer, swipe and Escape.
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      data-state={state}
      data-type={tone}
      data-swiping={swiping || undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={
        swiping
          ? { transform: `translateX(${dragX}px)`, opacity: 1 - Math.abs(dragX) / 200 }
          : undefined
      }
      className={cn(
        "pointer-events-auto flex min-h-11 w-max max-w-[min(92vw,26rem)] touch-pan-y items-center gap-3 rounded-button bg-toast-bg py-1.5 pr-2 pl-4 text-control text-toast-ink shadow-overlay",
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        !entered && "opacity-0 data-[state=open]:translate-y-2",
        closed && "opacity-0",
        closed && !reducedMotion && "scale-95",
      )}
    >
      <div className="min-w-0 flex-1">
        <div>{record.message}</div>
        {record.description ? <div className="opacity-70">{record.description}</div> : null}
      </div>
      {record.action ? (
        <button
          type="button"
          className="h-8 shrink-0 rounded-button bg-toast-ink/18 px-3 font-bold text-toast-ink focus-ring"
          onClick={(event) => {
            record.action?.onClick(event);
            if (!event.defaultPrevented) dismiss(id);
          }}
        >
          {record.action.label}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Ephemeral, non-critical confirmations. Pass `action: { label, onClick }` to
 * `toast()` for an undo button. Critical messages belong in a banner instead.
 */
export function Toaster({
  position = "bottom-center",
  duration = 6000,
  visibleToasts = 2,
  className,
  label,
  container,
  dir,
}: ToasterProps) {
  const strings = useUiStrings();
  const reducedMotion = usePrefersReducedMotion();
  const records = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const regionRef = useRef<HTMLElement>(null);
  const shown = selectVisible(records, visibleToasts);
  const fromTop = position.startsWith("top");

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey && event.code === "KeyT") regionRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Portal container={container}>
      <section
        ref={regionRef}
        dir={dir ?? documentDir()}
        data-ui-overlay-ignore=""
        aria-label={label ?? strings.notifications}
        tabIndex={-1}
        className={cn(
          "pointer-events-none fixed z-[1000] flex outline-none",
          POSITION[position],
          className,
        )}
      >
        <div
          className={cn("m-0 flex list-none gap-2 p-0", fromTop ? "flex-col-reverse" : "flex-col")}
        >
          {shown.map((record) => (
            <ToastItem
              key={record.id}
              record={record}
              duration={duration}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </section>
    </Portal>
  );
}
