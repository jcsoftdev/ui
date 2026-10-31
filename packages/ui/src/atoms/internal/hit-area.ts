/**
 * Invisible 44px hit target for a small control under `data-density="touch"` (and `"auto"` on a
 * coarse pointer). It is a pseudo element of `--touch-target` size centred on the control, so the
 * visual box and the layout never change; the control must be `relative`. Other densities size it
 * to 0.
 */
export const touchHitArea =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-(--touch-target) after:-translate-1/2 after:content-['']";
