export interface PressRepeatOptions {
  /** Called on the press (`count` 0), then again for every repeat while it is held. */
  onRepeat: (count: number) => void;
  /** A disabled control ignores presses. */
  disabled?: () => boolean;
  /** Milliseconds held before the first repeat. Default 400. */
  delay?: number;
  /** Milliseconds between repeats at the start. Default 80. */
  interval?: number;
  /** The interval shrinks towards this floor while the press is held. Default: `interval` (no ramp). */
  minInterval?: number;
  /** Repeats over which the interval ramps from `interval` to `minInterval`. Default 12. */
  ramp?: number;
  /** Enter and Space repeat too. Default true. */
  keyboard?: boolean;
}

export type RepeatTiming = Pick<PressRepeatOptions, "interval" | "minInterval" | "ramp">;

/** Milliseconds to wait before repeat number `count` (1 is the first repeat after the delay). */
export function repeatInterval(
  count: number,
  { interval = 80, minInterval = interval, ramp = 12 }: RepeatTiming,
): number {
  if (minInterval >= interval || ramp <= 0) return interval;
  const progress = Math.min(1, Math.max(0, (count - 1) / ramp));
  return Math.round(interval - (interval - minInterval) * progress);
}

/**
 * Hold-to-repeat for a stepper button: the pointer press fires `onRepeat(0)` at once, then
 * repeats after `delay`, speeding up if asked, until release, cancel, leave or blur. The behaviour
 * owns activation, so it suppresses the follow-up `click`. Enter and Space repeat with the key.
 * Returns the cleanup.
 */
export function createPressRepeat(target: HTMLElement, options: PressRepeatOptions): () => void {
  const { onRepeat, delay = 400 } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointerId: number | undefined;
  let count = 0;

  const stop = () => {
    clearTimeout(timer);
    timer = undefined;
    pointerId = undefined;
  };
  const schedule = (wait: number) => {
    timer = setTimeout(() => {
      if (options.disabled?.()) {
        stop();
        return;
      }
      count += 1;
      onRepeat(count);
      schedule(repeatInterval(count + 1, options));
    }, wait);
  };

  const onDown = (event: PointerEvent) => {
    if (options.disabled?.() || (event.pointerType === "mouse" && event.button !== 0)) return;
    stop();
    pointerId = event.pointerId;
    count = 0;
    onRepeat(0);
    schedule(delay);
  };
  const onEnd = (event: PointerEvent) => {
    if (event.pointerId === pointerId) stop();
  };
  const onClick = (event: MouseEvent) => {
    // Pointer clicks were handled on press; a keyboard click (detail 0) is handled by onKeyDown.
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (options.keyboard === false || options.disabled?.()) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    count = event.repeat ? count + 1 : 0;
    onRepeat(count);
  };

  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointerup", onEnd);
  target.addEventListener("pointercancel", onEnd);
  target.addEventListener("pointerleave", onEnd);
  target.addEventListener("blur", stop);
  target.addEventListener("click", onClick, true);
  target.addEventListener("keydown", onKeyDown);
  return () => {
    stop();
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointerup", onEnd);
    target.removeEventListener("pointercancel", onEnd);
    target.removeEventListener("pointerleave", onEnd);
    target.removeEventListener("blur", stop);
    target.removeEventListener("click", onClick, true);
    target.removeEventListener("keydown", onKeyDown);
  };
}
