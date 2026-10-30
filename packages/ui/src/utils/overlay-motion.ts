// Enter and exit motion of the overlays, as Tailwind classes written out in full so the consumer's
// Tailwind build (which scans this package's dist) generates them; no stylesheet to import.
//
// Enter uses `@starting-style` (`starting:`): the surface starts transparent and a little smaller and
// transitions in. Exit uses the primitives' `data-state="closed"`: `usePresence` keeps the node
// mounted until the transition ends. Durations and easing come from the theme's `--motion-duration`
// and `--motion-ease`, so a style preset (and a `[data-motion]` override) retunes every overlay; the
// exit runs at two thirds of the enter. Under `prefers-reduced-motion` nothing moves: the transition
// is dropped and `usePresence` unmounts at once.

/** Anchored surfaces (menus, popovers, listboxes, tooltips, hover cards): grow from the anchor side. */
export const POPPER_MOTION =
  "origin-(--ui-popper-transform-origin) transition-[opacity,scale,translate] duration-(--motion-duration) ease-(--motion-ease) starting:scale-96 starting:opacity-0 starting:data-[side=bottom]:-translate-y-1 starting:data-[side=left]:translate-x-1 starting:data-[side=right]:-translate-x-1 starting:data-[side=top]:translate-y-1 data-[state=closed]:scale-96 data-[state=closed]:opacity-0 data-[state=closed]:duration-[calc(var(--motion-duration)*2/3)] data-[state=closed]:data-[side=bottom]:-translate-y-1 data-[state=closed]:data-[side=left]:translate-x-1 data-[state=closed]:data-[side=right]:-translate-x-1 data-[state=closed]:data-[side=top]:translate-y-1 motion-reduce:transition-none";

/** The scrim behind a dialog or drawer: a plain fade. */
export const OVERLAY_MOTION =
  "transition-opacity duration-(--motion-duration) ease-(--motion-ease) starting:opacity-0 data-[state=closed]:opacity-0 data-[state=closed]:duration-[calc(var(--motion-duration)*2/3)] motion-reduce:transition-none";

/** A centred dialog: fades in while it settles from 97% to full size. */
export const DIALOG_MOTION =
  "transition-[opacity,scale] duration-(--motion-duration) ease-(--motion-ease) starting:scale-97 starting:opacity-0 data-[state=closed]:scale-97 data-[state=closed]:opacity-0 data-[state=closed]:duration-[calc(var(--motion-duration)*2/3)] motion-reduce:transition-none";

/** A drawer on the inline end: slides in from that edge. */
export const DRAWER_MOTION =
  "transition-[translate] duration-(--motion-duration) ease-(--motion-ease) starting:translate-x-full data-[state=closed]:translate-x-full data-[state=closed]:duration-[calc(var(--motion-duration)*2/3)] motion-reduce:transition-none";

/** Highlight of a menu item or listbox option: 120ms at the default 180ms motion duration. */
export const ITEM_MOTION =
  "transition-colors duration-[calc(var(--motion-duration)*2/3)] motion-reduce:transition-none";

/** A bottom sheet: slides up from the bottom edge. */
export const SHEET_MOTION =
  "transition-[translate] duration-(--motion-duration) ease-(--motion-ease) starting:translate-y-full data-[state=closed]:translate-y-full data-[state=closed]:duration-[calc(var(--motion-duration)*2/3)] motion-reduce:transition-none";
