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
 * A client point on `target` that really hits it: for an SVG shape, the point inside its fill or
 * stroke closest to its box centre (a ring's box centre is its hole); otherwise the box centre.
 */
export function pointInside(target: Element): { x: number; y: number } {
  const box = target.getBoundingClientRect();
  const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  if (!(target instanceof SVGGeometryElement)) return middle;
  const matrix = target.getScreenCTM();
  if (!matrix) return middle;
  const filled = getComputedStyle(target).fill !== "none";
  const local = target.getBBox();
  const centre = new DOMPoint(local.x + local.width / 2, local.y + local.height / 2);
  const step = Math.max(1, Math.min(local.width, local.height) / 40);
  let best: { point: DOMPoint; distance: number } | null = null;
  for (let x = local.x; x <= local.x + local.width; x += step) {
    for (let y = local.y; y <= local.y + local.height; y += step) {
      const point = new DOMPoint(x, y);
      if (!(filled && target.isPointInFill(point)) && !target.isPointInStroke(point)) continue;
      const distance = Math.hypot(x - centre.x, y - centre.y);
      if (!best || distance < best.distance) best = { point, distance };
    }
  }
  // A stroke-only shape (a ring track): its centre line.
  const onLine =
    !best && target.getTotalLength() > 0
      ? target.getPointAtLength(target.getTotalLength() / 2)
      : null;
  const found = best?.point ?? onLine;
  if (!found) return middle;
  const at = new DOMPoint(found.x, found.y).matrixTransform(matrix);
  return { x: at.x, y: at.y };
}

/**
 * A press and release at a client point the way a browser reports a tap, on the element under it:
 * `over`, `down`, `up`, then `out` (a touch or pen pointer leaves the element when it lifts).
 * A mouse press also leaves when it moves away, which `moveAway` stands for.
 */
export async function tapAt(
  point: { x: number; y: number },
  pointerType: "mouse" | "touch" = "touch",
  { travel = 0 }: { travel?: number } = {},
) {
  const target = document.elementFromPoint(point.x, point.y) ?? document.body;
  const init = {
    bubbles: true,
    clientX: point.x,
    clientY: point.y,
    pointerType,
    isPrimary: true,
    pointerId: 7,
  };
  target.dispatchEvent(new PointerEvent("pointerover", init));
  target.dispatchEvent(new PointerEvent("pointerdown", init));
  await frame();
  if (travel > 0) {
    target.dispatchEvent(
      new PointerEvent("pointermove", { ...init, clientX: point.x + travel, clientY: point.y }),
    );
    await frame();
  }
  target.dispatchEvent(
    new PointerEvent(travel > 0 ? "pointercancel" : "pointerup", {
      ...init,
      clientX: point.x + travel,
    }),
  );
  target.dispatchEvent(new PointerEvent("pointerout", { ...init, relatedTarget: null }));
  await frame();
  await frame();
  await frame();
}

/** A press and release on `target`, aimed at a point that hits it. */
export async function tapAndLift(target: Element, pointerType: "mouse" | "touch") {
  await tapAt(pointInside(target), pointerType);
}

/** A mouse pointer moved to a client point, dispatched on the element under it. */
export async function moveTo(point: { x: number; y: number }) {
  const target = document.elementFromPoint(point.x, point.y) ?? document.body;
  target.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: point.x,
      clientY: point.y,
      pointerType: "mouse",
      isPrimary: true,
    }),
  );
  await frame();
}
