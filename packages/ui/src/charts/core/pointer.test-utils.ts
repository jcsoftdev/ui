export const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/**
 * A pointer that stays at one client point, re-hit-tested every frame the way the browser does
 * after layout or transform changes, firing the over/out pairs React turns into enter/leave.
 * Returns how many times the element under the pointer changed.
 */
export async function holdPointer(x: number, y: number, ms: number, onFrame: () => void) {
  let current: Element | null = null;
  let changes = 0;
  const init = { bubbles: true, clientX: x, clientY: y, pointerType: "mouse", isPrimary: true };
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const next = document.elementFromPoint(x, y);
    if (next !== current) {
      if (current)
        current.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: next }));
      if (next)
        next.dispatchEvent(new PointerEvent("pointerover", { ...init, relatedTarget: current }));
      if (current) changes++;
      current = next;
    }
    next?.dispatchEvent(new PointerEvent("pointermove", init));
    await frame();
    onFrame();
  }
  return changes;
}

/** A point just inside the inner edge of a ring shape at its middle angle, at rest. */
export function innerEdgePoint(slice: SVGPathElement, svg: SVGSVGElement) {
  const cx = svg.width.baseVal.value / 2;
  const cy = svg.height.baseVal.value / 2;
  let best: { x: number; y: number; r: number; deg: number }[] = [];
  for (let deg = 0; deg < 360; deg += 1) {
    const a = (deg * Math.PI) / 180;
    for (let r = 4; r < Math.min(cx, cy); r += 1) {
      const point = new DOMPoint(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
      if (slice.isPointInFill(point)) {
        best.push({ x: point.x, y: point.y, r, deg });
        break;
      }
    }
  }
  const mid = best.reduce((sum, p) => sum + p.deg, 0) / best.length;
  best = best.sort((a, b) => Math.abs(a.deg - mid) - Math.abs(b.deg - mid));
  const pick = best[0] as { x: number; y: number; r: number; deg: number };
  const box = svg.getBoundingClientRect();
  const a = (pick.deg * Math.PI) / 180;
  // One pixel past the first filled radius, well inside the step-out distance.
  return { x: box.left + pick.x + Math.sin(a), y: box.top + pick.y - Math.cos(a) };
}

/**
 * A press and release on `target` with the over/out pairs React turns into enter/leave: a touch
 * or pen pointer leaves the element when it lifts, a mouse leaves when it moves away.
 */
export async function tapAndLift(target: Element, pointerType: "mouse" | "touch") {
  const box = target.getBoundingClientRect();
  const init = {
    bubbles: true,
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
    pointerType,
    isPrimary: true,
  };
  target.dispatchEvent(new PointerEvent("pointerover", init));
  target.dispatchEvent(new PointerEvent("pointerdown", init));
  await frame();
  target.dispatchEvent(new PointerEvent("pointerup", init));
  target.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: null }));
  await frame();
}
