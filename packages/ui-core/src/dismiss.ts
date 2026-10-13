/** Ordered stack of open layers; only the topmost reacts to Escape and outside presses. */
export interface LayerStack<T extends object = object> {
  push(layer: T): () => void;
  isTop(layer: T): boolean;
  size(): number;
}

export function createLayerStack<T extends object = object>(): LayerStack<T> {
  const layers: T[] = [];
  return {
    push(layer) {
      layers.push(layer);
      return () => {
        const index = layers.indexOf(layer);
        if (index !== -1) layers.splice(index, 1);
      };
    },
    isTop: (layer) => layers[layers.length - 1] === layer,
    size: () => layers.length,
  };
}

const KEY = Symbol.for("@jcsoftdev/ui-core/layers");

/** The page-wide stack every dismiss layer joins (shared across copies of this module). */
export function overlayLayers(): LayerStack {
  const scope = globalThis as unknown as Record<symbol, LayerStack | undefined>;
  scope[KEY] ??= createLayerStack();
  return scope[KEY];
}

/** Elements carrying this attribute are branches of every layer (the toast region). */
export const LAYER_BRANCH_ATTRIBUTE = "data-ui-layer-branch";
const LAYER_BRANCH = `[${LAYER_BRANCH_ATTRIBUTE}]`;
/** An in-content widget that wants this Escape for itself (a field with a query to clear). */
const ESCAPE_CLAIM = "[data-ui-escape-claim]";

export type OutsideEvent<E extends Event = Event> = CustomEvent<{ originalEvent: E }>;

export interface DismissLayerOptions {
  onDismiss: () => void;
  /** `preventDefault()` keeps the layer open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: OutsideEvent<PointerEvent>) => void;
  onFocusOutside?: (event: OutsideEvent<FocusEvent>) => void;
  onInteractOutside?: (event: OutsideEvent) => void;
  /** Extra nodes that count as inside (the trigger, a portaled child). */
  inside?: () => Array<Node | null | undefined>;
  /** Join a different stack than {@link overlayLayers}. */
  stack?: LayerStack;
}

function outside<E extends Event>(name: string, originalEvent: E): OutsideEvent<E> {
  return new CustomEvent(name, { cancelable: true, detail: { originalEvent } });
}

/**
 * Escape and outside press/focus dismissal for `element`, stacked: a layer opened above another
 * takes the Escape and the outside presses until it closes. Every callback may
 * `preventDefault()` to keep the layer open. Mirrors the React kit's `useDismissableLayer`.
 * Returns the cleanup.
 */
export function createDismissLayer(element: HTMLElement, options: DismissLayerOptions): () => void {
  const stack = options.stack ?? overlayLayers();
  const token = {};
  const pop = stack.push(token);
  const isTop = () => stack.isTop(token);

  const isInside = (target: EventTarget | null) => {
    if (!(target instanceof Node)) return false;
    const path = [element, ...(options.inside?.() ?? [])];
    if (path.some((node) => node?.contains(target))) return true;
    return target instanceof Element && target.closest(LAYER_BRANCH) !== null;
  };
  const pathInside = (event: Event) =>
    event.composedPath().some((node) => node instanceof Node && isInside(node));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.isComposing || event.keyCode === 229) return;
    if (event.defaultPrevented || !isTop()) return;
    if (event.target instanceof Element && event.target.closest(ESCAPE_CLAIM)) return;
    options.onEscapeKeyDown?.(event);
    if (!event.defaultPrevented) {
      event.preventDefault();
      options.onDismiss();
    }
  };

  const dispatch = <E extends Event>(
    name: string,
    original: E,
    specific: ((event: OutsideEvent<E>) => void) | undefined,
  ) => {
    const event = outside(name, original);
    specific?.(event);
    options.onInteractOutside?.(event as OutsideEvent);
    if (!event.defaultPrevented) options.onDismiss();
  };

  let removeTouchClick: (() => void) | undefined;
  const onPointerDown = (event: PointerEvent) => {
    removeTouchClick?.();
    if (pathInside(event) || !isTop()) return;
    const fire = () => dispatch("ui.pointerDownOutside", event, options.onPointerDownOutside);
    if (event.pointerType === "touch") {
      document.addEventListener("click", fire, { once: true });
      removeTouchClick = () => document.removeEventListener("click", fire);
    } else fire();
  };

  const onFocusIn = (event: FocusEvent) => {
    if (pathInside(event) || !isTop()) return;
    dispatch("ui.focusOutside", event, options.onFocusOutside);
  };

  document.addEventListener("keydown", onKeyDown, true);
  // Registered after the opening gesture has finished bubbling.
  const timer = setTimeout(() => {
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
  }, 0);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    pop();
    clearTimeout(timer);
    removeTouchClick?.();
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("focusin", onFocusIn);
  };
}
