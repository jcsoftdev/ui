/** Hover opens a tooltip for a mouse or pen, never for a finger: a tap must reach the control. */
export function opensOnHover(pointerType: string): boolean {
  return pointerType !== "touch";
}

/**
 * Focus opens a tooltip only when it came from the keyboard (`:focus-visible`) and not from a
 * press that has just closed it, so clicking a button never makes its tooltip flicker back.
 */
export function opensOnFocus({
  pressed,
  focusVisible,
}: {
  pressed: boolean;
  focusVisible: boolean;
}): boolean {
  return focusVisible && !pressed;
}
