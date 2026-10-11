export type MenuMove = "next" | "prev" | "first" | "last";

/**
 * Index to focus after `move`, over `count` enabled items. `current` is -1 when
 * focus sits on the menu itself: `next` then enters at the start, `prev` at the end.
 */
export function moveIndex(count: number, current: number, move: MenuMove, loop = true): number {
  if (count === 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  if (current < 0) return move === "next" ? 0 : count - 1;
  const next = current + (move === "next" ? 1 : -1);
  if (next >= 0 && next < count) return next;
  return loop ? (next + count) % count : current;
}
