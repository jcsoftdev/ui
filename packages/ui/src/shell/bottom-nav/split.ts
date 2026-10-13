/** Slots of a bottom bar on a phone, the "More" button included. */
export const BOTTOM_NAV_MAX_SLOTS = 5;

export interface BottomNavSplit<T> {
  visible: T[];
  overflow: T[];
}

/**
 * Items shown in the bar and items moved behind "More". Everything fits when there are at most
 * `maxSlots` items; otherwise one slot is given to "More" and the rest overflow in order.
 */
export function splitBottomNavItems<T>(
  items: readonly T[],
  maxSlots: number = BOTTOM_NAV_MAX_SLOTS,
): BottomNavSplit<T> {
  const slots = Math.max(2, Math.floor(maxSlots));
  if (items.length <= slots) return { visible: [...items], overflow: [] };
  return { visible: items.slice(0, slots - 1), overflow: items.slice(slots - 1) };
}
