/**
 * Invisible 44px hit target for a small control under `data-density="touch"`. It is a pseudo
 * element centred on the control, so the visual box and the layout never change; the control must
 * be `relative`. Default density adds nothing.
 */
export const touchHitArea =
  "relative in-data-[density=touch]:after:absolute in-data-[density=touch]:after:top-1/2 in-data-[density=touch]:after:left-1/2 in-data-[density=touch]:after:size-11 in-data-[density=touch]:after:-translate-1/2 in-data-[density=touch]:after:content-['']";
