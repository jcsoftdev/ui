/** Scroll-spy for tables of contents and scrollytelling steps. */
/**
 * Active section from the headings currently intersecting the observation band: the first visible
 * one in document order. When none is visible the previous one stays, so the highlight never
 * blinks off between two headings.
 */
export function pickActive(
  order: readonly string[],
  visible: ReadonlySet<string>,
  previous: string | null,
): string | null {
  for (const id of order) {
    if (visible.has(id)) return id;
  }
  return previous && order.includes(previous) ? previous : (order[0] ?? null);
}

export interface ScrollSpyOptions {
  /** Element ids in document order. */
  ids: readonly string[];
  /** Scroll container; defaults to the viewport. */
  root?: Element | null;
  /** Pixels reserved above the band (a sticky header). */
  offsetTop?: number;
  onChange?: (id: string | null) => void;
}

export interface ScrollSpy {
  readonly active: string | null;
  /** Forces the active id (a click on a link) and notifies. */
  set(id: string): void;
  destroy(): void;
}

/** Tracks which of `ids` sits in the top 30% of the scroll area. */
export function createScrollSpy({
  ids,
  root = null,
  offsetTop = 0,
  onChange,
}: ScrollSpyOptions): ScrollSpy {
  const visible = new Set<string>();
  let active: string | null = ids[0] ?? null;
  const update = (next: string | null) => {
    if (next === active) return;
    active = next;
    onChange?.(next);
  };
  const scope: ParentNode = root ?? document;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      update(pickActive(ids, visible, active));
    },
    { root, rootMargin: `-${offsetTop}px 0px -70% 0px`, threshold: 0 },
  );
  for (const id of ids) {
    const element = scope.querySelector(`#${CSS.escape(id)}`);
    if (element) observer.observe(element);
  }
  return {
    get active() {
      return active;
    },
    set: update,
    destroy: () => observer.disconnect(),
  };
}

export interface StepRect {
  top: number;
  bottom: number;
}

/**
 * The step a reader is on: the one containing the trigger `line` (a y coordinate). In a gap the
 * previous step stays active; above the first it is the first, below the last it is the last.
 * `-1` only when there are no steps.
 */
export function pickActiveStep(rects: readonly StepRect[], line: number): number {
  if (rects.length === 0) return -1;
  let active = 0;
  for (let i = 0; i < rects.length; i += 1) {
    const rect = rects[i] as StepRect;
    if (rect.top <= line) active = i;
    if (line >= rect.top && line < rect.bottom) return i;
  }
  return active;
}

/** Viewport coordinate of the trigger line: `offset` is its fraction (0 top, 1 bottom) of the area. */
export function triggerLine(areaTop: number, areaHeight: number, offset: number): number {
  return areaTop + areaHeight * Math.min(1, Math.max(0, offset));
}

/** Scroll progress through a step, 0 when its top meets the line and 1 when its bottom does. */
export function stepProgress(rect: StepRect, line: number): number {
  const height = rect.bottom - rect.top;
  if (height <= 0) return line >= rect.top ? 1 : 0;
  return Math.min(1, Math.max(0, (line - rect.top) / height));
}

/** The `rootMargin` that shrinks the observed area to a thin band at `offset`. */
export function lineRootMargin(offset: number): string {
  const clamped = Math.min(1, Math.max(0, offset));
  const top = Math.round(clamped * 100);
  return `-${top}% 0px -${100 - top}% 0px`;
}

export interface StepSpyOptions {
  /** Step elements in order; read on every measure so steps may come and go. */
  steps: () => readonly Element[];
  root?: Element | null;
  /** Trigger line as a fraction of the scroll area (0 top, 1 bottom). Default 0.5. */
  offset?: number;
  onChange?: (index: number, previous: number) => void;
}

export interface StepSpy {
  readonly step: number;
  /** Re-measure now (after steps changed). */
  measure(): void;
  destroy(): void;
}

/** Scrollytelling: reports the step crossing the trigger line. */
export function createStepSpy({
  steps,
  root = null,
  offset = 0.5,
  onChange,
}: StepSpyOptions): StepSpy {
  let step = 0;
  const measure = () => {
    const list = steps();
    if (list.length === 0) return;
    const area = root?.getBoundingClientRect();
    const line = triggerLine(area?.top ?? 0, area?.height ?? window.innerHeight, offset);
    const next = pickActiveStep(
      list.map((element) => element.getBoundingClientRect()),
      line,
    );
    if (next >= 0 && next !== step) {
      const previous = step;
      step = next;
      onChange?.(next, previous);
    }
  };
  const observer = new IntersectionObserver(measure, { root, rootMargin: lineRootMargin(offset) });
  for (const element of steps()) observer.observe(element);
  measure();
  return {
    get step() {
      return step;
    },
    measure,
    destroy: () => observer.disconnect(),
  };
}
