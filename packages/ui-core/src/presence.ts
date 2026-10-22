const SAFETY_MS = 50;

function toMs(value: string): number[] {
  return value.split(",").map((part) => {
    const text = part.trim();
    const number = Number.parseFloat(text);
    if (Number.isNaN(number)) return 0;
    return text.endsWith("ms") ? number : number * 1000;
  });
}

/** Properties whose transition can be an exit effect; colour transitions (hover styles) are not. */
const EXIT_PROPERTIES = new Set([
  "all",
  "opacity",
  "transform",
  "translate",
  "scale",
  "rotate",
  "filter",
  "backdrop-filter",
  "clip-path",
  "visibility",
  "width",
  "height",
  "max-width",
  "max-height",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
]);

const cycle = (list: number[], index: number) => list[index % list.length] ?? 0;

/**
 * Longest exit effect on the node, in ms: its own animation (when `animation-name` is set) or a
 * transition of an exit-relevant property. Unrelated transitions such as `transition: color` are
 * ignored so unmounting never waits for the safety timeout.
 */
export function exitDuration(node: Element): number {
  const style = getComputedStyle(node);
  const total = (durations: string, delays: string, index = 0): number =>
    cycle(toMs(durations), index) + cycle(toMs(delays), index);
  const animated =
    style.animationName === "none"
      ? 0
      : Math.max(
          0,
          ...toMs(style.animationDuration).map((_, i) =>
            total(style.animationDuration, style.animationDelay, i),
          ),
        );
  const properties = style.transitionProperty.split(",").map((part) => part.trim());
  const transitioned = Math.max(
    0,
    ...properties.map((property, i) =>
      EXIT_PROPERTIES.has(property) ? total(style.transitionDuration, style.transitionDelay, i) : 0,
    ),
  );
  return Math.max(animated, transitioned);
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/**
 * Calls `done` once the exit effect on `node` has finished: on `animationend` or `transitionend`
 * of the node itself, after a safety timeout, or at once without motion or under reduced motion.
 * The node must already carry its closed state (`data-state`) so the effect is running. Returns the
 * cancel; `done` never fires after it.
 */
export function waitForExit(node: HTMLElement, done: () => void): () => void {
  const duration = prefersReducedMotion() ? 0 : exitDuration(node);
  if (duration <= 0) {
    done();
    return () => {};
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    cancel();
    done();
  };
  const onEnd = (event: Event) => {
    if (event.target !== node) return;
    if (
      event.type === "transitionend" &&
      !EXIT_PROPERTIES.has((event as TransitionEvent).propertyName)
    )
      return;
    finish();
  };
  node.addEventListener("animationend", onEnd);
  node.addEventListener("transitionend", onEnd);
  const timer = setTimeout(finish, duration + SAFETY_MS);
  function cancel() {
    finished = true;
    node.removeEventListener("animationend", onEnd);
    node.removeEventListener("transitionend", onEnd);
    clearTimeout(timer);
  }
  return cancel;
}

export interface PresenceOptions {
  /** The node whose exit effect to wait for (read when `present(false)` is called). */
  node: () => HTMLElement | null | undefined;
  /** Fires when the node should be mounted (`true`) or may be removed (`false`). */
  onChange: (mounted: boolean) => void;
  /** Whether it starts mounted. Default `false`. */
  initial?: boolean;
}

export interface Presence {
  /** Request presence. `false` keeps it mounted until the exit effect finishes. */
  present(next: boolean): void;
  /** Whether the node should still be in the DOM. */
  mounted(): boolean;
  /** Cancels a pending exit without changing the mounted state. */
  destroy(): void;
}

/**
 * Framework-free port of the React kit's `usePresence`: keeps a node mounted while its exit
 * animation or transition runs. Call `present(false)` after the node carries its closed state.
 */
export function createPresence({ node, onChange, initial = false }: PresenceOptions): Presence {
  let mounted = initial;
  let cancel: (() => void) | undefined;
  const set = (next: boolean) => {
    if (mounted === next) return;
    mounted = next;
    onChange(next);
  };
  return {
    present(next) {
      cancel?.();
      cancel = undefined;
      if (next) return set(true);
      const target = node();
      if (!mounted) return;
      if (!target) return set(false);
      cancel = waitForExit(target, () => {
        cancel = undefined;
        set(false);
      });
    },
    mounted: () => mounted,
    destroy() {
      cancel?.();
      cancel = undefined;
    },
  };
}
