const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function stamp(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function schedule() {
  timer = setTimeout(
    () => {
      for (const listener of [...listeners]) listener();
      if (listeners.size > 0) schedule();
      else timer = undefined;
    },
    1000 - (Date.now() % 1000) + 5,
  );
}

/** Subscribes to the one-second ticker every `ElapsedTime` shares; the timer runs only while someone listens. */
export function subscribeTicker(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === undefined) schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

/** Wall clock floored to the second, stable between ticks so it is a valid external-store snapshot. */
export function getTickerSnapshot(): number {
  return stamp();
}

export function tickerListenerCount(): number {
  return listeners.size;
}
